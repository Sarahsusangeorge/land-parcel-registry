"""Polygon -> H3 cells, shared by the Sprint 0 analysis and the Sprint 1 pipeline.

Conventions (PLAN.md):
  - Input geometry is GeoJSON in WGS84 (lon, lat order).
  - CELL_MODE "center": a cell counts if its centre lies inside the parcel.
    "overlap": a cell counts if any part of it touches the parcel.
  - Cell lists come back sorted ascending.
"""
import h3
from pyproj import Geod
from shapely.geometry import mapping, shape

_GEOD = Geod(ellps="WGS84")


def to_h3shape(geom):
    """GeoJSON geometry dict -> H3Shape. geo_to_h3shape handles the lon/lat order."""
    return h3.geo_to_h3shape(mapping(shape(geom)))


def polygon_cells(geom, res, mode="center"):
    """Sorted list of H3 cells (hex strings) for a parcel at a resolution."""
    if mode not in ("center", "overlap"):
        raise ValueError(f"mode must be 'center' or 'overlap', got {mode!r}")
    cells = h3.h3shape_to_cells_experimental(to_h3shape(geom), res, contain=mode)
    return sorted(cells)


def area_m2(geom):
    """Geodesic area in square metres (no projection needed)."""
    a, _ = _GEOD.geometry_area_perimeter(shape(geom))
    return abs(a)


def cell_to_dec(cell):
    """H3 hex string -> decimal string (never pass H3 IDs around as JS numbers)."""
    return str(int(cell, 16))
