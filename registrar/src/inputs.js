"use strict";
// registrar/src/inputs.js
// Build the full circuit input object for register_parcel.circom from a
// parcels.json entry and the current SMT tree state.
//
// Usage:
//   const { buildInputs } = require("./inputs");
//   const input = await buildInputs(parcelEntry, smt, N, N_LEVELS);
//   // input is ready to pass to snarkjs.groth16.fullProve(input, wasm, zkey)
//
// Commitment (I3):
//   inner      = Poseidon(cells[0..N-1])
//   commitment = Poseidon([inner, salt])
//
// salt is a random 248-bit value generated fresh for each call.
// It is a private circuit input (not in public signals).

const crypto = require("crypto");
const { buildPoseidon } = require("circomlibjs");

const N        = 16;
const N_LEVELS = 32;

let _poseidon = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

/**
 * Generate a random 248-bit salt (fits safely in the BN128 scalar field).
 */
function randomSalt() {
  return BigInt("0x" + crypto.randomBytes(31).toString("hex"));
}

/**
 * Compute the I3 commitment in JavaScript (matches the circuit's G3).
 *   inner      = Poseidon(cells[0..N-1])
 *   commitment = Poseidon([inner, salt])
 *
 * @param {BigInt[]} cells  Padded cell array (length exactly n).
 * @param {BigInt}   salt
 */
async function computeCommitment(cells, salt) {
  const poseidon = await getPoseidon();
  const inner = poseidon.F.toObject(poseidon(cells));
  return poseidon.F.toObject(poseidon([inner, salt]));
}

/**
 * Build the circuit input for a single parcel registration.
 *
 * @param {object} parcel     Entry from geo/out/parcels.json (parcel_id, fine_cells_dec, ...)
 * @param {object} smt        Live SMT tree (result of tree.load())
 * @param {number} [n]        Circuit N (default 16)
 * @param {number} [nLevels]  Circuit N_LEVELS (default 32)
 * @returns {object}  circuitInput with all signal values as decimal strings
 */
async function buildInputs(parcel, smt, n = N, nLevels = N_LEVELS) {
  if (!parcel.fits_batch) {
    throw new Error(`Parcel ${parcel.parcel_id} has fits_batch=false; cannot register`);
  }
  if (parcel.fine_cells_dec.length > n) {
    throw new Error(
      `Parcel ${parcel.parcel_id} has ${parcel.fine_cells_dec.length} cells, circuit N=${n}`
    );
  }

  // Pad the cell list to exactly n entries (trailing zeros = inactive slots)
  const cells = parcel.fine_cells_dec.map(d => BigInt(d));
  while (cells.length < n) cells.push(0n);

  // For each active cell: do an insertCell on the tree to get witness data.
  // For inactive (0) cells: zero-fill all witness arrays.
  // IMPORTANT: the inserts are done on the live tree, advancing the root as
  // we go.  Callers must NOT use the tree for anything else concurrently.

  const siblings    = [];
  const oldKeys     = [];
  const oldValues   = [];
  const isOld0      = [];
  const currentRoot = smt.root();   // root before this parcel

  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    if (cell !== 0n) {
      // Active cell: insert into the tree and record the witness.
      const w = await smt.insertCell(cell, 1n, nLevels);
      siblings.push(w.siblings.map(s => s.toString()));
      oldKeys.push(w.oldKey.toString());
      oldValues.push(w.oldValue.toString());
      isOld0.push(w.isOld0.toString());
    } else {
      // Inactive slot: NOP -- zeros everywhere.
      siblings.push(new Array(nLevels).fill("0"));
      oldKeys.push("0");
      oldValues.push("0");
      isOld0.push("1");
    }
  }

  // Compute the final root (root after all active inserts) from the tree.
  const finalRoot = smt.root();

  // Generate salt and compute the I3 commitment in JavaScript.
  const salt = randomSalt();
  const commitment = await computeCommitment(cells, salt);

  const circuitInput = {
    initialRoot:  currentRoot.toString(),
    cells:        cells.map(c => c.toString()),
    n_cells:      String(parcel.fine_cells_dec.length),
    salt:         salt.toString(),
    siblings,
    oldKey:       oldKeys,
    oldValue:     oldValues,
    isOld0,
  };

  // Test-only metadata -- NOT circuit signals.
  circuitInput._meta = {
    expectedOldRoot:    currentRoot.toString(),
    expectedNewRoot:    finalRoot.toString(),
    expectedCommitment: commitment.toString(),
    salt:               salt.toString(),
  };

  return circuitInput;
}

module.exports = { buildInputs, computeCommitment, randomSalt, N, N_LEVELS };
