# Land Parcel Non-Overlap Registry: Build Plan to TRL 4

Plan by Maneesh Ari, 2026-10-12. Repo copy of the build plan doc; this file is the source of truth from Sprint 1 on.

Read `CONTEXT.md` first for current status, then this file.

## How to use this doc

Maneesh and Sarah work in parallel lanes, sprint by sprint, and each points their own coding-assistant session at this file.

1. Find the current sprint. Work only on your lane.
2. Before starting a task, check the Interfaces section. Your output must match it exactly.
3. Tick the checkbox when a task meets its acceptance line, not before.
4. Add one line to the changelog at the end of each working session.
5. If you need to change an interface, log it in the decision log and tell the other person before merging.

### Session rules

Paste this block at the start of every coding-assistant session:

```
You are helping build the land parcel non-overlap registry. Read CONTEXT.md, then PLAN.md.

My lane: <Maneesh | Sarah>. Current sprint: <number>.

Rules:
- Work only on tasks in my lane for the current sprint.
- Edit only folders my lane owns (see Repo layout). Shared files: PLAN.md,
  patent/IDF-B.md, bench/.
- Never change anything in the Interfaces section. If an interface looks wrong, stop
  and tell me.
- Never weaken, skip or delete a failing test to make it pass.
- Use mocks only where the plan says so (mock verifier in Sprint 2 only).
- Pin exact package versions. Record new ones in the decision log.
- No secrets, keys or private data in the repo. The repo stays private.
- No tool or assistant attribution in commits, PRs or files.
- When a task is done: tick its box in PLAN.md and add one changelog line.
- Keep answers short. Show complete files when changing code, not fragments.
```

## Goal and TRL 4 target

Build a working prototype in which a smart contract rejects a land parcel that overlaps an already registered parcel, using a zero-knowledge proof, without exact boundaries ever going on-chain. Done means TRL 4: every component integrated and validated end to end in a lab setting, on real parcel data, with measured results.

What TRL 4 means here:

- Real Circom circuit, not a mock. Real proofs generated and verified on a local Hardhat chain.
- Real US parcel polygons from public GIS data, not hand-typed coordinates.
- One command runs the full flow: parcel file in, proof generated, contract accepts or rejects.
- Automated tests cover accept, reject and tamper cases.
- Measured numbers: constraint count, proving time, verification gas, cells per parcel at two resolutions.

### Privacy model (state this honestly in the patent)

- Public chain sees: occupied-set roots, a parcel commitment (hash), coarse public cells, owner address.
- Public chain never sees: exact polygon or fine grid cells.
- Registrar sees: the exact polygon and fine cells. It certifies the parcel, holds the occupied-cell tree and generates proofs.
- Hashing cells does not hide them from someone who guesses cells in a known area. Privacy rests on the fine cells never leaving the registrar.

### Trust assumption

The registrar (a land office or licensed surveyor in the real world) certifies that the polygon matches the land. The proof guarantees consistency, not ground truth. Only an address with the registrar role can submit registrations.

## System design

Four components. The key idea: inserting each fine cell into a sparse Merkle tree only succeeds if that cell is empty, so a valid insert proof is itself the non-overlap proof.

| Component | Folder | Owner | Does |
|---|---|---|---|
| Geo pipeline (Python) | `geo/` | Sarah | Polygon to H3 fine cells and coarse cells, writes `parcels.json` |
| Circuit (Circom) | `circuits/` | Maneesh | Proves cells match the commitment and were all inserted into an empty slot |
| Registrar service (Node) | `registrar/` | Maneesh | Holds the occupied-cell tree, builds inputs, generates proof, submits tx |
| Registry contract (Solidity) | `contracts/` | Sarah | Verifies proof, checks and updates root, mints ERC-721, stores commitment |

### Registration flow

1. Registrar receives a certified parcel polygon (GeoJSON).
2. Geo pipeline converts it to fine H3 cells (private) and coarse parent cells (public), at the frozen resolutions.
3. Registrar picks a random salt and computes `commitment = Poseidon(Poseidon(cells[0..15]), salt)`.
4. Registrar inserts each cell into its local sparse Merkle tree copy, recording the old root, new root and siblings for every insert.
5. If any cell already exists, the insert fails. The parcel overlaps. Stop here and report which parcel it hits.
6. Otherwise, build the circuit input and generate a Groth16 proof with public signals `[oldRoot, newRoot, commitment]`.
7. Registrar calls `registerParcel` on the contract with the proof, public signals, coarse cells, owner address and metadata URI.
8. Contract checks caller has the registrar role, `oldRoot == occupiedRoot`, and the proof verifies.
9. Contract sets `occupiedRoot = newRoot`, mints the NFT to the owner, stores commitment and coarse cells, emits `ParcelRegistered`.
10. Registrar saves its updated tree only after the transaction is confirmed.

