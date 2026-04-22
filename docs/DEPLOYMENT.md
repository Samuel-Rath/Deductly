# Deployment

Deductly ships as two artefacts: a Python/FastAPI backend and a static Vite-built frontend. They can be hosted anywhere that runs those stacks.

## Frontend — static hosting

Any static host works. Example with Netlify:

```bash
npm install -g netlify-cli
cd frontend
npm run build             # tsc + vite build → dist/
netlify deploy --prod --dir=dist
```

**Required env var** (set in the host's dashboard, not committed):
- `VITE_API_BASE_URL` — full URL of the backend (e.g. `https://api.yourdomain.com`)

Other supported hosts: Vercel, Cloudflare Pages, S3+CloudFront, GitHub Pages (with a custom domain).

## Backend — Docker (recommended)

The repo ships a multi-stage [Dockerfile](../backend/Dockerfile) that builds a non-root image with a stdlib-only healthcheck:

```bash
cd backend
docker build -t deductly-backend .
docker run -p 8000:8000 --env-file .env deductly-backend
```

The healthcheck hits `/health` every 30s via stdlib `urllib.request` (no extra deps).

## Backend — PaaS (Railway / Render / Fly.io)

All three run the Dockerfile directly or the Python app natively:

- Point the service at `backend/`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Set environment variables in the platform dashboard (see [Production checklist](#production-checklist))

Render's free tier spins containers down after ~15 min idle. The frontend Landing page pre-warms `/health` on load to mitigate cold-start wait on the subsequent upload.

## Backend — serverless (AWS Lambda)

Add [Mangum](https://mangum.io/) to `backend/requirements.txt`, then in `main.py`:

```python
from mangum import Mangum
handler = Mangum(app)
```

Deploy with SAM or Serverless Framework. Note: ephemeral-mode cleanup relies on filesystem writes to `/tmp` — fine on Lambda but size your function memory accordingly.

## CI/CD

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push/PR to `main` or `develop`:

| Job | What it runs |
|---|---|
| `backend` | `pip install -r backend/requirements.txt` + `pytest backend/tests/ --no-cov -q` (from workspace root) |
| `frontend` | `npm ci` + `tsc --noEmit` + `vitest --run` + `vite build` (uploads `dist/` artifact) |
| `e2e` | `playwright test --project=chromium` against the built frontend (uploads HTML report + failure traces) |

All jobs use concurrency-cancellation per branch.

[`.github/workflows/security.yml`](../.github/workflows/security.yml) runs weekly + on PR:
- `pip-audit` + `safety` for Python CVEs
- `npm audit` for JS CVEs
- TruffleHog secret scan
- CodeQL static analysis (Python + JS)

## Production checklist

Before flipping DNS:

- [ ] `SECRET_KEY` is ≥32 characters and randomly generated
- [ ] `ENVIRONMENT=production` — suppresses verbose error bodies
- [ ] `ALLOWED_ORIGINS` contains only your frontend domain
- [ ] `EPHEMERAL_MODE=true` (default — do not disable)
- [ ] `ENABLE_REDACTION=true`
- [ ] `ENABLE_SWAGGER_UI=false` (default) — don't expose `/docs` in prod
- [ ] `ENABLE_METRICS=false` unless you've gated it with `REQUIRE_API_KEY=true` or `TRUSTED_PROXIES=...`
- [ ] `RATE_LIMIT_ENABLED=true`
- [ ] `ANTHROPIC_API_KEY` set if you want RAG-powered fitness classification
- [ ] HTTPS enforced at the edge (HSTS header is already set in the app)
- [ ] `VITE_API_BASE_URL` on the frontend host points at the production backend
- [ ] Run `npm run build` locally to confirm the bundle builds without TS errors
- [ ] Run `pytest backend/tests/ --no-cov -q` from workspace root — should return 0 failures

## Environment variables

### Backend — minimum viable `.env`

```env
SECRET_KEY=<32+ char random string>
ENVIRONMENT=production
ALLOWED_ORIGINS=https://yourdomain.com
EPHEMERAL_MODE=true
ENABLE_REDACTION=true
RATE_LIMIT_ENABLED=true

# Optional: enables RAG-powered fitness classification
ANTHROPIC_API_KEY=sk-ant-...
```

See [`backend/.env.example`](../backend/.env.example) for the full list with every tunable and its default.

### Frontend `.env.local`

```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

## Monitoring

- `/health` returns 200 + `{status: "ok"}` — wire to uptime monitors (StatusCake, UptimeRobot)
- `/metrics` — gated behind `ENABLE_METRICS=true` + (API key or trusted-proxy IP). Emits request counts, per-endpoint timing, and security-event counters
- Application logs use structured JSON by default (`logging_config.py`) — scrape into Datadog / CloudWatch / Loki as needed
