from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import parcel_lookup
import permit_rag
import precomputed_predictions
import rag_client
from models import (
    ArchetypePrediction,
    ModelInfo,
    ParcelCapacity,
    ParcelDetailRequest,
    ParcelDetailResponse,
    RagChatRequest,
    RagChatResponse,
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


@app.post("/rag/chat", response_model=RagChatResponse)
async def rag_chat(request: RagChatRequest) -> RagChatResponse:
    """General-purpose permit Q&A, grounded in permit_type_stats.csv. Same
    underlying Claude call as /parcel-detail's rag_result, just asked a
    free-form question instead of one built from a specific parcel."""
    result = await permit_rag.answer_question(request.message)
    return RagChatResponse(**result)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
