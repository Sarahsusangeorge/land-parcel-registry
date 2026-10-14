"use strict";
// registrar/test/circuit.test.js
// Sprint 2 (Maneesh): five circuit tests for register_parcel.circom.
//
// Tests:
//   1. A proves            – fixture A inserts into empty tree; proof verifies
//   2. B after A fails     – B shares cells with A; inserting occupied slot fails
//   3. C after A proves    – C shares no cells with A; proof verifies
//   4. Tampered commitment – changing a cell after building input breaks commitment
//   5. Non-prefix active   – a "hole" in the active cell list (cell[0]=X, cell[1]=0,
//                            cell[2]=Y) violates G1 and fails witness generation

const path    = require("path");
const fs      = require("fs");
const snarkjs = require("snarkjs");
const { load }        = require("../src/tree");
const { buildInputs } = require("../src/inputs");

const REPO_ROOT = path.resolve(__dirname, "../../");
// Production circuit (N=16, N_LEVELS=32).
const WASM  = path.join(REPO_ROOT, "circuits/build/register_parcel_js/register_parcel.wasm");
const ZKEY  = path.join(REPO_ROOT, "circuits/build/register_parcel_final.zkey");
const VKEY_PATH = path.join(REPO_ROOT, "circuits/build/register_parcel_vkey.json");

// Circuit dimensions – must match component main = RegisterParcel(16, 32) in register_parcel.circom
const CIRC_N        = 16;
const CIRC_N_LEVELS = 32;

const PARCELS_FILE = path.join(REPO_ROOT, "geo/out/parcels.json");
const { parcels } = JSON.parse(fs.readFileSync(PARCELS_FILE, "utf8"));
const byId = Object.fromEntries(parcels.map(p => [p.parcel_id, p]));

let vkey;
beforeAll(() => {
  vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));
});

// Strip _meta before passing to the circuit (it's not a signal).
function toCircuit(input) {
  const { _meta, ...ci } = input;
  return ci;
}

// ── helper ────────────────────────────────────────────────────────────────────
async function proveAndVerify(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    toCircuit(input), WASM, ZKEY
  );
  const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
  return { valid, proof, publicSignals };
}

// ── test 1: A proves ──────────────────────────────────────────────────────────
test("fixture A inserts into empty tree and proof verifies", async () => {
  const smt = await load(null);
  const input = await buildInputs(byId["A"], smt, CIRC_N, CIRC_N_LEVELS);
  const { valid, publicSignals } = await proveAndVerify(input);

  expect(valid).toBe(true);
  // publicSignals[0] = oldRoot = 0 (empty tree)
  expect(publicSignals[0]).toBe("0");
  // publicSignals[1] = newRoot, non-zero
  expect(BigInt(publicSignals[1])).toBeGreaterThan(0n);
  // publicSignals[2] = commitment, non-zero
  expect(BigInt(publicSignals[2])).toBeGreaterThan(0n);
}, 300_000);

// ── test 2: B after A fails ───────────────────────────────────────────────────
test("fixture B inserted after A fails (shared cells are now occupied)", async () => {
  // Register A first
  const smt = await load(null);
  await buildInputs(byId["A"], smt, CIRC_N, CIRC_N_LEVELS);   // inserts A's cells into the tree

  // Now try to build inputs for B — it shares 5 cells with A, so those inserts
  // will attempt to put a value into an already-occupied slot.
  await expect(buildInputs(byId["B"], smt, CIRC_N, CIRC_N_LEVELS)).rejects.toThrow();
}, 60_000);

// ── test 3: C after A proves ──────────────────────────────────────────────────
test("fixture C inserted after A proves (no shared cells)", async () => {
  const smt = await load(null);

  // Register A
  const inputA = await buildInputs(byId["A"], smt, CIRC_N, CIRC_N_LEVELS);
  const { valid: validA } = await proveAndVerify(inputA);
  expect(validA).toBe(true);

  // Register C — tree root is now A's newRoot
  const inputC = await buildInputs(byId["C"], smt, CIRC_N, CIRC_N_LEVELS);
  expect(inputC.initialRoot).toBe(inputA._meta.expectedNewRoot);

  const { valid: validC, publicSignals } = await proveAndVerify(inputC);
  expect(validC).toBe(true);
  expect(publicSignals[0]).toBe(inputA._meta.expectedNewRoot);  // oldRoot = A's newRoot
}, 600_000);

// ── test 4: tampered commitment fails ─────────────────────────────────────────
test("tampered cells make commitment constraint fail", async () => {
  const smt = await load(null);
  const input = await buildInputs(byId["A"], smt, CIRC_N, CIRC_N_LEVELS);

  // Replace the first cell value with a different number — the commitment
  // computed in the circuit will not match what the SMT paths prove.
  const tampered = { ...input, cells: [...input.cells] };
  tampered.cells[0] = "9999999999999999";  // bogus cell

  await expect(
    snarkjs.groth16.fullProve(toCircuit(tampered), WASM, ZKEY)
  ).rejects.toThrow();
}, 300_000);

// ── test 5: non-prefix active fails ──────────────────────────────────────────
test("non-prefix active cells violate G1 and fail witness generation", async () => {
  const smt = await load(null);
  const input = await buildInputs(byId["A"], smt, CIRC_N, CIRC_N_LEVELS);

  // Fixture A has 5 active cells at indices 0-4, then zeros.
  // Force a "hole": set cells[1] = "0" while cells[2] stays non-zero.
  // Pattern: [cell0, 0, cell2, ...] violates G1 (active-prefix gate).
  const cells = [...input.cells];
  cells[1] = "0";   // create hole — cells[2] is still non-zero

  const holed = { ...input, cells };

  await expect(
    snarkjs.groth16.fullProve(toCircuit(holed), WASM, ZKEY)
  ).rejects.toThrow();
}, 300_000);
