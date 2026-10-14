"use strict";
// registrar/src/register.js  —  I4 CLI
//
// Registers one land parcel against the on-chain LandRegistry, or runs in
// --dry-run mode (prove but do not submit).
//
// Usage:
//   node register.js --parcel-id <id> [options]
//
// Options:
//   --parcel-id <id>        Parcel to register (required)
//   --dry-run               Prove; do not submit to chain
//   --state-file <path>     Tree+index state (default: registrar/data/state.json)
//   --deployment <path>     contracts/deployments/local.json (default path)
//   --parcels <path>        geo/out/parcels.json (default path)
//   --rpc <url>             JSON-RPC URL (default: http://127.0.0.1:8545)
//   --owner <addr>          Token recipient (default: admin from deployment)
//   --registrar-key <key>   Registrar signer private key (default: Hardhat acct 1)
//
// Output (exactly one JSON line to stdout):
//   {status:"overlap",    parcel_id, hits:[...]}
//   {status:"dry-run",    parcel_id, oldRoot, newRoot, commitment,
//                         a, b, c, pubSignals, coarseCells, metadataURI, proveMs}
//   {status:"registered", parcel_id, tokenId, txHash,
//                         oldRoot, newRoot, commitment, coarseCells, metadataURI, proveMs}
//   {status:"error",      parcel_id, reason}

const path    = require("path");
const fs      = require("fs");
const snarkjs = require("snarkjs");
const { ethers } = require("ethers");
const { load }        = require("./tree");
const { buildInputs } = require("./inputs");

// ── build artifact paths ──────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, "../../");
const WASM     = path.join(REPO_ROOT, "circuits/build/register_parcel_js/register_parcel.wasm");
const ZKEY     = path.join(REPO_ROOT, "circuits/build/register_parcel_final.zkey");
const VKEY_PATH = path.join(REPO_ROOT, "circuits/build/register_parcel_vkey.json");
const ABI_PATH  = path.join(REPO_ROOT, "contracts/artifacts/contracts/LandRegistry.sol/LandRegistry.json");

// ── defaults ──────────────────────────────────────────────────────────────────
const PARCELS_DEFAULT  = path.join(REPO_ROOT, "geo/out/parcels.json");
const STATE_DEFAULT    = path.join(REPO_ROOT, "registrar/data/state.json");
const DEPLOY_DEFAULT   = path.join(REPO_ROOT, "contracts/deployments/local.json");

// Hardhat deterministic private keys (account indices 0 and 1)
const HH_ADMIN_KEY     = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const HH_REGISTRAR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const N        = 16;
const N_LEVELS = 32;

// ── arg parsing ───────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    parcelId:     null,
    dryRun:       false,
    stateFile:    STATE_DEFAULT,
    deployment:   DEPLOY_DEFAULT,
    parcelsFile:  PARCELS_DEFAULT,
    rpcUrl:       null,
    ownerAddr:    null,
    registrarKey: HH_REGISTRAR_KEY,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--parcel-id":      opts.parcelId     = args[++i]; break;
      case "--dry-run":        opts.dryRun        = true;      break;
      case "--state-file":     opts.stateFile     = args[++i]; break;
      case "--deployment":     opts.deployment    = args[++i]; break;
      case "--parcels":        opts.parcelsFile   = args[++i]; break;
      case "--rpc":            opts.rpcUrl        = args[++i]; break;
      case "--owner":          opts.ownerAddr     = args[++i]; break;
      case "--registrar-key":  opts.registrarKey  = args[++i]; break;
    }
  }
  return opts;
}

// ── state helpers ─────────────────────────────────────────────────────────────
function loadState(stateFile) {
  if (fs.existsSync(stateFile)) {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  }
  return { tree: null, cellIndex: {}, registrations: [] };
}

function saveState(stateFile, state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n");
}

// ── proof helpers ─────────────────────────────────────────────────────────────

