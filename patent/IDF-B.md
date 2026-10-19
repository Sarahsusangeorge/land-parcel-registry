# Invention Disclosure (IDF-B) Draft

Version: 0.2 | Last updated: 2026-10-15 | Updated by: Maneesh (sections 1, 2, 4, 6, 7, 9, 10)
Inventors: (as agreed with mentor)

## 1. Title of the invention
<!-- Owner: Maneesh | Sprint 1, final in 4 | Status: Draft, needs Maneesh review -->

Privacy-Preserving Physical-Overlap Prevention for Land Parcel Tokenization Using Sparse Merkle Tree Insert Proofs

## 2. Field / area of invention
<!-- Owner: Maneesh | Sprint 1 | Status: Draft, needs Maneesh review -->

This invention is in the field of blockchain-based land registries and zero-knowledge proof systems. Specifically, it addresses cryptographic enforcement of physical non-overlap between land parcels that are tokenized as NFTs on a blockchain, without publishing the parcel's exact boundary or cell coordinates on-chain.

## 3. Prior patents and publications
<!-- Owner: Sarah | Sprint 1-2 | Status: In progress (first pass 2026-10-13; rows marked "to verify" not yet read in full) -->

### Patents

| Reference | Summary | Limitations | How our invention differs |
|---|---|---|---|
| VIT IDF-B: Blockchain-Based Immutable Land Registry System with NFT Ownership, E-Notary Authentication, and Zero-Knowledge Privacy Protection (invention disclosure, TRL 3) | Land ownership as ERC-721 NFTs; documents on IPFS with only a hash on-chain; E-Notary step; ZK proofs for funds, KYC and ownership at transfer; escrow | Duplicate check only on land IDs and document hashes, so the same land under a new ID passes; location is a single public GPS point; ZK circuits are mocks; no geometry in any proof | We detect duplicates by physical location: every fine grid cell of the parcel must enter an empty slot of the occupied-cell tree, enforced on-chain by a real Groth16 proof, without the boundary or fine cells going on-chain |
| [US 12,333,587 B2](https://patents.google.com/patent/US12333587): Associating land NFTs with digital representations of land parcels (Deere & Co.; filed 2022-05-12, granted 2025-06-17) | Covers a parcel with recursively subdivided S2 cells (Hilbert-curve cell values) and stores the cell list with a land NFT at the owner's blockchain address; used for agricultural-operation agreements | Cell values are a public, "objective and immutable" definition of the land; no parcel-to-parcel overlap or duplicate-registration check; no zero-knowledge proof; cells not kept private | **Closest prior art for "grid cells + land NFT".** We do not claim cells-on-NFT. We claim: cells kept private by the registrar; a ZK proof that each cell was inserted into an empty slot of a sparse Merkle tree (insert proof = non-overlap proof); the contract accepting only proofs whose old root equals the current on-chain root; only a commitment and coarse parent cells published |
| US20240202847A1: Blockchain-GIS based framework for land registration | Cited by the VIT IDF-B as storing parcel geography with blockchain records | To verify: claims not yet read | To verify after reading the claims |

### Publications

| Reference | Summary | Limitations | How our invention differs |
|---|---|---|---|
| [Torun, A. "Geodata Enabled Hierarchical Blockchain Architecture for Resolving Boundary Conflicts in Cadastre Surveys and Land Registration", FIG Congress 2018 (peer review journal paper 9260)](https://fig.net/resources/publications/prj/showpeerreviewpaper.asp?pubid=9260) | Blockchain + middleware + GIS/CAD model; a boundary change is recorded only after hierarchical approval by all stakeholders, with the registry as a trusted node | Conflicts are prevented by human approval workflow, not by an automatic geometric check; geometry is exchanged in the clear; no ZK | Our overlap check is automatic and cryptographic (cell insert into an empty tree slot, verified by the contract), and geometry stays private |
| Privacy-preserving location sharing with hexagonal grids and zero-knowledge proofs (TU Munich, 2025; press release ["Hexagons for data protection"](https://www.tum.de/en/news-and-events/all-news/press-releases/details/hexagons-for-data-protection)) | Proves a user's location lies in a hexagonal grid cell without revealing it | To verify: paper not yet read. Appears to target point location of users, not land parcels | Proves non-overlap of a set of private cells against all registered parcels, with an on-chain root update, not membership of one point |

Search still to run (Sprint 2): Google Patents and InPASS for "zero-knowledge" + "land parcel"; "sparse Merkle tree" + "non-membership" + "geospatial"; "geohash" + "NFT" + "overlap"; IEEE Xplore and Scholar for ZK proof-of-location and blockchain cadastre surveys.

## 4. Summary and background (gap and novelty)
<!-- Owner: Maneesh | Sprint 2 | Status: Draft, needs Maneesh review -->

### Problem

Land is occasionally registered twice. A landowner or fraudster acquires an existing parcel, re-surveys it under a new parcel ID with a slightly altered boundary description, and submits it as a new registration. Blockchain land registries that store ownership as NFTs are particularly exposed to this attack: the NFT minting step checks document hashes and parcel IDs, not physical location. If the new document has a new ID and a new hash, the blockchain accepts the registration. The result is two NFTs covering the same physical land.

The closest prior art, the VIT system, detects duplicates only by land ID and document hash. It stores location as a single GPS point, not a spatial extent. Its ZK circuits are mocked (stubs that always pass). It has no mechanism to detect that a new ID covers the same physical area as an existing registration.

US 12,333,587 B2 (Deere) stores S2 grid cells with a land NFT, which is the closest art for grid-cells-plus-NFT. However, it publishes the cell list on-chain, provides no privacy for land geometry, and includes no duplicate or overlap check.

### Gap in existing systems

No existing blockchain land registry verifies physical non-overlap automatically and without publishing the parcel's spatial representation on-chain. The gap is: a cryptographic mechanism that (a) proves a new parcel does not physically overlap any registered parcel, (b) does not reveal the new parcel's exact geometry to the blockchain or to the public, and (c) is enforced by the smart contract without a trusted off-chain oracle.

### Our solution and novelty

We represent each parcel as a set of H3 hexagonal grid cells at resolution 12, center mode. Each cell is a private input. A sparse Merkle tree (SMT) on the Poseidon hash function accumulates all registered cells. To register a new parcel, the registrar inserts each of its cells into the SMT. If any cell is already in the tree, the insertion fails, proving an overlap with an existing parcel.

The novelty is that this insert-based check is done inside a Groth16 zero-knowledge proof circuit. The circuit proves, without revealing the cell values, that every active cell was successfully inserted into a previously-empty slot, moving the SMT root from a known old value to a new value. The smart contract checks the proof and the root transition. The only data published on-chain is the old root, the new root, a Poseidon commitment to the cell set and a random salt, and a list of coarse parent cells at resolution 9.

This is the first system, to our knowledge, that combines H3 grid-cell decomposition, a sparse Merkle insert proof, a Groth16 ZK circuit, and an on-chain Solidity verifier to enforce physical non-overlap without publishing parcel geometry.

## 5. Objectives
<!-- Owner: Sarah | Sprint 2 | Status: Draft, needs Sarah review -->

The primary objective of this work is to prevent the same physical land from being
tokenized more than once on a blockchain-based land registry.

Specifically, the system aims to:

1. Enforce physical non-overlap automatically: any attempt to register a parcel whose
   H3 grid cells overlap with an already-registered parcel is rejected by the smart
   contract, without human review.
2. Keep exact parcel boundaries private: the fine H3 cells that define a parcel's
   spatial extent are never published on-chain or in the proof. Only a salted
   Poseidon commitment and coarse parent cells at resolution 9 appear on-chain.
3. Enforce non-overlap through the smart contract alone: the contract verifies a
   Groth16 zero-knowledge proof and a Merkle root transition without relying on a
   trusted off-chain oracle or administrator to confirm non-overlap.
4. Demonstrate the approach on real parcel data: the prototype processes parcels from
   the City of Newton, MA cadastral dataset, achieving 95.9% fit rate at H3 resolution
   12 with zero neighbour collisions among real parcel boundaries.

## 6. Working principle
<!-- Owner: Maneesh | Sprint 2 | Status: Draft, needs Maneesh review -->

The system has four components: the geo pipeline, the sparse Merkle tree, the ZK circuit, and the smart contract.

**Geo pipeline.** A parcel polygon (from a cadastral GIS source) is converted to a set of H3 hexagonal cells at resolution 12, center mode. Center mode selects only cells whose centre point lies inside the polygon, so no two neighbouring polygons share a cell. Each cell is represented as a 64-bit integer (the H3 cell index in decimal). Parcels with more than 16 cells (about 4% of Newton, MA parcels at this resolution) are flagged and not registered; parcels with zero cells are also flagged. The registrar also computes the coarse parent cells at resolution 9 for on-chain publication.

**Sparse Merkle tree.** The registrar maintains an off-chain SMT built on the Poseidon hash function, matching the circomlib SMTProcessor circuit. The tree key for a cell is Poseidon([cell_decimal]). The tree value is 1 (present). The root is a 32-byte field element; it summarises the entire set of registered cells. The SMT and its root are the single source of truth for which cells are occupied.

**ZK circuit.** The circuit `register_parcel.circom` (N=16 cells, N_LEVELS=32 tree levels, Groth16) does the following in a single proof:
1. Constraint G5 binds the public `oldRoot` output to the private `initialRoot` input.
2. Constraint G1 (active-prefix gate) requires that active cells come before inactive cells: `cells[i] == 0 implies cells[i+1] == 0`.
3. Constraint I1 requires `active[0] === 1`, rejecting empty-parcel inputs.
4. Constraint G2 hashes each cell to its SMT key: `key[i] = Poseidon([cells[i]])`.
5. Constraint G3 computes the commitment: `inner = Poseidon(cells[0..N-1])`, then `commitment = Poseidon([inner, salt])`, where `salt` is a fresh random 248-bit private input.
6. Constraint G4 chains N SMTProcessor inserts. Each active slot inserts its key into the tree (fails if the slot is occupied) and advances the root. Inactive slots are NOPs that pass the root through.

The circuit's public signals are `[oldRoot, newRoot, commitment]`. The cell values and the salt never appear on-chain.

**Smart contract.** `LandRegistry.sol` stores the current SMT root. On a `registerParcel` call, it checks: (a) `oldRoot` in the proof matches the on-chain root (StaleRoot revert if not); (b) the commitment has not been used before (CommitmentReused revert); (c) the coarse cell list is non-empty; (d) the Groth16 proof verifies against the exported verification key. If all checks pass, it updates the on-chain root to `newRoot` and mints an ERC-721 token to the specified owner address.

The combination of the on-chain root check and the circuit's insert semantics guarantees that every cell in a successfully registered parcel was absent from the tree before the registration. Attempted registration of an overlapping parcel will fail witness generation (the SMT insert rejects the occupied slot), so no valid proof can be produced for an overlapping parcel.

## 7. Detailed description
<!-- Owner: Both | Sprint 3 | Status: Draft, needs Maneesh review -->

### Components

**registrar/src/tree.js.** A thin JavaScript wrapper around the circomlibjs in-memory SMT. It provides `insertCell(cell, value, nLevels)`, which inserts a cell key (Poseidon-hashed) and returns the full Merkle path witness required by the circuit. It also provides `findCell(cell)` for the pre-insertion overlap check, and `save()` / `load(snapshot)` for persistence to a JSON file.

**registrar/src/inputs.js.** Builds the circuit input object from a parcel entry and the current tree state. It calls `insertCell` for each active cell (advancing the tree root as it goes), pads inactive slots to N with zeros, generates a random 248-bit salt, and computes the JS-side commitment for verification. The output is a JSON object ready to pass to `snarkjs.groth16.fullProve`.

**registrar/src/register.js.** The I4 CLI. It loads the parcel from `geo/out/parcels.json`, runs `findCell` for each cell as a pre-proof overlap check, calls `buildInputs`, proves with the production zkey, verifies the proof locally against the vkey, and submits the transaction. It saves the updated tree state only after the transaction confirms. If the transaction reverts with StaleRoot, it reloads the state, rechecks overlap, and reproves once.

**circuits/register_parcel.circom.** The production circuit: N=16, N_LEVELS=32, 588,814 total constraints (from snarkjs r1cs info). The constraint count fits pot20 (2^20 = 1,048,576). The dev variant `register_parcel_dev.circom` uses N=8, N_LEVELS=16 for fast testing (158,981 constraints, fits pot19).

**contracts/contracts/LandRegistry.sol.** The ERC-721 registry contract. Stores the current SMT root and a mapping from commitment to boolean (for CommitmentReused checks). Calls the Groth16Verifier with the proof and public signals. Emits a `ParcelRegistered` event with the tokenId, newRoot, and commitment.

**contracts/contracts/Groth16Verifier.sol.** Exported from the production zkey by `snarkjs zkey export solidityverifier`. Regenerated every time the circuit is rebuilt. The current file corresponds to the 2026-10-15 build (salt + I1 fix, 588,814 constraints).

### Registration flow

1. The registrar receives a parcel polygon from the GIS source (off-chain).
2. The geo pipeline converts the polygon to a set of fine H3 cells (res 12, center mode) and coarse parent cells (res 9).
3. The registrar calls `findCell` on each fine cell to detect an overlap with the current tree. If any cell is found, the registration stops and returns `status: overlap`.
4. The registrar calls `buildInputs`, which inserts all active cells into the off-chain tree and builds the circuit witness. A fresh random salt is generated.
5. `snarkjs.groth16.fullProve` runs the circuit, producing a Groth16 proof and public signals `[oldRoot, newRoot, commitment]`. The registrar verifies the proof locally against the vkey.
6. The registrar calls `LandRegistry.registerParcel` with the proof calldata, public signals, coarse cells, and a metadata URI. The contract checks the root, commitment uniqueness, coarse cell list, and proof.
7. On confirmation, the registrar persists the updated tree state. An ERC-721 token is minted to the owner address.

### Privacy model and trust assumption

The registrar (the entity running `register.js`) sees the full set of fine cells for every parcel it processes. This is a trust assumption: the registrar must be a trusted or regulated party, such as a government cadastral authority.

The blockchain and all observers see only: the old and new SMT roots, the commitment `Poseidon([Poseidon(cells), salt])`, and the coarse parent cells at resolution 9. The coarse cells identify which H3 resolution-9 hexagon(s) contain the parcel, which gives a rough geographic area (each res-9 hexagon covers about 0.1 km2). The exact cell set is not recoverable from the commitment without knowledge of the salt, and the salt is never published.

The ZK proof guarantees that the public signals are consistent with a valid witness: if a proof verifies, then the cell set used in the proof was not already in the tree, the commitment is correctly formed, and the root transition is correct. The proof does not guarantee that the cell set accurately represents the physical parcel; that accuracy depends on the geo pipeline and the registrar's input data.

### Figures

Figures to be added by Sarah (Sprint 3 task 4): system architecture diagram, registration flow diagram, SMT root chain diagram.

## 8. Experimental validation results
<!-- Owner: Both | Sprint 4 | Status: Draft, needs Sarah review -->

All measurements were taken on a MacBook Pro M4 Pro, 24 GB RAM, macOS.
The powers-of-tau files (pot19 and pot20) were generated locally by one contributor
(Maneesh) using `snarkjs powersoftau new` + `contribute` + `prepare phase2`. This is
acceptable for a TRL 4 lab prototype; a public multi-party ceremony file is required
before any deployment beyond a lab context.

### Circuit and proving

| Metric | Value | Source |
|---|---|---|
| Constraint count (production circuit, post-fix) | 588,814 | bench/bench.md |
| Required trusted setup | pot20 (2^20 = 1,048,576 constraints capacity) | bench/bench.md |
| Groth16 setup time | 42 s | bench/bench.md |
| Prove time -- mean (31-parcel run, M4 Pro) | 10,104 ms | bench/results/full_run.json |
| Prove time -- max (31-parcel run, M4 Pro) | 10,482 ms | bench/results/full_run.json |
| Prove time -- min (31-parcel run, M4 Pro) | 9,950 ms | bench/results/full_run.json |
| Proof size (JSON) | 719 bytes | bench/bench.md |
| zkey size | 268.7 MB | CONTEXT.md |

### Smart contract gas (real Groth16Verifier)

| Metric | Value | Source |
|---|---|---|
| registerParcel gas -- mean | 415,944 | bench/results/full_run.json |
| registerParcel gas -- max | 448,564 | bench/results/full_run.json |
| registerParcel gas -- min | 414,700 | bench/results/full_run.json |

Note: A's gas is higher (448,564) because it is the first registration and the SMT root
transition from 0 writes a cold storage slot.

### Geo pipeline (City of Newton, MA -- 24,102 parcels)

| Metric | Value | Source |
|---|---|---|
| Resolution | 12 (fine), 9 (coarse) | bench/bench.md |
| Mode | center | bench/bench.md |
| Cells per parcel -- median | 3 | bench/bench.md |
| Cells per parcel -- max | 1,868 | bench/bench.md |
| Fit rate (1-16 cells per parcel) | 95.9% (23,105 of 24,102) | bench/bench.md |
| Neighbour collisions | 0 | bench/bench.md |

### Full real-parcel run

| Metric | Value | Source |
|---|---|---|
| Total parcels | 31 (30 real Newton + fixture B) | bench/results/full_run.json |
| Registered | 30 | bench/results/full_run.json |
| Overlap rejections | 1 (fixture B, overlaps A as designed) | bench/results/full_run.json |
| Errors | 0 | bench/results/full_run.json |
| Unintended overlaps among real parcels | 0 | bench/results/full_run.json |

### Test results

| Suite | Result | File |
|---|---|---|
| Circuit tests (dev zkey, 7 tests) | 7/7 pass | registrar/test/circuit.test.js |
| Contract tests -- mock verifier (13 tests) | 13/13 pass | contracts/test/registry.mock.test.js |
| Contract tests -- real Groth16Verifier, real proofs (7 tests) | 7/7 pass | contracts/test/registry.e2e.test.js |
| Clean-clone demo (Gate 3) | Pass (2026-10-14) | CONTEXT.md |

## 9. Aspects of the invention that need protection
<!-- Owner: Maneesh | Sprint 4 | Status: Draft, needs Maneesh review -->

The following specific mechanisms are the technical contribution of this work:

1. **The use of a sparse Merkle tree insert proof as a physical-overlap check for land parcels.** Specifically: representing a parcel as a set of H3 hexagonal grid cells, inserting each cell as a key into a Poseidon SMT, and using a Groth16 proof of successful insertion (with no pre-existing key collisions) as the non-overlap certificate accepted by the smart contract.

2. **The circuit constraint design that combines insert-based non-overlap enforcement (G4) with a salted commitment (G3) and an active-prefix gate (G1, I1) in a single Groth16 proof.** The circuit structure allows a single proof to cover a variable-length active cell list (padded to a fixed size N) without revealing the cell values or the number of active cells beyond the binary active/inactive flag.

3. **The on-chain root-chain mechanism in LandRegistry.sol:** the contract maintains a single SMT root, requires that the proof's oldRoot matches the stored root before accepting a registration, and updates the root to newRoot on success. This ties every registration to a globally consistent state of occupied cells, enforced without an oracle.

4. **The commitment binding: `commitment = Poseidon([Poseidon(cells[0..N-1]), salt])`** where salt is a fresh private random value. This makes the commitment unpredictable even to a party who knows the cell set, preventing commitment pre-image attacks and commitment grinding.

We do not claim the H3 grid decomposition itself (Uber H3 is open-source), the Poseidon hash function, the SMT data structure, or Groth16 proving in isolation. The combination and the specific application to the land registration problem is the claimed contribution.

## 10. Technology readiness level
<!-- Owner: Maneesh | Sprint 4 | Status: Draft, needs Maneesh review -->

**Claimed TRL: 4 (Technology Validated in Lab)**

Evidence for TRL 4 as of 2026-10-15:

- The production ZK circuit compiles and generates valid Groth16 proofs (588,814 constraints, pot20 trusted setup).
- 7 circuit tests pass, including tests for the fixed salt commitment and the empty-parcel rejection.
- 13 smart contract tests pass against the mock verifier.
- A fresh Hardhat local node with the real Groth16Verifier was used for all end-to-end tests.
- 31 parcels from a real cadastral dataset (City of Newton, MA) were processed: 30 registered without error, 1 rejected for overlap (fixture B, as designed). No unintended overlaps were detected.
- Prove time: mean 10,104 ms, max 10,482 ms on a MacBook Pro M4 Pro, 24 GB RAM.
- registerParcel gas: mean 415,944, max 448,564 (real Groth16Verifier).
- A clean-clone reproducibility test (Gate 3) passed on 2026-10-14.

**Known limitations at TRL 4:**

- The powers-of-tau files were generated locally by a single contributor. This is acceptable for a lab prototype but not for production. The setup must be replaced with a publicly verifiable multi-party ceremony file before any deployment beyond a lab context.
- The registrar is a single trusted party. There is no mechanism for the contract to verify that the cell set accurately represents the physical parcel boundary. The system enforces consistency and non-overlap, not ground truth.
- Grid approximation: an overlap smaller than the gap between cell centres at res 12 (edge approximately 9.4 m) may not be detected.
- Parcels with more than 16 cells (about 4% of Newton parcels at res 12) cannot be registered with the current circuit parameters.
- E2E contract tests with the real Groth16Verifier and real proof fixtures are not yet written (Sarah's task).

**Not yet at TRL 5:** no public testnet deployment, no independent operator, no public ceremony ptau.

## Changelog

- 2026-10-15: Maneesh drafted sections 1, 2, 4, 6, 7, 9, 10. Circuit fix applied
  (salt in commitment, active[0]===1). Circuit rebuilt, 7/7 tests pass.
  Full 31-parcel run complete with fixed circuit.
- 2026-10-12: Template created (Sarah, Sprint 0).
