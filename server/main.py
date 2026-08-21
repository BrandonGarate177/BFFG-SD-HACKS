import asyncio

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import ml_model_client
import parcel_lookup
import precomputed_predictions
import rag_client
from models import (
    MlResult,
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
        budget_usd=request.budget_usd,
        timeframe_months=request.timeframe_months,
    )
    return SearchResponse(matches=matches)


@app.post("/parcel-detail", response_model=ParcelDetailResponse)
async def parcel_detail(request: ParcelDetailRequest) -> ParcelDetailResponse:
    parcel = parcel_lookup.get_parcel_by_id(request.parcel_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail=f"Unknown parcel_id: {request.parcel_id}")

    ml_task = ml_model_client.get_ml_prediction(parcel)
    rag_task = rag_client.get_rag_context(parcel)

    ml_raw, rag_raw = await asyncio.gather(ml_task, rag_task, return_exceptions=True)

    if isinstance(ml_raw, Exception):
        ml_result = MlResult(
            predicted_time_months=0,
            predicted_cost_usd=0,
            source="error",
            error=f"{type(ml_raw).__name__}: {ml_raw}",
        )
    else:
        ml_result = MlResult(**ml_raw)

    if isinstance(rag_raw, Exception):
        rag_result = RagResult(
            reasons=[],
            sentiment_summary="RAG service unavailable.",
            source="error",
            error=f"{type(rag_raw).__name__}: {rag_raw}",
        )
    else:
        rag_result = RagResult(**rag_raw)

    return ParcelDetailResponse(
        parcel_id=request.parcel_id,
        parcel=parcel,
        ml_result=ml_result,
        rag_result=rag_result,
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
