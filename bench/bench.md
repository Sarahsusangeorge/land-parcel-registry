# Benchmarks and measured results

Every number here comes from a file in `bench/results/` or a logged run. Never round up.

## Geo: cells per parcel (Sprint 0, Sarah)

Source: all 24,102 parcels in the City of Newton, MA parcel layer
(`geo/data/raw/newton_parcels_full.geojson`, see `geo/scripts/fetch_parcels.py`).
Run: `python geo/scripts/cell_count_table.py`. Raw numbers: `bench/results/cell_counts.json`.

Parcel area: median 888 m², min 2 m², max 593,189 m².

| Res | Mode | Median cells | Max cells | Parcels with 0 cells | Fit 1–16 cells | Parcels sharing a cell with a neighbour |
|---|---|---|---|---|---|---|
| 11 | center | 0 | 269 | 13,362 | 10,643 (44.2%) | 0 |
| 11 | overlap | 3 | 317 | 0 | 23,876 (99.1%) | 24,101 |
| **12** | **center** | **3** | 1,868 | 419 | **23,105 (95.9%)** | **0** |
| 12 | overlap | 8 | 2,004 | 0 | 22,611 (93.8%) | 24,099 |
| 13 | center | 20 | 13,121 | 32 | 8,962 (37.2%) | 2 |
| 13 | overlap | 32 | 13,471 | 0 | 1,113 (4.6%) | 24,047 |
| 12 | center + one fallback cell for zero-cell parcels (rejected) | 3 | 1,868 | 0 | 23,524 (97.6%) | 658 |

Reading:

- Res 12, center mode is the only setting where almost all parcels fit N = 16 and no real neighbours collide.
- Overlap mode makes nearly every parcel collide with its neighbours, so shared boundaries would look like overlaps.
- Giving tiny parcels a fallback cell (the cell containing a point inside them) makes 658 parcels collide, because that cell's centre lies in a neighbour that already owns it. Rejected: zero-cell parcels are flagged `fits_batch: false` instead.
- The 2 collisions at res 13 are probably from the source data itself (5 pairs of Newton polygons overlap with real area); not yet checked parcel by parcel.

## Geo: Sprint 1 sample (parcels.json)

30 single-family parcels nearest (-71.2230, 42.3330), plus fixture B. Run: `python geo/src/parcels.py`.

| Item | Value |
|---|---|
| Parcels in `geo/out/parcels.json` | 31 (A, B, C + 28 real) |
| Fine cells per parcel (res 12) | median 5, max 10 |
| `fits_batch: false` | none |
| Fixture A | Newton parcel `53009 0010`, 1,832 m², 5 cells |
| Fixture B | A shifted 5 m east, 6 cells, 5 shared with A |
| Fixture C | Newton parcel `53009 0011` (touches A), 3 cells, none shared with A or B |
| Real parcels sharing a cell | 0 |

## Contract: registerParcel gas with the MOCK verifier (Sprint 2, Sarah)

Run: `REPORT_GAS=true npx hardhat test`. Raw: `bench/results/gas-report.txt`.
Excludes Groth16 verification, so it is **not** the TRL 4 verification-gas number (that comes in Sprint 4 with the real verifier).

| Min | Max | Mean | Calls |
|---|---|---|---|
| 228,321 | 245,085 | 241,732 | 10 |

Deployment: LandRegistry 1,561,293 gas.

## Circuit: toy insert_one (Sprint 1, Maneesh)

Circuit: `circuits/toy/insert_one.circom` — 1 × SMTProcessor(10), Groth16.
Setup: local pot14 (dev-only — not a ceremony). Run: `node registrar/scripts/toy_prove.js`.
Raw: `bench/results/circuit_toy.json`.

| Metric | Value |
|---|---|
| Non-linear constraints | 6,604 |
| Linear constraints | 6,270 |
| Wires | 12,882 |
| Proving time (single run, Apple Silicon) | 406 ms |
| Verification: valid proof | pass |
| Verification: duplicate insert rejected | pass |

## Circuit: register_parcel_dev (Sprint 2, Maneesh)

Circuit: `circuits/register_parcel_dev.circom` — N=8 cells, N_LEVELS=16, Groth16. (Dev/test
version of `register_parcel.circom`; identical G1–G5 constraints, smaller params to fit pot19.)
Setup: locally generated pot19 (dev only, not a ceremony; powersoftau new + contribute + prepare phase2). Run: `npm test` in `registrar/`.
Raw: `bench/results/circuit_reg_dev.json`.

