import asyncio

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
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
    """General-purpose permit Q&A, grounded in permit_type_stats.csv. One-shot,
    no memory of prior questions — see /ws/rag/chat for a stateful version."""
    result = await permit_rag.answer_question(request.message)
    return RagChatResponse(**result)


WS_PING_INTERVAL_SECONDS = 25.0


@app.websocket("/ws/rag/chat")
async def rag_chat_ws(websocket: WebSocket) -> None:
    """Interactive, multi-turn version of /rag/chat. Holds one connection open
    per client and keeps a running `messages` array of the conversation so
    far, so follow-up questions ("what about ADUs?") have context — unlike
    the stateless POST endpoint, which answers each call in isolation.

    Waits for the client to send {"message": "..."}; while idle, sends
    {"type": "ping"} every WS_PING_INTERVAL_SECONDS instead of blocking
    forever, so the connection doesn't sit silent long enough for a proxy's
    idle timeout to kill it.

    Each answer is streamed as a sequence of tagged frames rather than one
    blob, so the client can render text as it arrives:

        {"type": "chunk", "text": "..."}   one or more, in order
        {"type": "done", "source": "live" | "mock" | "error",
         "error": str | None}              exactly one, terminating

    Concatenating the chunk text of one turn reproduces the whole answer.
    "done" carries the same source/error taxonomy as POST /rag/chat, so
    unlike the earlier bare-string protocol a client here CAN tell a mock
    answer from a live one — plus "error", which only the streaming path
    can produce (see permit_rag.stream_conversation).
    """
    await websocket.accept()
    messages: list[dict[str, str]] = []
    try:
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(), timeout=WS_PING_INTERVAL_SECONDS
                )
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue

            question = (data.get("message") or "").strip()
            if not question:
                continue

            messages.append({"role": "user", "content": question})
            parts: list[str] = []
            async for frame in permit_rag.stream_conversation(messages):
                if frame["type"] == "chunk":
                    parts.append(frame["text"])
                await websocket.send_json(frame)

            answer = "".join(parts)
            if answer:
                messages.append({"role": "assistant", "content": answer})
            else:
                # Nothing came back. Drop the user turn too rather than leave
                # history ending on it — the next question would then send two
                # consecutive user messages, which the Messages API rejects.
                messages.pop()
    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
