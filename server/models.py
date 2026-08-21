from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

Archetype = Literal["adu", "duplex", "3_4_unit", "5plus"]


class SearchRequest(BaseModel):
    archetype: Archetype
    budget_usd: float  # matched against permit_fee_usd, a fee floor — see data/README.md
    timeframe_months: float
    community: Optional[str] = None
    limit: int = 200


class ParcelMatch(BaseModel):
    apn: str
    archetype: Archetype
    median_days: float
    permit_fee_usd: float
    prob_issued_365d: Optional[float] = None


class SearchResponse(BaseModel):
    matches: list[ParcelMatch]


class ParcelDetailRequest(BaseModel):
    apn: str


class ArchetypePrediction(BaseModel):
    median_days: Optional[float] = None
    prob_issued_180d: Optional[float] = None
    prob_issued_365d: Optional[float] = None
    permit_fee_usd: Optional[float] = None
    owes_dif: Optional[bool] = None


class ParcelCapacity(BaseModel):
    cap_base: Optional[float] = None
    cap_adu: Optional[float] = None
    cap_jadu: Optional[float] = None
    cap_sb9: Optional[float] = None
    cap_total: Optional[float] = None
    delta_units: Optional[float] = None
    cap_adu_bonus_max: Optional[float] = None
    delta_units_with_bonus: Optional[float] = None


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())  # "model_c_index" isn't a Pydantic internal

    source: str = "precomputed"
    model_c_index: float
    predictions_as_of: str
    disclaimer: str = (
        "Ranks parcels better than chance (C-index above), not a commitment. "
        "Based on historical permits, not a forecast."
    )


class RagResult(BaseModel):
    reasons: list[str]
    sentiment_summary: str
    source: str
    error: Optional[str] = None


class ParcelDetailResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())  # "model_info" isn't a Pydantic internal

    apn: str
    parcel: dict[str, Any]
    capacity: ParcelCapacity
    predictions: dict[str, ArchetypePrediction]
    model_info: ModelInfo
    # Absent by design. Composing this needs a Claude call, which took 4-6s
    # while every other field here comes out of memory in under a
    # millisecond - so the page no longer waits on it. Clients fetch it from
    # POST /parcel-rag once the parcel itself has rendered.
    rag_result: Optional[RagResult] = None


class RagChatRequest(BaseModel):
    message: str


class RagChatResponse(BaseModel):
    answer: str
    source: str
    error: Optional[str] = None
