from typing import Any, Optional

from pydantic import BaseModel


class SearchRequest(BaseModel):
    budget_usd: float
    timeframe_months: float


class ParcelMatch(BaseModel):
    parcel_id: str
    predicted_time_months: float
    predicted_cost_usd: float


class SearchResponse(BaseModel):
    matches: list[ParcelMatch]


class ParcelDetailRequest(BaseModel):
    parcel_id: str


class MlResult(BaseModel):
    predicted_time_months: float
    predicted_cost_usd: float
    source: str
    error: Optional[str] = None


class RagResult(BaseModel):
    reasons: list[str]
    sentiment_summary: str
    source: str
    error: Optional[str] = None


class ParcelDetailResponse(BaseModel):
    parcel_id: str
    parcel: dict[str, Any]
    ml_result: MlResult
    rag_result: RagResult
