"use strict";
// Quick sanity-check: build inputs for fixture A and compute a witness.
// Does not need the zkey — just checks that G1-G5 constraints are satisfied.
const path    = require("path");
const fs      = require("fs");
const snarkjs = require("snarkjs");
const { load }        = require("../src/tree");
const { buildInputs } = require("../src/inputs");

const REPO_ROOT = path.resolve(__dirname, "../../");
const WASM = path.join(REPO_ROOT, "circuits/build/register_parcel_js/register_parcel.wasm");
const PARCELS_FILE = path.join(REPO_ROOT, "geo/out/parcels.json");
const { parcels } = JSON.parse(fs.readFileSync(PARCELS_FILE, "utf8"));
const byId = Object.fromEntries(parcels.map(p => [p.parcel_id, p]));

(async () => {
  const smt = await load(null);
  const input = await buildInputs(byId["A"], smt);
  console.log("Input built. cells:", input.cells.slice(0,6));
  console.log("initialRoot:", input.initialRoot);

  // Strip test-only _meta before passing to the circuit
  const { _meta, ...circuitInput } = input;
  // Calculate witness (will throw if constraints fail)
  const wtnsOutput = { type: "mem" };
  await snarkjs.wtns.calculate(circuitInput, WASM, wtnsOutput);
  console.log("Witness OK");
  console.log("publicSignals[0..2] from witness should be [oldRoot, newRoot, commitment]");
  console.log("Expected oldRoot:", input._meta.expectedOldRoot);
  console.log("Expected newRoot:", input._meta.expectedNewRoot);
})().catch(e => { console.error("FAIL:", e.message || e); process.exit(1); });
