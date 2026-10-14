"use strict";
// registrar/src/tree.js
// Thin wrapper around the circomlibjs in-memory sparse Merkle tree.
// The tree uses Poseidon hashing, matching the SMTProcessor circuit.
//
// API
//   load(snapshot)                      – restore a saved tree or start fresh
//   smt.insertCell(cell, id, nLevels)   – insert H3 cell; returns circuit witness
//   smt.findCell(cell)                  – lookup; returns { found, value }
//   smt.save()                          – serialise for storage
//   smt.root()                          – current root as BigInt

const { newMemEmptyTrie, buildPoseidon } = require("circomlibjs");

let _poseidon = null;
async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

/**
 * key = Poseidon([cell_decimal])
 * @param {BigInt} cell
 */
async function cellKey(cell) {
  const poseidon = await getPoseidon();
  return poseidon.F.toObject(poseidon([cell]));
}

/**
 * Restore a sparse Merkle tree or create a fresh empty one.
 * @param {object|null} snapshot  Output of a prior save(), or null.
 */
async function load(snapshot) {
  const poseidon = await getPoseidon();
  const F = poseidon.F;
  const tree = await newMemEmptyTrie();

  // Track (key→value) entries so we can serialise the tree later.
  // Keys and values are stored as BigInts (field elements).
  const entries = new Map();  // key (BigInt) → value (BigInt)

  if (snapshot && snapshot.entries) {
    for (const [keyHex, valueHex] of snapshot.entries) {
      const k = BigInt(keyHex);
      const v = BigInt(valueHex);
      await tree.insert(k, v);
      entries.set(k, v);
    }
  }

  return wrapTree(tree, entries, F);
}

function wrapTree(tree, entries, F) {
  let currentRoot = F.toObject(tree.root);   // BigInt root, updated on each insert

  return {
    _tree: tree,  // expose for direct root access in inputs.js

    /** Current SMT root as a BigInt field element. */
    root() {
      return currentRoot;
    },

    /**
     * Insert a fine H3 cell into the SMT.
     * @param {BigInt|string} cell      H3 cell decimal value.
     * @param {BigInt|number} parcelId  Value to store.
     * @param {number} nLevels          Circuit N_LEVELS; siblings padded to this.
     * @returns {object}  Circuit witness: { fnc, oldRoot, oldKey, oldValue,
     *                                       isOld0, siblings[nLevels], newRoot, newKey }
     */
    async insertCell(cell, parcelId, nLevels) {
      const poseidon = await getPoseidon();
      const Fp = poseidon.F;
      const key = await cellKey(BigInt(cell));
      const val = BigInt(parcelId);
      const res = await tree.insert(key, val);  // throws "Key already exists" if occupied

      entries.set(key, val);

      const siblings = res.siblings.map(s => Fp.toObject(s));
      if (nLevels !== undefined) {
        while (siblings.length < nLevels) siblings.push(0n);
      }

      const witness = {
        fnc:      res.fnc,
        oldRoot:  Fp.toObject(res.oldRoot),
        oldKey:   Fp.toObject(res.oldKey),
        oldValue: Fp.toObject(res.oldValue),
        isOld0:   res.isOld0 ? 1n : 0n,
        siblings,
        newRoot:  Fp.toObject(res.newRoot),
        newKey:   key,
      };
      currentRoot = witness.newRoot;
      return witness;
    },

    /**
     * Look up a cell.
     * @param {BigInt|string} cell
     * @returns {{ found: boolean, value: BigInt|null }}
     */
    async findCell(cell) {
      const poseidon = await getPoseidon();
      const Fp = poseidon.F;
      const key = await cellKey(BigInt(cell));
      const res = await tree.find(key);
      return {
        found: res.found,
        value: res.found ? Fp.toObject(res.foundValue) : null,
      };
    },

    /**
     * Serialise the current tree for storage.
     * Entries are [key, value] pairs as 0x-hex strings.
     */
    save() {
      const out = [];
      for (const [k, v] of entries) {
        out.push([`0x${k.toString(16)}`, `0x${v.toString(16)}`]);
      }
      return { root: `0x${currentRoot.toString(16)}`, entries: out };
    },
  };
}

module.exports = { load, cellKey, getPoseidon };
