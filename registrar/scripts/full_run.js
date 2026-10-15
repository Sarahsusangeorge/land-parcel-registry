"use strict";
// registrar/scripts/full_run.js
//
// Registers every parcel in geo/out/parcels.json against a running Hardhat node.
// Expects the Hardhat node to be running and contracts already deployed before
// this script is called (full_run.sh handles both).
//
// Order: file order (A, B, C, P01 … P28).
// For each parcel: status, overlaps, prove_ms, gas_used (from tx receipt).
// Writes bench/results/full_run.json when done.
//
// Usage: node registrar/scripts/full_run.js [--state-file <path>] [--deployment <path>]
//        (defaults mirror demo.sh)

const { spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const REPO_ROOT    = path.resolve(__dirname, "../../");
const PARCELS_FILE = path.join(REPO_ROOT, "geo/out/parcels.json");
const STATE_FILE   = path.join(REPO_ROOT, "registrar/data/full_run_state.json");
const DEPLOY_FILE  = path.join(REPO_ROOT, "contracts/deployments/local.json");
const OUT_FILE     = path.join(REPO_ROOT, "bench/results/full_run.json");
const REGISTER_JS  = path.join(REPO_ROOT, "registrar/src/register.js");
const RPC_URL      = "http://127.0.0.1:8545";

async function main() {
  // Clean previous state
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

  const parcelsData = JSON.parse(fs.readFileSync(PARCELS_FILE, "utf8"));
  const parcels = parcelsData.parcels;

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const results  = [];
  let   n        = 0;
  const total    = parcels.length;

  process.stderr.write(`[full_run] ${total} parcels to process.\n`);

  for (const parcel of parcels) {
    n++;
    process.stderr.write(
      `[full_run] (${n}/${total}) ${parcel.parcel_id} …\n`
    );

    const proc = spawnSync("node", [
      REGISTER_JS,
      "--parcel-id",   parcel.parcel_id,
      "--state-file",  STATE_FILE,
      "--deployment",  DEPLOY_FILE,
    ], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });

    if (proc.error) throw proc.error;

    // register.js exits non-zero on fatal errors; check stderr for context
    const line = (proc.stdout || "").trim();
    if (!line) {
      const reason = (proc.stderr || "").slice(-200);
      throw new Error(`No output from register.js for ${parcel.parcel_id}. stderr: ${reason}`);
    }

    const parsed = JSON.parse(line);

    const entry = {
      parcel_id: parsed.parcel_id,
      status:    parsed.status,
      overlaps:  parsed.overlaps  || [],
      prove_ms:  parsed.prove_ms  ?? null,
      gas_used:  null,
    };

    if (parsed.status === "registered" && parsed.tx_hash) {
      const receipt = await provider.getTransactionReceipt(parsed.tx_hash);
      entry.gas_used = Number(receipt.gasUsed);
    }

    const detail = [
      parsed.status,
      parsed.prove_ms != null ? `${parsed.prove_ms} ms` : null,
      entry.gas_used  != null ? `gas ${entry.gas_used}` : null,
      parsed.overlaps && parsed.overlaps.length
        ? `overlaps [${parsed.overlaps.join(", ")}]` : null,
    ].filter(Boolean).join(", ");

    process.stderr.write(`[full_run]   → ${detail}\n`);
    process.stdout.write(JSON.stringify(entry) + "\n");
    results.push(entry);
  }

  // ── statistics ────────────────────────────────────────────────────────────────
  const registered  = results.filter(r => r.status === "registered");
  const overlapList = results.filter(r => r.status === "overlap");
  const errors      = results.filter(r => r.status === "error");

  const proveTimes  = registered.map(r => r.prove_ms).filter(v => v != null);
  const gasValues   = registered.map(r => r.gas_used).filter(v => v != null);

  function mean(arr) { return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length); }

  const stats = {
    total:      results.length,
    registered: registered.length,
    overlaps:   overlapList.length,
    errors:     errors.length,
    prove_ms: {
      mean: mean(proveTimes),
      max:  Math.max(...proveTimes),
      min:  Math.min(...proveTimes),
    },
    gas_used: {
      mean: mean(gasValues),
      max:  Math.max(...gasValues),
      min:  Math.min(...gasValues),
    },
  };

  const output = {
    meta: {
      run_at:       new Date().toISOString(),
      hardware:     "MacBook Pro M4 Pro, 24 GB RAM",
      parcels_file: "geo/out/parcels.json",
      circuit:      "register_parcel.circom N=16 N_LEVELS=32",
      verifier:     "Groth16Verifier.sol (production zkey)",
      network:      "Hardhat local node",
      rpc:          RPC_URL,
    },
    stats,
    results,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n");

  process.stderr.write(`\n[full_run] ── Summary ─────────────────────────────────\n`);
  process.stderr.write(`[full_run]   Total:      ${stats.total}\n`);
  process.stderr.write(`[full_run]   Registered: ${stats.registered}\n`);
  process.stderr.write(`[full_run]   Overlaps:   ${stats.overlaps}\n`);
  process.stderr.write(`[full_run]   Errors:     ${stats.errors}\n`);
  process.stderr.write(`[full_run]   Prove ms:   mean ${stats.prove_ms.mean}, max ${stats.prove_ms.max}, min ${stats.prove_ms.min}\n`);
  process.stderr.write(`[full_run]   Gas used:   mean ${stats.gas_used.mean}, max ${stats.gas_used.max}, min ${stats.gas_used.min}\n`);
  process.stderr.write(`[full_run]   Written to: bench/results/full_run.json\n`);
}

main().catch(err => {
  process.stderr.write(`[full_run] FATAL: ${err.message || err}\n`);
  process.exit(1);
});
