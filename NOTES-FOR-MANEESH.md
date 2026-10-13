# Notes for Maneesh

## PLAN.md is a placeholder

`PLAN.md` contains only the placeholder text ("Replace this file with the export…").
The full interface spec (I1–I5, sprint checklists) was not readable during this session.
All interfaces below were inferred from the existing codebase.

## Inferred interface values

| Interface | Key values | Source |
|---|---|---|
| I1 | fine_res=12, coarse_res=9, cell_mode="center", max_cells=16 | geo/out/parcels.json meta |
| I2 | parcels.json schema | geo/out/parcels.json |
| I3 | register_parcel.circom: N=16, N_LEVELS=32, public outputs [oldRoot, newRoot, commitment] | assumed from Sprint 2 spec + I5 |
| I4 | key = Poseidon([cell_dec]), value = 1 | toy circuit spec + circomlib SMT convention |
| I5 | verifyProof(a,b,c, [oldRoot,newRoot,commitment]) | contracts/contracts/LandRegistry.sol |

## Commitment definition (assumption)

PLAN.md I3 was not readable. I defined:

    commitment = Poseidon(cells[0], cells[1], …, cells[N-1])

where N=16, unused cells padded with 0. If the real I3 defines it differently, the
circuit and inputs.js must be updated together — they are the only two files that
touch commitment.

## Public signal ordering

snarkjs emits circuit OUTPUTS before public INPUTS. To get `pubSignals = [oldRoot,
newRoot, commitment]` for the contract, the circuit declares all three as `signal output`
in that order. `oldRoot` is a pass-through of the private `initialRoot` input.

## circom PATH

circom 2.2.3 is installed at `~/.cargo/bin/circom`. It is NOT in the default PATH
that Node/npm scripts see. `build.sh` adds it with:

    export PATH="$HOME/.cargo/bin:$PATH"

If you run circom directly in a fresh terminal, run:

    export PATH="$HOME/.cargo/bin:$PATH"

or add it permanently to ~/.zshrc.

## SMTProcessor fnc encoding (circomlib)

    fnc[0]=1, fnc[1]=0  →  INSERT   (empty slot)
    fnc[0]=0, fnc[1]=1  →  UPDATE   (existing key)
    fnc[0]=1, fnc[1]=1  →  DELETE
    fnc[0]=0, fnc[1]=0  →  NOP

The circuit hard-codes INSERT for active cells and NOP for inactive (zero-padded) cells.
NOP disables all ForceEqualIfEnabled checks so arbitrary siblings/oldKey/oldValue
are valid — inactive slots get zeros in all those fields.

## Powers of Tau (ptau) sizing

register_parcel.circom (N=16, N_LEVELS=32):
- Non-linear constraints: 287,745
- Wires: 588,732
- Need pot19 (2^19 = 524,288 > 287,745)

The Hermez ceremony `powersOfTau28_hez_final_19.ptau` is a phase1 file. You MUST
run `powersoftau prepare phase2` before using it with `groth16 setup`. build.sh
handles this automatically (it checks for pot19_pp.ptau and generates it if absent).

WARNING: `prepare phase2` for pot19 takes ~30-40 minutes on Apple Silicon and
produces a ~600MB file. The file is gitignored. Run `bash circuits/scripts/build.sh`
from the repo root; it caches all intermediate files.

## PLAN.md checkboxes

Because PLAN.md is a placeholder there are no checkboxes to tick. Items below are
tracked by this file and the git log instead.

## Package versions pinned (Group 1)

| Package | Version |
|---|---|
| circomlib | 2.0.5 |
| circomlibjs | 0.1.7 |
| snarkjs | 0.7.6 |
| ethers | 6.17.0 |
| jest | 29.7.0 |

System tools: circom 2.2.3, Node 22.14.0, npm 10.9.2.

## Circuit numbers (to copy to bench/bench.md once full prove is timed)

| Circuit | Non-linear constraints | Wires | Prove time |
|---|---|---|---|
| insert_one (N_LEVELS=10) | 6,604 | 12,882 | 406–503 ms |
| register_parcel (N=16, N_LEVELS=32) | 287,745 | 588,732 | TBD (groth16 setup not yet complete) |

## Sprint 2 summary (Group 3)

### What was completed

| Item | Status |
|---|---|
| register_parcel.circom (N=16, N_LEVELS=32) | Compiled. 287,745 non-linear constraints, 588,732 wires. |
| register_parcel_dev.circom (N=8, N_LEVELS=16) | Compiled + groth16 setup (15s). All 5 jest tests pass. |
| registrar/src/inputs.js | buildInputs(parcel, smt, n, nLevels) — pads to N, inserts active cells. |
| registrar/test/circuit.test.js | 5 tests via dev circuit — all PASS. |
| circuits/build/register_parcel_dev_final.zkey | Generated (71 MB). |
| circuits/build/register_parcel_dev_vkey.json | Exported (3.2 KB). |
| circuits/build/Groth16Verifier.sol | Exported from dev zkey; copied to contracts/contracts/. |
| circuits/scripts/build.sh | Updated — accepts --dev (pot19) or default production (pot21). |
| bench/bench.md | Updated with dev and production circuit numbers. |

### Production circuit groth16 setup — NOT RUN

`register_parcel.circom` (N=16, N_LEVELS=32) has 588,732 wires. Groth16 setup requires
wires×2 ≤ 2^p, so pot21 (2^21 = 2,097,152) is needed. pot21 `.ptau` is ~3 GB and
`prepare phase2` takes ~160 min on Apple Silicon. To complete the production build:

    bash circuits/scripts/build.sh       # (no --dev flag)

This will download powersOfTau28_hez_final_21.ptau, run prepare phase2, then setup.
The Groth16Verifier.sol in contracts/contracts/ was generated from the dev circuit and
must be regenerated from the production zkey before mainnet deployment.

### Dev vs production circuit key differences

| | Dev | Production |
|---|---|---|
| N (max cells) | 8 | 16 |
| N_LEVELS (tree depth) | 16 | 32 |
| Non-linear constraints | 79,330 | 287,745 |
| Wires | 158,555 | 588,732 |
| Required ptau | pot19 | pot21 |
| Groth16 setup | 15 s | TBD |
| Fixtures A/B/C | All fit (≤8 cells) | All fit (≤16 cells) |

### Test results (npm test in registrar/)

```
✓ fixture A inserts into empty tree and proof verifies (3422 ms)
✓ fixture B inserted after A fails (shared cells are now occupied) (255 ms)
✓ fixture C inserted after A proves (no shared cells) (5928 ms)
✓ tampered cells make commitment constraint fail (323 ms)
✓ non-prefix active cells violate G1 and fail witness generation (263 ms)

Tests: 5 passed, 5 total
```

The `console.error` lines in test output from tests 4 and 5 are expected — they log the
circom runtime errors that the circuit deliberately triggers (commitment mismatch,
G1 active-prefix violation). The tests check that `fullProve` rejects; the errors confirm it.

## Changelog

- Group 1 (Sprint 0, Maneesh): registrar/ npm setup, build.sh skeleton, .gitignore confirmed.
- Group 2 (Sprint 1, Gate 1): insert_one.circom, tree.js, toy_prove.js — GATE 1 PASSED.
- Group 3 (Sprint 2): register_parcel.circom compiled (287k constraints); register_parcel_dev.circom compiled + groth16 setup; inputs.js; 5 jest tests — all PASS.
