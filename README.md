# Land Parcel Non-Overlap Registry

Private prototype. Do not make this repo public until the provisional patent application is filed.

The full plan, interfaces and sprint checklist live in `PLAN.md` (export of the build plan doc).

## Layout

| Folder | Owner | What |
|---|---|---|
| `geo/` | Sarah | Python pipeline: parcel polygon → H3 fine and coarse cells → `geo/out/parcels.json` |
| `contracts/` | Sarah | Hardhat project: `LandRegistry.sol` (ERC-721 + AccessControl) |
| `circuits/` | Maneesh | Circom circuit, build script, generated verifier |
| `registrar/` | Maneesh | Node service: sparse Merkle tree, proof generation, registration CLI |
| `bench/` | shared | Measured results (`bench.md`) |
| `patent/` | shared | IDF-B draft and figures |

## Parcel data

City of Newton, Massachusetts official parcel layer, published by the city's GIS office:
<https://github.com/NewtonMAGIS/GISData/blob/master/Property/Parcels.geojson> (WGS84, public record).
The committed sample `geo/data/raw/newton_sample.geojson` keeps only parcel ID, land use, lot size and
polygon type; owner names and values are dropped. The full file (~40 MB) is gitignored.

## Geo (Python 3.11+)

```bash
cd geo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/fetch_parcels.py        # downloads the full layer (once), rewrites the sample
python src/parcels.py                  # writes out/parcels.json (interface I2)
pytest                                 # 22 tests
python scripts/cell_count_table.py     # Sprint 0 table over all ~24k parcels (~2 min)
```

## Contracts (Node 20+)

```bash
cd contracts
npm ci
npx hardhat test                       # LandRegistry with MockVerifier (13 tests)
REPORT_GAS=true npx hardhat test       # also writes bench/results/gas-report.txt

npx hardhat node                                        # terminal 1
npx hardhat run scripts/deploy.js --network localhost   # terminal 2 -> deployments/local.json
```

Tests read the committed `geo/out/parcels.json`; rerun the geo pipeline if you change it.

The one-command demo is added in Sprint 3.
