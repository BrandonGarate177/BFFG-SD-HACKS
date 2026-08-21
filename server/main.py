import itertools

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

import csv_export
import ml_bulk_client
import parcel_lookup
import precomputed_predictions
import rag_client
from models import (
    ArchetypePrediction,
    MlBulkUploadResponse,
    ModelInfo,
    ParcelCapacity,
    ParcelDetailRequest,
    ParcelDetailResponse,
    RagResult,
    SearchRequest,
    SearchResponse,
)

app = FastAPI(title="Building Permits Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    matches = precomputed_predictions.filter_parcels(
        archetype=request.archetype,
        budget_usd=request.budget_usd,
        timeframe_months=request.timeframe_months,
        community=request.community,
        limit=request.limit,
    )
    return SearchResponse(matches=matches)


@app.post("/parcel-detail", response_model=ParcelDetailResponse)
async def parcel_detail(request: ParcelDetailRequest) -> ParcelDetailResponse:
    parcel = parcel_lookup.get_parcel(request.apn)
    if parcel is None:
        raise HTTPException(status_code=404, detail=f"Unknown apn: {request.apn}")

    rag_raw = await rag_client.get_rag_context(parcel)

    return ParcelDetailResponse(
        apn=parcel["apn"],
        parcel=parcel["parcel"],
        capacity=ParcelCapacity(**parcel["capacity"]),
        predictions={
            archetype: ArchetypePrediction(**prediction)
            for archetype, prediction in parcel["predictions"].items()
        },
        model_info=ModelInfo(
            model_c_index=parcel_lookup.MODEL_INFO["model_c_index"],
            predictions_as_of=parcel_lookup.MODEL_INFO["as_of_date"],
        ),
        rag_result=RagResult(**rag_raw),
    )


@app.get("/model-info")
async def model_info() -> dict:
    return parcel_lookup.MODEL_INFO


@app.get("/ml/bulk-export/csv")
async def bulk_export_csv(limit: int = Query(500, le=5000)) -> Response:
    """Downloads the DSD-schema CSV built from up to `limit` parcels, without
    sending it anywhere. Useful for inspecting exactly what /ml/bulk-export would
    upload. Defaults and caps at a small limit — the real dataset has 393,755
    parcels, far more than makes sense as a default download."""
    parcels = itertools.islice(parcel_lookup.iter_all_parcels(), limit)
    csv_bytes = csv_export.build_csv_bytes(list(parcels))
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=development_projects.csv"},
    )


@app.post("/ml/bulk-export", response_model=MlBulkUploadResponse)
async def bulk_export(limit: int = Query(500, le=5000)) -> MlBulkUploadResponse:
    """Builds the DSD-schema rows from up to `limit` parcels and sends them as JSON
    to the ML model's bulk-ingest endpoint (ML_MODEL_BULK_URL) — no file upload
    involved. Falls back to a mock acknowledgement if the URL is unset or the call
    fails, same pattern as /parcel-detail's RAG call."""
    parcels = itertools.islice(parcel_lookup.iter_all_parcels(), limit)
    records = csv_export.build_records(list(parcels))
    result = await ml_bulk_client.send_bulk_records(records)
    return MlBulkUploadResponse(**result)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
