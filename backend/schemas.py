"""API request/response models"""

from enum import Enum

from pydantic import BaseModel, Field


class ResponseMode(str, Enum):
    SIMPLE = "simple"
    DETAILED = "detailed"
    PROFESSIONAL = "professional"
    TEACHER = "teacher"
    PROGRAMMER = "programmer"
    INTERVIEWER = "interviewer"


class StreamEventType(str, Enum):
    STATUS = "status"
    DELTA = "delta"
    DONE = "done"
    ERROR = "error"


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1)
    mode: ResponseMode = ResponseMode.SIMPLE
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=512, ge=64, le=4096)


class ErrorResponse(BaseModel):
    detail: str
