"""API routes: health check + chat stream"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from core import stream_chat
from schemas import ChatRequest
from settings import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "service": "askio-api",
        "gemini_key_set": s.api_key_configured,
        "gemini_key_valid": s.api_key_valid_format,
    }


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_chat(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
