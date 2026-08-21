import json
from pathlib import Path
from typing import Any, Optional

GEOJSON_PATH = Path(__file__).parent / "sample_parcels.geojson"

_parcels_by_id: dict[str, dict[str, Any]] = {}


def _load() -> None:
    with open(GEOJSON_PATH, encoding="utf-8") as f:
        geojson = json.load(f)

    for feature in geojson["features"]:
        props = feature["properties"]
        parcel_id = props["parcel_id"]
        _parcels_by_id[parcel_id] = {
            **props,
            "geometry": feature["geometry"],
        }


_load()


def get_all_parcels() -> list[dict[str, Any]]:
    return list(_parcels_by_id.values())


def get_parcel_by_id(parcel_id: str) -> Optional[dict[str, Any]]:
    return _parcels_by_id.get(parcel_id)
