# Askio Backend

5 files. See [flows.md](../flows.md) for how everything connects.

```
backend/
  main.py       # FastAPI app + CORS
  routes.py     # GET /health, POST /chat
  core.py       # validate → safety → session → Gemini → SSE
  schemas.py    # request models
  prompts.py    # AI system prompt
  settings.py   # reads .env
```

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set GEMINI_API_KEY
./venv/bin/uvicorn main:app --reload
```
