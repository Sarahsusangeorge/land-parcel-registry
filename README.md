# Land Parcel Non-Overlap Registry

Private prototype. Do not make this repo public until the provisional patent application is filed.

Read `CONTEXT.md` for current status, then `PLAN.md` for the design, the frozen interfaces and the sprint checklist.

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
npx hardhat test                       # 21 tests: 13 with MockVerifier, 8 end-to-end with real proofs
REPORT_GAS=true npx hardhat test       # also writes bench/results/gas-report.txt
npx hardhat run scripts/gas_bench.js   # registerParcel gas from receipts -> bench/results/gas.json

npx hardhat node                                        # terminal 1
npx hardhat run scripts/deploy.js --network localhost   # terminal 2: real Groth16Verifier + LandRegistry -> deployments/local.json
```

The end-to-end tests use the committed proof fixtures in `contracts/test/fixtures/` (interface I6), so
they need no circuit build and run on any machine. The mock tests read the committed `geo/out/parcels.json`.

## Registrar (Node 20+)

```bash
cd registrar
npm ci
```

### Sprint 3 end-to-end demo

The production ZK artefacts are gitignored (zkey is 269 MB). Copy them from the machine that
ran `bash circuits/scripts/build.sh`, or re-run that script (requires ~75 min for pot20 setup):

```
circuits/build/register_parcel_final.zkey
circuits/build/register_parcel_js/register_parcel.wasm
circuits/build/register_parcel_vkey.json
```

Then, from the **repo root**:

```bash
bash registrar/scripts/demo.sh
```

The script starts a local Hardhat node, deploys the real `Groth16Verifier` + `LandRegistry`,
registers parcel A, attempts B (expected overlap), registers C, then stops the node.

Expected stdout (one JSON line per parcel):

```
{"status":"registered","parcel_id":"A","token_id":1,"tx_hash":"0x…",…}
{"status":"overlap","parcel_id":"B","overlaps":["A"]}
{"status":"registered","parcel_id":"C","token_id":2,"tx_hash":"0x…",…}
```

## Demo interface

A local web interface for running registrations interactively and capturing IDF-B screenshots.
It drives the existing pieces — it does not change how the system works.

**Start** (from the repo root; requires the production zkey and wasm to be present):

```bash
cd ui && npm ci   # first time only
npm run ui        # from repo root
```

Then open **http://localhost:3000**.

| View | URL | What it shows |
|---|---|---|
| Landing page | http://localhost:3000/ | Registrar and public views side by side |
| Registrar view | http://localhost:3000/registrar.html | Fine H3 cells (private), Register buttons, live step/timer |
| Public view | http://localhost:3000/public.html | Coarse H3 cells from the chain, occupied-root, token table |

**Workflow:**
1. Click **Reset chain** — starts a fresh Hardhat node and deploys the contracts (~15 s).
2. Click **Register** next to a parcel — streams live steps: checking overlap → generating proof → submitting transaction.
3. Parcel B will fail with an overlap; the shared cells turn red on the map.
4. The public view polls the chain every 3 s and shows only coarse cells; exact boundaries are never displayed there.

## Reproducing the TRL 4 evidence

Proving needs the production zkey (269 MB, gitignored), so the two proving rows run on the machine that
holds it (Maneesh's). Everything else runs on any machine.

| Evidence | Command (from the repo root unless noted) | Output | Needs the zkey |
|---|---|---|---|
| Cells per parcel, all 24,102 Newton parcels | `cd geo && python scripts/cell_count_table.py` | `bench/results/cell_counts.json` | No |
| Geo tests (25) | `cd geo && pytest` | `patent/figures/logs/geo_tests.txt` | No |
| Contract tests (21, incl. real proofs) | `cd contracts && npx hardhat test` | `patent/figures/logs/contracts_tests.txt` | No |
| `registerParcel` gas, real verifier | `cd contracts && npx hardhat run scripts/gas_bench.js` | `bench/results/gas.json` | No |
| Demo: A registered, B overlap, C registered | `bash registrar/scripts/demo.sh` | `patent/figures/logs/demo_run.txt` | Yes |
| Full run, all 31 parcels | `bash registrar/scripts/full_run.sh` | `bench/results/full_run.json`, `patent/figures/logs/full_run.txt` | Yes |
| IDF-B Fig. 3 (overlap, from real data) | `cd geo && python scripts/figure_overlap.py` | `patent/figures/fig3_overlap_rejection.svg` | No |
| IDF-B Figs. 1 and 2 | `python patent/figures/src/make_figs.py patent/figures` | `patent/figures/fig1_*.svg`, `fig2_*.svg` | No |

Headline numbers are in `bench/bench.md`. Each one points to the file it came from.
