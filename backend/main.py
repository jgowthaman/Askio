"""FastAPI entry — run: uvicorn main:app --reload"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import routes
from schemas import ErrorResponse
from settings import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    if not s.api_key_configured:
        print("WARNING: GEMINI_API_KEY not set in backend/.env")
    elif not s.api_key_valid_format:
        print("WARNING: GEMINI_API_KEY format looks invalid (AIzaSy... or AQ....)")
    yield


app = FastAPI(title="Askio API", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def on_error(_req: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content=ErrorResponse(detail="Unexpected server error.").model_dump())


app.include_router(routes.router, prefix="/api")


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Askio API", "docs": "/docs"}
