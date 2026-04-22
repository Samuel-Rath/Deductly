# Deductly — Australian Tax Deduction Analyser

> ⚠️ **Not tax advice.** Deductly provides indicative analysis only. Always verify classifications with a registered tax agent or the ATO before lodging a claim.

Upload a CSV or PDF bank statement → get a line-by-line report of likely ATO-deductible transactions, with confidence scores, evidence checklists, and ATO citations.

No account. Nothing stored. Processing is entirely in-memory.

---

## Why

- **ATO-grounded, not AI-hallucinated.** Rule-based classification for deterministic categories (software, memberships, equipment, phone, travel, donations). A retrieval-augmented pipeline backed by 17 ATO guidance chunks handles the occupation-dependent edge cases (fitness).
- **Privacy by construction.** Raw statements never touch disk. BSB, account, and card numbers are redacted before any AI call and before any output file. Every report cleanup runs on every exit path — success or failure.
- **Explainable.** Every classification shows the matched keyword or rule, a confidence score, and an evidence checklist. Fitness transactions also surface the ATO ruling and a RAG score breakdown.

---

## Quick start

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # set SECRET_KEY at minimum
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local                          # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:3000`, drop a CSV or PDF on the upload page. Full env reference in the per-app READMEs below.

---

## Tests

```bash
# Backend (run from repo root — tests import as `backend.xxx`)
python -m pytest backend/tests/ --no-cov -q

# Frontend unit + integration
cd frontend && npm test

# Frontend end-to-end (Playwright)
cd frontend && npx playwright test --project=chromium
```

CI runs all three on every push/PR — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Documentation

| Doc | For |
|---|---|
| [`backend/README.md`](backend/README.md) | Running and testing the API server |
| [`frontend/README.md`](frontend/README.md) | Running and testing the SPA |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Pipeline walk-through, RAG internals, data flow, repo layout |
| [`docs/API.md`](docs/API.md) | REST endpoints, request/response schemas, error codes |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker, Render/Railway/Fly, CI/CD, production checklist |
| [`docs/BANK-EXPORTS.md`](docs/BANK-EXPORTS.md) | Step-by-step CSV export paths for 13 Australian banks |
| [`docs/CODE_DOCUMENTATION.md`](docs/CODE_DOCUMENTATION.md) | Module-level reference |

---

## Supported banks

CSV exports from **CommBank, NAB, Westpac, ANZ, ING, Bendigo, Macquarie, BOQ, Suncorp, St. George / Bank of Melbourne / BankSA, BankWest, Up, Ubank, 86 400** — any Australian bank CSV with recognisable column names (date, description, amount or debit/credit) parses automatically. Per-bank export steps: [`docs/BANK-EXPORTS.md`](docs/BANK-EXPORTS.md).

PDF parsing works on machine-generated statements (downloaded from internet banking). Scanned or print-to-PDF documents parse less reliably — if results look off, download the same period as CSV.

Preparation gotchas:

| Issue | What to do |
|---|---|
| Date range too short | Export 3+ months; 12 months ideal for a full income year |
| Multiple accounts | Upload each separately |
| Excel `.xlsx` | Save as CSV first |
| File won't upload | Must be ≤10 MB, `.csv` or `.pdf` |

---

## Privacy & security

- **Ephemeral mode always on.** No raw transaction data is written to disk. Generated reports are deleted on every request exit path, not just success.
- **Automatic redaction** before any AI call and before any output: BSB codes, bank account numbers, card numbers, transaction references.
- **No analytics, no cookies, no tracking.** The app doesn't even set session IDs — every request is independent.
- **Security controls.** Rate limiting, CORS allowlist, strict security headers (CSP, HSTS, X-Frame-Options), Pydantic input validation, constant-time API key comparison when enabled.

Full detail: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and the Privacy Policy page served at `/privacy`.

---

## Changelog

### v1.3.0
- Accessibility pass: skip-to-content, `<main>` landmark, `aria-live` error region, `focus-visible` rings
- `AnimatedSection` respects `prefers-reduced-motion`
- Ephemeral cleanup hardened to run on every exit path (SEC-1)
- Security: env-var whitespace stripping, stdlib-only Docker healthcheck, file-anchored paths

### v1.2.0
- UI: Playfair Display + Space Mono + DM Sans, warm gold/amber palette
- Frontend tests expanded

### v1.1.0
- Full RAG pipeline: TF-IDF retrieval + Claude Haiku reasoning for fitness transactions

### v1.0.0
- Initial release: CSV parsing, rule-based classification, PDF/CSV/JSON reports, ephemeral mode

---

**Author:** Samuel Rath · *Built with privacy and security as core principles. Not tax advice.*
