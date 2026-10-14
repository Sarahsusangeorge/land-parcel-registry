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

## Changelog

- 2026-10-14 (Maneesh): housekeeping — .gitattributes, untrack NOTES-FOR-MANEESH.md, fix pot19 bench provenance, CONTEXT.md production-build status.