Why the contract still matters if step 5 already catches overlaps: the contract enforces it. A registrar cannot skip the check, reuse an old root or alter the commitment, because the proof would fail on-chain.

## Repo layout and ownership

Each folder has one owner, so the two lanes never edit the same files. Shared files are edited in small, separate commits.

```
/
├── PLAN.md                  shared   this doc
├── README.md                shared   setup and one-command demo
├── geo/                     Sarah
│   ├── requirements.txt
│   ├── data/raw/            downloaded GeoJSON (gitignored if large)
│   ├── src/parcels.py       polygon to cells
│   ├── tests/
│   └── out/parcels.json     pipeline output (interface)
├── circuits/                Maneesh
│   ├── toy/                 Sprint 1 spike
│   ├── register_parcel.circom
│   ├── scripts/build.sh     compile, setup, export verifier
│   └── build/               gitignored
├── registrar/               Maneesh
│   ├── package.json
│   ├── src/tree.js          sparse Merkle tree state
│   ├── src/inputs.js        circuit input builder
│   ├── src/register.js      CLI: end-to-end registration
│   └── state/               tree.json, salts (gitignored)
├── contracts/               Sarah (Hardhat project)
│   ├── contracts/LandRegistry.sol
│   ├── contracts/Groth16Verifier.sol   generated, copied in by circuits/scripts/build.sh
│   ├── contracts/MockVerifier.sol      Sprint 2 only
│   ├── test/
│   └── scripts/deploy.js
├── bench/                   shared
│   ├── results/*.json
│   └── bench.md
└── patent/                  shared
    ├── IDF-B.md
    └── figures/
```

One exception to ownership: `contracts/contracts/Groth16Verifier.sol` is written only by Maneesh's build script. Sarah never edits it by hand.

### Git workflow

- Branches: `maneesh/s<N>-<task>` and `sarah/s<N>-<task>`. Example: `sarah/s2-registry`.
- Small pull requests into `main`. The other person skims and merges within the same day. Squash-merge, with a clean message.
- `main` must always pass `npm test` in `contracts/` and `pytest` in `geo/`.
- Gitignore: `circuits/build/`, `registrar/state/`, `*.ptau`, `.env`, `node_modules/`, large raw data.
- Keep the repo private until the provisional patent application is filed.

## Stack and setup

Everything runs locally. Exact versions are in the decision log.

| Area | Tools | Lane |
|---|---|---|
| Geo | Python 3.11+, h3 (v4 API), shapely, pyproj, pytest | Sarah |
| Circuit | circom 2.x (built from source with Rust), snarkjs, circomlib | Maneesh |
| Registrar | Node 20+, circomlibjs (Poseidon and sparse Merkle tree), snarkjs, ethers | Maneesh |
| Contracts | Hardhat, Solidity 0.8.x, OpenZeppelin Contracts (ERC721, AccessControl), hardhat-gas-reporter | Sarah |

Setup commands for each lane are in `README.md`.

### Conventions

- Cell IDs travel as H3 hex strings in JSON and as decimal strings when they enter the circuit or contract. Never as JS numbers, which lose precision past 2^53.
- All field elements in JSON are decimal strings.
- Every script prints what it read, what it wrote and where.

## Interfaces (frozen)

These are the contracts between the two lanes. Values marked "set in Sprint 0" are decided once, written into the decision log, then frozen. Any later change needs a decision log entry and both people agreeing.

### I1. Constants

| Name | Value | Notes |
|---|---|---|
| `FINE_RES` | set in Sprint 0 (start by testing 12) | Chosen so most sample parcels give at most N fine cells |
| `COARSE_RES` | set in Sprint 0 (start by testing 9) | Public footprint resolution |
| `CELL_MODE` | set in Sprint 0 | center (cells whose centre is inside) preferred. Each cell then belongs to at most one parcel, so true neighbours never collide. overlap mode makes shared boundaries look like overlaps. Trade-off: overlaps smaller than a cell can slip through. |
| `N` | 16 | Max fine cells per parcel. Also Poseidon's input limit in circomlib. |
| `N_LEVELS` | 32 | Sparse Merkle tree depth |
| Tree key | `Poseidon([cell])` | Hashing spreads key bits. Raw H3 IDs share long bit prefixes and would overflow tree depth. |
| Tree value | 1 | |
| Commitment | `Poseidon([Poseidon(cells[0..15]), salt])` | Unused cell slots are 0 |
| Empty tree root | 0 | circomlib convention |

