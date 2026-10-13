"""Download real US parcels and cut the Sprint 1 sample block.

Source: City of Newton, Massachusetts official parcel layer, published by the
city's GIS office on GitHub (already in WGS84 lon/lat, MultiPolygon):
  https://github.com/NewtonMAGIS/GISData/blob/master/Property/Parcels.geojson
Public record under Massachusetts public records law; provided without warranty.

The full file (~40 MB, ~24,000 parcels) is saved as data/raw/newton_parcels_full.geojson
(gitignored). The sample is the SAMPLE_SIZE parcels whose centroids are nearest to
SEED_LONLAT, a single-family block chosen so neighbours share edges. Only the
parcel ID and a few non-personal fields are kept: owner names, prices and
values are dropped.

Usage:
    python scripts/fetch_parcels.py              # download (if missing) + write sample
    python scripts/fetch_parcels.py --refresh    # force re-download
"""
import argparse
import json
import pathlib
import urllib.request

from shapely.geometry import Point, shape

URL = "https://raw.githubusercontent.com/NewtonMAGIS/GISData/master/Property/Parcels.geojson"
SOURCE_NAME = "City of Newton MA parcels (NewtonMAGIS/GISData, Property/Parcels.geojson)"
SOURCE_URL = "https://github.com/NewtonMAGIS/GISData/blob/master/Property/Parcels.geojson"
SEED_LONLAT = (-71.2230, 42.3330)
SAMPLE_SIZE = 30
KEEP = ("MAP_PAR_ID", "Land_Use", "Lot_Size", "POLY_TYPE")

RAW = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"
FULL = RAW / "newton_parcels_full.geojson"
SAMPLE = RAW / "newton_sample.geojson"


def download(refresh):
    if FULL.exists() and not refresh:
        print(f"read cached {FULL}")
        return
    RAW.mkdir(parents=True, exist_ok=True)
    print(f"GET {URL}")
    with urllib.request.urlopen(URL, timeout=300) as r:
        FULL.write_bytes(r.read())
    print(f"wrote {FULL} ({FULL.stat().st_size / 1e6:.1f} MB)")


def cut_sample():
    feats = json.loads(FULL.read_text())["features"]
    feats = [f for f in feats if f["properties"].get("POLY_TYPE") == "FEE"]
    seed = Point(*SEED_LONLAT)
    feats.sort(key=lambda f: (shape(f["geometry"]).centroid.distance(seed),
                              f["properties"]["MAP_PAR_ID"]))
    out = [{"type": "Feature",
            "properties": {k: f["properties"].get(k) for k in KEEP},
            "geometry": f["geometry"]} for f in feats[:SAMPLE_SIZE]]
    SAMPLE.write_text(json.dumps({
        "type": "FeatureCollection",
        "source": {"name": SOURCE_NAME, "url": SOURCE_URL,
                   "seed_lonlat": list(SEED_LONLAT), "sample_size": SAMPLE_SIZE},
        "features": out,
    }, indent=1))
    print(f"wrote {SAMPLE} ({len(out)} parcels near {SEED_LONLAT})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    download(args.refresh)
    cut_sample()


if __name__ == "__main__":
    main()
