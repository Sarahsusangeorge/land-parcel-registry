pragma circom 2.0.0;

// register_parcel.circom  –  Sprint 2, Maneesh
//
// Proves that the active fine H3 cells of a parcel were each inserted into a
// previously-empty slot of a Poseidon sparse Merkle tree, moving the tree root
// from oldRoot to newRoot.  Inactive slots (cells[i] == 0) are no-ops.
//
// Public signals emitted by snarkjs in declaration order (outputs first):
//   publicSignals[0] = oldRoot      – tree root before any inserts
//   publicSignals[1] = newRoot      – tree root after all active inserts
//   publicSignals[2] = commitment   – Poseidon(cells[0..N-1])
//
// Private inputs:
//   initialRoot          – equals oldRoot; kept private so its value is bound
//                          only through the public output
//   cells[N]             – H3 cell decimal values; cells[n_cells..N-1] = 0
//   n_cells              – advisory; not circuit-constrained (range-checked off-chain)
//   siblings[N][N_LEVELS] – SMT Merkle paths (zeros for inactive slots)
//   oldKey[N]            – existing key at target slot (0 if empty / inactive)
//   oldValue[N]          – existing value (0 if empty / inactive)
//   isOld0[N]            – 1 if slot is empty, 0 otherwise (1 for inactive)
//
// Constraint groups (G1–G5):
//   G1  Active-prefix gate:  cells[i]==0  →  cells[i+1]==0   (i < N-1)
//   G2  Key hashing:         key[i] = Poseidon(cells[i])
//   G3  Commitment:          commitment = Poseidon(cells[0..N-1])
//   G4  Chained inserts:     N × SMTProcessor (INSERT when active, NOP when not)
//                            root passes through for inactive slots via Mux1
//   G5  oldRoot binding:     oldRoot output == initialRoot private input

include "circomlib/circuits/smt/smtprocessor.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

template RegisterParcel(N, N_LEVELS) {

    // ── private inputs ────────────────────────────────────────────────────────
    signal input initialRoot;           // tree root before all inserts
    signal input cells[N];
    signal input n_cells;               // informational; not constrained here
    signal input siblings[N][N_LEVELS];
    signal input oldKey[N];
    signal input oldValue[N];
    signal input isOld0[N];

    // ── public outputs (order = publicSignals[0..2] for the contract) ─────────
    signal output oldRoot;              // [0] pass-through of initialRoot
    signal output newRoot;              // [1] root after all active inserts
    signal output commitment;           // [2] Poseidon of all cells

    // ── G5: bind public oldRoot to the private initialRoot ────────────────────
    oldRoot <== initialRoot;

    // ── G1: active-prefix gate ────────────────────────────────────────────────
    // cells[i] == 0  →  cells[i+1] == 0  for all i in [0, N-2]
    // Implemented as: IsZero(cells[i]).out * cells[i+1] === 0
    // (if cells[i] is zero, then cells[i+1] must also be zero)
    component iz[N-1];
    for (var i = 0; i < N-1; i++) {
        iz[i] = IsZero();
        iz[i].in <== cells[i];
        iz[i].out * cells[i+1] === 0;
    }

    // ── G2: key hashing ───────────────────────────────────────────────────────
    component keyHash[N];
    signal key[N];
    for (var i = 0; i < N; i++) {
        keyHash[i] = Poseidon(1);
        keyHash[i].inputs[0] <== cells[i];
        key[i] <== keyHash[i].out;
    }

    // ── G3: commitment ────────────────────────────────────────────────────────
    component commitHash = Poseidon(N);
    for (var i = 0; i < N; i++) {
        commitHash.inputs[i] <== cells[i];
    }
    commitment <== commitHash.out;

    // ── G4: chained SMTProcessor inserts ──────────────────────────────────────
    //
    // For each slot i:
    //   isZeroCell[i].out == 1  ↔  cells[i] == 0  (inactive slot)
    //   active[i]         == 1  ↔  cells[i] != 0  (active slot)
    //
    //   fnc for SMTProcessor:
    //     active:   fnc[0]=1, fnc[1]=0  →  INSERT
    //     inactive: fnc[0]=0, fnc[1]=0  →  NOP  (ForceEqualIfEnabled disabled)
    //
    //   Root chain:
    //     active:   rootChain[i+1] = proc[i].newRoot
    //     inactive: rootChain[i+1] = rootChain[i]   (Mux1 bypass)

    component izCell[N];
    signal active[N];          // 1 if cells[i] != 0
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

        // INSERT when active, NOP when inactive
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
        proc[i].newValue <== active[i];   // 1 for active, 0 for NOP

        // Mux: select proc output (active) or pass-through (inactive)
        rootMux[i] = Mux1();
        rootMux[i].c[0] <== rootChain[i];        // inactive: root unchanged
        rootMux[i].c[1] <== proc[i].newRoot;     // active: updated root
        rootMux[i].s    <== active[i];
        rootChain[i+1]  <== rootMux[i].out;
    }

    newRoot <== rootChain[N];
}

component main = RegisterParcel(16, 32);
