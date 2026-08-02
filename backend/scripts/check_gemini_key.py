"""Verify GEMINI_API_KEY — run: ./venv/bin/python scripts/check_gemini_key.py"""

import asyncio
import sys

from google import genai

from settings import get_settings


async def main() -> int:
    s = get_settings()
    if not s.api_key_configured:
        print("FAIL: GEMINI_API_KEY not set in backend/.env")
        return 1
    if not s.api_key_valid_format:
        print("FAIL: Key format invalid (need AIzaSy... or AQ....)")
        return 1

    client = genai.Client(api_key=s.gemini_api_key)
    try:
        r = await client.aio.models.generate_content(model=s.gemini_model, contents="Reply: OK")
        print(f"SUCCESS: { (r.text or '').strip()[:60] }")
        return 0
    except Exception as exc:
        msg = str(exc)
        if "API_KEY_INVALID" in msg or "api key not valid" in msg.lower():
            print("FAIL: Google rejected this key. Create a new one at aistudio.google.com/apikey")
        else:
            print(f"FAIL: {msg[:200]}")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
