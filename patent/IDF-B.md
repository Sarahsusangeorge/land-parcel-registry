# Invention Disclosure (IDF-B) Draft

Version: 0.2 | Last updated: 2026-10-14 | Updated by: Sarah
Inventors: (as agreed with mentor)

## 1. Title of the invention
<!-- Owner: Maneesh | Sprint 1, final in 4 | Status: Not started -->

## 2. Field / area of invention
<!-- Owner: Maneesh | Sprint 1 | Status: Not started -->

## 3. Prior patents and publications
<!-- Owner: Sarah | Sprint 1-2 | Status: Nearly done (2026-10-14). One row to verify: US20240202847A1 claims -->

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
| Ernstberger, J., Zhang, C., Ciprian, L., Jovanovic, P., Steinhorst, S. Zero-Knowledge Location Privacy (ZKLP), IEEE Symposium on Security and Privacy 2025 (TU Munich, HKU, UCL; [TUM press release](https://www.tum.de/en/news-and-events/all-news/press-releases/details/hexagons-for-data-protection), [report](https://www.theregister.com/2025/05/17/privacy_preserving_location_sharing/)) | zk-SNARKs that let a user prove their location lies in a chosen region of a hexagonal Discrete Global Grid System without revealing the exact point; granularity chosen by the user | Proves membership of one point in a region; no land parcels, polygons, registries or overlap between regions; no on-chain state | We prove the opposite relation for a set of cells: none of a parcel's private cells is already occupied, against a tree of all registered parcels, with the root update checked on-chain |
| Patel, M., Vyas, A., Katwala, S. "Design and Implementation of a Geospatially Enabled Blockchain Application for Land Record Management", ISPRS Annals X-5/W2-2025, pp. 491–496 (GIFTS Summit 2025, Pune) ([link](https://isprs-annals.copernicus.org/articles/X-5-W2-2025/491/2025/)) | Indian land-record prototype (Java, MySQL, GIS, smart contracts) for buyers, sellers, inspectors and administrators; reports reduced fraud and duplication; spatial data supports visual verification of parcels | Duplication handled by ledger records and visual checks, not an automatic geometric test; no ZK; no boundary privacy described | Automatic, cryptographic non-overlap check at registration, enforced by the contract, with boundaries kept private. Shows the Indian context we target |

Searched so far: Google Patents and web for "geospatial NFT", "land parcel tokenization", "polygon non-overlap blockchain", "zero-knowledge proof of location", "blockchain cadastre boundary conflict". None found combines private parcel cells with a zero-knowledge non-overlap proof enforced on-chain.

Still to run before filing: InPASS (Indian Patent Office) for "land" + "blockchain" + "overlap"; Google Patents for "sparse Merkle tree" + "non-membership" + "geospatial"; read the claims of US20240202847A1. A patent agent's search should confirm this before the claims are drafted.

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

## 8. Experimental validation results
<!-- Owner: Both | Sprint 4 | Status: Not started -->

| Metric | Value | Source file |
|---|---|---|
| Constraint count | | bench/results/circuit.json |
| Proving time (mean / max) | | bench/results/circuit.json |
| Verification gas (mean) | | bench/results/gas.json |
| Cells per parcel (median / max) | | bench/bench.md |
| Overlap fixture B rejected | | demo log |
| Real parcels registered without false overlap | | bench/bench.md |

## 9. Aspects of the invention that need protection
<!-- Owner: Maneesh | Sprint 4 | Status: Not started -->

## 10. Technology readiness level
<!-- Owner: Maneesh | Sprint 4 | Status: Not started -->

## Changelog

- 2026-10-14: Section 3 extended (ZKLP, ISPRS 2025) and search status recorded; Section 5 drafted (Sarah).
- 2026-10-13: Section 3 first pass (Sarah).
- 2026-10-12: Template created (Sarah, Sprint 0).
