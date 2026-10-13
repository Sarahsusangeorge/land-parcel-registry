# Benchmarks and measured results

Every number here comes from a file in `bench/results/` or a logged run. Never round up.

## Geo: cells per parcel (Sprint 0, Sarah)

Source: all 24,102 parcels in the City of Newton, MA parcel layer
(`geo/data/raw/newton_parcels_full.geojson`, see `geo/scripts/fetch_parcels.py`).
Run: `python geo/scripts/cell_count_table.py`. Raw numbers: `bench/results/cell_counts.json`.

Parcel area: median 888 m², min 2 m², max 593,189 m².

| Res | Mode | Median cells | Max cells | Parcels with 0 cells | Fit 1–16 cells | Parcels sharing a cell with a neighbour |
|---|---|---|---|---|---|---|
| 11 | center | 0 | 269 | 13,362 | 10,643 (44.2%) | 0 |
| 11 | overlap | 3 | 317 | 0 | 23,876 (99.1%) | 24,101 |
| **12** | **center** | **3** | 1,868 | 419 | **23,105 (95.9%)** | **0** |
| 12 | overlap | 8 | 2,004 | 0 | 22,611 (93.8%) | 24,099 |
| 13 | center | 20 | 13,121 | 32 | 8,962 (37.2%) | 2 |
| 13 | overlap | 32 | 13,471 | 0 | 1,113 (4.6%) | 24,047 |
| 12 | center + one fallback cell for zero-cell parcels (rejected) | 3 | 1,868 | 0 | 23,524 (97.6%) | 658 |

Reading:

- Res 12, center mode is the only setting where almost all parcels fit N = 16 and no real neighbours collide.
- Overlap mode makes nearly every parcel collide with its neighbours, so shared boundaries would look like overlaps.
- Giving tiny parcels a fallback cell (the cell containing a point inside them) makes 658 parcels collide, because that cell's centre lies in a neighbour that already owns it. Rejected: zero-cell parcels are flagged `fits_batch: false` instead.
- The 2 collisions at res 13 are probably from the source data itself (5 pairs of Newton polygons overlap with real area); not yet checked parcel by parcel.

## Geo: Sprint 1 sample (parcels.json)

30 single-family parcels nearest (-71.2230, 42.3330), plus fixture B. Run: `python geo/src/parcels.py`.

| Item | Value |
|---|---|
| Parcels in `geo/out/parcels.json` | 31 (A, B, C + 28 real) |
| Fine cells per parcel (res 12) | median 5, max 10 |
| `fits_batch: false` | none |
| Fixture A | Newton parcel `53009 0010`, 1,832 m², 5 cells |
| Fixture B | A shifted 5 m east, 6 cells, 5 shared with A |
| Fixture C | Newton parcel `53009 0011` (touches A), 3 cells, none shared with A or B |
| Real parcels sharing a cell | 0 |

## Contract: registerParcel gas with the MOCK verifier (Sprint 2, Sarah)

Run: `REPORT_GAS=true npx hardhat test`. Raw: `bench/results/gas-report.txt`.
Excludes Groth16 verification, so it is **not** the TRL 4 verification-gas number (that comes in Sprint 4 with the real verifier).

| Min | Max | Mean | Calls |
|---|---|---|---|
| 228,321 | 245,085 | 241,732 | 10 |

Deployment: LandRegistry 1,561,293 gas.

## Known limitations (so far)

- Grid approximation: an overlap smaller than the gap between cell centres (res 12 edge about 9.4 m) can slip through.
- Parcel size: at res 12, 2.4% of Newton parcels have more than 16 cells and 1.7% have none; both are flagged, not registered.
