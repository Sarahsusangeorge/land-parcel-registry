# PLAN.md

Read CONTEXT.md first for current status.

Placeholder. Replace this file with the export of "Land Parcel Non-Overlap Registry: Build Plan to TRL 4"
(export the doc as Markdown) during Sprint 0, then keep this repo copy as the source of truth.

---

## Decision log

### circuits/register_parcel_dev.circom — test-only circuit (Sprint 2)

**Decision:** Keep `register_parcel_dev.circom` (N=8, N_LEVELS=16) alongside the production
`register_parcel.circom` (N=16, N_LEVELS=32).

**Reason:** The production circuit has 588,297 constraints and requires pot20 (~500 MB
Hermez download) for groth16 setup. The jest circuit tests in `registrar/test/circuit.test.js`
need a compiled zkey to run. Rather than gate all sprint 2 tests on a 500 MB download, we
compile a structurally identical circuit with smaller parameters that fits pot19 (already
present in `circuits/build/`). All five constraint groups G1–G5 are exercised identically.

**Scope:** `register_parcel_dev.circom` is for CI/sprint testing only. The `contracts/contracts/
Groth16Verifier.sol` currently exported from the dev zkey must be regenerated from the
production zkey (`bash circuits/scripts/build.sh`, no `--dev` flag) before Sprint 3
integration and before claiming TRL 4.

### Production circuit uses pot20 (Sprint 2 follow-up)

**Decision:** Production circuit (`register_parcel.circom`, N=16, N_LEVELS=32) requires
`powersOfTau28_hez_final_20.ptau` (pot20), not pot19 or pot21.

**Reason:** `snarkjs r1cs info` reports 588,297 constraints. snarkjs `groth16 setup`
requires `2^k ≥ constraints`, so pot19 (2^19 = 524,288 < 588,297) is insufficient and
pot20 (2^20 = 1,048,576 > 588,297) is the minimum. pot21 would also work but is
unnecessarily large.

**How to apply:** The build script attempts to download `powersOfTau28_hez_final_20.ptau`
from the Hermez GCS mirror (now access-restricted). In practice: generate locally with
`snarkjs powersoftau new bn128 20` + `contribute` + `prepare phase2`. The `prepare phase2`
step is mandatory — passing a raw phase1 file to `groth16 setup` completes silently but
writes a corrupt 12-byte zkey. `build.sh` handles the full sequence automatically.

## Sprint 3 checklist — Maneesh

- [x] `registrar/src/register.js`: I4 CLI — load tree, findCell overlap check, prove
      with production zkey, export Solidity calldata, call registerParcel, save state
      only after tx confirms; --dry-run mode; StaleRoot rebuild
- [x] Proof fixtures generated and verified against production vkey:
      `contracts/test/fixtures/A.json`, `C_after_A.json`, `B_overlap.json`
- [x] StaleRoot handling: rebuild proof once, then report status "error"
- [x] `registrar/scripts/demo.sh`: fresh Hardhat node, real Groth16Verifier, A/B/C
      → registered / overlap (hits A) / registered ✓
- [x] Prove times recorded in `bench/bench.md`

### register.js "registered" output carries oldRoot, newRoot, commitment (Sprint 3)

**Decision:** The I4 `registered` JSON line includes three fields beyond the frozen spec:
`oldRoot`, `newRoot`, and `commitment`.

**Reason:** The frozen I4 spec lists `parcel_id, status, overlaps, tx_hash, token_id, prove_ms`.
These three extra fields duplicate what the contract already stores on-chain but surface them
directly in the CLI output, making it easy to chain registrations, audit root transitions, and
script against the proof without a separate on-chain call. They add no ambiguity to I4 because
they are additive and do not rename any frozen key.

**How to apply:** Consumers of the I4 output may rely on `oldRoot`, `newRoot`, `commitment`
being present in `status:"registered"` lines from this registrar. They are omitted from
`status:"overlap"` and `status:"error"` lines where they are not meaningful.

## TRL 4 checklist

TRL 4 = "Technology validated in lab". Evidence required: the system does what it
claims (non-overlap enforcement) on real data, with measured performance.

### ZK circuit and trusted setup

- [x] Production circuit compiled and constraint count confirmed
      — `circuits/register_parcel.circom`, 588,297 constraints
        (`bench/results/circuit_reg_prod.json`)
