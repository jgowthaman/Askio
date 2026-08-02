"""Env config — loads GEMINI_API_KEY, model, CORS from backend/.env"""

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PLACEHOLDER_KEYS = {"", "your_key_here", "your-api-key-here"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    google_api_key: str = Field(default="", validation_alias="GOOGLE_API_KEY")
    gemini_model: str = "gemini-2.0-flash"
    cors_origins: str = "http://localhost:5173"
    max_prompt_chars: int = 4000
    max_history_turns: int = 6
    request_timeout_sec: int = 60

    @model_validator(mode="after")
    def resolve_api_key(self) -> "Settings":
        raw = (self.gemini_api_key or self.google_api_key).strip()
        self.gemini_api_key = "" if raw in PLACEHOLDER_KEYS else raw
        return self

    @property
    def api_key_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def api_key_valid_format(self) -> bool:
        key = self.gemini_api_key
        return len(key) >= 20 and (key.startswith("AIzaSy") or key.startswith("AQ."))

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


def get_settings() -> Settings:
    return Settings()