/**
 * Convert snarkjs proof to the arrays the Solidity verifier expects.
 * G2 (pi_b) has its two field elements swapped per the EVM pairing convention.
 * Returns BigInt values, ready for an ethers v6 contract call.
 */
function proofToCalldata(proof) {
  return {
    a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    b: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
  };
}

/**
 * Same reversal but keeps values as decimal strings for JSON fixtures.
 */
function proofToFixtureFields(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

// ── overlap check ─────────────────────────────────────────────────────────────
async function checkOverlap(smt, cellIndex, fineCellsDec) {
  const hits = new Set();
  for (const cellDec of fineCellsDec) {
    const { found } = await smt.findCell(BigInt(cellDec));
    if (found) {
      const owner = cellIndex[cellDec] || "unknown";
      hits.add(owner);
    }
  }
  return hits;
}

// ── prove ─────────────────────────────────────────────────────────────────────
async function proveParcel(parcel, smt) {
  const input = await buildInputs(parcel, smt, N, N_LEVELS);
  const { _meta, ...circuitInput } = input;

  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput, WASM, ZKEY
  );
  const proveMs = Date.now() - t0;
  return { proof, publicSignals, proveMs };
}

// ── tx submission ─────────────────────────────────────────────────────────────
async function submitTx(registry, ownerAddr, proof, publicSignals, coarseCellsDec, metadataURI) {
  const { a, b, c } = proofToCalldata(proof);
  const pub = [
    BigInt(publicSignals[0]),
    BigInt(publicSignals[1]),
    BigInt(publicSignals[2]),
  ];
  const coarseBig = coarseCellsDec.map(d => BigInt(d));

  const tx = await registry.registerParcel(
    ownerAddr,
    a, b, c,
    pub,
    coarseBig,
    metadataURI,
  );
  return tx.wait();
}

// ── extract tokenId from ParcelRegistered event ───────────────────────────────
function extractTokenId(receipt, iface) {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === "ParcelRegistered") {
        return Number(parsed.args.tokenId);
      }
    } catch (_) { /* non-matching log */ }
  }
  return null;
}

