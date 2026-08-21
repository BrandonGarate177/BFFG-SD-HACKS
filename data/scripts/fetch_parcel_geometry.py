#!/usr/bin/env python3
"""
Fetches City-of-San-Diego parcel geometry from SANDAG's public parcels
FeatureServer and joins it to parcels_tile_attributes.parquet on apn.

Writes two GeoJSON FeatureCollections (polygons + centroids), each feature
carrying the full 18-column production schema. tippecanoe combines both
into one "parcels" vector tile layer: MapLibre's fill layer only draws the
Polygon features and the circle layer only draws the Point features, so a
single vector layer can hold both without conflict.

Usage: python data/scripts/fetch_parcel_geometry.py
"""
import json
import math
import sys
import time
from pathlib import Path

import pyarrow.parquet as pq
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[2]
ATTRS_PARQUET = ROOT / "data" / "parcels_tile_attributes.parquet"
OUT_POLYGONS = ROOT / "data" / "parcels.polygons.geojson"
OUT_CENTROIDS = ROOT / "data" / "parcels.centroids.geojson"

FEATURE_SERVER = "https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/query"
PAGE_SIZE = 2000

session = requests.Session()
session.mount("https://", HTTPAdapter(max_retries=Retry(
    total=5, backoff_factor=1.5, status_forcelist=[429, 500, 502, 503, 504],
)))


def clean(v):
    """JSON-safe scalar: NaN/None -> None, numpy scalars -> python."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if hasattr(v, "item"):
        v = v.item()
    return v


def load_attributes() -> dict[str, dict]:
    table = pq.read_table(ATTRS_PARQUET)
    cols = table.column_names
    rows = table.to_pylist()
    attrs = {row["apn"]: {c: clean(row[c]) for c in cols} for row in rows}
    print(f"loaded {len(attrs):,} parcels from {ATTRS_PARQUET.name}", file=sys.stderr)
    return attrs


def fetch_pages():
    offset = 0
    total = None
    while True:
        params = {
            "where": "situs_juris='SD'",
            "outFields": "apn",
            "outSR": 4326,
            "f": "geojson",
            "returnCentroid": "true",
            "orderByFields": "objectid",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
        }
        resp = session.get(FEATURE_SERVER, params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(data["error"])
        feats = data.get("features", [])
        if not feats:
            break
        yield feats
        offset += len(feats)
        if total is None:
            print(f"  fetched {offset:,} so far...", file=sys.stderr)
        elif offset % (PAGE_SIZE * 10) == 0:
            print(f"  fetched {offset:,} so far...", file=sys.stderr)
        if len(feats) < PAGE_SIZE:
            break


def main():
    attrs = load_attributes()
    remaining = set(attrs.keys())

    polygons = []
    centroids = []
    unmatched_geometry = 0

    t0 = time.time()
    for page in fetch_pages():
        for feat in page:
            apn = feat.get("properties", {}).get("apn")
            row = attrs.get(apn)
            if row is None:
                unmatched_geometry += 1
                continue
            remaining.discard(apn)

            polygons.append({
                "type": "Feature",
                "geometry": feat["geometry"],
                "properties": row,
            })
            centroid = feat.get("centroid")
            if centroid is not None:
                centroids.append({
                    "type": "Feature",
                    "geometry": centroid,
                    "properties": row,
                })

    elapsed = time.time() - t0
    print(f"fetch complete in {elapsed:.0f}s", file=sys.stderr)
    print(f"matched {len(polygons):,} parcels", file=sys.stderr)
    print(f"unmatched (FeatureServer apn not in parquet): {unmatched_geometry:,}", file=sys.stderr)
    print(f"missing (parquet apn not returned by FeatureServer): {len(remaining):,}", file=sys.stderr)
    if remaining:
        print(f"  sample missing apns: {list(remaining)[:5]}", file=sys.stderr)

    OUT_POLYGONS.write_text(json.dumps({"type": "FeatureCollection", "features": polygons}))
    OUT_CENTROIDS.write_text(json.dumps({"type": "FeatureCollection", "features": centroids}))
    print(f"wrote {OUT_POLYGONS}", file=sys.stderr)
    print(f"wrote {OUT_CENTROIDS}", file=sys.stderr)


if __name__ == "__main__":
    main()
