# CIS Controls RAG UI

React + Tailwind CSS chat interface for the local FastAPI RAG backend.

## Run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The backend must be running at `http://127.0.0.1:8000`.

```powershell
uv run uvicorn main:app --host 127.0.0.1 --port 8000
```

## API contract

Request:

```json
{ "message": "How often should DHCP logs be reviewed?" }
```

Response fields used by the UI:

- `answer`
- `page`
- `cache_hit`
- `timings.total`
