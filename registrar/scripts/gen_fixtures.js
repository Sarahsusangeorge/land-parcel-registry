"use strict";
// registrar/scripts/gen_fixtures.js
//
// Generates the three proof fixtures that Sarah's e2e tests require.
// Does NOT need a running Hardhat node; it only uses snarkjs + the local tree.
//
// Writes to contracts/test/fixtures/:
//   A.json          – valid registration of A on an empty tree
//   C_after_A.json  – valid registration of C built on the root after A
//   B_overlap.json  – registrar output for B: status "overlap", hits ["A"]
//
// Each proof fixture is verified against the production vkey before writing.
// Run: node registrar/scripts/gen_fixtures.js

const path    = require("path");
const fs      = require("fs");
const snarkjs = require("snarkjs");
const { load }        = require("../src/tree");
const { buildInputs } = require("../src/inputs");

const REPO_ROOT  = path.resolve(__dirname, "../../");
const WASM       = path.join(REPO_ROOT, "circuits/build/register_parcel_js/register_parcel.wasm");
const ZKEY       = path.join(REPO_ROOT, "circuits/build/register_parcel_final.zkey");
const VKEY_PATH  = path.join(REPO_ROOT, "circuits/build/register_parcel_vkey.json");
const PARCELS    = path.join(REPO_ROOT, "geo/out/parcels.json");
const FIXTURE_DIR = path.join(REPO_ROOT, "contracts/test/fixtures");

const N        = 16;
const N_LEVELS = 32;

/**
 * Proof → fixture fields (string decimals, pi_b swapped for Solidity verifier).
 */
function proofFields(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
  };
}

async function main() {
  const { parcels } = JSON.parse(fs.readFileSync(PARCELS, "utf8"));
  const byId = Object.fromEntries(parcels.map(p => [p.parcel_id, p]));
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));

  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  // ── side index: cell_dec → parcel_id ────────────────────────────────────────
  const cellIndex = {};

  // ── shared SMT — cells accumulate as we go ──────────────────────────────────
  const smt = await load(null);

  // ── fixture A: empty tree ───────────────────────────────────────────────────
  console.error("Generating A.json (prove)…");
  const inputA = await buildInputs(byId["A"], smt, N, N_LEVELS);
  const { _meta: _mA, ...ciA } = inputA;

  const t0 = Date.now();
  const { proof: pA, publicSignals: psA } = await snarkjs.groth16.fullProve(ciA, WASM, ZKEY);
  const msA = Date.now() - t0;

  const validA = await snarkjs.groth16.verify(vkey, psA, pA);
  if (!validA) throw new Error("A proof did not verify against production vkey");
  console.error(`A: verified ✓  (${msA} ms)  oldRoot=${psA[0]}  newRoot=${psA[1]}`);

  // Record A's cells in the side index
  for (const cellDec of byId["A"].fine_cells_dec) {
    cellIndex[cellDec] = "A";
  }

  const fixtureA = {
    ...proofFields(pA),
    pubSignals:  psA.slice(0, 3),
    coarseCells: byId["A"].coarse_cells_dec,
    metadataURI: `ipfs://land-parcel-registry/A`,
  };
  fs.writeFileSync(
    path.join(FIXTURE_DIR, "A.json"),
    JSON.stringify(fixtureA, null, 2) + "\n"
  );
  console.error("Wrote A.json");

  // ── fixture B_overlap: B shares cells with A ─────────────────────────────────
  // At this point smt has A's cells; just run findCell checks.
  console.error("\nChecking B overlap…");
  const hits = new Set();
  for (const cellDec of byId["B"].fine_cells_dec) {
    const { found } = await smt.findCell(BigInt(cellDec));
    if (found) {
      const owner = cellIndex[cellDec] || "unknown";
      hits.add(owner);
    }
  }
  if (hits.size === 0) throw new Error("Expected B to overlap with A but no overlap found");
  console.error(`B overlaps with: ${[...hits].join(", ")} ✓`);

  const fixtureB = {
    status:     "overlap",
    parcel_id:  "B",
    overlaps:   [...hits],
  };
  fs.writeFileSync(
    path.join(FIXTURE_DIR, "B_overlap.json"),
    JSON.stringify(fixtureB, null, 2) + "\n"
  );
  console.error("Wrote B_overlap.json");

  // ── fixture C_after_A: C on tree that already has A ──────────────────────────
  console.error("\nGenerating C_after_A.json (prove)…");
  const inputC = await buildInputs(byId["C"], smt, N, N_LEVELS);
  const { _meta: _mC, ...ciC } = inputC;

  // Verify C's initialRoot equals A's newRoot (proves correct chaining)
  if (inputC.initialRoot !== psA[1]) {
    throw new Error(
      `C initialRoot mismatch: expected ${psA[1]}, got ${inputC.initialRoot}`
    );
  }

  const t1 = Date.now();
  const { proof: pC, publicSignals: psC } = await snarkjs.groth16.fullProve(ciC, WASM, ZKEY);
  const msC = Date.now() - t1;

  const validC = await snarkjs.groth16.verify(vkey, psC, pC);
  if (!validC) throw new Error("C proof did not verify against production vkey");
  console.error(`C: verified ✓  (${msC} ms)  oldRoot=${psC[0]}  newRoot=${psC[1]}`);

  if (psC[0] !== psA[1]) {
    throw new Error(`C oldRoot (${psC[0]}) ≠ A newRoot (${psA[1]})`);
  }

  const fixtureC = {
    ...proofFields(pC),
    pubSignals:  psC.slice(0, 3),
    coarseCells: byId["C"].coarse_cells_dec,
    metadataURI: `ipfs://land-parcel-registry/C`,
  };
  fs.writeFileSync(
    path.join(FIXTURE_DIR, "C_after_A.json"),
    JSON.stringify(fixtureC, null, 2) + "\n"
  );
  console.error("Wrote C_after_A.json");

  console.error(`\nAll fixtures generated and verified.`);
  console.error(`  A prove time  : ${msA} ms`);
  console.error(`  C prove time  : ${msC} ms`);

  // Machine-readable summary for bench
  console.log(JSON.stringify({
    fixtureA_proveMs: msA,
    fixtureC_proveMs: msC,
    A_oldRoot: psA[0],
    A_newRoot: psA[1],
    C_oldRoot: psC[0],
    C_newRoot: psC[1],
  }));
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error("FATAL:", err.message); process.exit(1); });
