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
| `bench/` | shared | Measured results |
| `patent/` | shared | IDF-B draft and figures |

## Setup (Sarah lane)

```bash
# geo
cd geo
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest

# contracts
cd ../contracts
npm ci
npx hardhat test
```

## Sprint 0: cell-count analysis

```bash
cd geo
python scripts/fetch_parcels.py            # downloads sample parcels into data/raw/
python scripts/cell_count_table.py         # prints the resolution / mode table
```

The one-command demo is added in Sprint 3.
