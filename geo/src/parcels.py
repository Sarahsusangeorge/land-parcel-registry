"""Geo pipeline: real parcel polygons -> geo/out/parcels.json (interface I2).

For every parcel: fine H3 cells (private, FINE_RES, CELL_MODE), coarse parent
cells (public, COARSE_RES), decimal forms, geodesic area and a SHA-256 of the
canonical geometry. Parcels with more than MAX_CELLS fine cells, or with none
(smaller than one cell), are kept and flagged fits_batch: false, never
truncated or padded.

Fixtures (I2):
  A  a real parcel from the sample
  B  A translated SHIFT_M metres east: a redrawn re-registration of the same land,
     so it shares at least one fine cell with A
  C  a real parcel that touches A (shares a boundary) and shares no fine cell
     with A or B: true neighbours must not collide
  P01.. every other sample parcel, for benchmarks

Fixtures are always chosen at the frozen FINE_RES, so the same real parcels
are A, B, C and P01.. in every output.

Usage (from geo/):
    python src/parcels.py [--in data/raw/newton_sample.geojson] [--out out/parcels.json]

    # Sprint 4 resolution comparison: same parcels, another fine resolution.
    # Never overwrite out/parcels.json with this; it is the I2 interface file.
    python src/parcels.py --fine-res 13 --out out/parcels_res13.json
"""
import argparse
import datetime
import hashlib
import json
import math
import pathlib
import sys

from shapely import affinity
from shapely.geometry import mapping, shape

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from src.cells import area_m2, cell_to_dec, coarse_cells, polygon_cells  # noqa: E402

# I1 constants (decision log 2026-10-13; frozen once Maneesh agrees)
FINE_RES = 12
COARSE_RES = 9
CELL_MODE = "center"
MAX_CELLS = 16

SHIFT_M = 5.0  # fixture B offset, about half a res-12 cell edge (~9.4 m)

GEO = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_IN = GEO / "data" / "raw" / "newton_sample.geojson"
DEFAULT_OUT = GEO / "out" / "parcels.json"


def canonical_geometry(geom):
    """Stable JSON for hashing: type + coordinates rounded to 9 dp, sorted keys, no spaces."""
    def rnd(x):
        return [rnd(v) for v in x] if isinstance(x, (list, tuple)) else round(float(x), 9)
    g = mapping(shape(geom))
    return json.dumps({"type": g["type"], "coordinates": rnd(g["coordinates"])},
                      sort_keys=True, separators=(",", ":"))


def polygon_sha256(geom):
    return hashlib.sha256(canonical_geometry(geom).encode()).hexdigest()


def shift_east(geom, metres):
    """Translate a lon/lat geometry east by a distance in metres."""
    g = shape(geom)
    lat = g.centroid.y
    dlon = metres / (111_320.0 * math.cos(math.radians(lat)))
    return mapping(affinity.translate(g, xoff=dlon))


def parcel_record(parcel_id, source_feature_id, geom, fine_res=FINE_RES):
    fine = polygon_cells(geom, fine_res, CELL_MODE)
    coarse = coarse_cells(fine, COARSE_RES)
    return {
        "parcel_id": parcel_id,
        "source_feature_id": source_feature_id,
        "polygon_sha256": polygon_sha256(geom),
        "area_m2": round(area_m2(geom), 1),
        "fine_cells": fine,
        "fine_cells_dec": [cell_to_dec(c) for c in fine],
        "coarse_cells": coarse,
        "coarse_cells_dec": [cell_to_dec(c) for c in coarse],
        "num_fine_cells": len(fine),
        "fits_batch": 1 <= len(fine) <= MAX_CELLS,
    }


def pick_fixtures(feats):
    """Deterministic A and C from the sample (sample order = distance from seed)."""
    for a in feats:
        a_geom = shape(a["geometry"])
        a_cells = set(polygon_cells(a["geometry"], FINE_RES, CELL_MODE))
        if not 4 <= len(a_cells) <= MAX_CELLS:
            continue
        b_cells = set(polygon_cells(shift_east(a["geometry"], SHIFT_M), FINE_RES, CELL_MODE))
        if not (a_cells & b_cells) or len(b_cells) > MAX_CELLS:
            continue
        for c in feats:
            if c is a or not a_geom.touches(shape(c["geometry"])):
                continue
            c_cells = set(polygon_cells(c["geometry"], FINE_RES, CELL_MODE))
            if 1 <= len(c_cells) <= MAX_CELLS and not c_cells & (a_cells | b_cells):
                return a, c
    raise SystemExit("no A/C pair in the sample meets the fixture rules; widen the sample")


def build(sample, fine_res=FINE_RES):
    feats = sample["features"]
    a, c = pick_fixtures(feats)
    a_id = a["properties"]["MAP_PAR_ID"]
    out = [
        parcel_record("A", a_id, a["geometry"], fine_res),
        parcel_record("B", f"{a_id}+shift{SHIFT_M:g}mE", shift_east(a["geometry"], SHIFT_M), fine_res),
        parcel_record("C", c["properties"]["MAP_PAR_ID"], c["geometry"], fine_res),
    ]
    rest = [f for f in feats if f is not a and f is not c]
    for i, f in enumerate(rest, 1):
        out.append(parcel_record(f"P{i:02d}", f["properties"]["MAP_PAR_ID"], f["geometry"], fine_res))
    src = sample.get("source", {})
    return {
        "meta": {
            "fine_res": fine_res,
            "coarse_res": COARSE_RES,
            "cell_mode": CELL_MODE,
            "max_cells": MAX_CELLS,
            "source": f"{src.get('name', 'unknown')} {src.get('url', '')}".strip(),
            "generated_at": datetime.datetime.now(datetime.timezone.utc)
                            .isoformat(timespec="seconds"),
        },
        "parcels": out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", type=pathlib.Path, default=DEFAULT_IN)
    ap.add_argument("--out", type=pathlib.Path, default=DEFAULT_OUT)
    ap.add_argument("--fine-res", type=int, default=FINE_RES,
                    help=f"fine H3 resolution (default {FINE_RES}, the frozen I1 value)")
    args = ap.parse_args()
    if args.fine_res != FINE_RES and args.out.resolve() == DEFAULT_OUT.resolve():
        sys.exit(f"--fine-res {args.fine_res} would overwrite the I2 file {DEFAULT_OUT}; pass --out")

    sample = json.loads(args.inp.read_text())
    print(f"read {len(sample['features'])} parcels from {args.inp}")
    doc = build(sample, args.fine_res)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, indent=2) + "\n")

    ps = doc["parcels"]
    over = [p["parcel_id"] for p in ps if not p["fits_batch"]]
    counts = sorted(p["num_fine_cells"] for p in ps)
    print(f"fine_res {args.fine_res}. fixtures: A={ps[0]['source_feature_id']} ({ps[0]['num_fine_cells']} cells), "
          f"B=A shifted {SHIFT_M:g} m east ({ps[1]['num_fine_cells']} cells, "
          f"{len(set(ps[0]['fine_cells']) & set(ps[1]['fine_cells']))} shared with A), "
          f"C={ps[2]['source_feature_id']} ({ps[2]['num_fine_cells']} cells)")
    print(f"fine cells per parcel: median {counts[len(counts) // 2]}, max {counts[-1]}; "
          f"fit 1-{MAX_CELLS}: {len(ps) - len(over)}/{len(ps)}; fits_batch false: {over or 'none'}")
    print(f"wrote {args.out} ({len(ps)} parcels)")


if __name__ == "__main__":
    main()
