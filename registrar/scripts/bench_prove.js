"use strict";
// registrar/scripts/bench_prove.js
// Measure Groth16 prove time for register_parcel (production circuit) over N_RUNS.
// Usage: node registrar/scripts/bench_prove.js [n_runs]
// Outputs: mean and max prove time in ms, proof size in bytes.

const path    = require("path");
const fs      = require("fs");
const snarkjs = require("snarkjs");
const { load }        = require("../src/tree");
const { buildInputs } = require("../src/inputs");

const REPO_ROOT = path.resolve(__dirname, "../../");
const WASM  = path.join(REPO_ROOT, "circuits/build/register_parcel_js/register_parcel.wasm");
const ZKEY  = path.join(REPO_ROOT, "circuits/build/register_parcel_final.zkey");
const VKEY_PATH = path.join(REPO_ROOT, "circuits/build/register_parcel_vkey.json");
const PARCELS_FILE = path.join(REPO_ROOT, "geo/out/parcels.json");

const N_RUNS = parseInt(process.argv[2] || "3", 10);
const N        = 16;
const N_LEVELS = 32;

async function main() {
  const { parcels } = JSON.parse(fs.readFileSync(PARCELS_FILE, "utf8"));
  const byId = Object.fromEntries(parcels.map(p => [p.parcel_id, p]));
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));

  const times = [];
  let proofBytes = 0;

  for (let run = 1; run <= N_RUNS; run++) {
    // Fresh SMT each run so rootChain is consistent.
    const smt = await load(null);
    const input = await buildInputs(byId["A"], smt, N, N_LEVELS);
    const { _meta, ...ci } = input;

    const t0 = Date.now();
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(ci, WASM, ZKEY);
    const ms = Date.now() - t0;
    times.push(ms);

    const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    if (!valid) throw new Error(`Run ${run}: proof did not verify`);

    const proofJson = JSON.stringify(proof);
    proofBytes = Buffer.byteLength(proofJson, "utf8");

    console.log(`Run ${run}/${N_RUNS}: ${ms} ms  valid=${valid}`);
  }

  const mean = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max  = Math.max(...times);
  const zkeyBytes = fs.statSync(ZKEY).size;

  console.log("---");
  console.log(`Prove time: mean=${mean} ms  max=${max} ms  runs=${N_RUNS}`);
  console.log(`Proof size: ${proofBytes} bytes`);
  console.log(`zkey size:  ${(zkeyBytes / 1024 / 1024).toFixed(1)} MB`);

  // Machine-readable for bench update
  console.log(JSON.stringify({ mean, max, proofBytes, zkeyMB: +(zkeyBytes / 1024 / 1024).toFixed(1) }));
}

main().catch(e => { console.error(e.message); process.exit(1); });
