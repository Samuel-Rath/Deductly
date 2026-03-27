# Deductly — Australian Tax Deduction Analyser

A privacy-first web application that parses Australian bank statements (CSV and PDF) and generates ATO-grounded deduction candidate reports. Upload your bank statement and receive an itemised analysis of potential work-related deductions across all major ATO categories — with composite confidence scores, evidence checklists, ATO citations, and a full audit trail.

> **Disclaimer:** Deductly provides indicative analysis only and does not constitute tax advice. Always verify classifications with a registered tax agent or the ATO before lodging a claim.

---

## Table of Contents

1. [How the System Works](#how-the-system-works)
2. [The RAG Pipeline](#the-rag-pipeline)
3. [Confidence Scoring](#confidence-scoring)
4. [Deduction Categories](#deduction-categories)
5. [Architecture](#architecture)
6. [Quick Start](#quick-start)
7. [API Reference](#api-reference)
8. [Configuration](#configuration)
9. [Testing](#testing)
10. [Privacy & Security](#privacy--security)
11. [Deployment](#deployment)

---

## How the System Works

### End-to-End Flow

```
Bank Statement (CSV or PDF)
        │
        ▼
┌───────────────────┐
│  File Validation  │  Type check (CSV/PDF), size limit, format sniff
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Parser           │  CSV: multi-bank format detection + column mapping
│  (CSV / PDF)      │  PDF: pdfplumber primary, PyPDF2 fallback
└─────────┬─────────┘
          │  List[NormalisedTransaction]
          ▼
┌───────────────────┐
│  Exclusion Engine │  Filters transfers, ATM withdrawals, mortgage
└─────────┬─────────┘  repayments, ATO payments, salary credits
          │  List[NormalisedTransaction] (candidates only)
          ▼
┌───────────────────┐
│  Rules Engine     │  10 priority-ordered rules × keyword + fuzzy
│  + Fuzzy Matcher  │  merchant matching → ClassifiedTransaction
└─────────┬─────────┘
          │  List[ClassifiedTransaction] (rule-based confidence)
          ▼
┌───────────────────────────────────┐
│  RAG + LLM Enhancement (optional) │  See "The RAG Pipeline" below
└─────────┬─────────────────────────┘
          │  List[ClassifiedTransaction] (RAG-enriched)
          ▼
┌───────────────────┐
│  Report Generator │  PDF (ReportLab) · CSV · JSON audit trail
└───────────────────┘
```

### Transaction Lifecycle

Every transaction passes through five states recorded in the audit trail:

| State | Description |
|---|---|
| **Normalised** | Date, merchant, amount, payment rail, recurring flag extracted |
| **Excluded** | Pattern matched an exclusion rule (transfer, ATM, loan, etc.) |
| **Classified** | Matched a deduction rule; assigned category + confidence |
| **RAG-enhanced** | Fitness-related transactions also processed through the RAG pipeline |
| **Finalised** | Placed in one of three report buckets: Deductible / Needs Review / Excluded |

### Report Buckets

| Bucket | Condition |
|---|---|
| **Likely Deductible** | Confidence ≥ threshold (default 0.60) and no `needs_review` flag |
| **Needs Review** | Confidence < threshold, or has `needs_review` / `method_required` / `percentage_required` flag |
| **Excluded** | Matched an exclusion rule before classification |

---

## The RAG Pipeline

Retrieval-Augmented Generation (RAG) is applied to transactions that the keyword heuristic identifies as potentially fitness-related. It augments the rule-based classification with ATO-grounded reasoning from Claude AI.

### Why RAG?

Fitness expense deductibility under Australian tax law is highly context-dependent — the same gym membership is deductible for a police officer required to maintain fitness standards but not for a software developer. A static rule cannot capture this nuance. RAG retrieves the relevant ATO guidance and passes it to Claude alongside the redacted transaction, enabling occupation-aware reasoning.

### Step-by-Step RAG Process

```
Transaction (description, merchant, amount)
        │
        ▼ Redact PII (BSB codes, account numbers, card numbers)
        │
        ▼ Step 1 — Keyword Score (0–30)
┌───────────────────────────────────────────────────────────────┐
│  ATOKnowledgeBase.keyword_confidence(description, merchant)   │
│                                                               │
│  Checks 11 fitness keyword groups:                            │
│    gym · personal_training · supplements · equipment          │
│    activewear · sports_stores · wearables · memberships       │
│    fitness_apps · medical_fitness · certifications            │
│                                                               │
│  Specificity-weighted: multi-word phrases (e.g. "personal     │
│  trainer") score higher than single words (e.g. "gym").       │
│  Capped at 0.30 → rescaled to integer 0–30.                   │
└───────────────────────────────────────────────────────────────┘
        │  keyword_score ∈ [0, 30]
        ▼
        ▼ Step 2 — Retrieve ATO Context (top-k chunks)
┌───────────────────────────────────────────────────────────────┐
│  ATOKnowledgeBase.retrieve(query, k=5)                        │
│                                                               │
│  Uses TF-IDF-style scoring — no ML, no embeddings:           │
│    • Tokenise query and each chunk (title + content + tags)   │
│    • Score = Σ IDF(term) for matching terms                   │
│    • +2.0 bonus per exact keyword-list match                  │
│    • Return top-k chunks sorted descending by score           │
│                                                               │
│  Knowledge base: 17 ATO chunks covering gym memberships,      │
│  personal training, supplements, equipment, activewear,       │
│  fitness professionals, athletes, police/military, certif-    │
│  ications, and sports medicine.  Each chunk includes:         │
│    id · title · ato_reference · deductible (bool)             │
│    occupation_dependent (bool) · keywords · content           │
│    who_can_claim · who_cannot_claim · evidence_required       │
└───────────────────────────────────────────────────────────────┘
        │  chunks: List[Dict] (top-5 most relevant)
        ▼
        ▼ Step 3 — RAG Grounding Score (0–40)
┌───────────────────────────────────────────────────────────────┐
│  Evaluates whether the retrieved chunks support a claim:      │
│                                                               │
│  support = count(chunks where deductible == True)             │
│  against = count(chunks where deductible == False)            │
│                                                               │
│  score = (support/total × 40) − (against/total × 10)         │
│  Bounded to [0, 40]                                           │
│                                                               │
│  Interpretation: If the most relevant ATO guidance says "this │
│  is not deductible", the grounding score is suppressed even   │
│  if a keyword matched.                                        │
└───────────────────────────────────────────────────────────────┘
        │  rag_grounding ∈ [0, 40]
        ▼
        ▼ Step 4 — Call Claude (model: claude-haiku-4-5-20251001)
┌───────────────────────────────────────────────────────────────┐
│  System prompt: Expert Australian tax accountant persona.     │
│  Conservative stance — most fitness expenses are private.     │
│                                                               │
│  User message contains:                                       │
│    • Redacted transaction (description, merchant, amount)     │
│    • Top-5 retrieved ATO knowledge chunks (truncated at 600   │
│      characters each)                                         │
│                                                               │
│  Claude returns strict JSON:                                  │
│    is_fitness_related · is_potentially_deductible             │
│    occupation_dependent · category · confidence (0–100)       │
│    reason · ato_citation · conditions · evidence_required     │
│                                                               │
│  claude_score = int((claude_confidence / 100) × 30)  → 0–30  │
└───────────────────────────────────────────────────────────────┘
        │  claude_score ∈ [0, 30]
        ▼
        ▼ Step 5 — Composite Score
┌───────────────────────────────────────────────────────────────┐
│  composite = min(keyword_score + rag_grounding + claude_score, 100)
│  confidence_float = composite / 100   →  0.0 – 1.0           │
│                                                               │
│  Component breakdown is preserved and surfaced in the report: │
│    [RAG] reason | ATO: citation                               │
│    | Score: keyword=X/30 grounding=Y/40 claude=Z/30          │
└───────────────────────────────────────────────────────────────┘
```

### Graceful Degradation

If `ANTHROPIC_API_KEY` is not set or the `anthropic` package is unavailable, `RAGEngine.available` is `False`. In this mode:
- Steps 2–4 are skipped.
- The fallback result uses `confidence = keyword_score` only.
- `is_potentially_deductible` defaults to `False` (conservative).
- The reason field explicitly notes that RAG is unavailable.

The rule-based classification still runs for all transactions regardless of RAG availability.

### LLM Classifier Merge Strategy

After RAG analysis, `LLMClassifier.enhance()` merges the RAG result back into the `ClassifiedTransaction`:

| Condition | Behaviour |
|---|---|
| Transaction is not fitness-related | Pass through unchanged |
| Existing confidence ≥ override threshold (0.60) AND not fitness-related | Pass through unchanged (rule did well) |
| RAG confidence > existing confidence | Use RAG category + confidence |
| RAG confidence ≤ existing confidence | Keep original category + confidence |
| Always | Append RAG reason, ATO citation, score breakdown, and disclaimer |
| Always | Merge RAG evidence requirements into checklist (no duplicates) |
| Always | Add `rag_analysed` flag |
| `occupation_dependent = True` | Add `occupation_dependent` flag |
| `is_potentially_deductible = False` | Add `needs_review` flag |

---

## Confidence Scoring

### Rule-Based (All Transactions)

Each classification rule in `rules.json` carries a base confidence (0.60–0.95). The final confidence from rule matching is:
- The rule's base confidence, weighted by the fuzzy merchant match score.
- Transactions below the threshold (default 0.60) are flagged `needs_review`.

### RAG-Composite (Fitness Transactions Only)

```
Final = keyword(0–30) + grounding(0–40) + claude(0–30)  ≤ 100
        ───────────────────────────────────────────────
        Divided by 100 → 0.0 – 1.0 ClassifiedTransaction.confidence
```

| Range | Label | Interpretation |
|---|---|---|
| 0.80 – 1.00 | High | Clear nexus, low ambiguity |
| 0.60 – 0.79 | Medium | Likely but verify occupation/usage |
| < 0.60 | Low | Needs professional review |

---

## Deduction Categories

The rule engine covers six primary ATO work-related deduction categories plus four supporting categories:

| Category | Rule ID | Base Confidence | Examples |
|---|---|---|---|
| Work Software & Subscriptions | R001 | 0.95 | Adobe, Microsoft 365, GitHub, JetBrains |
| Professional Memberships | R002 | 0.90 | CPA Australia, Law Society, AMA |
| Self-Education & Training | R003 | 0.85 | Udemy, TAFE, conference registrations |
| Work Equipment & Technology | R004 | 0.80 | JB Hi-Fi, Apple, Officeworks tools |
| Phone & Internet | R005 | 0.70 | Telstra, Optus, TPG (work-use %) |
| Working From Home | R006 | 0.65 | Internet, electricity (requires WFH method) |
| Work-Related Travel | R007 | 0.75 | Uber, Qantas, Transurban (logbook required) |
| Donations to DGR | R008 | 0.85 | Registered charities (DGR status check) |
| Bank Fees | R009 | high | Account keeping fees on income accounts |
| Fitness-Related | RAG | composite | Processed through RAG pipeline |

### Exclusion Rules

Applied before classification; excluded transactions do not appear in deduction candidates:

| Rule | Patterns |
|---|---|
| Transfers | OSKO, PAYID, BPAY, TRANSFER TO/FROM |
| Cash Withdrawals | ATM WITHDRAWAL, CASH OUT |
| Loan Repayments | MORTGAGE, HOME LOAN, CAR LOAN |
| Tax Payments | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE |
| Superannuation | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER |
| Salary / Income Credits | SALARY, WAGES, PAYROLL (credit direction only) |

---

## Architecture

### Backend (`/backend`) — Python 3.11 + FastAPI

```
backend/
├── api/
│   └── endpoints.py          # POST /api/upload, GET /api/jobs/{id}, downloads
├── config/
│   ├── rules.json             # 10+ classification rules
│   └── ato_fitness_knowledge.json  # 17 ATO knowledge chunks
├── models/
│   └── schemas.py             # Pydantic models: NormalisedTransaction,
│                              #   ClassifiedTransaction, ReportData, etc.
├── processing/
│   ├── pipeline.py            # Main orchestration: parse → exclude → classify → RAG → report
│   ├── csv_parser.py          # Multi-bank CSV format detection and parsing
│   ├── pdf_parser.py          # pdfplumber + PyPDF2 dual-engine PDF extraction
│   ├── classification_engine.py  # Rule-based classification
│   ├── exclusion_engine.py    # Pre-classification exclusion filter
│   ├── rules_engine.py        # Rule matching and priority evaluation
│   ├── fuzzy_matcher.py       # Merchant name canonicalisation (rapidfuzz)
│   ├── report_generator.py    # PDF (ReportLab), CSV, JSON report generation
│   ├── audit_trail.py         # Per-transaction audit event recording
│   └── redaction_service.py   # BSB codes, account numbers, card numbers
├── rag/
│   ├── knowledge_base.py      # ATOKnowledgeBase: TF-IDF retrieval, keyword scoring
│   ├── rag_engine.py          # RAGEngine: retrieve → score → Claude → composite
│   └── llm_classifier.py      # LLMClassifier: enhance ClassifiedTransactions with RAG
├── storage/
│   ├── database.py            # SQLite schema and migrations
│   └── storage_service.py     # Ephemeral vs. persistent storage abstraction
├── middleware/
│   └── security.py            # Rate limiting, API key, security headers
├── main.py                    # FastAPI app, CORS, middleware, lifespan
└── tests/                     # 35 test files, 338 tests
```

### Frontend (`/frontend`) — React 18 + TypeScript + Vite

```
frontend/src/
├── pages/
│   ├── Landing.tsx            # Hero, features, how-it-works, stats
│   ├── Upload.tsx             # File upload, income year, analysis trigger
│   ├── Report.tsx             # Deduction report display + downloads
│   ├── Rules.tsx              # Deduction rules reference
│   └── Privacy.tsx            # Privacy policy and data handling
├── components/
│   ├── Navigation.tsx         # Top navigation bar
│   ├── Button.tsx             # Primary / secondary / tertiary variants
│   ├── Card.tsx               # Glass-morphism card container
│   ├── Chip.tsx               # Category badge / confidence chip
│   ├── Drawer.tsx             # Transaction detail side panel
│   ├── AnimatedSection.tsx    # Scroll-triggered reveal animations
│   └── ...
├── api/
│   ├── client.ts              # Axios HTTP client
│   └── hooks.ts               # React Query hooks (useUpload, useJobStatus)
└── hooks/
    └── useParallax.ts         # Framer Motion parallax scroll hook
```

### Data Flow Diagram

```
Browser                    FastAPI                    Anthropic API
  │                           │                            │
  │  POST /api/upload          │                            │
  │  (multipart/form-data)     │                            │
  ├──────────────────────────>│                            │
  │                           │                            │
  │                    ┌──────┴──────────────────────┐     │
  │                    │  1. Validate file            │     │
  │                    │  2. Parse CSV/PDF            │     │
  │                    │  3. Exclude non-candidates   │     │
  │                    │  4. Classify (rules)         │     │
  │                    │  5. [if use_rag=true]        │     │
  │                    │     Redact PII               │     │
  │                    │     Retrieve ATO chunks      │     │
  │                    │     ────────────────────────>│     │
  │                    │     Claude response          │     │
  │                    │     <────────────────────────│     │
  │                    │     Merge into classification│     │
  │                    │  6. Generate reports         │     │
  │                    └──────┬──────────────────────-┘     │
  │                           │                            │
  │  UploadResponse (inline)   │                            │
  │<──────────────────────────│                            │
  │                           │                            │
  │  GET /api/jobs/{id}/       │                            │
  │  download/pdf              │                            │
  ├──────────────────────────>│                            │
  │  PDF report                │                            │
  │<──────────────────────────│                            │
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Anthropic API key for RAG-enhanced fitness classification

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment (copy and edit)
cp .env.example .env
# Set ANTHROPIC_API_KEY to enable RAG (optional — degrades gracefully without it)

# Run all tests
pytest -v

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:8000

# Run all tests
npm test -- --run

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables

**Backend `.env`:**
```env
# Required for AI-powered RAG analysis
ANTHROPIC_API_KEY=sk-ant-...

# Security
SECRET_KEY=your-secret-key-here-minimum-32-characters
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Upload limits
MAX_UPLOAD_SIZE_MB=10
RATE_LIMIT_PER_MINUTE=10

# Privacy
EPHEMERAL_MODE=true
ENABLE_REDACTION=true

# Optional: custom redaction patterns (comma-separated regex)
REDACTION_PATTERNS=\d{6}-\d{6,10},\d{3}-\d{3}
```

**Frontend `.env.local`:**
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_MAX_FILE_SIZE_MB=10
```

---

## API Reference

### `POST /api/upload`

Upload a bank statement (CSV or PDF) for analysis.

**Request:** `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | CSV or PDF bank statement |
| `income_year` | string | auto-detected | e.g. `"2025-2026"` |
| `ephemeral_mode` | bool | `true` | Delete data after response |
| `confidence_threshold` | float | `0.60` | Minimum confidence for "Likely Deductible" bucket |
| `use_rag` | bool | `true` | Enable RAG pipeline for fitness transactions |

**Response `200`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Processing complete",
  "report": {
    "summary": {
      "total_deductible": "1249.85",
      "total_needs_review": "312.40",
      "total_excluded": "6850.00",
      "category_totals": {
        "work_software": "549.00",
        "professional_memberships": "549.00",
        "training_education": "151.85"
      },
      "confidence_distribution": {
        "high": 8,
        "medium": 3,
        "low": 1
      }
    },
    "candidates": [ /* ClassifiedTransaction[] */ ],
    "excluded": [ /* ExcludedTransaction[] */ ],
    "audit_trail": [ /* AuditEntry[] */ ],
    "income_year": "2025-2026",
    "generated_at": "2026-03-26T14:23:01Z"
  },
  "report_urls": {
    "pdf":  "/api/jobs/{job_id}/download/pdf",
    "csv":  "/api/jobs/{job_id}/download/csv",
    "json": "/api/jobs/{job_id}/download/json"
  }
}
```

### `GET /api/jobs/{job_id}`

Poll job status (for async processing of large files).

**Response `200`:**
```json
{
  "job_id": "550e8400-...",
  "status": "completed",
  "progress": 100,
  "report_urls": { "pdf": "...", "csv": "...", "json": "..." }
}
```

`status` values: `queued` · `processing` · `completed` · `failed`

### `GET /api/jobs/{job_id}/download/{format}`

Download generated report. `format` is one of `pdf`, `csv`, `json`.

### `GET /health`

Health check — returns `{"status": "ok"}`.

### Error Format

All errors use a consistent structure:
```json
{
  "error": "file_too_large",
  "message": "File exceeds 10 MB limit",
  "details": {}
}
```

| HTTP Status | Error Code | When |
|---|---|---|
| 400 | `invalid_file_type` | Not CSV or PDF |
| 400 | `file_too_large` | Exceeds `MAX_UPLOAD_SIZE_MB` |
| 400 | `parse_error` | Could not parse the file |
| 404 | `job_not_found` | Unknown `job_id` |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `processing_error` | Internal pipeline error |

---

## Configuration

### Classification Rules (`backend/config/rules.json`)

Each rule defines a deduction category:

```json
{
  "rule_id": "R001",
  "version": "1.0",
  "category": "work_software",
  "priority": 100,
  "confidence": 0.95,
  "keywords": ["adobe", "microsoft 365", "github", "jetbrains", "atlassian"],
  "merchants": ["Adobe", "Microsoft", "GitHub", "JetBrains"],
  "evidence_checklist": ["receipt"],
  "flags": [],
  "enabled": true
}
```

Rules are evaluated in descending priority order. The first matching rule wins.

### ATO Knowledge Base (`backend/config/ato_fitness_knowledge.json`)

17 chunks covering fitness deduction nuances. Each chunk:

```json
{
  "id": "gym_general",
  "title": "Gym Memberships — General Employee Rule",
  "ato_reference": "ATO ID 2007/182; Section 8-1 ITAA 1997",
  "category": "fitness_gym",
  "deductible": false,
  "occupation_dependent": true,
  "keywords": ["gym", "fitness centre", "anytime fitness"],
  "content": "Gym memberships for general employees are private expenses...",
  "who_can_claim": ["police officers", "firefighters", "fitness instructors"],
  "who_cannot_claim": ["general employees", "office workers"],
  "evidence_required": ["receipt", "employer letter", "diary"]
}
```

The `deductible` boolean drives the RAG grounding score (Step 3 above).

### CSV Format Support

Deductly auto-detects the column layout of major Australian banks:

| Bank | Format | Date Style |
|---|---|---|
| Commonwealth Bank | `Date, Description, Amount` | `DD/MM/YYYY` |
| NAB | `Transaction Date, Details, Debit, Credit` | `DD/MM/YYYY` |
| Westpac | `Date, Narrative, Debit Amount, Credit Amount` | `DD/MM/YYYY` |
| ANZ | `Date, Description, Amount` | `DD/MM/YYYY` |
| ING | `Date, Description, Credit, Debit` | `DD/MM/YYYY` |

Any CSV with recognisable date, description, and amount columns will be accepted.

---

## Testing

### Backend — 338 Tests

```bash
cd backend
pytest -v                          # all tests
pytest -v --cov=. --cov-report=html  # with coverage report
pytest tests/test_rag_engine.py -v   # RAG tests only
```

**Test coverage by module:**

| Module | Tests | Type |
|---|---|---|
| `rag/knowledge_base.py` | 52 | Unit |
| `rag/rag_engine.py` | 37 | Unit (Anthropic client mocked) |
| `rag/llm_classifier.py` | 33 | Unit (RAGEngine mocked) |
| `processing/csv_parser.py` | ~30 | Unit + property-based |
| `processing/pdf_parser.py` | ~20 | Unit |
| `processing/classification_engine.py` | ~25 | Unit |
| `processing/exclusion_engine.py` | ~15 | Unit |
| `processing/pipeline.py` | ~20 | Integration |
| `api/endpoints.py` | ~20 | Integration (TestClient) |
| Property-based (Hypothesis) | 23 | Property |

**Key property invariants tested:**
- Confidence scores always in `[0.0, 1.0]`
- Audit trail entry exists for every input transaction
- Audit trail is deterministic across runs
- Derived fields only ever written to storage (never raw CSV)
- Sensitive data (BSB, account numbers) never appears in output
- Exclusion rules applied before classification
- Every candidate has a non-empty evidence checklist

### Frontend — 118 Tests

```bash
cd frontend
npm test -- --run               # all tests
npm test -- --run --coverage    # with coverage
```

Tests cover all pages (`Landing`, `Upload`, `Report`, `Rules`, `Privacy`) and all components (`Button`, `Card`, `Chip`, `Drawer`, `Table`, `Input`, `Modal`), plus end-to-end user journeys via `e2e.test.tsx`.

### Running Both Suites

```bash
# From project root
cd backend && pytest -q && cd ../frontend && npm test -- --run
```

---

## Privacy & Security

### Ephemeral Mode (Always On)

Raw bank statement data is **never stored to disk**. All processing happens in memory. When the API response is sent, the in-memory data is discarded. The only persistent artefact is a minimal job record (job ID, status, timestamps) — no transaction data.

### What Is Never Stored

- Account numbers or BSB codes
- Full transaction descriptions
- Raw CSV or PDF file contents
- Any personal identifying information

### Redaction Before AI Calls

Before any transaction data is sent to the Anthropic API, the `RedactionService` strips:
- BSB codes (pattern `\d{3}-\d{3}`)
- Account numbers (pattern `\d{6}-\d{6,10}`)
- Card numbers (custom patterns, configurable)

Merchant names and keyword signals are preserved so the RAG analysis remains useful.

### Security Controls

| Control | Detail |
|---|---|
| Rate limiting | 10 requests/minute per IP (configurable) |
| File validation | Type + size check before any processing |
| CORS | Strict origin allowlist |
| Security headers | CSP, HSTS, X-Frame-Options, X-XSS-Protection, Referrer-Policy |
| Input validation | Pydantic models on all API inputs |
| No analytics | Zero third-party tracking or telemetry |

---

## Deployment

### Frontend — Netlify

```bash
# Install CLI
npm install -g netlify-cli

# Build and deploy
cd frontend && npm run build
netlify deploy --prod --dir=dist
```

Set `VITE_API_BASE_URL` in Netlify environment variables.

### Backend Options

**Railway / Render / Fly.io** (recommended for simplicity):
- Python/FastAPI supported natively
- Set all environment variables in the platform dashboard
- Enable HTTPS (automatic on all three platforms)

**Docker:**
```bash
docker build -t deductly-backend .
docker run -p 8000:8000 --env-file .env deductly-backend
```

**AWS Lambda** (serverless):
- Requires the `mangum` adapter
- Add `handler = Mangum(app)` to `main.py`
- Deploy via SAM or Serverless Framework

### Production Checklist

- [ ] `ANTHROPIC_API_KEY` set for RAG analysis
- [ ] `SECRET_KEY` is at least 32 characters and random
- [ ] `ALLOWED_ORIGINS` contains only your frontend domain
- [ ] `EPHEMERAL_MODE=true` (default — do not disable unless needed)
- [ ] HTTPS enforced (HSTS header configured)
- [ ] Rate limiting enabled
- [ ] `DEBUG=false` / Swagger UI disabled
- [ ] File size limit appropriate (`MAX_UPLOAD_SIZE_MB`)

---

## Changelog

### v1.1.0
- Expanded from fitness-only to all ATO work-related deduction categories
- Added RAG pipeline documentation
- Added comprehensive RAG unit tests (122 new tests)
- Redesigned UI: banking-appropriate colour scheme (Deep Trust Blue + Growth Green)
- Removed ephemeral mode toggle — always on by default
- Fixed React Rules of Hooks violation in transaction drawer

### v1.0.0
- Initial release: CSV parsing, rule-based classification, PDF/CSV/JSON reports, ephemeral mode

---

## Author

**Samuel Rath**

---

*Built with privacy and security as core principles. Not tax advice.*
