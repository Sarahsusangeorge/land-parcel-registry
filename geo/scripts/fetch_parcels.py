"""Download a small, contiguous block of real parcels for Sprint 0.

Source: Fairfax County, VA parcel layer (ArcGIS FeatureServer, public).
  https://www.fairfaxcounty.gov/mercator/rest/services/GIS/ParcelsPlus/FeatureServer/0
The layer is stored in Virginia State Plane (feet). We ask the server for
outSR=4326 so the GeoJSON comes back in WGS84 lon/lat, which is what h3 needs.

Usage:
    python scripts/fetch_parcels.py                      # default block, up to 40 parcels
    python scripts/fetch_parcels.py --bbox -77.29 38.844 -77.286 38.8465 --limit 40

The default bbox is a small residential area; if it returns too few parcels,
move or widen it. Pick an area with ordinary house lots so neighbours share
edges, since that is what the edge rule needs to be tested on.
"""
import argparse
import json
import pathlib
import sys
import urllib.parse
import urllib.request

LAYER = "https://www.fairfaxcounty.gov/mercator/rest/services/GIS/ParcelsPlus/FeatureServer/0"
DEFAULT_BBOX = (-77.2890, 38.8440, -77.2860, 38.8465)  # xmin, ymin, xmax, ymax (lon/lat)
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw" / "fairfax_sample.geojson"


def fetch(bbox, limit):
    params = {
        "where": "1=1",
        "geometry": ",".join(str(v) for v in bbox),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "OBJECTID,PIN,PARCEL_TYPE",
        "outSR": "4326",
        "returnGeometry": "true",
        "resultRecordCount": str(limit),
        "f": "geojson",
    }
    url = f"{LAYER}/query?{urllib.parse.urlencode(params)}"
    print(f"GET {url}")
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX,
                    metavar=("XMIN", "YMIN", "XMAX", "YMAX"))
    ap.add_argument("--limit", type=int, default=40)
    args = ap.parse_args()

    fc = fetch(args.bbox, args.limit)
    if "error" in fc:
        sys.exit(f"Server error: {fc['error']}")
    feats = [f for f in fc.get("features", [])
             if f.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")]
    if not feats:
        sys.exit("No polygon parcels returned. Move or widen --bbox.")

    fc["features"] = feats
    fc["source"] = {"name": "Fairfax County VA ParcelsPlus", "url": LAYER, "bbox": list(args.bbox)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc))
    print(f"read {len(feats)} parcels; wrote {OUT}")
    if len(feats) < 20:
        print("warning: fewer than 20 parcels, widen --bbox")


if __name__ == "__main__":
    main()
