# Invention Disclosure (IDF-B) Draft

Version: 0.5 | Last updated: 2026-10-20 | Updated by: Sarah (merged Maneesh's v0.2: Sections 1, 2, 4, 6, 7, 9, 10)
Inventors: (as agreed with mentor)

## 1. Title of the invention
<!-- Owner: Maneesh | Sprint 1, final in 4 | Status: Draft, needs Maneesh review -->

Privacy-Preserving Physical-Overlap Prevention for Land Parcel Tokenization Using Sparse Merkle Tree Insert Proofs

## 2. Field / area of invention
<!-- Owner: Maneesh | Sprint 1 | Status: Draft, needs Maneesh review -->

This invention is in the field of blockchain-based land registries and zero-knowledge proof systems. Specifically, it addresses cryptographic enforcement of physical non-overlap between land parcels that are tokenized as NFTs on a blockchain, without publishing the parcel's exact boundary or cell coordinates on-chain.

## 3. Prior patents and publications
<!-- Owner: Sarah | Sprint 1-2 | Status: Done (2026-10-15). A patent agent's search should confirm before filing -->

### Patents

| Reference | Summary | Limitations | How our invention differs |
|---|---|---|---|
| VIT IDF-B: Blockchain-Based Immutable Land Registry System with NFT Ownership, E-Notary Authentication, and Zero-Knowledge Privacy Protection (invention disclosure, TRL 3) | Land ownership as ERC-721 NFTs; documents on IPFS with only a hash on-chain; E-Notary step; ZK proofs for funds, KYC and ownership at transfer; escrow | Duplicate check only on land IDs and document hashes, so the same land under a new ID passes; location is a single public GPS point; ZK circuits are mocks; no geometry in any proof | We detect duplicates by physical location: every fine grid cell of the parcel must enter an empty slot of the occupied-cell tree, enforced on-chain by a real Groth16 proof, without the boundary or fine cells going on-chain |
| [US 12,333,587 B2](https://patents.google.com/patent/US12333587): Associating land NFTs with digital representations of land parcels (Deere & Co.; filed 2022-05-12, granted 2025-06-17) | Covers a parcel with recursively subdivided S2 cells (Hilbert-curve cell values) and stores the cell list with a land NFT at the owner's blockchain address; used for agricultural-operation agreements | Cell values are a public, "objective and immutable" definition of the land; no parcel-to-parcel overlap or duplicate-registration check; no zero-knowledge proof; cells not kept private | **Closest prior art for "grid cells + land NFT".** We do not claim cells-on-NFT. We claim: cells kept private by the registrar; a ZK proof that each cell was inserted into an empty slot of a sparse Merkle tree (insert proof = non-overlap proof); the contract accepting only proofs whose old root equals the current on-chain root; only a commitment and coarse parent cells published |
| [US 2024/0202847 A1](https://patents.google.com/patent/US20240202847A1/en): Blockchain-GIS based framework for land registration (University of Florida Research Foundation; inventors Alem, Lawal, Nawari; filed 2023-12-15, priority 2022-12-15, published 2024-06-20; pending) | A permissioned ledger run by a municipal authority receives a land parcel record with geocoded data and a georeferenced map; smart contracts validate it against municipal geo-spatial records; the record is added as a block and the owner gets an electronic ownership confirmation (claims 1, 10, 19). Says coordinates give each parcel a unique identification "to avoid double registration" | No defined overlap test: duplicates are avoided by a coordinate identifier and validation against municipal records, so a slightly redrawn boundary is not caught by any geometric check. Map and ownership data sit openly on the ledger, "transparent to all authorized participants"; no zero-knowledge proof, no boundary privacy, no grid cells, Merkle tree or NFT | We replace identifier matching with a geometric test: every fine grid cell must enter an empty slot of the occupied-cell tree, so a redrawn copy of the same land (fixture B, shifted 5 m) is rejected. The test is proved in zero knowledge and enforced by the contract, and exact boundaries and fine cells never go on-chain |

### Publications

| Reference | Summary | Limitations | How our invention differs |
|---|---|---|---|
| [Torun, A. "Geodata Enabled Hierarchical Blockchain Architecture for Resolving Boundary Conflicts in Cadastre Surveys and Land Registration", FIG Congress 2018 (peer review journal paper 9260)](https://fig.net/resources/publications/prj/showpeerreviewpaper.asp?pubid=9260) | Blockchain + middleware + GIS/CAD model; a boundary change is recorded only after hierarchical approval by all stakeholders, with the registry as a trusted node | Conflicts are prevented by human approval workflow, not by an automatic geometric check; geometry is exchanged in the clear; no ZK | Our overlap check is automatic and cryptographic (cell insert into an empty tree slot, verified by the contract), and geometry stays private |
| Ernstberger, J., Zhang, C., Ciprian, L., Jovanovic, P., Steinhorst, S. Zero-Knowledge Location Privacy (ZKLP), IEEE Symposium on Security and Privacy 2025 (TU Munich, HKU, UCL; [TUM press release](https://www.tum.de/en/news-and-events/all-news/press-releases/details/hexagons-for-data-protection), [report](https://www.theregister.com/2025/05/17/privacy_preserving_location_sharing/)) | zk-SNARKs that let a user prove their location lies in a chosen region of a hexagonal Discrete Global Grid System without revealing the exact point; granularity chosen by the user | Proves membership of one point in a region; no land parcels, polygons, registries or overlap between regions; no on-chain state | We prove the opposite relation for a set of cells: none of a parcel's private cells is already occupied, against a tree of all registered parcels, with the root update checked on-chain |
| Patel, M., Vyas, A., Katwala, S. "Design and Implementation of a Geospatially Enabled Blockchain Application for Land Record Management", ISPRS Annals X-5/W2-2025, pp. 491–496 (GIFTS Summit 2025, Pune) ([link](https://isprs-annals.copernicus.org/articles/X-5-W2-2025/491/2025/)) | Indian land-record prototype (Java, MySQL, GIS, smart contracts) for buyers, sellers, inspectors and administrators; reports reduced fraud and duplication; spatial data supports visual verification of parcels | Duplication handled by ledger records and visual checks, not an automatic geometric test; no ZK; no boundary privacy described | Automatic, cryptographic non-overlap check at registration, enforced by the contract, with boundaries kept private. Shows the Indian context we target |

Searched so far: Google Patents and web for "geospatial NFT", "land parcel tokenization", "polygon non-overlap blockchain", "zero-knowledge proof of location", "blockchain cadastre boundary conflict". None found combines private parcel cells with a zero-knowledge non-overlap proof enforced on-chain.

Still to run before filing: InPASS (Indian Patent Office) for "land" + "blockchain" + "overlap"; Google Patents for "sparse Merkle tree" + "non-membership" + "geospatial". A patent agent's search should confirm this before the claims are drafted.

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

The novelty is that this insert-based check is done inside a Groth16 zero-knowledge proof circuit. The circuit proves, without revealing the cell values, that every active cell was successfully inserted into a previously-empty slot, moving the SMT root from a known old value to a new value. The smart contract checks the proof and the root transition. The only data published on-chain is the old root, the new root, a salted Poseidon commitment to the cell set (the salt itself stays private), and a list of coarse parent cells at resolution 9.

This is the first system, to our knowledge, that combines H3 grid-cell decomposition, a sparse Merkle insert proof, a Groth16 ZK circuit, and an on-chain Solidity verifier to enforce physical non-overlap without publishing parcel geometry.

## 5. Objectives
<!-- Owner: Sarah | Sprint 2 | Status: Draft (2026-10-14), needs Maneesh review -->

1. Prevent double tokenization of the same physical land: reject any registration whose parcel occupies a grid cell already held by a registered parcel, regardless of the land ID, owner or documents submitted with it.
2. Keep exact boundaries private: put only a commitment to the parcel's cells, coarse public parent cells and the owner on the public chain, never the polygon or the fine cells.
3. Make the check enforceable, not advisory: the registry contract accepts a parcel only with a zero-knowledge proof that every fine cell was inserted into an empty slot of the occupied-cell sparse Merkle tree, moving it from the current on-chain root to the new one. A registrar cannot skip the check, reuse an old root or change the commitment.
4. Let true neighbours register without false conflicts: assign each grid cell to the one parcel containing its centre, so parcels that only share a boundary never collide.
5. Work on real cadastral data at practical cost: validate on official US municipal parcel polygons, with measured proof time, verification gas and the share of parcels that fit one proof, as a basis for Indian land records once digitized boundaries are available.

## 6. Working principle
<!-- Owner: Maneesh | Sprint 2 | Status: Draft, needs Maneesh review -->

The system has four components: the geo pipeline, the sparse Merkle tree, the ZK circuit, and the smart contract.

**Geo pipeline.** A parcel polygon (from a cadastral GIS source) is converted to a set of H3 hexagonal cells at resolution 12, center mode. Center mode selects only cells whose centre point lies inside the polygon, so no two neighbouring polygons share a cell. Each cell is represented as a 64-bit integer (the H3 cell index in decimal). Parcels with more than 16 cells (2.4% of Newton, MA parcels at this resolution) and parcels with zero cells (1.7%) are flagged and not registered. The registrar also computes the coarse parent cells at resolution 9 for on-chain publication.

**Sparse Merkle tree.** The registrar maintains an off-chain SMT built on the Poseidon hash function, matching the circomlib SMTProcessor circuit. The tree key for a cell is Poseidon([cell_decimal]). The tree value is 1 (present). The root is a 32-byte field element; it summarises the entire set of registered cells. The SMT and its root are the single source of truth for which cells are occupied.

**ZK circuit.** The circuit `register_parcel.circom` (N=16 cells, N_LEVELS=32 tree levels, Groth16) does the following in a single proof:
1. Constraint G5 binds the public `oldRoot` output to the private `initialRoot` input.
2. Constraint G1 (active-prefix gate) requires that active cells come before inactive cells: `cells[i] == 0 implies cells[i+1] == 0`.
3. Constraint I1 requires `active[0] === 1`, rejecting empty-parcel inputs.
4. Constraint G2 hashes each cell to its SMT key: `key[i] = Poseidon([cells[i]])`.
5. Constraint G3 computes the commitment: `inner = Poseidon(cells[0..N-1])`, then `commitment = Poseidon([inner, salt])`, where `salt` is a fresh random 248-bit private input.
6. Constraint G4 chains N SMTProcessor inserts. Each active slot inserts its key into the tree (fails if the slot is occupied) and advances the root. Inactive slots are NOPs that pass the root through.

The circuit's public signals are `[oldRoot, newRoot, commitment]`. The cell values and the salt never appear on-chain.

**Smart contract.** `LandRegistry.sol` stores the current SMT root. On a `registerParcel` call, it checks, in this order: (a) the caller holds the registrar role; (b) the coarse cell list is non-empty (EmptyCoarseCells revert); (c) `oldRoot` in the proof matches the on-chain root (StaleRoot revert if not); (d) the commitment has not been used before (CommitmentReused revert); (e) the Groth16 proof verifies against the exported verification key (InvalidProof revert). If all checks pass, it updates the on-chain root to `newRoot` and mints an ERC-721 token to the specified owner address.

The combination of the on-chain root check and the circuit's insert semantics guarantees that every cell in a successfully registered parcel was absent from the tree before the registration. Attempted registration of an overlapping parcel will fail witness generation (the SMT insert rejects the occupied slot), so no valid proof can be produced for an overlapping parcel.

## 7. Detailed description
<!-- Owner: Both | Sprint 3 | Status: Draft (components, flow, privacy: Maneesh; figures: Sarah), needs review by both -->

### Components

**registrar/src/tree.js.** A thin JavaScript wrapper around the circomlibjs in-memory SMT. It provides `insertCell(cell, value, nLevels)`, which inserts a cell key (Poseidon-hashed) and returns the full Merkle path witness required by the circuit. It also provides `findCell(cell)` for the pre-insertion overlap check, and `save()` / `load(snapshot)` for persistence to a JSON file.

**registrar/src/inputs.js.** Builds the circuit input object from a parcel entry and the current tree state. It calls `insertCell` for each active cell (advancing the tree root as it goes), pads inactive slots to N with zeros, generates a random 248-bit salt, and computes the JS-side commitment for verification. The output is a JSON object ready to pass to `snarkjs.groth16.fullProve`.

**registrar/src/register.js.** The I4 CLI. It loads the parcel from `geo/out/parcels.json`, runs `findCell` for each cell as a pre-proof overlap check, calls `buildInputs`, proves with the production zkey, verifies the proof locally against the vkey, and submits the transaction. It saves the updated tree state only after the transaction confirms. If the transaction reverts with StaleRoot, it reloads the state, rechecks overlap, and reproves once.

**circuits/register_parcel.circom.** The production circuit: N=16, N_LEVELS=32, 588,814 total constraints (from snarkjs r1cs info). The constraint count fits pot20 (2^20 = 1,048,576). The dev variant `register_parcel_dev.circom` uses N=8, N_LEVELS=16 for fast testing (158,981 constraints, fits pot19).

**contracts/contracts/LandRegistry.sol.** The ERC-721 registry contract. Stores the current SMT root, a mapping from commitment to boolean (for CommitmentReused checks), and per token the commitment, coarse cells and metadata URI. Calls the Groth16Verifier with the proof and public signals. Emits a `ParcelRegistered` event with the tokenId, owner, commitment, oldRoot and newRoot.

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

Figure files are in `patent/figures/` (SVG source and PNG).

- **Fig. 1, System architecture** (`fig1_architecture`): registrar side (geo pipeline, occupied-cell sparse Merkle tree, Groth16 prover) and chain side (`LandRegistry`, `Groth16Verifier`), with what stays private and what is public.
- **Fig. 2, Registration sequence** (`fig2_registration_sequence`): the 12 steps from a certified polygon to a minted token, including the branch where an occupied cell stops the registration.
- **Fig. 3, Overlap rejection** (`fig3_overlap_rejection`): real Newton parcels A and C and fixture B (A shifted 5 m east) with their res-12 H3 cells. 5 of B's 6 cells are already held by A, so no valid insert proof exists and it is rejected; C touches A but shares no cell and is accepted. Drawn by `geo/scripts/figure_overlap.py` from `geo/out/parcels.json`.

Figs. 1 and 2 show the salted commitment, as implemented in the current circuit (2026-10-15 build).

Text sources for the same three views, for editing: `patent/figures/architecture.mmd`, `registration_flow.mmd`, `overlap_rejection.mmd` (Mermaid).

Evidence logs: `patent/figures/logs/` (demo run, full 31-parcel run, contract and geo test runs, gas report).

## 8. Experimental validation results
<!-- Owner: Both | Sprint 4 | Status: Draft (Sarah and Maneesh, merged 2026-10-20). All numbers are from the circuit after the 2026-10-15 salt and active[0] fix -->

The prototype was validated on real parcel polygons from the City of Newton, Massachusetts (official municipal parcel layer, 24,102 parcels). A sample of 30 adjacent single-family parcels plus a synthetic re-registration (fixture B: parcel A shifted 5 m east) was registered end to end on a local Ethereum (Hardhat) chain with a real Groth16 verifier contract. Proofs were generated on a MacBook Pro M4 Pro with 24 GB RAM.

The powers-of-tau files (pot19 for tests of the small dev circuit, pot20 for production) were generated locally by one contributor (Maneesh) with `snarkjs powersoftau new`, `contribute` and `prepare phase2`. This is acceptable for a TRL 4 lab prototype; a public multi-party ceremony file is required before any deployment beyond the lab.

### Overlap detection

| Test | Result | Source |
|---|---|---|
| Real parcels registered in sequence | 30 of 30 accepted, 0 errors | `bench/results/full_run.json` |
| False overlaps between real neighbouring parcels | 0 | `bench/results/full_run.json` |
| Re-registration of parcel A redrawn 5 m east (fixture B) | Rejected: 5 of its 6 cells already occupied by A; no valid proof can be produced | `patent/figures/logs/demo_run.txt`, Fig. 3 |
| Neighbour C, sharing A's boundary, after A | Accepted, token 2 | `patent/figures/logs/demo_run.txt` |
| Tampered public signal (new root or commitment changed) | Rejected by the contract (`InvalidProof`) | `contracts/test/registry.e2e.test.js` |
| Replayed proof after the root moved | Rejected (`StaleRoot`) | `contracts/test/registry.e2e.test.js` |
| Valid proof sent by an address without the registrar role | Rejected | `contracts/test/registry.e2e.test.js` |
| Empty parcel (all cells zero) | No proof can be produced (`active[0] === 1`) | `registrar/test/circuit.test.js` |
| Wrong salt for a given commitment | Proof does not verify | `registrar/test/circuit.test.js` |

### Tests

| Suite | Result | Source |
|---|---|---|
| Circuit tests (production zkey) | 8 of 8 pass | `registrar/test/circuit.test.js` |
| Contract tests, mock verifier | 13 of 13 pass | `contracts/test/registry.mock.test.js` |
| Contract tests, real `Groth16Verifier` and real proofs | 8 of 8 pass | `contracts/test/registry.e2e.test.js` |
| Geo pipeline tests | 25 of 25 pass | `geo/tests/` |
| Demo on the fixed circuit (A registered, B overlap, C registered) | Pass (2026-10-15); clean-clone run passed 2026-10-14 on the pre-fix circuit | `patent/figures/logs/demo_run.txt`, `CONTEXT.md` |

### Performance

| Metric | Value | Source |
|---|---|---|
| Circuit size (N = 16 cells, tree depth 32) | 588,814 constraints | `bench/bench.md` |
| Trusted setup | pot20 (capacity 2^20 = 1,048,576); Groth16 setup about 42 s | `bench/bench.md` |
| Proving time per parcel | mean 10,104 ms, max 10,482 ms, min 9,950 ms (30 proofs) | `bench/results/full_run.json` |
| Proof size | 719 bytes (JSON) | `bench/bench.md` |
| Proving key (zkey) size | 268.7 MiB (about 282 MB) | `bench/bench.md` |
| `registerParcel` gas, incl. on-chain proof verification | mean 415,944, max 448,564 (first registration), min 414,700 (30 registrations) | `bench/results/full_run.json`, `bench/results/gas.json` |
| Proof verification alone | about 228,500 gas | `bench/results/gas.json` |

The first registration costs more because the root moves from zero, a fresh storage write.

### Grid resolution

Share of parcels whose fine cells fit one proof (1 to 16 cells), centre rule:

| H3 resolution | All 24,102 Newton parcels | 31-parcel test set | Median cells (test set) |
|---|---|---|---|
| 11 | 44.2% | 19 of 31 | 1 |
| **12 (chosen)** | **95.9%** | **31 of 31** | **5** |
| 13 | 37.2% | 0 of 31 | 30 |

At resolution 12 no two real neighbouring parcels shared a cell across the whole city (median 3 cells per parcel city-wide, maximum 1,868). Sources: `bench/results/cell_counts.json`, `bench/bench.md`, `geo/out/parcels*.json`.

### Limitations observed

- An overlap smaller than the spacing of cell centres (about 9.4 m at resolution 12) can go undetected.
- 2.4% of Newton parcels need more than 16 cells and 1.7% are smaller than one cell; both are flagged and not registered in this prototype.
- The registrar is trusted to certify that the polygon matches the land.
- The trusted setup used a locally generated powers-of-tau file with one contributor.

## 9. Aspects of the invention that need protection
<!-- Owner: Maneesh | Sprint 4 | Status: Draft, needs Maneesh review -->

The following specific mechanisms are the technical contribution of this work:

1. **The use of a sparse Merkle tree insert proof as a physical-overlap check for land parcels.** Specifically: representing a parcel as a set of H3 hexagonal grid cells, inserting each cell as a key into a Poseidon SMT, and using a Groth16 proof of successful insertion (with no pre-existing key collisions) as the non-overlap certificate accepted by the smart contract.

2. **The circuit constraint design that combines insert-based non-overlap enforcement (G4) with a salted commitment (G3) and an active-prefix gate (G1, I1) in a single Groth16 proof.** The circuit structure allows a single proof to cover a variable-length active cell list (padded to a fixed size N) without revealing the cell values or how many of the N slots are in use; the active flags are private.

3. **The on-chain root-chain mechanism in LandRegistry.sol:** the contract maintains a single SMT root, requires that the proof's oldRoot matches the stored root before accepting a registration, and updates the root to newRoot on success. This ties every registration to a globally consistent state of occupied cells, enforced without an oracle.

4. **The commitment binding: `commitment = Poseidon([Poseidon(cells[0..N-1]), salt])`** where salt is a fresh private random value. Cell sets are small and guessable, so without the salt anyone could confirm a guessed cell set against the public commitment; with it, the commitment reveals nothing about the cells, and two registrations of the same cells give different commitments.

We do not claim the H3 grid decomposition itself (Uber H3 is open-source), the Poseidon hash function, the SMT data structure, or Groth16 proving in isolation. The combination and the specific application to the land registration problem is the claimed contribution.

## 10. Technology readiness level
<!-- Owner: Maneesh | Sprint 4 | Status: Draft, needs Maneesh review -->

**Claimed TRL: 4 (Technology Validated in Lab)**

Evidence for TRL 4 as of 2026-10-20:

- The production ZK circuit compiles and generates valid Groth16 proofs (588,814 constraints, pot20 trusted setup).
- 8 circuit tests pass against the production zkey, including the salted commitment, a wrong salt and the empty-parcel rejection.
- 21 smart contract tests pass: 13 against a mock verifier and 8 against the real Groth16Verifier with real proofs (replay, tampered signals, non-registrar caller).
- 25 geo pipeline tests pass.
- 31 parcels from a real cadastral dataset (City of Newton, MA) were processed: 30 registered without error, 1 rejected for overlap (fixture B, as designed). No unintended overlaps were detected.
- Prove time: mean 10,104 ms, max 10,482 ms on a MacBook Pro M4 Pro, 24 GB RAM.
- registerParcel gas: mean 415,944, max 448,564 (real Groth16Verifier).
- A clean-clone reproducibility test (Gate 3) passed on 2026-10-14 on the circuit before the salt fix; the A/B/C demo was re-run on the fixed circuit on 2026-10-15.

**Known limitations at TRL 4:**

- The powers-of-tau files were generated locally by a single contributor. This is acceptable for a lab prototype but not for production. The setup must be replaced with a publicly verifiable multi-party ceremony file before any deployment beyond a lab context.
- The registrar is a single trusted party. There is no mechanism for the contract to verify that the cell set accurately represents the physical parcel boundary. The system enforces consistency and non-overlap, not ground truth.
- Grid approximation: an overlap smaller than the gap between cell centres at res 12 (edge approximately 9.4 m) may not be detected.
- Parcels with more than 16 cells (2.4% of Newton parcels at res 12) cannot be registered with the current circuit parameters, nor can parcels smaller than one cell (1.7%).

**Not yet at TRL 5:** no public testnet deployment, no independent operator, no public ceremony ptau.

## Changelog

- 2026-10-20: Review before merge to main (Sarah): Gate 3 date tied to the pre-fix circuit (8, 10); Section 9 items 2 and 4 reworded to what the circuit guarantees.
- 2026-10-20: Merged Maneesh's v0.2 with Sarah's v0.4 (Sarah). Section 3 and 5 from Sarah; 1, 2, 4, 6, 7 text, 9, 10 from Maneesh; Section 8 combined, post-fix numbers only. Corrections: the salt is not published (4); parcel-size shares and contract check order (6, 10); event fields (7); circuit tests use the production zkey and number 8 (8, 10).
- 2026-10-15: Maneesh drafted sections 1, 2, 4, 6, 7, 9, 10. Circuit fix applied (salt in commitment, active[0]===1). Circuit rebuilt, tests pass. Full 31-parcel run complete with fixed circuit.
- 2026-10-15: Section 8 drafted from bench results; circuit numbers marked provisional (Sarah).
- 2026-10-15: Section 3: US 2024/0202847 A1 claims read and row completed (Sarah).
- 2026-10-15: Section 7 figures 1 to 3 added (Sarah).
- 2026-10-14: Section 3 extended (ZKLP, ISPRS 2025) and search status recorded; Section 5 drafted (Sarah).
- 2026-10-13: Section 3 first pass (Sarah).
- 2026-10-12: Template created (Sarah, Sprint 0).
