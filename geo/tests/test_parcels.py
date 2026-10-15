"""Sprint 1 acceptance tests for geo/src/parcels.py and geo/out/parcels.json (I2).

Runs the pipeline on the committed real sample (data/raw/newton_sample.geojson),
so it needs no network and matches what is written to out/parcels.json.
"""
import json
import pathlib
import re
import sys

import h3
import pytest
from shapely.geometry import shape

GEO = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(GEO))
from src import parcels as P  # noqa: E402

SAMPLE = GEO / "data" / "raw" / "newton_sample.geojson"
OUT = GEO / "out" / "parcels.json"

I2_META = {"fine_res": int, "coarse_res": int, "cell_mode": str, "max_cells": int,
           "source": str, "generated_at": str}
I2_PARCEL = {"parcel_id": str, "source_feature_id": str, "polygon_sha256": str,
             "area_m2": float, "fine_cells": list, "fine_cells_dec": list,
             "coarse_cells": list, "coarse_cells_dec": list,
             "num_fine_cells": int, "fits_batch": bool}


@pytest.fixture(scope="module")
def doc():
    return P.build(json.loads(SAMPLE.read_text()))


@pytest.fixture(scope="module")
def by_id(doc):
    return {p["parcel_id"]: p for p in doc["parcels"]}


def check_i2(doc):
    assert set(doc) == {"meta", "parcels"}
    assert set(doc["meta"]) == set(I2_META)
    for k, t in I2_META.items():
        assert isinstance(doc["meta"][k], t), k
    assert doc["meta"]["max_cells"] == 16
    assert doc["meta"]["cell_mode"] == "center"
    for p in doc["parcels"]:
        assert set(p) == set(I2_PARCEL), p["parcel_id"]
        for k, t in I2_PARCEL.items():
            assert isinstance(p[k], t), (p["parcel_id"], k)
        assert re.fullmatch(r"[0-9a-f]{64}", p["polygon_sha256"])
        for hexes, decs in (("fine_cells", "fine_cells_dec"), ("coarse_cells", "coarse_cells_dec")):
            assert p[hexes] == sorted(set(p[hexes]))
            assert all(isinstance(d, str) and d.isdigit() for d in p[decs])
            assert len(p[hexes]) == len(p[decs])
        assert all(h3.get_resolution(c) == doc["meta"]["fine_res"] for c in p["fine_cells"])
        assert all(h3.get_resolution(c) == doc["meta"]["coarse_res"] for c in p["coarse_cells"])
        assert p["num_fine_cells"] == len(p["fine_cells"])
        assert p["fits_batch"] == (1 <= p["num_fine_cells"] <= doc["meta"]["max_cells"])


def test_output_validates_against_i2(doc):
    check_i2(doc)


def test_written_file_validates_against_i2():
    check_i2(json.loads(OUT.read_text()))


def test_fixture_ids_and_count(doc):
    ids = [p["parcel_id"] for p in doc["parcels"]]
    assert ids[:3] == ["A", "B", "C"]
    assert len(ids) == len(set(ids))
    assert len(ids) - 3 >= 10  # at least 10 more real parcels


def test_b_shares_a_fine_cell_with_a(by_id):
    assert set(by_id["A"]["fine_cells"]) & set(by_id["B"]["fine_cells"])


def test_c_shares_no_cell_with_a_or_b(by_id):
    c = set(by_id["C"]["fine_cells"])
    assert not c & set(by_id["A"]["fine_cells"])
    assert not c & set(by_id["B"]["fine_cells"])


def test_c_is_a_true_neighbour_of_a():
    feats = {f["properties"]["MAP_PAR_ID"]: f for f in json.loads(SAMPLE.read_text())["features"]}
    doc = P.build(json.loads(SAMPLE.read_text()))
    a, c = doc["parcels"][0], doc["parcels"][2]
    assert shape(feats[a["source_feature_id"]]["geometry"]).touches(
        shape(feats[c["source_feature_id"]]["geometry"]))


def test_fixtures_fit_one_batch(by_id):
    for k in "ABC":
        assert by_id[k]["fits_batch"]


def test_real_parcels_never_share_cells(doc):
    owner = {}
    for p in doc["parcels"]:
        if p["parcel_id"] == "B":
            continue
        for c in p["fine_cells"]:
            assert c not in owner, f"{p['parcel_id']} and {owner[c]} share {c}"
            owner[c] = p["parcel_id"]


def test_decimal_strings_round_trip_to_hex(doc):
    for p in doc["parcels"]:
        for h, d in zip(p["fine_cells"] + p["coarse_cells"],
                        p["fine_cells_dec"] + p["coarse_cells_dec"]):
            assert format(int(d), "x") == h
            assert int(d) < 2**64  # coarse cells travel as uint64 on-chain


def test_coarse_cells_are_parents_of_fine_cells(doc):
    for p in doc["parcels"]:
        assert p["coarse_cells"] == sorted({h3.cell_to_parent(c, doc["meta"]["coarse_res"])
                                            for c in p["fine_cells"]})


def test_polygon_hash_is_stable_and_distinct(doc, by_id):
    again = P.build(json.loads(SAMPLE.read_text()))
    assert [p["polygon_sha256"] for p in again["parcels"]] == \
           [p["polygon_sha256"] for p in doc["parcels"]]
    assert by_id["A"]["polygon_sha256"] != by_id["B"]["polygon_sha256"]


def big_square(side_m):
    """A square parcel near the sample, side_m metres across."""
    lon0, lat0 = -71.2230, 42.3330
    dlat = side_m / 111_320.0
    dlon = side_m / (111_320.0 * 0.7385)
    ring = [[lon0, lat0], [lon0 + dlon, lat0], [lon0 + dlon, lat0 + dlat],
            [lon0, lat0 + dlat], [lon0, lat0]]
    return {"type": "Polygon", "coordinates": [ring]}


def test_large_parcel_flagged_not_truncated():
    rec = P.parcel_record("BIG", "synthetic", big_square(120))
    assert rec["num_fine_cells"] > 16
    assert rec["fits_batch"] is False
    assert len(rec["fine_cells"]) == rec["num_fine_cells"]


def test_tiny_parcel_flagged_not_padded():
    # Smaller than one res-12 cell: no cell centre inside. A fallback cell would
    # collide with the neighbour that owns it, so the parcel is flagged instead.
    rec = P.parcel_record("TINY", "synthetic", big_square(3))
    assert rec["num_fine_cells"] == 0 and rec["fine_cells"] == []
    assert rec["fits_batch"] is False


@pytest.mark.parametrize("res", [11, 13])
def test_other_resolution_keeps_same_parcels_and_i2_shape(res, doc):
    other = P.build(json.loads(SAMPLE.read_text()), fine_res=res)
    assert other["meta"]["fine_res"] == res
    assert [p["parcel_id"] for p in other["parcels"]] == [p["parcel_id"] for p in doc["parcels"]]
    assert [p["source_feature_id"] for p in other["parcels"]] == \
           [p["source_feature_id"] for p in doc["parcels"]]
    for p in other["parcels"]:
        assert all(h3.get_resolution(c) == res for c in p["fine_cells"])
        assert p["fits_batch"] == (1 <= p["num_fine_cells"] <= 16)


def test_default_build_is_the_frozen_resolution(doc):
    assert doc["meta"]["fine_res"] == P.FINE_RES == 12
