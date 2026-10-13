"use strict";
// registrar/src/tree.js
// Thin wrapper around the circomlibjs in-memory sparse Merkle tree.
// The tree uses Poseidon hashing, matching the SMTProcessor circuit.
//
// API
//   load(snapshot)               – restore a saved tree (or start empty)
//   smt.insertCell(cell, id, nLevels)  – insert H3 cell; returns circuit witness
//   smt.findCell(cell)           – lookup; returns { found, value }
//   smt.save()                   – serialise for storage

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
  const tree = await newMemEmptyTrie();

  if (snapshot && snapshot.entries) {
    for (const [keyHex, valueHex] of snapshot.entries) {
      await tree.insert(BigInt(keyHex), BigInt(valueHex));
    }
  }

  return wrapTree(tree);
}

function wrapTree(tree) {
  return {
    _tree: tree,

    /**
     * Insert a fine H3 cell into the SMT.
     * @param {BigInt|string} cell      H3 cell decimal value.
     * @param {BigInt|number} parcelId  Value to store (e.g. 1n or a parcel index).
     * @param {number} nLevels          Circuit N_LEVELS; siblings are padded to this.
     * @returns {object}  Circuit witness fields:
     *   { fnc, oldRoot, oldKey, oldValue, isOld0, siblings[nLevels], newRoot, newKey }
     */
    async insertCell(cell, parcelId, nLevels) {
      const poseidon = await getPoseidon();
      const F = poseidon.F;
      const key = await cellKey(BigInt(cell));
      const res = await tree.insert(key, BigInt(parcelId));

      const siblings = res.siblings.map(s => F.toObject(s));
      if (nLevels !== undefined) {
        while (siblings.length < nLevels) siblings.push(0n);
      }

      return {
        fnc:      res.fnc,
        oldRoot:  F.toObject(res.oldRoot),
        oldKey:   F.toObject(res.oldKey),
        oldValue: F.toObject(res.oldValue),
        isOld0:   res.isOld0 ? 1n : 0n,
        siblings,
        newRoot:  F.toObject(res.newRoot),
        newKey:   key,
      };
    },

    /**
     * Look up a cell.
     * @param {BigInt|string} cell
     * @returns {{ found: boolean, value: BigInt|null }}
     */
    async findCell(cell) {
      const poseidon = await getPoseidon();
      const F = poseidon.F;
      const key = await cellKey(BigInt(cell));
      const res = await tree.find(key);
      return {
        found: res.found,
        value: res.found ? F.toObject(res.foundValue) : null,
      };
    },

    /**
     * Serialise the current tree for storage.
     * Entries are [key, value] pairs as 0x-hex strings.
     */
    save() {
      const entries = [];
      for (const [k, v] of tree.entries()) {
        entries.push([`0x${k.toString(16)}`, `0x${v.toString(16)}`]);
      }
      const poseidon = _poseidon;
      const rootHex = poseidon
        ? `0x${poseidon.F.toObject(tree.root).toString(16)}`
        : "0x0";
      return { root: rootHex, entries };
    },
  };
}

module.exports = { load, cellKey, getPoseidon };
