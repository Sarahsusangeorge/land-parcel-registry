# Invention Disclosure (IDF-B) Draft

Version: 0.4 | Last updated: 2026-10-15 | Updated by: Sarah
Inventors: (as agreed with mentor)

## 1. Title of the invention
<!-- Owner: Maneesh | Sprint 1, final in 4 | Status: Not started -->

## 2. Field / area of invention
<!-- Owner: Maneesh | Sprint 1 | Status: Not started -->

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
<!-- Owner: Maneesh | Sprint 2 | Status: Not started -->

### Problem

### Gap in existing systems

### Our solution and novelty

## 5. Objectives
<!-- Owner: Sarah | Sprint 2 | Status: Draft (2026-10-14) -->

1. Prevent double tokenization of the same physical land: reject any registration whose parcel occupies a grid cell already held by a registered parcel, regardless of the land ID, owner or documents submitted with it.
2. Keep exact boundaries private: put only a commitment to the parcel's cells, coarse public parent cells and the owner on the public chain, never the polygon or the fine cells.
3. Make the check enforceable, not advisory: the registry contract accepts a parcel only with a zero-knowledge proof that every fine cell was inserted into an empty slot of the occupied-cell sparse Merkle tree, moving it from the current on-chain root to the new one. A registrar cannot skip the check, reuse an old root or change the commitment.
4. Let true neighbours register without false conflicts: assign each grid cell to the one parcel containing its centre, so parcels that only share a boundary never collide.
5. Work on real cadastral data at practical cost: validate on official US municipal parcel polygons, with measured proof time, verification gas and the share of parcels that fit one proof, as a basis for Indian land records once digitized boundaries are available.

## 6. Working principle
<!-- Owner: Maneesh | Sprint 2 | Status: Not started -->

## 7. Detailed description
<!-- Owner: Both | Sprint 3 | Status: Not started -->

### Components

### Registration flow

### Privacy model and trust assumption

### Figures

Figure files are in `patent/figures/` (SVG source and PNG).

- **Fig. 1, System architecture** (`fig1_architecture`): registrar side (geo pipeline, occupied-cell sparse Merkle tree, Groth16 prover) and chain side (`LandRegistry`, `Groth16Verifier`), with what stays private and what is public.
- **Fig. 2, Registration sequence** (`fig2_registration_sequence`): the 12 steps from a certified polygon to a minted token, including the branch where an occupied cell stops the registration.
- **Fig. 3, Overlap rejection** (`fig3_overlap_rejection`): real Newton parcels A and C and fixture B (A shifted 5 m east) with their res-12 H3 cells. B claims 5 of A's 5 cells, so no valid insert proof exists and it is rejected; C touches A but shares no cell and is accepted. Drawn by `geo/scripts/figure_overlap.py` from `geo/out/parcels.json`.

Figs. 1 and 2 show the commitment with a salt, as specified in PLAN.md I1. The circuit used for the current measurements does not yet include the salt; see CONTEXT.md.

Evidence logs: `patent/figures/logs/` (contract and geo test runs, gas report).

## 8. Experimental validation results
<!-- Owner: Both | Sprint 4 | Status: Draft (Sarah, 2026-10-15). Circuit numbers are provisional: they come from the circuit before the salt and active[0] fix and must be re-measured after it -->

The prototype was validated on real parcel polygons from the City of Newton, Massachusetts (official municipal parcel layer, 24,102 parcels). A sample of 30 adjacent single-family parcels plus a synthetic re-registration (fixture B: parcel A shifted 5 m east) was registered end to end on a local Ethereum (Hardhat) chain with a real Groth16 verifier contract. Proofs were generated on a MacBook Pro M4 Pro with 24 GB RAM.

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
| Automated tests | 21 contract tests (8 with real proofs), 5 circuit tests, 25 geo tests passing | `patent/figures/logs/`, `registrar/test/circuit.test.js` |

### Performance (provisional until the circuit fix)

| Metric | Value | Source |
|---|---|---|
| Circuit size (N = 16 cells, tree depth 32) | 588,297 constraints | `bench/results/circuit_reg_prod.json` |
| Proving time per parcel | mean 10,102 ms, max 10,846 ms (30 proofs) | `bench/results/full_run.json` |
| Proof size | 719 bytes (JSON) | `bench/results/circuit_reg_prod.json` |
| `registerParcel` gas, incl. on-chain proof verification | mean 415,942, max 448,564 (first registration), min 414,724 (30 registrations) | `bench/results/full_run.json`, `bench/results/gas.json` |
| Proof verification alone | about 228,500 gas | `bench/results/gas.json` |

### Grid resolution

Share of parcels whose fine cells fit one proof (1 to 16 cells), centre rule:

| H3 resolution | All 24,102 Newton parcels | 31-parcel test set | Median cells (test set) |
|---|---|---|---|
| 11 | 44.2% | 19 of 31 | 1 |
| **12 (chosen)** | **95.9%** | **31 of 31** | **5** |
| 13 | 37.2% | 0 of 31 | 30 |

At resolution 12 no two real neighbouring parcels shared a cell across the whole city. Sources: `bench/results/cell_counts.json`, `geo/out/parcels*.json`.

### Limitations observed

- An overlap smaller than the spacing of cell centres (about 9.4 m at resolution 12) can go undetected.
- 2.4% of Newton parcels need more than 16 cells and 1.7% are smaller than one cell; both are flagged and not registered in this prototype.
- The registrar is trusted to certify that the polygon matches the land.
- The trusted setup used a locally generated powers-of-tau file with one contributor.

## 9. Aspects of the invention that need protection
<!-- Owner: Maneesh | Sprint 4 | Status: Not started -->

## 10. Technology readiness level
<!-- Owner: Maneesh | Sprint 4 | Status: Not started -->

## Changelog

- 2026-10-15: Section 8 drafted from bench results; circuit numbers marked provisional (Sarah).
- 2026-10-15: Section 3: US 2024/0202847 A1 claims read and row completed (Sarah).
- 2026-10-15: Section 7 figures 1 to 3 added (Sarah).
- 2026-10-14: Section 3 extended (ZKLP, ISPRS 2025) and search status recorded; Section 5 drafted (Sarah).
- 2026-10-13: Section 3 first pass (Sarah).
- 2026-10-12: Template created (Sarah, Sprint 0).
