pragma circom 2.0.0;

// register_parcel_dev.circom  –  DEV/TEST ONLY (Sprint 2)
//
// Identical constraint groups G1–G5 as register_parcel.circom, but compiled
// with smaller parameters so it fits under pot19 (2^19 = 524 288 SRS points):
//
//   N       =  8  (max active cells per parcel; A=5, B=6, C=3 all fit)
//   N_LEVELS = 16  (tree depth; adequate for prototype with a handful of parcels)
//
// Production parameters (N=16, N_LEVELS=32) require pot21 (~2.1e6 SRS points).
// See circuits/register_parcel.circom for the production version and
// NOTES-FOR-MANEESH.md for the ptau sizing rationale.
//
// Public signals (same ordering as production):
//   publicSignals[0] = oldRoot
//   publicSignals[1] = newRoot
//   publicSignals[2] = commitment

include "circomlib/circuits/smt/smtprocessor.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

template RegisterParcel(N, N_LEVELS) {

    signal input initialRoot;
    signal input cells[N];
    signal input n_cells;
    signal input siblings[N][N_LEVELS];
    signal input oldKey[N];
    signal input oldValue[N];
    signal input isOld0[N];

    signal output oldRoot;
    signal output newRoot;
    signal output commitment;

    // G5: bind public oldRoot to the private initialRoot
    oldRoot <== initialRoot;

    // G1: active-prefix gate
    component iz[N-1];
    for (var i = 0; i < N-1; i++) {
        iz[i] = IsZero();
        iz[i].in <== cells[i];
        iz[i].out * cells[i+1] === 0;
    }

    // G2: key hashing
    component keyHash[N];
    signal key[N];
    for (var i = 0; i < N; i++) {
        keyHash[i] = Poseidon(1);
        keyHash[i].inputs[0] <== cells[i];
        key[i] <== keyHash[i].out;
    }

    // G3: commitment
    component commitHash = Poseidon(N);
    for (var i = 0; i < N; i++) {
        commitHash.inputs[i] <== cells[i];
    }
    commitment <== commitHash.out;

    // G4: chained SMTProcessor inserts
    component izCell[N];
    signal active[N];
    for (var i = 0; i < N; i++) {
        izCell[i] = IsZero();
        izCell[i].in <== cells[i];
        active[i] <== 1 - izCell[i].out;
    }

    component proc[N];
    component rootMux[N];
    signal rootChain[N+1];
    rootChain[0] <== initialRoot;

    for (var i = 0; i < N; i++) {
        proc[i] = SMTProcessor(N_LEVELS);
        proc[i].fnc[0] <== active[i];
        proc[i].fnc[1] <== 0;
        proc[i].oldRoot <== rootChain[i];
        for (var j = 0; j < N_LEVELS; j++) {
            proc[i].siblings[j] <== siblings[i][j];
        }
        proc[i].oldKey   <== oldKey[i];
        proc[i].oldValue <== oldValue[i];
        proc[i].isOld0   <== isOld0[i];
        proc[i].newKey   <== key[i];
        proc[i].newValue <== active[i];

        rootMux[i] = Mux1();
        rootMux[i].c[0] <== rootChain[i];
        rootMux[i].c[1] <== proc[i].newRoot;
        rootMux[i].s    <== active[i];
        rootChain[i+1]  <== rootMux[i].out;
    }

    newRoot <== rootChain[N];
}

component main = RegisterParcel(8, 16);
