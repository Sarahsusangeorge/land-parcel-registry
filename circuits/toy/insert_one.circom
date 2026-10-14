pragma circom 2.0.0;

// insert_one.circom
// A minimal circuit that performs exactly one SMTProcessor INSERT into a
// Poseidon-based sparse Merkle tree.
//
// Inputs (private unless noted):
//   oldRoot    – public: tree root before the insert
//   siblings   – Merkle path for the new key slot
//   oldKey     – key of the existing leaf at the target position (0 if empty)
//   oldValue   – value of that existing leaf (0 if empty)
//   isOld0     – 1 if the target slot is empty, 0 otherwise
//   newKey     – Poseidon([cell]) — computed off-chain by the prover
//
// Outputs (public):
//   newRoot    – tree root after the insert

include "circomlib/circuits/smt/smtprocessor.circom";

template InsertOne(N_LEVELS) {
    // --- public inputs ---
    signal input oldRoot;
    // --- private inputs ---
    signal input siblings[N_LEVELS];
    signal input oldKey;
    signal input oldValue;
    signal input isOld0;
    signal input newKey;     // Poseidon([cell_decimal])
    // --- public output ---
    signal output newRoot;

    component proc = SMTProcessor(N_LEVELS);

    // Hardcode operation: INSERT (fnc = [1, 0] per circomlib SMTProcessor encoding)
    // fnc[0]=1, fnc[1]=0  →  INSERT
    // fnc[0]=0, fnc[1]=1  →  UPDATE
    // fnc[0]=1, fnc[1]=1  →  DELETE
    // fnc[0]=0, fnc[1]=0  →  NOP
    proc.fnc[0] <== 1;
    proc.fnc[1] <== 0;

    proc.oldRoot   <== oldRoot;
    for (var i = 0; i < N_LEVELS; i++) {
        proc.siblings[i] <== siblings[i];
    }
    proc.oldKey    <== oldKey;
    proc.oldValue  <== oldValue;
    proc.isOld0    <== isOld0;
    proc.newKey    <== newKey;
    proc.newValue  <== 1;   // "occupied"

    newRoot <== proc.newRoot;
}

component main { public [oldRoot] } = InsertOne(10);
