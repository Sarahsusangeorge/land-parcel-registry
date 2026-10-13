"""Checks for src/cells.py on a synthetic block of edge-sharing lots in Fairfax.

Lots are built in metres and converted to lon/lat, so true neighbours share
exact edges, like real cadastral data.
"""
import math
import pathlib
import sys

import h3
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from src.cells import area_m2, cell_to_dec, polygon_cells  # noqa: E402

LON0, LAT0 = -77.2875, 38.8450
M_PER_DEG_LAT = 111_320.0
M_PER_DEG_LON = 111_320.0 * math.cos(math.radians(LAT0))


def lot(ix, iy, w=25.0, d=40.0):
    """Rectangular lot (w x d metres) at grid position (ix, iy), as GeoJSON."""
    x0, y0 = ix * w, iy * d
    pts = [(x0, y0), (x0 + w, y0), (x0 + w, y0 + d), (x0, y0 + d), (x0, y0)]
    ring = [[LON0 + x / M_PER_DEG_LON, LAT0 + y / M_PER_DEG_LAT] for x, y in pts]
    return {"type": "Polygon", "coordinates": [ring]}


BLOCK = [lot(ix, iy) for ix in range(6) for iy in range(4)]


def test_area_is_geodesic_square_metres():
    assert area_m2(lot(0, 0)) == pytest.approx(25 * 40, rel=0.01)


def test_lon_lat_order_not_swapped():
    for c in polygon_cells(lot(0, 0), 12):
        lat, lng = h3.cell_to_latlng(c)
        assert abs(lat - LAT0) < 0.01 and abs(lng - LON0) < 0.01


def test_cells_sorted_and_unique():
    cells = polygon_cells(lot(2, 2, 60, 60), 12)
    assert cells == sorted(set(cells))


def test_center_mode_neighbours_never_share_cells():
    seen = {}
    for i, g in enumerate(BLOCK):
        for c in polygon_cells(g, 13, "center"):
            assert c not in seen, f"lots {seen[c]} and {i} share {c}"
            seen[c] = i


def test_overlap_mode_neighbours_do_share_cells():
    a = set(polygon_cells(lot(0, 0), 12, "overlap"))
    b = set(polygon_cells(lot(1, 0), 12, "overlap"))
    assert a & b


def test_overlap_mode_is_superset_of_center():
    for g in BLOCK[:6]:
        assert set(polygon_cells(g, 12, "center")) <= set(polygon_cells(g, 12, "overlap"))


def test_tiny_parcel_can_get_zero_center_cells():
    # Documents the edge case to handle in Sprint 1 (e.g. fall back to the centroid's cell).
    tiny = lot(0, 0, 3, 3)
    assert polygon_cells(tiny, 11, "center") == []


def test_decimal_round_trip():
    c = polygon_cells(lot(0, 0), 12)[0]
    assert format(int(cell_to_dec(c)), "x") == c


def test_bad_mode_rejected():
    with pytest.raises(ValueError):
        polygon_cells(lot(0, 0), 12, "full")
