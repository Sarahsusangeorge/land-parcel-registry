"""Sprint 0 deliverable: cells per parcel at each resolution and mode.

Prints a markdown table (paste it into the chat / decision log) and writes
bench/results/cell_counts.json with every per-parcel number behind it.

Usage:
    python scripts/cell_count_table.py [path/to/parcels.geojson]
"""
import json
import pathlib
import statistics
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.cells import area_m2, fallback_cell, polygon_cells  # noqa: E402

RESOLUTIONS = (11, 12, 13)
MODES = ("center", "overlap")
N = 16
DEFAULT_IN = ROOT / "data" / "raw" / "newton_parcels_full.geojson"
OUT = ROOT.parent / "bench" / "results" / "cell_counts.json"


def shared_cells(cell_sets):
    """How many parcels share at least one cell with another parcel."""
    owner = Counter(c for s in cell_sets for c in set(s))
    return sum(1 for s in cell_sets if any(owner[c] > 1 for c in s))


def main():
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_IN
    feats = json.loads(path.read_text())["features"]
    print(f"read {len(feats)} parcels from {path}")
    areas = [area_m2(f["geometry"]) for f in feats]

    rows, detail = [], {}
    for res in RESOLUTIONS:
        for mode in MODES:
            sets = [polygon_cells(f["geometry"], res, mode) for f in feats]
            counts = [len(s) for s in sets]
            key = f"res{res}_{mode}"
            detail[key] = counts
            rows.append({
                "res": res, "mode": mode,
                "median": statistics.median(counts), "max": max(counts),
                "zero": sum(c == 0 for c in counts),
                "fit": sum(1 <= c <= N for c in counts),
                "shared": shared_cells(sets),
            })

    # Rejected option: center mode plus one fallback cell for parcels that get none.
    # Shows how many false neighbour collisions that fallback would add.
    fb = []
    for f in feats:
        c = polygon_cells(f["geometry"], 12, "center")
        fb.append((c, False) if c else ([fallback_cell(f["geometry"], 12)], True))
    sets = [c for c, _ in fb]
    counts = [len(s) for s in sets]
    detail["res12_center_fallback"] = counts
    rows.append({
        "res": 12, "mode": "center + fallback",
        "median": statistics.median(counts), "max": max(counts),
        "zero": sum(c == 0 for c in counts),
        "fit": sum(1 <= c <= N for c in counts),
        "shared": shared_cells(sets),
        "fallback_used": sum(u for _, u in fb),
    })

    n = len(feats)
    print(f"\nParcel area (m²): median {statistics.median(areas):.0f}, "
          f"min {min(areas):.0f}, max {max(areas):.0f}\n")
    print("| Res | Mode | Median cells | Max cells | Parcels with 0 cells "
          f"| Fit 1–{N} cells | Parcels sharing a cell with a neighbour |")
    print("|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['res']} | {r['mode']} | {r['median']:g} | {r['max']} | {r['zero']} "
              f"| {r['fit']}/{n} | {r['shared']}/{n} |")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    try:  # record the input relative to the repo root, never a machine-specific path
        source = str(path.resolve().relative_to(ROOT.parent))
    except ValueError:
        source = path.name
    OUT.write_text(json.dumps({"source": source, "n_parcels": n, "N": N,
                               "areas_m2": areas, "summary": rows,
                               "counts": detail}, indent=2))
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