### I2. Geo output: `geo/out/parcels.json`

```json
{
  "meta": {
    "fine_res": 12,
    "coarse_res": 9,
    "cell_mode": "center",
    "max_cells": 16,
    "source": "<county GIS dataset name and URL>",
    "generated_at": "<ISO timestamp>"
  },
  "parcels": [
    {
      "parcel_id": "A",
      "source_feature_id": "<id from the GIS file>",
      "polygon_sha256": "<hex of canonical GeoJSON geometry>",
      "area_m2": 1234.5,
      "fine_cells": ["8c2a1072b59ffff"],
      "fine_cells_dec": ["<decimal string>"],
      "coarse_cells": ["892a1072b5bffff"],
      "coarse_cells_dec": ["<decimal string>"],
      "num_fine_cells": 7,
      "fits_batch": true
    }
  ]
}
```

Required fixtures: A (a real parcel), B (A shifted by roughly one cell width, so it shares at least one fine cell with A, simulating a redrawn re-registration), C (a real parcel sharing no cells with A or B). Plus at least 10 more real parcels for benchmarks. Cell lists are sorted ascending.

### I3. Circuit: `circuits/register_parcel.circom`

Template `RegisterParcel(N, N_LEVELS)`. Public signals, in this declared order: `oldRoot`, `newRoot`, `commitment`.

| Signal | Visibility | Meaning |
|---|---|---|
| `oldRoot` | public | Tree root before this parcel |
| `newRoot` | public | Tree root after inserting all active cells |
| `commitment` | public | Parcel commitment (I1) |
| `cells[N]` | private | Fine cell IDs as field elements, 0 in unused slots |
| `active[N]` | private | 1 for used slots, 0 after. Must be a prefix of 1s. |
| `salt` | private | Random field element |
| `siblings[N][N_LEVELS]` | private | Per-insert siblings, zero-padded |
| `oldKey[N]`, `oldValue[N]`, `isOld0[N]` | private | Per-insert values from circomlibjs `smt.insert` |

Constraints the circuit must enforce:

1. Each `active[i]` is 0 or 1, `active[0] == 1`, and `active[i+1] <= active[i]`.
2. Active cells are non-zero. Inactive cells are zero.
3. `commitment` equals the I1 formula.
4. For each slot, an `SMTProcessor` with `fnc = [active[i], 0]` (insert or no-op), key `Poseidon([cells[i]])`, value 1.
5. Roots chain: slot 0 starts at `oldRoot`, slot N-1 ends at `newRoot`.

An insert of a key that already exists cannot satisfy the constraints. That is the non-overlap guarantee.

### I4. Registrar CLI

```
node registrar/src/register.js --parcel <parcel_id> --owner <address> [--dry-run]
```

Prints one JSON line:

```json
{"parcel_id":"B","status":"overlap","overlaps":["A"],"tx_hash":null,"token_id":null,"prove_ms":null}
```

`status` is one of `registered`, `overlap`, `error`. State lives in `registrar/state/tree.json` (ordered list of inserted keys with their `parcel_id` and cell) and `registrar/state/salts.json`. The tree is rebuilt by replaying inserts in order. Proof calldata comes from snarkjs's Solidity calldata export, so the `b` coordinates are already in the order the verifier expects.

### I5. Contract: `contracts/contracts/LandRegistry.sol`

```solidity
interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata pubSignals            // [oldRoot, newRoot, commitment]
    ) external view returns (bool);
}

// LandRegistry is ERC721 + AccessControl
bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
uint256 public occupiedRoot;               // starts at 0
mapping(uint256 => bool) public commitmentUsed;

constructor(address verifier, address admin);

function registerParcel(
    address owner,
    uint[2] calldata a,
    uint[2][2] calldata b,
    uint[2] calldata c,
    uint[3] calldata pubSignals,
    uint64[] calldata coarseCells,
    string calldata metadataURI
) external returns (uint256 tokenId);                // onlyRole(REGISTRAR_ROLE)

function getParcel(uint256 tokenId) external view
    returns (uint256 commitment, uint64[] memory coarseCells, string memory metadataURI, uint256 registeredAt);

event ParcelRegistered(uint256 indexed tokenId, address indexed owner,
    uint256 commitment, uint256 oldRoot, uint256 newRoot);

error StaleRoot();
error InvalidProof();
error CommitmentReused();
error EmptyCoarseCells();
```

`registerParcel` checks, in order: caller role, `coarseCells` not empty, `pubSignals[0] == occupiedRoot`, commitment not used, proof valid. Then it updates `occupiedRoot`, marks the commitment used, mints token IDs from 1 upwards, stores the parcel and emits the event.

