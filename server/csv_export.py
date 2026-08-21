import csv
import io
from typing import Any

# Column order matches the schema handed off to the ML model team.
CSV_HEADERS = [
    "DEVELOPMENT_ID",
    "PROJECT_ID",
    "PROJECT_TYPE",
    "PROJECT_STATUS",
    "PROJECT_PROCESSING_CODE",
    "PROJECT_CREATE_DATE",
    "PROJECT_DEEMEDCOMPLETE_DATE",
    "PROJECT_TRUST_ACCOUNT_NO",
    "PROJECT_TITLE",
    "PROJECT_SCOPE",
    "JOB_ID",
    "JOB_DRAWING_NUMBER",
    "GIS_ADDRESS",
    "GIS_APN",
    "JOB_BC_CODE",
    "JOB_BC_CODE_DESCRIPTION",
    "GIS_LATITUDE",
    "GIS_LONGITUDE",
    "APPROVAL_ID",
    "APPROVAL_CATEGORY_CODE",
    "APPROVAL_PROCESSING_CODE",
    "APPROVAL_TYPE",
    "APPROVAL_STATUS",
    "APPROVAL_SCOPE",
    "APPROVAL_CREATE_DATE",
    "APPROVAL_ISSUE_DATE",
    "APPROVAL_CLOSE_DATE",
    "APPROVAL_EXPIRE_DATE",
    "APPROVAL_VALUATION",
    "APPROVAL_DU_NET_CHANGE",
    "APPROVAL_STORIES",
    "APPROVAL_FLOOR_AREA",
    "APPROVAL_DU_EXTREMELY_LOW",
    "APPROVAL_DU_VERY_LOW",
    "APPROVAL_DU_LOW",
    "APPROVAL_DU_MODERATE",
    "APPROVAL_DU_ABOVE_MODERATE",
    "APPROVAL_DU_FUTURE_DEMO",
    "APPROVAL_DU_BONUS",
    "APPROVAL_ADU_EXTREMELY_LOW",
    "APPROVAL_ADU_VERY_LOW",
    "APPROVAL_ADU_LOW",
    "APPROVAL_ADU_MODERATE",
    "APPROVAL_ADU_ABOVE_MODERATE",
    "APPROVAL_ADU_BONUS",
    "APPROVAL_ADU_TOTAL",
    "APPROVAL_JADU_EXTREMELY_LOW",
    "APPROVAL_JADU_VERY_LOW",
    "APPROVAL_JADU_LOW",
    "APPROVAL_JADU_MODERATE",
    "APPROVAL_JADU_ABOVE_MODERATE",
    "APPROVAL_JADU_BONUS",
    "APPROVAL_JADU_TOTAL",
    "APPROVAL_PERMIT_HOLDER",
]

# Fields our real parcel records (data/predictions.parquet, via parcel_lookup.py)
# actually carry. Everything else in CSV_HEADERS comes from the DSD
# projects/approvals schema, which has no equivalent here — there is no address
# or geometry in this dataset (that lives only in the separate tile-build
# artifact, out of scope for this server) — so those columns are emitted blank
# rather than guessed.
_UNMAPPED = ""


def parcel_to_csv_row(parcel: dict[str, Any]) -> dict[str, str]:
    """Maps one merged parcel record (from parcel_lookup.get_parcel) onto the
    DSD-shaped CSV row. Only columns with a genuine 1:1 source field are
    populated; the rest are left blank."""
    apn = parcel.get("apn", _UNMAPPED)
    delta_units = parcel.get("capacity", {}).get("delta_units")

    row = {header: _UNMAPPED for header in CSV_HEADERS}
    row.update(
        {
            "PROJECT_ID": apn,
            "JOB_ID": apn,
            "GIS_APN": apn,
            "APPROVAL_DU_NET_CHANGE": delta_units if delta_units is not None else _UNMAPPED,
        }
    )
    return row


def build_records(parcels: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Maps parcels to CSV_HEADERS-shaped row dicts, for sending as JSON."""
    return [parcel_to_csv_row(parcel) for parcel in parcels]


def build_csv_bytes(parcels: list[dict[str, Any]]) -> bytes:
    """Writes parcels to an in-memory CSV using CSV_HEADERS and returns UTF-8 bytes.
    Used only for the local preview/download endpoint, not for the ML model call."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_HEADERS)
    writer.writeheader()
    for record in build_records(parcels):
        writer.writerow(record)
    return buffer.getvalue().encode("utf-8")
