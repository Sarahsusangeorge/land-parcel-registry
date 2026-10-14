# CONTEXT.md

Read this first, then PLAN.md. This file says where the project is right now. PLAN.md says what the project is and how it is built.

Last updated: 2026-10-14, by Maneesh (Sprint 3: register.js I4 CLI, proof fixtures, demo.sh)

---

## 1. Read order for any Claude session

1. `CONTEXT.md` (this file): current state, deviations from the plan, what to do next.
2. `PLAN.md`: goal, system design, repo ownership, frozen interfaces (I1 to I5), sprint tasks, decision log.
3. `git log --oneline -15` and `git status`: confirm the state matches this file.

If this file and the repo disagree, trust the repo and tell the person you are working with.

---

## 2. The project in three lines

A land registry add-on that stops the same physical land being tokenized twice, without putting exact boundaries on-chain. Each parcel becomes a set of H3 grid cells. A Groth16 proof shows every cell was inserted into an empty slot of a sparse Merkle tree, which is the non-overlap proof. The contract checks the proof and the root, then mints an ERC-721.

Target: working prototype at TRL 4, plus an IDF-B patent disclosure in `patent/IDF-B.md`.

---

## 3. People, lanes and machines

| Person | Lane | Owns | Machine |
| --- | --- | --- | --- |
| Maneesh | Circuit, registrar, benchmarks | `circuits/`, `registrar/`, `bench/` | MacBook Pro M4 Pro, 24 GB RAM, macOS |
| Sarah | Geo pipeline, contracts, figures | `geo/`, `contracts/` | Lenovo, Intel, about 8 GB RAM, Windows |

Shared files: `PLAN.md`, `CONTEXT.md`, `patent/IDF-B.md`, `bench/`.

**Machine rules (important)**

- All trusted setup, proving and benchmarks run on Maneesh's Mac only.
- Sarah does not install circom or generate proofs. At 588k constraints it is too heavy for 8 GB, and the build scripts are bash.
- Sarah tests the contract with proof fixtures that Maneesh generates and commits under `contracts/test/fixtures/`.
- If Sarah needs to run a `.sh` script, use WSL or Git Bash.
- Gate 3 (clean-clone demo) runs on Maneesh's Mac. Sarah verifies on hers with the fixtures.

---

## 4. Status

### Done

**Sarah**
- Sprint 0: repo skeleton, geo and contracts setup, cell-count script (`957d2c9`)
- Sprint 1: geo pipeline, Newton parcels, fixtures A/B/C, `geo/out/parcels.json` per I2 (`0f0bb36`, `2214fad`)
- Sprint 2: `LandRegistry.sol` per I5, `MockVerifier.sol`, 13 mock tests passing, deploy script (`76c584d`)
- Patent: IDF-B Section 3 first pass

**Maneesh** (branch `maneesh/s0-setup`)
- Sprint 0: registrar setup, `circuits/scripts/build.sh`
- Sprint 1: toy circuit, `registrar/src/tree.js`, toy prove and verify. **Gate 1 passed.**
- Sprint 2: `circuits/register_parcel.circom` (N=16, N_LEVELS=32), `circuits/register_parcel_dev.circom` (N=8, N_LEVELS=16), `registrar/src/inputs.js`, 5 circuit tests passing (`e369d49`)
- Follow-up: constraint check, leftover processes killed, Sarah's 13 tests confirmed still passing, dev circuit decision logged (`85de2e6`)
  - Sprint 2 follow-up: production circuit built, Groth16Verifier.sol exported from the production zkey, 5/5 circuit tests and 13/13 contract tests pass, pushed (`1a47f53`)
  - Sprint 3: `registrar/src/register.js` (I4 CLI), proof fixtures A/B/C, `demo.sh`. All three Sprint 3 Maneesh tasks done (`b793a88`, `f317ee2`).

### In progress

Nothing running. Sprint 3 closed for Maneesh.

### Not started

- Sprint 3 and Sprint 4 for both lanes
- IDF-B Sections 1, 2, 4, 6 (Maneesh), 5 (Sarah), 7 to 10 (both)
- PR from `maneesh/s0-setup` into `main`

---

## 5. Facts that differ from or add to PLAN.md

Read these before touching circuits, proofs or the verifier.