- [x] pot20 generated locally (single contributor), prepare-phase2 complete
      — `circuits/build/ptau/pot20_final.ptau` (gitignored; provenance in CONTEXT.md §5)
- [x] Production zkey generated with `groth16 setup`
      — `circuits/build/register_parcel_final.zkey` (gitignored)
- [x] Verification key exported and committed
      — `circuits/build/register_parcel_vkey.json`
- [x] Groth16Verifier.sol exported from production zkey
      — `contracts/contracts/Groth16Verifier.sol`
- [x] All 5 circuit tests pass against production zkey
      — `registrar/test/circuit.test.js`

### Smart contract

- [x] `LandRegistry.sol` deployed with real Groth16Verifier
      — `contracts/contracts/LandRegistry.sol`; deploy script `contracts/scripts/deploy.js`
- [x] 13 mock-verifier contract tests passing
      — `contracts/test/registry.test.js` (`bench/results/gas-report.txt`)
- [x] registerParcel gas measured with the real verifier on real parcels
      — `bench/results/full_run.json`: mean 415,942, max 448,564, min 414,724

### Registrar CLI (I4)

- [x] `register.js` overlap check, prove, submit, StaleRoot rebuild
      — `registrar/src/register.js`
- [x] Proof fixtures A, B (overlap), C committed
      — `contracts/test/fixtures/A.json`, `B_overlap.json`, `C_after_A.json`
- [x] Dry-run mode verified
      — `registrar/src/register.js` (`--dry-run` flag)

### End-to-end demo (Gate 3)

- [x] Fresh Hardhat node + real Groth16Verifier: A registered, B overlap, C registered
      — `registrar/scripts/demo.sh`; log: `patent/figures/logs/demo_run.txt`
- [x] Clean-clone reproducibility confirmed
      — CONTEXT.md §5 "Gate 3 clean-clone" entry (2026-10-14)

### Full real-parcel run (Gate 4 / TRL 4 evidence)

- [x] All 31 parcels in `geo/out/parcels.json` processed: 30 registered, 1 overlap (B only)
      — `bench/results/full_run.json`; log: `patent/figures/logs/full_run.txt`
- [x] No unintended overlap among the 30 real Newton parcels
      — `bench/results/full_run.json` (every status except B is "registered")
- [x] Prove time measured across all parcels: mean 10,102 ms, max 10,846 ms
      — `bench/results/full_run.json` (`stats.prove_ms`)
- [x] registerParcel gas measured with real verifier: mean 415,942
      — `bench/results/full_run.json` (`stats.gas_used`)
- [x] Geo pipeline handles real-world parcels with zero neighbour collisions
      — `bench/bench.md` "Geo: cells per parcel" (res 12, center mode)

### Still missing (as of 2026-10-14)

- [ ] E2E contract tests with real proof fixtures (Sarah, Sprint 3 task 2):
      `contracts/test/registry.e2e.test.js` — not yet written
- [ ] Gas reporter on `registerParcel` with real verifier in test suite (Sarah, Sprint 3 task 3)
- [ ] IDF-B Sections 1, 2, 4, 6 (Maneesh), 5 (Sarah), 7–10 (both) — in progress
- [ ] README updated with reproduction steps and TRL 4 claim
- [ ] Public ptau ceremony file swap before any production or public use
- [ ] Decision log rows still marked "Pending" resolved (tree key, cell mode, N/N_LEVELS, registrar holds cells)

## Changelog

- 2026-10-14 (Maneesh): Sprint 4 — full real-parcel run (30/31 registered, B only overlap),
      bench.md updated, patent evidence logs, TRL 4 checklist in PLAN.md.
      Prove ms: mean 10,102 / max 10,846. Gas (real verifier): mean 415,942 / max 448,564.
- 2026-10-14 (Maneesh): Sprint 3 — register.js I4 CLI, proof fixtures, demo.sh.
      Demo prove times: A 9,723 ms, C 9,631 ms. All three Sprint 3 Maneesh tasks done.
- 2026-10-14 (Maneesh): housekeeping — .gitattributes, untrack NOTES-FOR-MANEESH.md, fix pot19 bench provenance, CONTEXT.md production-build status.