### I6. End-to-end proof fixtures: `contracts/test/fixtures/`

Written by Maneesh's `register.js --dry-run` on his machine, read by Sarah's `registry.e2e.test.js`. All numbers are decimal strings.

| File | Content |
|---|---|
| `A.json` | Valid registration of parcel A on the empty tree |
| `C_after_A.json` | Valid registration of parcel C, built on the root after A |
| `B_overlap.json` | The registrar's I4 output for parcel B: `status` `"overlap"`, `overlaps` listing `"A"`. No proof exists for B, by design. |

Proof fixtures (`A.json`, `C_after_A.json`):

```json
{
  "a": ["<x>", "<y>"],
  "b": [["<x1>", "<x0>"], ["<y1>", "<y0>"]],
  "c": ["<x>", "<y>"],
  "pubSignals": ["<oldRoot>", "<newRoot>", "<commitment>"],
  "coarseCells": ["<decimal uint64>"],
  "metadataURI": "<string>"
}
```

`a`, `b`, `c` and `pubSignals` are exactly the arrays from `snarkjs zkey export soliditycalldata`, so `b` is already in verifier order. The owner address is not part of the proof; tests pick their own signer as owner.

## Sprint 0: Setup (half a day)

Goal: both machines can build their lane, the repo skeleton exists, and the I1 constants are decided.

Together (first hour)

- [x] Create the private repo with the folder layout above, `.gitignore` and an empty `patent/IDF-B.md` from the template in the Patent track section
- [x] Add this doc as `PLAN.md`
- [x] Pick the county GIS source for US parcels and write it in the decision log

Maneesh lane

- [x] Install circom and snarkjs. `circom --version` runs.
- [x] Set up `registrar/` with circomlib, circomlibjs, snarkjs, ethers. Pin versions.
- [x] Download a small powers-of-tau file for the toy circuit
- [x] Write `circuits/scripts/build.sh` skeleton: compile, Groth16 setup, export zkey, export verifier, copy `Groth16Verifier.sol` into `contracts/contracts/`

Acceptance: circomlib's own SMT test circuit compiles on Maneesh's machine.

Sarah lane

- [x] Set up `geo/` venv with h3, shapely, pytest. Pin versions.
- [x] Set up the Hardhat project in `contracts/` with OpenZeppelin and the gas reporter. `npx hardhat test` runs (zero tests is fine).
- [x] Download 20 to 30 parcels from the chosen county into `geo/data/raw/`
- [x] Quick check: cell counts per parcel at resolutions 11, 12 and 13, in both overlap and center modes

Acceptance: Sarah posts a small table of median and max cells per parcel for each resolution and mode. (Done: `bench/bench.md`, all 24,102 Newton parcels.)

Decide and freeze (end of Sprint 0)

- [ ] `FINE_RES`, `COARSE_RES`, `CELL_MODE` chosen from Sarah's table, so most parcels fit N = 16. Log it. (Proposed in decision log; needs Maneesh's agreement.)
- [x] Exact package versions logged

## Sprint 1: Geo pipeline and toy circuit (1 day)

Goal: prove the risky part works. A toy circuit inserts a cell into a sparse Merkle tree and fails on a duplicate. Real parcels come out as cells in the I2 format.

Maneesh lane

- [x] `circuits/toy/insert_one.circom`: one SMTProcessor insert, N_LEVELS = 10, key `Poseidon([cell])`, value 1. Public: oldRoot, newRoot.
- [x] `registrar/src/tree.js`: wrap circomlibjs sparse Merkle tree. Functions: `load()`, `insertCell(cell, parcelId)` returning the I3 per-insert values, `findCell(cell)`, `save()`.
- [x] Toy script: insert cell X, prove, verify with snarkjs. Then try inserting X again and confirm witness generation fails.
- [x] Write the toy results (constraint count, prove time) in `bench/bench.md`

Acceptance: valid insert proves and verifies. Duplicate insert cannot produce a witness.

Sarah lane

- [x] `geo/src/parcels.py`: read GeoJSON, compute fine and coarse cells at the frozen settings, sort them, write `geo/out/parcels.json` exactly per I2
- [x] Build fixtures A, B (A shifted a few metres) and C
- [x] `geo/tests/`: B shares at least one fine cell with A; C shares none with A or B; output validates against I2; decimal strings round-trip to the hex IDs
- [x] Flag parcels with more than 16 cells (`fits_batch: false`), never truncate silently

Acceptance: pytest passes and `parcels.json` holds A, B, C and at least 10 more real parcels. (Done: 22 tests, 31 parcels.)

Patent lane

