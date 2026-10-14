# PLAN.md

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
production zkey (`bash circuits/scripts/build.sh`, no `--dev` flag) before mainnet deployment.
