"""
All chat business logic: validate → safety → session → Gemini stream → SSE
"""

import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from better_profanity import profanity
from google import genai
from google.genai import types

from prompts import build_system_prompt
from schemas import ChatRequest, StreamEventType
from settings import get_settings

profanity.load_censor_words()
logger = logging.getLogger(__name__)

HTML_TAG = re.compile(r"<[^>]+>")
SCRIPT_TAG = re.compile(r"(?i)(javascript:|on\w+\s*=|<script)")

INVALID_KEY_MSG = "Invalid Gemini API key in backend/.env. Copy from Google AI Studio and restart."
NOT_SET_KEY_MSG = "Gemini API key is missing. Set GEMINI_API_KEY in backend/.env."


# --- Validation ---

class ValidationError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def validate_message(message: str) -> str:
    settings = get_settings()
    cleaned = message.strip()
    if not cleaned:
        raise ValidationError("Message cannot be empty.")
    if len(cleaned) > settings.max_prompt_chars:
        raise ValidationError(f"Message exceeds {settings.max_prompt_chars} characters.")
    if HTML_TAG.search(cleaned) or SCRIPT_TAG.search(cleaned):
        raise ValidationError("Message contains disallowed HTML or script content.")
    return cleaned


# --- SSE + Metrics ---

def format_sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


class MetricsTimer:
    def __init__(self) -> None:
        self._start = time.perf_counter()

    @property
    def elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._start) * 1000)


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def count_words(text: str) -> int:
    return len(text.split()) if text.strip() else 0


def detect_language_hint(text: str) -> str:
    for char in text:
        c = ord(char)
        if 0x0900 <= c <= 0x097F:
            return "hi"
        if 0x0B80 <= c <= 0x0BFF:
            return "ta"
    return "en"


# --- Session memory (in RAM, no DB) ---

@dataclass
class StoredMessage:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Session:
    session_id: str
    messages: list[StoredMessage] = field(default_factory=list)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def add(self, session_id: str, role: str, content: str) -> None:
        if session_id not in self._sessions:
            self._sessions[session_id] = Session(session_id=session_id)
        session = self._sessions[session_id]
        session.messages.append(StoredMessage(role=role, content=content))
        limit = get_settings().max_history_turns * 2
        if len(session.messages) > limit:
            session.messages = session.messages[-limit:]

    def history(self, session_id: str) -> list[dict[str, str]]:
        session = self._sessions.get(session_id, Session(session_id=session_id))
        limit = get_settings().max_history_turns * 2
        return [{"role": m.role, "content": m.content} for m in session.messages[-limit:]]


sessions = SessionStore()


# --- Safety filter ---

def check_safety(message: str) -> tuple[bool, str | None]:
    if profanity.contains_profanity(message):
        return False, "Sorry. Your message violates our safety policy."
    return True, None


# --- Gemini (only place that calls the AI) ---

async def stream_gemini(
    system_prompt: str,
    history: list[dict[str, str]],
    user_message: str,
    temperature: float,
    max_tokens: int,
) -> AsyncGenerator[str, None]:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    client = genai.Client(api_key=settings.gemini_api_key)
    contents: list[types.Content] = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=user_message)]))

    stream = await client.aio.models.generate_content_stream(
        model=settings.gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
        ),
    )
    async for chunk in stream:
        if chunk.text:
            yield chunk.text


# --- Chat orchestrator ---

def friendly_error(raw: str) -> str:
    lower = raw.lower()
    if any(k in lower for k in ("api key", "api_key", "not configured", "invalid_argument")) or (
        "invalid" in lower and "key" in lower
    ):
        return "Invalid or missing Gemini API key. Copy from Google AI Studio into backend/.env."
    if any(k in lower for k in ("429", "rate limit", "resource_exhausted", "too many requests")):
        return "Rate limit exceeded. Please try again in a moment."
    if "quota" in lower:
        return "Gemini quota error. Check API key or wait and retry."
    if "timeout" in lower or "deadline" in lower:
        return "Request timed out. Try a shorter message."
    return f"Something went wrong. ({raw[:120]})"


async def stream_chat(request: ChatRequest) -> AsyncGenerator[str, None]:
    timer = MetricsTimer()
    statuses = ("Understanding...", "Thinking...", "Writing...")

    try:
        cleaned = validate_message(request.message)
    except ValidationError as exc:
        yield format_sse({"type": StreamEventType.ERROR.value, "message": exc.message})
        return

    ok, reason = check_safety(cleaned)
    if not ok:
        yield format_sse({"type": StreamEventType.ERROR.value, "message": reason})
        return

    settings = get_settings()
    if not settings.api_key_configured:
        yield format_sse({"type": StreamEventType.ERROR.value, "message": NOT_SET_KEY_MSG})
        return
    if not settings.api_key_valid_format:
        yield format_sse({"type": StreamEventType.ERROR.value, "message": INVALID_KEY_MSG})
        return

    yield format_sse({"type": StreamEventType.STATUS.value, "text": statuses[0]})
    await asyncio.sleep(0)

    history = sessions.history(request.session_id)
    system = build_system_prompt(request.mode)

    yield format_sse({"type": StreamEventType.STATUS.value, "text": statuses[1]})
    await asyncio.sleep(0)

    full = ""
    try:
        async for delta in stream_gemini(system, history, cleaned, request.temperature, request.max_tokens):
            if not full:
                yield format_sse({"type": StreamEventType.STATUS.value, "text": statuses[2]})
                await asyncio.sleep(0)
            full += delta
            yield format_sse({"type": StreamEventType.DELTA.value, "text": delta})
            await asyncio.sleep(0)
    except Exception as exc:
        logger.error("Gemini error: %s", exc)
        yield format_sse({"type": StreamEventType.ERROR.value, "message": friendly_error(str(exc))})
        return

    sessions.add(request.session_id, "user", cleaned)
    sessions.add(request.session_id, "assistant", full)

    yield format_sse({
        "type": StreamEventType.DONE.value,
        "metrics": {
            "latency_ms": timer.elapsed_ms,
            "tokens_est": estimate_tokens(cleaned + full),
            "words": count_words(full),
            "chars": len(full),
            "language": detect_language_hint(cleaned),
        },
    })
