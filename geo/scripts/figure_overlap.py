"""IDF-B Section 7 figure: why fixture B is rejected and C is not.

Draws the real Newton parcels A and C, fixture B (A shifted 5 m east) and the
res-12 H3 cells each one occupies, from the same data and settings as
geo/out/parcels.json. Cells B shares with A are the cells whose insert would
hit an occupied slot in the registrar's tree, so no proof for B can exist.

Usage (from geo/):
    python scripts/figure_overlap.py
Writes ../patent/figures/fig3_overlap_rejection.svg
"""
import json
import math
import pathlib
import sys

import h3
from shapely.geometry import shape

GEO = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(GEO))
from src import parcels as P  # noqa: E402

SAMPLE = GEO / "data" / "raw" / "newton_sample.geojson"
PARCELS = GEO / "out" / "parcels.json"
OUT = GEO.parent / "patent" / "figures" / "fig3_overlap_rejection.svg"

W, H = 920, 600           # canvas
MAP_X, MAP_Y, MAP_W, MAP_H = 40, 96, 560, 470
INK, QUIET, RULE = "#1f2328", "#57606a", "#d0d7de"
A_COL, C_COL, CLASH = "#1f6feb", "#1a7f37", "#cf222e"


def main():
    sample = {f["properties"]["MAP_PAR_ID"]: f for f in json.loads(SAMPLE.read_text())["features"]}
    doc = json.loads(PARCELS.read_text())
    by = {p["parcel_id"]: p for p in doc["parcels"]}
    a_geom = sample[by["A"]["source_feature_id"]]["geometry"]
    c_geom = sample[by["C"]["source_feature_id"]]["geometry"]
    b_geom = P.shift_east(a_geom, P.SHIFT_M)

    a_cells, b_cells, c_cells = (set(by[k]["fine_cells"]) for k in "ABC")
    shared = a_cells & b_cells
    assert shared and not (c_cells & (a_cells | b_cells))

    # Local metric projection centred on A and C together.
    geoms = [shape(g) for g in (a_geom, b_geom, c_geom)]
    cells_all = a_cells | b_cells | c_cells
    pts = []
    for g in geoms:
        for poly in getattr(g, "geoms", [g]):
            pts += list(poly.exterior.coords)
    for c in cells_all:
        pts += [(lng, lat) for lat, lng in h3.cell_to_boundary(c)]
    lon0 = sum(p[0] for p in pts) / len(pts)
    lat0 = sum(p[1] for p in pts) / len(pts)
    kx = 111_320.0 * math.cos(math.radians(lat0))
    ky = 111_320.0
    xs = [(p[0] - lon0) * kx for p in pts]
    ys = [(p[1] - lat0) * ky for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.08
    scale = min(MAP_W, MAP_H) / span
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    def xy(lon, lat):
        x = MAP_X + MAP_W / 2 + ((lon - lon0) * kx - cx) * scale
        y = MAP_Y + MAP_H / 2 - ((lat - lat0) * ky - cy) * scale
        return f"{x:.1f},{y:.1f}"

    def cell_path(c):
        return "M" + " L".join(xy(lng, lat) for lat, lng in h3.cell_to_boundary(c)) + " Z"

    def poly_path(g):
        out = []
        for poly in getattr(shape(g), "geoms", [shape(g)]):
            out.append("M" + " L".join(xy(x, y) for x, y in poly.exterior.coords) + " Z")
        return " ".join(out)

    def centroid(cells):
        lats, lngs = zip(*[h3.cell_to_latlng(c) for c in cells])
        return xy(sum(lngs) / len(lngs), sum(lats) / len(lats)).split(",")

    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
         f'font-family="Helvetica, Arial, sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         f'<text x="40" y="44" font-size="20" font-weight="700" fill="{INK}">Fig. 3. A redrawn parcel B is rejected; '
         f'neighbour C is accepted</text>',
         f'<text x="40" y="70" font-size="14" fill="{QUIET}">Real parcels from the City of Newton, MA. '
         f'H3 resolution 12, centre rule. B = parcel A shifted 5 m east.</text>',
         f'<rect x="{MAP_X}" y="{MAP_Y}" width="{MAP_W}" height="{MAP_H}" fill="none" stroke="{RULE}"/>']

    # Cells: C, then A-only, then B-only, then shared (on top).
    for c in sorted(c_cells):
        s.append(f'<path d="{cell_path(c)}" fill="{C_COL}" fill-opacity="0.18" stroke="{C_COL}" stroke-width="1.2"/>')
    for c in sorted(a_cells - shared):
        s.append(f'<path d="{cell_path(c)}" fill="{A_COL}" fill-opacity="0.18" stroke="{A_COL}" stroke-width="1.2"/>')
    for c in sorted(b_cells - shared):
        s.append(f'<path d="{cell_path(c)}" fill="none" stroke="{QUIET}" stroke-width="1.2" stroke-dasharray="4 3"/>')
    for c in sorted(shared):
        s.append(f'<path d="{cell_path(c)}" fill="{CLASH}" fill-opacity="0.30" stroke="{CLASH}" stroke-width="2"/>')

    # Parcel boundaries.
    s.append(f'<path d="{poly_path(c_geom)}" fill="none" stroke="{C_COL}" stroke-width="2.5"/>')
    s.append(f'<path d="{poly_path(a_geom)}" fill="none" stroke="{A_COL}" stroke-width="2.5"/>')
    s.append(f'<path d="{poly_path(b_geom)}" fill="none" stroke="{INK}" stroke-width="1.8" stroke-dasharray="7 4"/>')

    # Labels near each parcel.
    for label, cells, col in (("A", a_cells, A_COL), ("C", c_cells, C_COL)):
        x, y = centroid(cells)
        s.append(f'<text x="{x}" y="{y}" font-size="26" font-weight="700" fill="{col}" text-anchor="middle" '
                 f'dominant-baseline="middle" stroke="#ffffff" stroke-width="5" paint-order="stroke">{label}</text>')
    bx, by_ = centroid(b_cells - shared or b_cells)
    s.append(f'<text x="{float(bx) + 18:.1f}" y="{by_}" font-size="22" font-weight="700" fill="{INK}" '
             f'dominant-baseline="middle" stroke="#ffffff" stroke-width="5" paint-order="stroke">B</text>')

    # Scale bar: 10 m.
    bar = 10 * scale
    y0 = MAP_Y + MAP_H - 22
    s.append(f'<line x1="{MAP_X + 20}" y1="{y0}" x2="{MAP_X + 20 + bar:.1f}" y2="{y0}" stroke="{INK}" stroke-width="3"/>')
    s.append(f'<text x="{MAP_X + 20}" y="{y0 - 8}" font-size="13" fill="{INK}">10 m</text>')

    # Legend: parcel boundaries, then cell types, then the outcome.
    lx, ly = 630, 110
    s.append(f'<text x="{lx}" y="{ly}" font-size="15" font-weight="700" fill="{INK}">Parcel boundaries</text>')
    bounds = [
        (f'stroke="{A_COL}" stroke-width="2.5"', "A: real parcel, registered first"),
        (f'stroke="{INK}" stroke-width="1.8" stroke-dasharray="7 4"', "B: A redrawn 5 m east"),
        (f'stroke="{C_COL}" stroke-width="2.5"', "C: real neighbour sharing A's edge"),
    ]
    for i, (style, text) in enumerate(bounds):
        yy = ly + 28 + i * 26
        s.append(f'<line x1="{lx}" y1="{yy - 4}" x2="{lx + 22}" y2="{yy - 4}" {style}/>')
        s.append(f'<text x="{lx + 32}" y="{yy}" font-size="13" fill="{INK}">{text}</text>')

    gy = ly + 120
    s.append(f'<text x="{lx}" y="{gy}" font-size="15" font-weight="700" fill="{INK}">Grid cells (H3 res 12)</text>')
    legend = []
    if a_cells - shared:
        legend.append((f'fill="{A_COL}" fill-opacity="0.18" stroke="{A_COL}"', f"Held by A only ({len(a_cells - shared)})"))
    legend += [
        (f'fill="{CLASH}" fill-opacity="0.30" stroke="{CLASH}" stroke-width="2"',
         f"Held by A, claimed again by B ({len(shared)})"),
        (f'fill="none" stroke="{QUIET}" stroke-dasharray="4 3"', f"Claimed by B only ({len(b_cells - shared)})"),
        (f'fill="{C_COL}" fill-opacity="0.18" stroke="{C_COL}"', f"Held by C ({len(c_cells)})"),
    ]
    for i, (style, text) in enumerate(legend):
        yy = gy + 18 + i * 30
        s.append(f'<rect x="{lx}" y="{yy}" width="22" height="18" rx="3" {style}/>')
        s.append(f'<text x="{lx + 32}" y="{yy + 14}" font-size="13" fill="{INK}">{text}</text>')

    oy = gy + 40 + len(legend) * 30
    s.append(f'<text x="{lx}" y="{oy}" font-size="15" font-weight="700" fill="{INK}">Registration outcome</text>')
    lines = [
        (A_COL, "A: every cell inserted into an empty slot;"),
        (A_COL, "   proof verifies, token 1 minted"),
        (CLASH, f"B: {len(shared)} of {len(b_cells)} cells already occupied;"),
        (CLASH, "   no valid insert proof exists, rejected"),
        (C_COL, "C: no cell shared with A or B;"),
        (C_COL, "   proof verifies, token 2 minted"),
    ]
    for i, (col, text) in enumerate(lines):
        s.append(f'<text x="{lx}" y="{oy + 26 + i * 22}" font-size="13" fill="{col}" '
                 f'xml:space="preserve">{text}</text>')
    ny = oy + 26 + len(lines) * 22 + 18
    for i, text in enumerate(("A cell belongs to the parcel containing", "its centre, so parcels that only touch",
                              "never share a cell.")):
        s.append(f'<text x="{lx}" y="{ny + i * 16}" font-size="12" fill="{QUIET}">{text}</text>')
    s.append("</svg>")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(s) + "\n")
    print(f"read {SAMPLE} and {PARCELS}")
    print(f"A {len(a_cells)} cells, B {len(b_cells)} cells ({len(shared)} shared with A), C {len(c_cells)} cells")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
