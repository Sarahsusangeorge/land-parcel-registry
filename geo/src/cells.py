"""Polygon -> H3 cells. Shared by the Sprint 0 analysis and the parcels pipeline.

Conventions (PLAN.md):
  - Input geometry is GeoJSON in WGS84 (lon, lat order).
  - "center": a cell counts if its centre lies inside the parcel, so each cell
    belongs to at most one parcel. "overlap": a cell counts if any part of it
    touches the parcel (used only for the Sprint 0 comparison).
  - Cell lists come back sorted ascending and unique.
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
    return sorted(set(cells))


def fallback_cell(geom, res):
    """The cell containing a point guaranteed inside the parcel.

    NOT used by the pipeline. Kept only so the Sprint 0 analysis can show why:
    on all 24,102 Newton parcels at res 12, giving the 419 zero-cell parcels this
    cell made 658 parcels collide with a neighbour (the cell's centre lies in the
    neighbour, which already owns it). Zero-cell parcels are flagged
    fits_batch: false instead.
    """
    p = shape(geom).representative_point()
    return h3.latlng_to_cell(p.y, p.x, res)


def coarse_cells(fine, coarse_res):
    """Public footprint: sorted unique H3 parents of the fine cells."""
    return sorted({h3.cell_to_parent(c, coarse_res) for c in fine})


def area_m2(geom):
    """Geodesic area in square metres (no projection needed)."""
    a, _ = _GEOD.geometry_area_perimeter(shape(geom))
    return abs(a)


def cell_to_dec(cell):
    """H3 hex string -> decimal string (never pass H3 IDs around as JS numbers)."""
    return str(int(cell, 16))
