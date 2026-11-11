# UI testing notes

Branch `sarah/ui-fixes`, 11 Nov 2026. Everything below was run **without proving**: no circom, no snarkjs, no `build.sh`, and Register was never clicked or called.

## Where it was run

- Linux container, Node 22, headless Chromium. **Not** run on Sarah's Windows laptop (see "Still to check").
- The container cannot download the Solidity compiler, so the contracts were compiled once with solcjs 0.8.28 as a stand-in for the native compiler. The contract tests below ran against that build.
- The container's browser cannot reach `unpkg.com` or `tile.openstreetmap.org`. Map libraries therefore loaded from the local fallback (see below), and map tiles were replaced with a blank image. Cell polygons, sizing and console output were still checked for real.

## What was checked and passed

| Check | Result |
|---|---|
| `npm run ui` starts, both pages and the landing page load | Pass, no browser console errors on any of the three |
| Registrar map, before Reset chain | Pass: all 31 parcels listed, 141 fine (resolution 12) cells drawn, view fitted to them, map box 1060 x 760 |
| Public map, before Reset chain | Pass: no tokens, no cells, status "Chain not deployed yet...", root "none yet", 0 tokens |
| Landing page (side by side) | Pass: both maps have a real size inside the iframes (354 x 680 and 314 x 680), registrar shows 141 cells |
| Reset chain (`POST /api/reset`) | Pass, about 4 s: Hardhat node started, contracts deployed, registrar role granted to `0x7099...` |
| Public view after reset | Pass: status "Connected", occupied root `0` (shown as "0 (empty tree)"), 0 tokens |
| Empty-tree root matches the registrar | Pass: `registrar/src/tree.js` gives root `0` for an empty tree, same as the chain |
| Parcel list | Pass: 31 rows with ID, cell count, status. Hovering P26 highlights its 10 cells, clicking B selects its 6 cells and the selection survives the 3 s refresh |
| Public API never returns fine cells | Pass: `/api/chain` and `/api/chain/state` fetched; none of the 270 fine-cell strings (hex and decimal, all 31 parcels) appear in either response. The handler also never reads `parcels.json` or registrar state |
| Public map draws coarse cells only | Pass (with a mocked response, see below): one token with parcel A's coarse cell gives 1 polygon at resolution 9 and no fine cells |
| `cd contracts && npx hardhat test` | **21 passing** |
| `cd geo && pytest` | **25 passed** |

## Changes that came out of testing

- Map libraries (Leaflet 1.9.4, h3-js 4.1.0) still load from pinned CDN tags. If the CDN is blocked, the pages now load the same pinned versions from `ui/node_modules` (served under `/vendor/`). This needs `npm ci` in `ui/`. If both fail, the map shows a visible message instead of a blank box.
- Before the first reset, `/api/chain` answers 200 with an empty view instead of 503, so the browser console stays clean.

## Limits of these tests

- The public map with a token was tested with a **mocked `/api/chain` response** (parcel A's coarse cell), not a real registration. No parcel was registered on the chain.
- The leak scan covers the empty chain. With real tokens, the same scan should be repeated (see below).
- The CDN path itself (as opposed to the local fallback) could not be exercised here.
- Browser checks were ad hoc scripts, not committed tests.

## Still to check

**On Sarah's Windows laptop** (could not be run from here):
- `cd ui && npm ci`, `cd contracts && npm ci`, then `npm run ui` from the repo root.
- Open `/`, `/registrar.html` and `/public.html`; the maps should show cells and the console should be clean.
- Click **Reset chain** (not Register). It now starts Hardhat and the deploy through Node, with no bash, `npx` or `lsof`. On first use Hardhat downloads the Solidity compiler, so allow extra time.
- If Reset chain fails on Windows, note the message. Hardhat itself is the only part not yet seen running there.

**On Maneesh's Mac** (needs the zkey and a real proof):
- The A, B, C flow: Reset chain, then Register A (should succeed, token 1), Register B (should be refused as an overlap with A, shared cells red on the registrar map), Register C (should succeed, token 2).
- After each step, the public view should show the new token and its coarse cells only. Repeat the fine-cell leak scan against `/api/chain` with tokens present.
- Register all, and the live step and timer display during proving.
- Confirm the public map matches the coarse cells in the token table.