| Metric | Value |
|---|---|
| Non-linear constraints | 79,330 |
| Linear constraints | 79,134 |
| Wires | 158,555 |
| Groth16 setup time (Apple Silicon) | ~15 s |
| Proving time – test 1 (A) | 3,422 ms |
| Proving time – test 3 (C after A) | 5,928 ms (two proofs) |
| Verification: valid proof (test 1, test 3) | pass |
| Rejection: shared cells (test 2) | pass |
| Rejection: tampered commitment (test 4) | pass |
| Rejection: non-prefix active cells (test 5) | pass |

## Circuit: register_parcel production (Sprint 2 follow-up, Maneesh)

Circuit: `circuits/register_parcel.circom` — N=16 cells, N_LEVELS=32, Groth16.
Setup: locally generated pot20 (powersoftau new + contribute + prepare phase2; ~75 min total).
Prove bench: `node registrar/scripts/bench_prove.js 3` (3 runs, fixture A, Apple Silicon).
Raw: `bench/results/circuit_reg_prod.json`.

| Metric | Value |
|---|---|
| Non-linear constraints | 588,297 |
| Wires | 588,732 |
| Required ptau | pot20 (2^20 = 1,048,576 > 588,297) |
| pot20 prepare phase2 time (Apple Silicon) | ~75 min |
| Groth16 setup time (Apple Silicon) | 42 s |
| Prove time — mean (3 runs, fixture A) | **9,751 ms** |
| Prove time — max (3 runs, fixture A) | **10,035 ms** |
| Proof size (JSON) | 719 bytes |
| zkey size | 268.7 MB |
| vkey size | 3.2 KB |
| Verification: valid proof | pass |
| Rejection: shared cells (test 2) | pass |
| Rejection: tampered commitment (test 4) | pass |
| Rejection: non-prefix active cells (test 5) | pass |

## End-to-end demo registration (Sprint 3, Maneesh)

Registrar: `registrar/src/register.js` (I4 CLI). Circuit: production (N=16, N_LEVELS=32).
Setup: real Groth16Verifier deployed to local Hardhat node. Run: `bash registrar/scripts/demo.sh`.

| Parcel | Status | Prove time | tokenId | tx |
|---|---|---|---|---|
| A | registered | **9,723 ms** | 1 | `0x923e97dc62998bf9ab118c8c942b689f31a8559d88330b879f8d96e195d4d10f` |
| B | overlap (hits A) | — | — | — |
| C | registered | **9,631 ms** | 2 | `0xd5ffdd79bde2bf8b44db6cff7f5e289c14b7791cf80280542927759184c9245e` |

A newRoot = `1627276571125689245575422886857369656002719209654662685577916150576429071912`
C oldRoot = A newRoot (root chain verified ✓)

Machine: MacBook Pro M4 Pro, 24 GB RAM, macOS. Node: no competing processes.

## Full real-parcel run (Sprint 4, Maneesh)

All 31 parcels in `geo/out/parcels.json` registered against a fresh Hardhat node with the real
`Groth16Verifier.sol` (production zkey). Order: A first, B second, then C and P01–P28 in file
order. Raw data: `bench/results/full_run.json`. Log: `patent/figures/logs/full_run.txt`.
Run: `bash registrar/scripts/full_run.sh`.

Machine: MacBook Pro M4 Pro, 24 GB RAM.

| Metric | Value |
|---|---|
| Total parcels | 31 |
| Registered | 30 |
| Overlaps | 1 (B only — overlaps A as designed) |
| Errors | 0 |
| Prove time — mean | **10,102 ms** |
| Prove time — max | **10,846 ms** |
| Prove time — min | 9,760 ms |
| registerParcel gas — mean (real verifier) | **415,942** |
| registerParcel gas — max | **448,564** (A, first registration on empty tree) |
| registerParcel gas — min | **414,724** |

Note: A's gas is higher (448,564) because it is the first registration and the SMT root
transition from 0 → newRoot writes a storage slot that is cold at deployment.

No real-parcel overlap was found among the 30 Newton parcels (P01–P28 plus A and C).
B is a synthetic fixture (A shifted 5 m east) and is the only overlap, as designed.

## Known limitations (so far)

- Grid approximation: an overlap smaller than the gap between cell centres (res 12 edge about 9.4 m) can slip through.
- Parcel size: at res 12, 2.4% of Newton parcels have more than 16 cells and 1.7% have none; both are flagged, not registered.
