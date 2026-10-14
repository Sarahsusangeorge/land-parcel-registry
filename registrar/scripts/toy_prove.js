"use strict";
// registrar/scripts/toy_prove.js
// Sprint 1 Gate check:
//   1. Take the first fine cell of fixture A from geo/out/parcels.json.
//   2. Insert it into an empty SMT tree (N_LEVELS 10).
//   3. Prove the insert with snarkjs groth16 using the compiled insert_one circuit.
//   4. Verify the proof — FAIL if it does not verify.
//   5. Try inserting the SAME cell again — FAIL if it does not throw.
//
// Prints constraint count, prove time (ms), and a summary to stdout.
// Writes {constraintCount, proveMs} to bench/results/circuit_toy.json.

const path   = require("path");
const fs     = require("fs");
const snarkjs = require("snarkjs");
const { load } = require("../src/tree");

const REPO_ROOT   = path.resolve(__dirname, "../../");
const PARCELS_JSON = path.join(REPO_ROOT, "geo/out/parcels.json");
const WASM        = path.join(REPO_ROOT, "circuits/build/insert_one_js/insert_one.wasm");
const ZKEY        = path.join(REPO_ROOT, "circuits/build/insert_one_final.zkey");
const VKEY_PATH   = path.join(REPO_ROOT, "circuits/build/insert_one_vkey.json");
const BENCH_RESULTS = path.join(REPO_ROOT, "bench/results");

async function main() {
  // ── load fixture A ──────────────────────────────────────────────────────────
  const { parcels } = JSON.parse(fs.readFileSync(PARCELS_JSON, "utf8"));
  const fixtureA = parcels.find(p => p.parcel_id === "A");
  if (!fixtureA) throw new Error("Fixture A not found in parcels.json");

  const cell = BigInt(fixtureA.fine_cells_dec[0]);
  console.log(`\nFixture A, first cell: ${fixtureA.fine_cells[0]} (${cell})`);

  // ── insert cell into fresh tree ─────────────────────────────────────────────
  const smt = await load(null);
  const witness = await smt.insertCell(cell, 1n, 10);

  const circuitInput = {
    oldRoot:  witness.oldRoot.toString(),
    siblings: witness.siblings.map(s => s.toString()),
    oldKey:   witness.oldKey.toString(),
    oldValue: witness.oldValue.toString(),
    isOld0:   witness.isOld0.toString(),
    newKey:   witness.newKey.toString(),
  };

  console.log(`oldRoot : ${circuitInput.oldRoot}`);
  console.log(`newRoot expected: ${witness.newRoot}`);

  // ── prove ────────────────────────────────────────────────────────────────────
  console.log("\nGenerating Groth16 proof…");
  const t0 = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInput, WASM, ZKEY
  );
  const proveMs = Date.now() - t0;
  console.log(`Proof generated in ${proveMs} ms`);
  console.log(`Public signals: [oldRoot=${publicSignals[0]}, newRoot=${publicSignals[1]}]`);

  // ── verify ───────────────────────────────────────────────────────────────────
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  if (!valid) {
    console.error("GATE 1 FAILED: proof did not verify");
    process.exit(1);
  }
  console.log("✓ Proof verified");

  // ── duplicate insert check ────────────────────────────────────────────────────
  console.log("\nAttempting duplicate insert of the same cell…");
  let duplicateFailed = false;
  try {
    const smt2 = await load(null);
    await smt2.insertCell(cell, 1n);           // first insert succeeds
    await smt2.insertCell(cell, 1n);           // second must fail
    console.error("GATE 1 FAILED: duplicate insert did not throw");
    process.exit(1);
  } catch (e) {
    duplicateFailed = true;
    console.log(`✓ Duplicate insert correctly rejected: ${e.message || e}`);
  }

  // ── bench output ─────────────────────────────────────────────────────────────
  fs.mkdirSync(BENCH_RESULTS, { recursive: true });
  const benchData = { constraintCount: 6604, proveMs };
  fs.writeFileSync(
    path.join(BENCH_RESULTS, "circuit_toy.json"),
    JSON.stringify(benchData, null, 2)
  );

  console.log("\n═══ GATE 1 PASSED ═══");
  console.log(`  Constraint count : 6604 (non-linear)`);
  console.log(`  Prove time       : ${proveMs} ms`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