- [x] Sarah: prior-art search (Google Patents, InPASS, Google Scholar, IEEE Xplore). Fill IDF-B Section 3 rows.
- [ ] Maneesh: fill IDF-B Sections 1 and 2 (draft title and field)

Gate 1 (end of Sprint 1)

- [x] Go: toy proof verifies and duplicate fails. Continue to Sprint 2.
- [ ] No-go: after one full extra day of trying, switch to the Fallback path section. Log the decision.

## Sprint 2: Full circuit and registry contract (1 day)

Goal: the real circuit and the real contract exist, each tested on its own. Sarah uses a mock verifier so she never waits for Maneesh.

Maneesh lane

- [ ] `circuits/register_parcel.circom`: full I3 template with N = 16, N_LEVELS = 32, all five constraint groups (built and tested, but missing the salt in the commitment and `active[0] == 1`; see CONTEXT.md section 7)
- [ ] `registrar/src/inputs.js`: from a `parcels.json` entry plus tree state, build the full circuit input (cells padded with 0, active prefix, salt, per-insert siblings zero-padded to 32) (built; salt still to add with the circuit fix)
- [x] Check constraint count, then pick the powers-of-tau size and log it (588,297 constraints, pot20)
- [x] Run `circuits/scripts/build.sh` end to end. Output: wasm, final zkey, verification key, `Groth16Verifier.sol` copied into `contracts/contracts/`
- [x] Circuit tests with snarkjs: A proves; B after A fails witness generation; C after A proves; tampered commitment fails verification; non-prefix active fails

Acceptance: all five circuit tests behave as stated. Verifier contract is committed to Sarah's folder by the build script.

Sarah lane

- [x] `contracts/contracts/MockVerifier.sol`: implements `IGroth16Verifier`, returns a settable bool
- [x] `contracts/contracts/LandRegistry.sol`: exactly per I5, ERC721 + AccessControl, custom errors
- [x] `contracts/test/registry.mock.test.js` using the mock verifier:
    - registrar registers, root updates, token 1 minted to owner, event emitted
    - non-registrar caller reverts
    - stale oldRoot reverts with `StaleRoot`
    - reused commitment reverts with `CommitmentReused`
    - empty coarse cells reverts with `EmptyCoarseCells`
    - mock returns false, reverts with `InvalidProof`
    - `getParcel` returns stored values
- [x] `contracts/scripts/deploy.js`: deploy verifier and registry to the local Hardhat node, grant registrar role, write addresses to `contracts/deployments/local.json`

