# Invention Disclosure (IDF-B) Draft

Version: 0.1 | Last updated: 2026-10-12 | Updated by: Sarah
Inventors: (as agreed with mentor)

## 1. Title of the invention
<!-- Owner: Maneesh | Sprint 1, final in 4 | Status: Not started -->

## 2. Field / area of invention
<!-- Owner: Maneesh | Sprint 1 | Status: Not started -->

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
<!-- Owner: Maneesh | Sprint 2 | Status: Not started -->

### Problem

### Gap in existing systems

### Our solution and novelty

## 5. Objectives
<!-- Owner: Sarah | Sprint 2 | Status: Not started -->

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

- 2026-10-12: Template created (Sarah, Sprint 0).