// ── is StaleRoot error ────────────────────────────────────────────────────────
function isStaleRoot(err) {
  return (
    (err.revert && err.revert.name === "StaleRoot") ||
    (err.errorName === "StaleRoot") ||
    String(err).includes("StaleRoot")
  );
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  if (!opts.parcelId) {
    emit({ status: "error", reason: "--parcel-id is required" });
    process.exit(1);
  }

  // Load parcel data
  const parcelsData = JSON.parse(fs.readFileSync(opts.parcelsFile, "utf8"));
  const byId  = Object.fromEntries(parcelsData.parcels.map(p => [p.parcel_id, p]));
  const parcel = byId[opts.parcelId];
  if (!parcel) {
    emit({ status: "error", parcel_id: opts.parcelId,
           reason: `parcel ${opts.parcelId} not found in ${opts.parcelsFile}` });
    process.exit(1);
  }

  const metadataURI = `ipfs://land-parcel-registry/${opts.parcelId}`;

  // ── step 1: load state + SMT ────────────────────────────────────────────────
  let state = loadState(opts.stateFile);
  let smt   = await load(state.tree);

  // ── step 2: overlap check ───────────────────────────────────────────────────
  let hits = await checkOverlap(smt, state.cellIndex, parcel.fine_cells_dec);
  if (hits.size > 0) {
    emit({ status: "overlap", parcel_id: opts.parcelId, hits: [...hits] });
    return;
  }

  // ── step 3: prove ───────────────────────────────────────────────────────────
  let { proof, publicSignals, proveMs } = await proveParcel(parcel, smt);

  // Always verify locally before doing anything else
  const vkey  = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!valid) {
    emit({ status: "error", parcel_id: opts.parcelId, reason: "proof verification failed" });
    return;
  }

  // ── step 4: dry-run exit ────────────────────────────────────────────────────
  if (opts.dryRun) {
    emit({
      status:      "dry-run",
      parcel_id:   opts.parcelId,
      oldRoot:     publicSignals[0],
      newRoot:     publicSignals[1],
      commitment:  publicSignals[2],
      ...proofToFixtureFields(proof),
      pubSignals:  publicSignals.slice(0, 3),
      coarseCells: parcel.coarse_cells_dec,
      metadataURI,
      proveMs,
    });
    return;
  }

  // ── step 5: load deployment, build contract handle ──────────────────────────
  const deployment = JSON.parse(fs.readFileSync(opts.deployment, "utf8"));
  const rpcUrl     = opts.rpcUrl || "http://127.0.0.1:8545";
  const { abi }    = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));

  const provider  = new ethers.JsonRpcProvider(rpcUrl);
  const wallet    = new ethers.Wallet(opts.registrarKey, provider);
  const registry  = new ethers.Contract(deployment.registry, abi, wallet);
  const iface     = new ethers.Interface(abi);
  const ownerAddr = opts.ownerAddr || deployment.admin;

  // ── step 6: submit tx (with one StaleRoot rebuild) ──────────────────────────
  let receipt;
  let activeSmt   = smt;
  let activeState = state;

  try {
    receipt = await submitTx(
      registry, ownerAddr, proof, publicSignals,
      parcel.coarse_cells_dec, metadataURI
    );
  } catch (err) {
    if (!isStaleRoot(err)) {
      emit({ status: "error", parcel_id: opts.parcelId, reason: err.message || String(err) });
      return;
    }

    // StaleRoot: reload fresh state, re-check overlap, re-prove once
    activeState = loadState(opts.stateFile);
    activeSmt   = await load(activeState.tree);

    hits = await checkOverlap(activeSmt, activeState.cellIndex, parcel.fine_cells_dec);
    if (hits.size > 0) {
      emit({ status: "overlap", parcel_id: opts.parcelId, hits: [...hits] });
      return;
    }

    ({ proof, publicSignals, proveMs } = await proveParcel(parcel, activeSmt));

    const valid2 = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    if (!valid2) {
      emit({ status: "error", parcel_id: opts.parcelId,
             reason: "proof verification failed on StaleRoot rebuild" });
      return;
    }

    try {
      receipt = await submitTx(
        registry, ownerAddr, proof, publicSignals,
        parcel.coarse_cells_dec, metadataURI
      );
    } catch (err2) {
      emit({ status: "error", parcel_id: opts.parcelId,
             reason: `StaleRoot (rebuild also reverted: ${err2.message || String(err2)})` });
      return;
    }
  }

  // ── step 7: tx confirmed — save state ───────────────────────────────────────
  const tokenId = extractTokenId(receipt, iface);

  for (const cellDec of parcel.fine_cells_dec) {
    activeState.cellIndex[cellDec] = opts.parcelId;
  }
  activeState.tree = activeSmt.save();
  if (!activeState.registrations) activeState.registrations = [];
  activeState.registrations.push({
    parcel_id:    opts.parcelId,
    tokenId,
    txHash:       receipt.hash,
    commitment:   publicSignals[2],
    registeredAt: new Date().toISOString(),
  });
  saveState(opts.stateFile, activeState);

  emit({
    status:      "registered",
    parcel_id:   opts.parcelId,
    tokenId,
    txHash:      receipt.hash,
    oldRoot:     publicSignals[0],
    newRoot:     publicSignals[1],
    commitment:  publicSignals[2],
    coarseCells: parcel.coarse_cells_dec,
    metadataURI,
    proveMs,
  });
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

// snarkjs keeps a background timer alive; exit explicitly once main() settles.
main()
  .then(() => process.exit(0))
  .catch(err => {
    emit({ status: "error", reason: err.message || String(err) });
    process.exit(1);
  });
