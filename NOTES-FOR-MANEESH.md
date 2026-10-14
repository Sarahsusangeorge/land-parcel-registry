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

### Exact numbers from `snarkjs r1cs info circuits/build/register_parcel.r1cs`

| Field | Value |
|---|---|
| # of Constraints | **588,297** |
| # of Wires | 588,732 |
| # of Private Inputs | 578 |
| # of Public Inputs | 0 |
| # of Outputs | 3 |

### Does production circuit fit pot19?

**No.** pot19 = 2^19 = 524,288 < 588,297 constraints.

For Groth16, snarkjs requires `2^k ≥ constraints`:

| Ptau | 2^k | Fits? |
|---|---|---|
| pot19 | 524,288 | **No** (524,288 < 588,297) |
| pot20 | 1,048,576 | **Yes** (1,048,576 > 588,297) |

### ptau format: Hermez vs locally generated

**Hermez `powersOfTau28_hez_final_*.ptau` files** are distributed in the phase2-prepared
format — they can be passed directly to `groth16 setup` with no extra step. Both Hermez S3
and GCS mirrors are now access-restricted and cannot be downloaded anonymously.

**Locally generated files** (via `powersoftau new` + `contribute`) are raw phase1 ceremony
files. They require `powersoftau prepare phase2` before `groth16 setup` will work. Passing a
raw phase1 file to `groth16 setup` completes in milliseconds but produces a 12-byte (corrupt)
zkey silently — no error, invalid output.

**Sprint 2 production build** uses `circuits/build/ptau/pot20_pp.ptau` generated locally:
```
snarkjs powersoftau new bn128 20 ptau/pot20_0000.ptau  (~384 MB)
snarkjs powersoftau contribute pot20_0000.ptau ptau/pot20_final.ptau
snarkjs powersoftau prepare phase2 ptau/pot20_final.ptau ptau/pot20_pp.ptau  (~60 min, ~1.2 GB)
```

To build the production circuit after the ptau is ready:
    bash circuits/scripts/build.sh       # downloads or generates ptau, runs prepare phase2, runs setup

### Dev circuit (register_parcel_dev.circom, N=8, N_LEVELS=16)

| Field | Value |
|---|---|
| # of Constraints | 79,330 |
| # of Wires | 158,555 |
| Fits pot19 (2^19=524,288)? | Yes |

The dev circuit uses `circuits/build/pot19_pp.ptau` (604 MB, generated locally in Sprint 2).
All 5 jest tests pass with the dev circuit.

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
| register_parcel (N=16, N_LEVELS=32) | 588,297 (snarkjs r1cs info total) | 588,732 | TBD (pot20 download needed) |

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
| circuits/scripts/build.sh | Updated — accepts --dev (pot19) or default production (pot20). |
| bench/bench.md | Updated with dev and production circuit numbers. |

### Production circuit groth16 setup — NOT RUN

`register_parcel.circom` has 588,297 constraints (from `snarkjs r1cs info`). Groth16
requires 2^k ≥ constraints: pot19 = 524,288 < 588,297 (does not fit); pot20 = 1,048,576
> 588,297 (fits). Hermez final files are already ceremony outputs — no `prepare phase2`.

To complete the production build:

    bash circuits/scripts/build.sh       # (no --dev flag)

This will download `powersOfTau28_hez_final_20.ptau` (~500 MB) and run groth16 setup.
The Groth16Verifier.sol in contracts/contracts/ was generated from the dev circuit and
must be regenerated from the production zkey before mainnet deployment.

### Dev vs production circuit key differences

| | Dev | Production |
|---|---|---|
| N (max cells) | 8 | 16 |
| N_LEVELS (tree depth) | 16 | 32 |
| Non-linear constraints | 79,330 | 287,745 |
| Total constraints (snarkjs) | 79,330 | 588,297 |
| Wires | 158,555 | 588,732 |
| Required ptau | pot19 | pot20 |
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
