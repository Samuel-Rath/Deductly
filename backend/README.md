# Deductly — Backend

FastAPI service that parses Australian bank statements and returns ATO-grounded deduction candidates.

## Prerequisites

- Python 3.11+
- (Optional) `ANTHROPIC_API_KEY` — enables the RAG pipeline for fitness transactions. Without it the pipeline degrades gracefully to rule-based only.

## Quick start

```bash
cd backend

# 1. Virtualenv
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate

# 2. Dependencies
pip install -r requirements.txt

# 3. Environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY (≥32 chars)

# 4. Run
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is then on `http://localhost:8000`. Swagger UI is served at `/docs` when `ENABLE_SWAGGER_UI=true` (default off in production).

## Tests

```bash
# From the repo root (tests import as `backend.xxx`)
python -m pytest backend/tests/ --no-cov -q

# With coverage
python -m pytest backend/tests/ --cov=backend --cov-report=term-missing
```

~300 tests across unit, integration, and [Hypothesis](https://hypothesis.readthedocs.io/) property-based invariants. Key invariants:
- Confidence scores are always in `[0.0, 1.0]`
- Every input transaction has an audit-trail entry
- BSB codes and account numbers never appear in output
- Exclusion always runs before classification
- Audit trail is deterministic across runs

## Environment variables

See [`.env.example`](.env.example) for the full list. The ones that matter most:

| Variable | Default | Notes |
|---|---|---|
| `SECRET_KEY` | dev default | **Must** be ≥32 chars in production. Insecure default warns on startup. |
| `ENVIRONMENT` | `development` | `production` suppresses verbose error bodies |
| `ALLOWED_ORIGINS` | `localhost:5173,localhost:3000` | Comma-separated; whitespace stripped |
| `MAX_UPLOAD_SIZE_MB` | `10` | Enforced pre-parse |
| `EPHEMERAL_MODE` | `true` | Never disable — raw data is processed in-memory only |
| `ENABLE_REDACTION` | `true` | Strips BSB/account/card numbers before AI calls and output |
| `ANTHROPIC_API_KEY` | unset | Enables RAG for fitness transactions |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per IP |
| `RATE_LIMIT_PER_HOUR` | `500` | Per IP |
| `UPLOAD_RATE_LIMIT_MB_PER_HOUR` | `100` | Per IP, cumulative MB uploaded |
| `REQUIRE_API_KEY` | `false` | If `true`, all endpoints need `X-API-Key` header |
| `API_KEYS` | empty | Comma-separated; whitespace stripped |
| `ENABLE_METRICS` | `false` | Exposes `/metrics`; gate with API key or trusted-proxy IP |
| `ENABLE_SWAGGER_UI` | `false` | Exposes `/docs` and `/redoc` |

## Endpoints

Brief summary — full request/response shapes in [`docs/API.md`](../docs/API.md).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload` | Upload CSV/PDF → returns `report_data` inline in ephemeral mode |
| GET | `/api/jobs/{job_id}` | Status poll (non-ephemeral mode) |
| GET | `/api/jobs/{job_id}/download/{pdf\|csv\|json}` | Download report artefact |
| GET | `/health` | Liveness probe |
| GET | `/metrics` | Request counts + security-event counters (gated) |

## How requests are processed

High-level: **validate → parse → normalise → exclude → classify → (RAG for fitness) → report**.

Full walk-through with worked example: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Project layout

```
backend/
├── main.py                   # FastAPI app, CORS, middleware, lifespan
├── api/endpoints.py          # Upload, job status, report downloads
├── config/
│   ├── rules.json            # Classification rules
│   └── ato_fitness_knowledge.json
├── models/schemas.py         # Pydantic data contracts
├── processing/               # Parse, classify, report
├── rag/                      # TF-IDF retrieval + Claude reasoning
├── storage/                  # SQLite (ephemeral-mode: writes skipped)
├── middleware/security.py    # Rate limit, API key, security headers
└── tests/
```

## Deploy

Dockerfile + Render/Railway/Fly.io instructions in [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