| Topic | Fact |
| --- | --- |
| Constraint count | Production circuit: **588,297** (from `snarkjs r1cs info`). An earlier figure of 287k was wrong. Use 588,297 everywhere. |
| Powers of tau | Production needs **pot20** (2^20). pot19 is too small. |
| Hermez file | The public Hermez download is dead. The old Google Cloud bucket returns "Access denied". Do not retry that link. |
| Our ptau | Generated locally on Maneesh's Mac, single contributor. Fine for the TRL 4 prototype. Must be swapped for a public ceremony file before any public or production use. Say which one was used in the IDF-B. |
| Dev circuit | `register_parcel_dev.circom`: N=8, N_LEVELS=16, about 79k constraints, fits pot19. Same public signals as production. **Tests only.** |
| Current verifier | `Groth16Verifier.sol` is exported from the production zkey (N=16, N_LEVELS=32). The dev circuit is for fast tests only. |
| Public signals | `[oldRoot, newRoot, commitment]`, as in I5. Unchanged. |
| Large files | `*.ptau`, `*.zkey`, `circuits/build/` are gitignored. Never commit them. Share zkey and wasm through a private drive if needed. |
| Proving speed | Expect tens of seconds per production proof with snarkjs. If it is too slow, reducing N_LEVELS from 32 to 24 cuts constraints a lot, but that is an interface change and needs both people to agree. |
| Prove time (measured) | Mean **9,751 ms**, max **10,035 ms** (3 runs, fixture A, MacBook Pro M4 Pro, 24 GB RAM) |
| Proof size | 719 bytes (JSON) |
| zkey size | 268.7 MB |
| Groth16 setup time | 42 s (production circuit, pot20_pp.ptau) |
| pot20 prepare phase2 time | ~75 min (Apple Silicon) |
| ptau provenance — pot19 | Locally generated (powersoftau new bn128 19 + contribute + prepare phase2). Not a public ceremony. Dev/test only. Confirmed: `pot19_0000.ptau` and `pot19_final.ptau` intermediates are present in `circuits/build/`. |
| ptau provenance — pot20 | Locally generated (powersoftau new bn128 20 + contribute + prepare phase2). Not a public ceremony. Fine for TRL 4 prototype; must be replaced before any public or production use. Confirmed: `pot20_0000.ptau` and `pot20_final.ptau` intermediates are present in `circuits/build/ptau/`. |
| Geo settings | FINE_RES 12, CELL_MODE center (from Sarah's bench). 95.9% of 24,102 Newton parcels fit 1–16 cells, zero neighbour collisions. Fixture C touches A but shares no cells. |
| snarkjs process exit | snarkjs holds a background timer that prevents Node.js from exiting naturally. All scripts that call snarkjs.groth16.fullProve must end with `process.exit(0)` (or `.then(() => process.exit(0))`). |
| Demo prove times | A: 9,723 ms, C: 9,631 ms (single uncontested run, M4 Pro, no competing node processes). |

---

## 6. Next tasks

### Maneesh (Sprint 3) — DONE

- [x] `registrar/src/register.js` (I4 CLI): overlap check, prove, tx submit, StaleRoot rebuild, save after confirm
- [x] `--dry-run` mode; proof fixtures A.json, C_after_A.json, B_overlap.json committed to `contracts/test/fixtures/`
- [x] `registrar/scripts/demo.sh`: registered / overlap (A) / registered ✓
- [x] StaleRoot handling in register.js

### Maneesh (Sprint 4)

- Register all real parcels, benchmarks, IDF-B Sections 1/2/4/6, TRL 4 checklist

### Sarah (Sprint 3)

1. Switch the deploy path from `MockVerifier` to the real `Groth16Verifier`.
2. `contracts/test/registry.e2e.test.js` using Maneesh's fixtures: A registers; replaying A's proof reverts with `StaleRoot`; C registers after A; a changed public signal reverts with `InvalidProof`; a non-registrar caller reverts.
3. Gas reporter on for `registerParcel`.
4. IDF-B Section 7 figures in `patent/figures/`, and Section 5.

### Both (Sprint 4, after Gate 3)

Benchmarks, register all real parcels, screenshots and logs, README, IDF-B Sections 8 to 10, TRL 4 checklist in PLAN.md.

---

## 7. Open items

- [ ] Agree the four decision log rows still marked "Pending" in PLAN.md (tree key, cell mode, N and N_LEVELS, registrar holds cells).
- [x] Add `.gitattributes` so Windows line endings do not break scripts.
- [x] `NOTES-FOR-MANEESH.md` untracked from git and added to `.gitignore`. Local file kept.
- [x] PLAN.md decision log: no "before mainnet" wording found — decision log already used "before Sprint 3 integration and before claiming TRL 4".

---

## 8. Rules for every Claude session

- Work only in your person's lane and the current sprint.
- Edit only folders your lane owns, plus the shared files.
- Never change the frozen interfaces (I1 to I5). If one looks wrong, stop and tell your person.
- Never weaken, skip or delete a failing test.
- Never run `git push` or `sudo` unless your person asks in that session.
- Never commit `.ptau`, `.zkey`, build output, secrets or private data.
- Keep the repo private. No public demo, testnet deployment or posting until the provisional patent application is filed.
- Pin exact package versions and log new ones in PLAN.md.
- Show complete files when changing code, not fragments.
- At the end of a session: tick finished boxes in PLAN.md, add one changelog line, and update sections 4 and 6 of this file.

---

## 9. How to keep this file useful

- Update **Status** (section 4) and **Next tasks** (section 6) at the end of every working session.
- Add new deviations from PLAN.md to section 5.
- Change the "Last updated" line at the top.
- Keep it short. Detail belongs in PLAN.md, commits and `bench/bench.md`.