Acceptance: all mock tests pass. Deploy script works on `npx hardhat node`. (Done: 13 tests; also checked against Maneesh's generated verifier.)

Patent lane

- [ ] Maneesh: IDF-B Sections 4 (gap) and 6 (working principle)
- [ ] Sarah: IDF-B Section 5 (objectives) and finish Section 3 (Section 5 drafted; Section 3 needs the US20240202847A1 claims read)

Gate 2 (end of Sprint 2)

- [x] Circuit tests pass and contract mock tests pass. Merge both to main. (PRs #1 and #2)

## Sprint 3: Integration and end-to-end tests (1 day)

Goal: one command takes a parcel from `parcels.json` to an on-chain decision, using the real verifier.

Maneesh lane

- [x] `registrar/src/register.js`: the I4 CLI. Load tree, check overlaps first with `findCell` (report overlap with the parcel IDs hit), build inputs, prove, export calldata, call `registerParcel`, save tree and salt only after the tx confirms.
- [x] `--dry-run` proves but does not submit
- [x] `registrar/scripts/demo.sh`: start from an empty tree, register A, attempt B, register C, print the three JSON lines
- [x] Handle failures cleanly: stale root (another registration landed first) rebuilds the proof once, then reports error

Acceptance: `demo.sh` prints registered, overlap (hitting A), registered, on a fresh local chain.

Sarah lane

- [x] Remove the mock from the deploy path. Deploy uses the real `Groth16Verifier`.
- [x] `contracts/test/registry.e2e.test.js` with real proofs (fixtures produced by Maneesh's `--dry-run`, saved under `contracts/test/fixtures/` per I6):
    - A real proof for A registers
    - Replaying A's proof after A reverts with `StaleRoot`
    - C's proof, generated against the root after A, registers
    - A proof with one public signal changed reverts with `InvalidProof`
    - A valid proof submitted by a non-registrar reverts
- [x] Turn on the gas reporter for `registerParcel`

Acceptance: all end-to-end tests pass against the real verifier. (Sarah lane done: 8 e2e tests + 13 mock tests pass; `registerParcel` with the real verifier used 448,564 gas for A and 415,048 for C.)

Patent lane

- [x] Sarah: IDF-B Section 7 figures (architecture, registration sequence, overlap rejection of B) in `patent/figures/`
- [ ] Maneesh: IDF-B Section 7 text, including the privacy model and trust assumption

Gate 3 (end of Sprint 3)

- [x] Demo runs from a clean clone using only the README. Ask the other person to try it on their machine. (Maneesh's Mac, 2026-10-14; zkey and wasm copied in, see CONTEXT.md section 5)

## Sprint 4: Benchmarks and TRL 4 evidence (1 day)

Goal: measured numbers and reproducible evidence, so the IDF-B can honestly claim TRL 4.

Maneesh lane

- [x] Constraint count from `snarkjs r1cs info` (588,297)
- [x] Proving time: mean and max over 5 runs for 3 parcels of different sizes. Note CPU and RAM. (measured as one run per parcel over all 31 parcels instead: mean 10,102 ms, max 10,846 ms, M4 Pro, 24 GB)
- [x] Proof size and verification key size (719 bytes, 3.2 KB)
- [ ] Resolution comparison: regenerate cells at two fine resolutions (from Sarah), report cells per parcel and how many parcels fit N = 16
- [ ] Write results to `bench/results/circuit.json` and summarize in `bench/bench.md`

Sarah lane

- [x] Gas for `registerParcel` (mean, min, max) from the gas reporter, written to `bench/results/gas.json` (from transaction receipts via `contracts/scripts/gas_bench.js`, because the reporter's row also counts the reverting test calls)
- [x] Register all real parcels in sequence. Record pass and overlap counts. Any unexpected overlap between real neighbours goes in `bench.md` as a known limitation of the grid approximation. (Maneesh's full run: 30 registered, B the only overlap, no unexpected overlaps; `bench/results/full_run.json`)
- [x] Screenshots and logs: demo output, test run, gas table, saved in `patent/figures/` (`patent/figures/logs/`)
- [x] README: clean-clone setup and the one-command demo

Acceptance: `bench.md` has every number in the TRL 4 checklist, each traceable to a results file or log.

Patent lane

- [ ] Both: IDF-B Section 8 (experimental results) from `bench.md`, numbers only from measured runs
- [ ] Maneesh: IDF-B Section 9 (aspects to protect) and Section 10 (TRL)
- [ ] Maneesh: one full pass so the IDF-B reads in one voice. Send to the mentor.

Gate 4 (end of Sprint 4)

- [ ] Every item in the TRL 4 checklist is ticked with evidence

## Fallback path and stretch goals

### Fallback (only if Gate 1 fails)

Use this if the toy circuit still fails after one extra day. It keeps the project moving but weakens the patent case, because it moves closer to the existing IDF-B's hash-based duplicate check.

- Registrar keeps the same sparse Merkle tree off-chain and checks overlaps with `findCell`.
- Contract stores the new root and commitment, accepting them only with the registrar's ECDSA signature instead of a ZK proof.
- Everything else (geo pipeline, fixtures, tests, benchmarks) stays the same.
- Claim TRL 3 in the IDF-B, not TRL 4.
- Keep retrying the circuit at a smaller size (N = 4, N_LEVELS = 16) in parallel. If it works, switch back.

### Stretch goals (after TRL 4, in this order)

1. Bind coarse cells to fine cells inside the circuit (H3 parent is bit operations on the cell ID), so the public footprint is provably consistent.
2. Parcels larger than 16 cells: chain two proofs, or widen N with a two-level Poseidon hash.
3. Encrypted exact polygon stored off-chain, with key sharing to buyers and courts (proxy or threshold re-encryption).
4. Ownership transfer flow that keeps the occupied set unchanged.
5. Public testnet deployment, only after the provisional patent application is filed. A public deployment counts as disclosure.

## Patent track: `patent/IDF-B.md`

The disclosure lives as a Markdown file in the repo, following VIT's 10-section IDF-B form. Each section is filled in the sprint that produces its inputs, so it is finished when the build is.

| # | Section | Owner | Sprint |
|---|---|---|---|
| 1 | Title | Maneesh | 1 (draft), 4 (final) |
| 2 | Field | Maneesh | 1 |
| 3 | Prior art table | Sarah | 1 to 2 |
| 4 | Summary, gap, novelty | Maneesh | 2 |
| 5 | Objectives | Sarah | 2 |
| 6 | Working principle | Maneesh | 2 |
| 7 | Detailed description and figures | Both | 3 |
| 8 | Experimental results | Both | 4 |
| 9 | Aspects to protect | Maneesh | 4 |
| 10 | TRL | Maneesh | 4 |

Update rules

- Update the file in the same pull request as the work it describes.
- Change the section's status comment when you edit it.
- Section 8 uses only numbers from `bench/`. Never round up or claim untested behaviour.
- Describe mechanisms concretely (grid, tree, circuit, contract checks). India's 2025 CRI guidelines expect cryptographic techniques and data structures to be disclosed.
- Frame the invention as a technical solution to a technical problem: double tokenization of the same physical land. Never as "encrypted coordinates on an NFT".
- The existing VIT IDF-B (BlockLand Registry) is the closest prior art. Distinguish it in Sections 3 and 4.

## TRL 4 evidence checklist

Claim TRL 4 in the IDF-B only when every box below is ticked and each has a file or log behind it.

Integration

- [ ] Real Circom circuit with all I3 constraints (no mock anywhere in the final path) (real circuit in the final path, but salt and `active[0] == 1` still missing)
- [x] Real verifier deployed and called by `LandRegistry` on a local chain (`registrar/scripts/demo.sh`, `contracts/test/registry.e2e.test.js`)
- [x] One-command demo from a clean clone: A registered, B rejected as overlap, C registered (`patent/figures/logs/demo_run.txt`)

Validation

- [x] Circuit tests pass (Sprint 2 list) (`registrar/test/circuit.test.js`)
- [x] Contract mock and end-to-end tests pass (Sprints 2 and 3 lists) (21 passing)
- [x] At least 10 real US parcels registered in sequence, with results recorded (30, `bench/results/full_run.json`)
- [x] Tamper cases rejected: changed public signal, replayed proof, stale root, non-registrar caller (`registry.e2e.test.js`)

Measurements (all in `bench/bench.md`)

- [x] Constraint count
- [x] Proving time, mean and max, with hardware noted
- [x] Verification gas, mean (415,942 over 30 registrations)
- [x] Cells per parcel at two fine resolutions, and share of parcels that fit N = 16 (res 11, 12 and 13 over 24,102 parcels)
- [x] Known limitations written down (grid approximation, parcel size limit, registrar trust) (`bench/bench.md`)

Documentation

- [x] README reproduces everything above (proving rows need the production zkey)
- [x] Screenshots and logs saved in `patent/figures/`
- [ ] IDF-B Sections 1 to 10 complete and sent to the mentor

## Decision log

Append new rows at the top. A decision that changes an interface needs both names in the "Agreed by" column.

| Date | Decision | Why | Agreed by |
|---|---|---|---|
| 2026-10-14 | I4 `registered` lines also carry `oldRoot`, `newRoot`, `commitment` | Additive; makes root transitions auditable from the CLI output without an on-chain call. Not present on `overlap` or `error` lines | Maneesh; pending Sarah |
| 2026-10-14 | Add I6: end-to-end proof fixtures `A.json`, `C_after_A.json`, `B_overlap.json` in `contracts/test/fixtures/` | Sarah's e2e tests and Maneesh's `--dry-run` need one agreed file shape | Sarah; pending Maneesh |
| 2026-10-14 | Squash-merge PRs into `main`; no tool attribution in commits, PRs or files | Keep `main` history clean | Sarah; pending Maneesh |
| 2026-10-13 | Contracts compile for the Cancun EVM (`evmVersion: "cancun"`) | OpenZeppelin 5.6 uses `mcopy`, which needs Cancun | Sarah; pending Maneesh |
| 2026-10-13 | Fixture B = A shifted 5 m east | Resolves "roughly one cell width" (I2) vs "a few metres" (Sprint 1). 5 m is about half a res-12 edge; B shares 5 of A's cells | Sarah; pending Maneesh |
| 2026-10-13 | Parcels with 0 fine cells are flagged `fits_batch: false`, not given a fallback cell | A fallback cell (the cell under a point inside the parcel) made 658 of 24,102 Newton parcels collide with a neighbour | Sarah; pending Maneesh |
| 2026-10-13 | `FINE_RES = 12`, `COARSE_RES = 9`, `CELL_MODE = center` | Res 12 center: 95.9% of 24,102 Newton parcels fit N = 16 and no neighbours collide. Res 11 leaves 55% with 0 cells; res 13 fits 37%; overlap mode makes nearly every neighbour collide (`bench/bench.md`) | Sarah; pending Maneesh |
| 2026-10-13 | Parcel source: City of Newton, MA parcel layer (`NewtonMAGIS/GISData`, `Property/Parcels.geojson`), replacing Fairfax County, VA | Official city data, already WGS84; Fairfax's server was unreachable from the build environment. Committed sample drops owner names and values | Sarah; pending Maneesh |
| 2026-10-13 | Production circuit uses pot20 | `snarkjs r1cs info`: 588,297 constraints > 2^19. Note: Maneesh's notes say a locally generated ptau needs `prepare phase2` before `groth16 setup` (else a corrupt zkey); keep that step | Maneesh |
| 2026-10-13 | Keep `register_parcel_dev.circom` (N = 8, N_LEVELS = 16) for tests only | Fits pot19, so circuit tests do not wait on the production setup. Production verifier must come from the production zkey | Maneesh |
| 2026-10-13 | Hardhat 2.29.1 (not 3.x) with hardhat-toolbox 5.0.0 | Toolbox 5 bundles hardhat-gas-reporter 1.0.10 and chai matchers used by the JS tests | Sarah |
| 2026-10-12 | Tree key is `Poseidon([cell])`, not the raw H3 ID | Raw H3 IDs share long bit prefixes and would exceed tree depth | Pending |
| 2026-10-12 | `CELL_MODE` leans center | Real neighbours sharing a boundary must not count as overlaps | Pending |
| 2026-10-12 | N = 16, N_LEVELS = 32 | Poseidon input limit in circomlib; depth leaves margin for hashed keys | Pending |
| 2026-10-12 | Registrar holds fine cells and generates proofs | Proving needs the full tree; registrar already certifies parcels | Pending |
| 2026-10-12 | US county GIS parcels for the prototype | Public, digitized, standard GeoJSON. Mentor informed. | Maneesh, Sarah |
| 2026-10-12 | Circom, snarkjs, Groth16, Hardhat, OpenZeppelin | Mature tooling, Solidity verifier export | Maneesh, Sarah |

### Pinned versions

| Area | Package | Version |
|---|---|---|
| Geo | Python | 3.11+ (tested 3.13) |
| Geo | h3 / shapely / pyproj / pytest | 4.5.0 / 2.2.0 / 3.8.0 / 9.1.1 (full list in `geo/requirements.txt`) |
| Contracts | hardhat / @nomicfoundation/hardhat-toolbox | 2.29.1 / 5.0.0 |
| Contracts | @openzeppelin/contracts | 5.6.1 |
| Contracts | Solidity | 0.8.28 |
| Circuit | circom | 2.2.3 |
| Registrar | circomlib / circomlibjs / snarkjs / ethers / jest | 2.0.5 / 0.1.7 / 0.7.6 / 6.17.0 / 29.7.0 |

## Changelog

| Date | Who | What changed |
|---|---|---|
| 2026-10-15 | Sarah | Sprint 4: IDF-B Figs. 1 to 3, `gas_bench.js` and `bench/results/gas.json`, evidence logs, README reproduction table, limitations in `bench.md` |
| 2026-10-15 | Sarah | Merged `maneesh/s3-registrar` into `main`: folded Maneesh's Sprint 3 checklist and TRL 4 checklist into this file |
| 2026-10-14 | Maneesh | Sprint 4: full real-parcel run (30/31 registered, B the only overlap), `bench.md` full-run section, evidence logs. Prove ms mean 10,102 / max 10,846; gas mean 415,942 / max 448,564 |
| 2026-10-14 | Maneesh | Sprint 3: `register.js` I4 CLI, proof fixtures, `demo.sh`, Gate 3 clean-clone run. Demo prove times A 9,723 ms, C 9,631 ms |
| 2026-10-14 | Sarah | Sprint 3: deploy path uses the real `Groth16Verifier`; `registry.e2e.test.js` (8 tests) on Maneesh's fixtures; gas reporter covers `registerParcel` |
| 2026-10-14 | Maneesh | Housekeeping: `CONTEXT.md`, `.gitattributes`, ptau provenance; PR #2 squash-merged into `main` |
| 2026-10-14 | Sarah | `PLAN.md` replaced with the full plan; I6 fixture format proposed; IDF-B Sections 3 and 5; checked `LandRegistry` against Maneesh's generated verifier |
| 2026-10-13 | Maneesh | Sprints 0 to 2 on `maneesh/s0-setup`: toy circuit (Gate 1 passed), `tree.js`, `inputs.js`, `register_parcel.circom`, production setup with pot20, `Groth16Verifier.sol`, 5 circuit tests |
| 2026-10-13 | Sarah | Sprint 1 geo pipeline and fixtures; Sprint 2 `LandRegistry`, mock tests, deploy script; IDF-B Section 3 first pass |
| 2026-10-12 | Sarah | Sprint 0: repo skeleton, geo and contracts setup, cell-count analysis |
| 2026-10-12 | Maneesh | Plan created. Phase 0 (mentor, inventorship, IPR Cell template) done. |
