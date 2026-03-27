# Deductly — Australian Tax Deduction Analyser

A privacy-first web application that parses Australian bank statements (CSV and PDF) and produces ATO-grounded deduction candidate reports. Upload your bank statement and receive an itemised analysis of potential work-related deductions — with composite confidence scores, evidence checklists, ATO citations, and a full audit trail.

> **Disclaimer:** Deductly provides indicative analysis only and does not constitute tax advice. Always verify all classifications with a registered tax agent or the ATO before lodging any claim.

---

## Table of Contents

1. [How the System Works](#how-the-system-works)
2. [The RAG Pipeline (Fitness Transactions)](#the-rag-pipeline-fitness-transactions-only)
3. [Confidence Scoring](#confidence-scoring)
4. [Deduction Categories](#deduction-categories)
5. [Supported Bank Statement Formats](#supported-bank-statement-formats)
6. [Architecture](#architecture)
7. [Quick Start](#quick-start)
8. [API Reference](#api-reference)
9. [Configuration](#configuration)
10. [Testing](#testing)
11. [Privacy & Security](#privacy--security)
12. [Deployment](#deployment)

---

## How the System Works

### End-to-End Flow

```
Bank Statement (CSV or PDF)
        │
        ▼
┌───────────────────┐
│  File Validation  │  Type check (CSV/PDF), size limit (10 MB), format sniff
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Parser           │  CSV: auto-detects column layout for any Australian bank
│  (CSV / PDF)      │  PDF: pdfplumber primary engine, PyPDF2 fallback
└─────────┬─────────┘
          │  List[NormalisedTransaction]
          ▼
┌───────────────────┐
│  Exclusion Engine │  Filters transfers, ATM withdrawals, loan repayments,
└─────────┬─────────┘  ATO payments, superannuation, and salary credits
          │  List[NormalisedTransaction] (deduction candidates only)
          ▼
┌───────────────────────┐
│  Rule-Based Engine    │  10+ priority-ordered rules × keyword + fuzzy
│  (ALL transactions)   │  merchant matching → ClassifiedTransaction
└─────────┬─────────────┘
          │  List[ClassifiedTransaction] (rule-based confidence)
          ▼
┌─────────────────────────────────────────────┐
│  RAG + LLM Enhancement                      │  ← FITNESS TRANSACTIONS ONLY
│  (conditional — fitness keyword detected)   │
│                                             │
│  1. Keyword Score    (0–30)                 │
│  2. TF-IDF Retrieval → top-5 ATO chunks     │
│  3. RAG Grounding    (0–40)                 │
│  4. Claude Haiku reasoning (0–30)           │
│  5. Composite score  (0–100)                │
└─────────┬───────────────────────────────────┘
          │  List[ClassifiedTransaction] (rule-based + RAG-enriched where applicable)
          ▼
┌───────────────────┐
│  Report Generator │  PDF (ReportLab) · CSV · JSON audit trail
└───────────────────┘
```

> **Key distinction:** The rule-based engine runs on **every** transaction. The RAG pipeline only runs on transactions the system identifies as potentially fitness-related. All other deduction categories (software, travel, equipment, memberships, etc.) are handled entirely by the rule-based engine.

### Transaction Lifecycle

Every transaction passes through five states, all recorded in the audit trail:

| State | Description |
|---|---|
| **Normalised** | Date, merchant, amount, payment rail, recurring flag extracted |
| **Excluded** | Matched an exclusion rule (transfer, ATM, loan, salary, etc.) |
| **Classified** | Matched a deduction rule; assigned category + confidence |
| **RAG-enhanced** | Fitness transactions additionally processed through the RAG pipeline |
| **Finalised** | Placed in one of three report buckets: Deductible / Needs Review / Excluded |

### Report Buckets

| Bucket | Condition |
|---|---|
| **Likely Deductible** | Confidence ≥ 0.60 (default threshold) and no `needs_review` flag |
| **Needs Review** | Confidence < 0.60, or flagged `needs_review` / `occupation_dependent` |
| **Excluded** | Matched an exclusion rule before classification ever ran |

### Worked Example

Here is a real transaction travelling through the full pipeline:

```
Input:  Description = "ANYTIME FITNESS MEMBERSHIP  REF:TXN-84732"
        Amount      = AUD $79.95 (debit)
        Date        = 15/01/2025
```

**Step 1 — Normalise**
- Date parsed as `2025-01-15`
- Description cleaned; REF:TXN-84732 redacted before any external call
- Merchant extracted: `"Anytime Fitness"`
- Direction: `debit`

**Step 2 — Exclusion check**
- No match against exclusion patterns (not ATM, not BPAY, not salary)
- Transaction enters classification

**Step 3 — Rule-based classification**
- Rule R011 (`fitness_related`, priority 50) matches keyword `"anytime fitness"`
- Rule assigns `confidence = 0.20` and flags: `["needs_review", "occupation_dependent", "rag_required"]`

**Step 4 — RAG pipeline triggered** (because `rag_required` flag is set)
- Keyword score: `"anytime fitness"` is a 2-word phrase → score ~12/30
- TF-IDF retrieves top-5 ATO chunks including `gym_general` (`deductible: false`) and `police_military_fitness` (`deductible: true`)
- Grounding score: 1 deductible / 5 total → (1/5 × 40) − (4/5 × 10) = **0**
- Claude Haiku receives redacted transaction + 5 ATO chunks; returns confidence 30/100 → claude_score = 9/30
- Composite: 12 + 0 + 9 = **21** → confidence_float = **0.21**

**Step 5 — Finalised**
- Confidence 0.21 < 0.60 → placed in **Needs Review** bucket
- Evidence checklist: `["receipt", "employer fitness requirement letter", "diary"]`
- ATO citation: `"ATO ID 2007/182; Section 8-1 ITAA 1997"`

---

## The RAG Pipeline (Fitness Transactions Only)

Retrieval-Augmented Generation (RAG) is applied exclusively to transactions that the system identifies as potentially fitness-related. It augments rule-based classification with ATO-grounded, occupation-aware reasoning powered by Claude AI.

### Why RAG for Fitness Specifically?

Most ATO deduction categories are deterministic: if you paid for Microsoft 365 as a software developer, it is almost certainly deductible. But fitness expenses are context-dependent at a level that static rules cannot capture. The same gym membership is:
- **Deductible** for a police officer required by their employer to maintain fitness standards (ATO ID 2007/182)
- **Deductible** for a fitness instructor whose work requires demonstrating exercises
- **Not deductible** for a software developer who goes to the gym to stay healthy

RAG retrieves the relevant ATO guidance chunks and passes them to Claude alongside the transaction, enabling occupation-aware nuanced reasoning that a keyword rule simply cannot provide.

### How Fitness Transactions Are Detected

Before RAG runs, `ATOKnowledgeBase.is_fitness_related()` checks the transaction against **11 keyword groups**:

| Group | Example keywords |
|---|---|
| `gym` | gym, fitness centre, anytime fitness, crossfit, f45 |
| `personal_training` | personal trainer, pt session, pt fee, training session |
| `supplements` | supplement, protein powder, creatine, pre-workout |
| `equipment` | weights, dumbbells, treadmill, resistance band |
| `activewear` | lululemon, nike activewear, under armour, 2xu |
| `sports_stores` | rebel sport, decathlon, athlete's foot, running shoes |
| `wearables` | garmin, fitbit, apple watch activity, whoop, polar |
| `memberships` | yoga studio, pilates, crossfit membership, swim club |
| `fitness_apps` | myfitnesspal, strava, zwift, garmin connect |
| `medical_fitness` | physiotherapy, physio, sports massage, chiropractic |
| `certifications` | cert iii fitness, cert iv, cpr, first aid, hltaid |

A transaction matches if **any** keyword in any group appears in the description or merchant name.

### Step-by-Step RAG Process

```
Transaction (description, merchant, amount)
        │
        ▼  PII redacted before any external call
        │  (BSB codes, account numbers, card numbers stripped)
        │
        ▼  STEP 1 — Keyword Score (0–30)
┌───────────────────────────────────────────────────────────────┐
│  ATOKnowledgeBase.keyword_confidence(description, merchant)   │
│                                                               │
│  For each of 11 keyword groups:                               │
│    • Find the best-matching keyword phrase                     │
│    • Score by specificity: multi-word phrases score higher    │
│      "personal trainer" (2 words) > "gym" (1 word)           │
│    • Cap per group at 2.0                                     │
│                                                               │
│  Aggregate across all groups, normalise to [0.0, 0.30],      │
│  hard-capped at 0.30. Rescale → integer 0–30.                 │
└───────────────────────────────────────────────────────────────┘
        │  keyword_score ∈ [0, 30]
        ▼
        ▼  STEP 2 — Retrieve ATO Context (top-5 chunks)
┌───────────────────────────────────────────────────────────────┐
│  ATOKnowledgeBase.retrieve(query, k=5)                        │
│                                                               │
│  Pure TF-IDF — NO machine learning, NO embeddings:           │
│    • Tokenise query: lowercase, remove punctuation            │
│    • Score each chunk: Σ IDF(term) for terms in common        │
│    • +2.0 bonus per term that appears in chunk's keyword list │
│    • Return top-5 chunks sorted by score (descending)         │
│                                                               │
│  Knowledge base: 17 ATO chunks (v2025-2026) covering:        │
│    gym memberships · personal training · supplements          │
│    equipment · activewear · fitness professionals             │
│    professional athletes · police/military fitness            │
│    sports associations · fitness apps · sports medicine       │
│    first aid & CPR · fitness certifications                   │
│                                                               │
│  Each chunk contains:                                         │
│    ato_reference · deductible (bool) · occupation_dependent   │
│    who_can_claim · who_cannot_claim · evidence_required       │
└───────────────────────────────────────────────────────────────┘
        │  chunks: List[Dict] (top-5 most relevant)
        ▼
        ▼  STEP 3 — RAG Grounding Score (0–40)
┌───────────────────────────────────────────────────────────────┐
│  Measures how strongly the ATO guidance supports a claim:     │
│                                                               │
│  support = number of retrieved chunks where deductible=True   │
│  against = number of retrieved chunks where deductible=False  │
│                                                               │
│  score = (support / total × 40) − (against / total × 10)     │
│  Bounded to [0, 40]                                           │
│                                                               │
│  Examples:                                                    │
│    All 5 chunks say deductible:     (5/5×40) − (0/5×10) = 40 │
│    2 deductible, 3 not:             (2/5×40) − (3/5×10) = 10 │
│    All 5 say NOT deductible:        (0/5×40) − (5/5×10) = 0  │
│                                                               │
│  If the most relevant ATO guidance says "not deductible",    │
│  the grounding score is suppressed even if keywords matched. │
└───────────────────────────────────────────────────────────────┘
        │  rag_grounding ∈ [0, 40]
        ▼
        ▼  STEP 4 — Claude Haiku Reasoning (0–30)
┌───────────────────────────────────────────────────────────────┐
│  Model: claude-haiku-4-5-20251001  (fast, cost-efficient)     │
│  Max tokens: 512                                              │
│                                                               │
│  System prompt: Expert Australian tax accountant persona      │
│    "Be conservative. Most fitness expenses for general        │
│     employees are private expenses."                          │
│                                                               │
│  User message contains:                                       │
│    • Redacted transaction (description, merchant, amount)     │
│    • Top-5 retrieved ATO chunks (each truncated at 600 chars) │
│                                                               │
│  Claude returns strict JSON:                                  │
│    is_fitness_related · is_potentially_deductible             │
│    occupation_dependent · category · confidence (0–100)       │
│    reason · ato_citation · conditions · evidence_required     │
│                                                               │
│  claude_score = int((claude_confidence / 100) × 30) → 0–30  │
└───────────────────────────────────────────────────────────────┘
        │  claude_score ∈ [0, 30]
        ▼
        ▼  STEP 5 — Composite Score
┌───────────────────────────────────────────────────────────────┐
│  composite = min(keyword_score + rag_grounding + claude_score, 100)
│  confidence_float = composite / 100   →   0.0 – 1.0          │
│                                                               │
│  Score breakdown is surfaced in the report reason field:      │
│    "[RAG] reason | ATO: citation                              │
│     | Score: keyword=X/30 grounding=Y/40 claude=Z/30"        │
│                                                               │
│  Example:                                                     │
│    keyword=20 + grounding=30 + claude=25 = 75 → 0.75         │
│    keyword=10 + grounding=40 + claude=30 = 80 → 0.80         │
│    keyword=30 + grounding=40 + claude=30 = 100 → 1.00        │
└───────────────────────────────────────────────────────────────┘
```

### Graceful Degradation

If `ANTHROPIC_API_KEY` is not set or the `anthropic` package is unavailable:

- `RAGEngine.available` is `False`
- Steps 2–4 (retrieval, grounding, Claude) are skipped entirely
- The fallback result uses `confidence = keyword_score` only (max 0.30)
- `is_potentially_deductible` defaults to `False` (conservative)
- The reason field explicitly notes that RAG is unavailable

Rule-based classification still runs on all transactions regardless of RAG availability. The only difference is that fitness transactions lose the Claude reasoning component.

### LLM Classifier Merge Strategy

After RAG analysis, `LLMClassifier.enhance()` merges the RAG result back into the `ClassifiedTransaction`:

| Condition | Behaviour |
|---|---|
| Transaction is not fitness-related | Pass through unchanged |
| Confidence ≥ 0.60 AND not fitness-related | Pass through unchanged (rule-based result is good) |
| RAG confidence > existing confidence | Adopt RAG category + composite confidence |
| RAG confidence ≤ existing confidence | Keep original category + confidence |
| Always | Append RAG reason, ATO citation, and score breakdown to reason field |
| Always | Merge RAG evidence requirements into checklist (deduped) |
| Always | Add `rag_analysed` flag |
| `occupation_dependent = True` | Add `occupation_dependent` flag |
| `is_potentially_deductible = False` | Add `needs_review` flag |

---

## Confidence Scoring

### Rule-Based (All Non-Fitness Transactions)

Each classification rule in `rules.json` carries a **base confidence** (0.60–0.95). The final rule-based confidence is the base value, weighted by the fuzzy merchant match score. Transactions below the threshold (default 0.60) are flagged `needs_review`.

### RAG-Composite (Fitness Transactions Only)

```
Final = keyword(0–30) + grounding(0–40) + claude(0–30)  ≤ 100
        ──────────────────────────────────────────────────────
        Divided by 100  →  0.0 – 1.0  ClassifiedTransaction.confidence
```

| Component | Max | Source |
|---|---|---|
| **Keyword score** | 30 | TF-IDF keyword groups in `ATOKnowledgeBase.keyword_confidence()` |
| **RAG grounding** | 40 | Ratio of retrieved ATO chunks that say `deductible: true` |
| **Claude score** | 30 | Claude's confidence (0–100) linearly scaled to 0–30 |
| **Total** | 100 | Capped at 100 |

| Confidence Range | Label | Meaning |
|---|---|---|
| 0.80 – 1.00 | **High** | Clear nexus to income-earning activity; low ambiguity |
| 0.60 – 0.79 | **Medium** | Likely deductible but verify occupation or usage % |
| < 0.60 | **Low** | Possible under specific conditions — consult a tax agent |

---

## Deduction Categories

### Primary Work-Related Categories (Rule-Based Engine)

These categories are processed entirely by the rule-based engine. No Claude AI call is made.

| Category | Rule ID | Base Confidence | Example Merchants / Keywords |
|---|---|---|---|
| Work Software & Subscriptions | R001 | 0.95 | Adobe, Microsoft 365, GitHub, JetBrains, Atlassian, Canva |
| Professional Memberships | R002 | 0.90 | CPA Australia, Law Society, AMA, Engineers Australia |
| Self-Education & Training | R003 | 0.85 | Udemy, Coursera, TAFE, conference registrations, textbooks |
| Work Equipment & Technology | R004 | 0.80 | JB Hi-Fi, Apple Store, Officeworks, stationery, hardware |
| Phone & Internet | R005 | 0.70 | Telstra, Optus, TPG, Aussie Broadband (work-use % applies) |
| Working From Home | R006 | 0.65 | Internet, electricity (requires ATO-approved WFH method) |
| Work-Related Travel | R007 | 0.75 | Uber, Qantas, Virgin, Transurban (logbook required) |
| Donations to DGR | R008 | 0.85 | Registered charities with Deductible Gift Recipient status |
| Bank Fees | R009 | 0.70 | Account-keeping fees on income-earning accounts |

### Fitness-Related Category (RAG + Rule-Based)

Fitness transactions are first picked up by the rule-based engine with a low base confidence (0.15–0.20) and a `rag_required` flag. The RAG pipeline then runs and can raise the composite confidence based on ATO knowledge and Claude reasoning.

| Rule ID | Fitness Subcategory | Base Rule Confidence | Note |
|---|---|---|---|
| R011 | Gym memberships & fitness centres | 0.20 | Almost always occupation-dependent |
| R012 | Personal training & coaching | 0.18 | Deductible for fitness instructors, police |
| R013 | Supplements & nutrition | 0.15 | Rarely deductible; professional athletes only |
| R014 | Fitness equipment & clothing | 0.15 | Deductible for fitness professionals |

The RAG composite score replaces the base rule confidence if it is higher.

### Exclusion Rules

Applied **before** classification. Excluded transactions do not appear in deduction candidates.

| Rule | Detection Patterns |
|---|---|
| **Transfers** | OSKO, PAYID, BPAY, TRANSFER TO/FROM, ACCOUNT TRANSFER |
| **Cash Withdrawals** | ATM WITHDRAWAL, ATM, CASH OUT, EFTPOS CASH |
| **Loan Repayments** | MORTGAGE, HOME LOAN, CAR LOAN, PERSONAL LOAN |
| **Tax Payments** | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE, TAX PAYMENT |
| **Superannuation** | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER, HESTA |
| **Salary / Income Credits** | SALARY, WAGES, PAYROLL (credit direction only) |

---

## Supported Bank Statement Formats

### How Format Detection Works

The CSV parser uses **column-name pattern matching** — not bank-specific logic. Any CSV that contains recognisable headers for date, description, and amount (or debit/credit) will be parsed correctly. This means banks not listed below are very likely to work as long as they export standard column names.

**Detected column patterns:**

| Column type | Accepted header names |
|---|---|
| Date | `date`, `transaction date`, `trans date`, `posting date`, `value date` |
| Description | `description`, `details`, `narrative`, `transaction details`, `merchant`, `payee`, `memo` |
| Amount (single) | `amount`, `value`, `transaction amount` |
| Debit (split) | `debit`, `debit amount`, `withdrawal`, `withdrawals`, `money out` |
| Credit (split) | `credit`, `credit amount`, `deposit`, `deposits`, `money in` |

**Supported date formats:**

| Format | Example | Used by |
|---|---|---|
| `DD/MM/YYYY` | `15/01/2024` | CommBank, ANZ, Westpac, ING, most |
| `DD-MM-YYYY` | `15-01-2024` | Some older exports |
| `YYYY-MM-DD` | `2024-01-15` | ISO, some digital banks |
| `DD/MM/YY` | `15/01/24` | Shortened year variants |
| `DD Mon YYYY` | `15 Jan 2024` | Some formatted exports |
| `DD Mon YY` | `23 Oct 25` | NAB online banking |
| `DD Month YYYY` | `15 January 2024` | Full month name |

Amounts support both **positive** and **negative** conventions, parentheses as negatives `(89.95)`, and dollar signs `$89.95`.

---

### Verified Banks: CSV Export Instructions

#### Commonwealth Bank (CommBank)

**Columns exported:** `Date, Description, Amount` (single amount column; negative = debit)

1. Log in → **Accounts** → select account
2. Click **Export** (top right of transaction list)
3. Choose date range → select **CSV** format
4. Download — no changes needed, upload directly

---

#### NAB (National Australia Bank)

**Columns exported:** `Date, Amount, Type, Description` — NAB uses `DD Mon YY` date format (e.g. `23 Oct 25`)

1. Log in → **Accounts** → select account
2. Click **Download transactions** → choose date range
3. Select **CSV** → Download
4. Upload directly — the parser handles NAB's date format automatically

---

#### Westpac

**Columns exported:** `Date, Narrative, Debit Amount, Credit Amount, Balance` — separate debit/credit columns

1. Log in → **Accounts** → select account
2. Click **Search & export** tab
3. Choose date range → select **Comma Separated Values (.csv)**
4. Download and upload directly

---

#### ANZ

**Columns exported:** `Date, Amount, Description` (negative = debit)

1. Log in → **Accounts** → select account
2. Click **Export** → choose date range
3. Select **CSV** → Export
4. Upload directly

---

#### ING

**Columns exported:** `Date, Description, Credit, Debit` — separate credit/debit columns

1. Log in → **My accounts** → select account
2. Click the **download** icon → choose date range
3. Select **CSV** → Download
4. Upload directly

---

#### Bendigo Bank

**Columns exported:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → **Transaction History**
2. Click **Export** → choose date range
3. Select **CSV** format → Download

---

#### Macquarie Bank

**Columns exported:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → select account → **Transactions**
2. Click **Export** → date range → **CSV**
3. Download and upload directly

---

#### Bank of Queensland (BOQ)

**Columns exported:** `Date, Description, Debit, Credit`

1. Log in → **Accounts** → select account
2. Choose **Export / Download** → date range → **CSV**

---

#### Suncorp

**Columns exported:** `Date, Description, Amount`

1. Log in → **Accounts** → select account → **Transaction history**
2. Click **Export** → date range → **CSV**

---

#### St. George / Bank of Melbourne / BankSA (Westpac Group)

Same format as Westpac — `Date, Narrative, Debit Amount, Credit Amount`

1. Log in → **Accounts** → select account
2. **Search & export** → date range → **CSV**

---

#### BankWest (now Commonwealth Bank)

**Columns exported:** `Date, Narrative, Debit, Credit`

1. Log in → **Accounts** → select account
2. Click **Download** icon → date range → **CSV**

---

#### Up Bank / Ubank / 86 400 (digital banks)

Most digital banks export ISO date format (`YYYY-MM-DD`) with standard `Description, Amount` columns — supported automatically.

---

### PDF Bank Statements

PDF support uses **pdfplumber** (primary) with **PyPDF2** as fallback. The parser extracts text and attempts to identify transaction rows using pattern matching.

**Tips for better PDF parsing:**
- Use the bank's "Download statement" option rather than printing to PDF — machine-generated PDFs parse more reliably than scanned images
- Statements with clear tabular formatting (rows and columns) parse best
- If PDF parsing fails, download the same period as a CSV instead — CSV is always more reliable

---

### Preparing Your Statement: Common Gotchas

| Issue | What to do |
|---|---|
| Date range too short | Export at least 3 months; 12 months ideal for a full income year analysis |
| Multiple accounts | Export each account separately and upload one at a time |
| Foreign currency transactions | Include them — amounts are left as-is; the tool does not do FX conversion |
| Redact sensitive info first | Remove BSB/account numbers from the description column before uploading; the redaction service also strips them automatically |
| Excel `.xlsx` format | Save as CSV first (File → Save As → CSV in Excel or Google Sheets) |
| Statement includes opening balance row | The exclusion engine will filter it out as it has no debit/credit pattern match |

---

## Architecture

### Backend (`/backend`) — Python 3.11 + FastAPI

```
backend/
├── api/
│   └── endpoints.py          # POST /api/upload, GET /api/jobs/{id}, downloads
├── config/
│   ├── rules.json             # 10+ classification rules (R001–R014)
│   └── ato_fitness_knowledge.json  # 17 ATO fitness knowledge chunks (v2025-2026)
├── models/
│   └── schemas.py             # Pydantic models: NormalisedTransaction,
│                              #   ClassifiedTransaction, ReportData, etc.
├── processing/
│   ├── pipeline.py            # Orchestration: parse → exclude → classify → RAG → report
│   ├── csv_parser.py          # Column-detection CSV parser (any Australian bank)
│   ├── pdf_parser.py          # pdfplumber + PyPDF2 dual-engine PDF extraction
│   ├── classification_engine.py  # Rule-based classification
│   ├── exclusion_engine.py    # Pre-classification exclusion filter
│   ├── rules_engine.py        # Rule matching and priority evaluation
│   ├── fuzzy_matcher.py       # Merchant name canonicalisation (rapidfuzz)
│   ├── report_generator.py    # PDF (ReportLab), CSV, JSON report generation
│   ├── audit_trail.py         # Per-transaction audit event recording
│   └── redaction_service.py   # BSB codes, account numbers, card numbers stripped
├── rag/
│   ├── knowledge_base.py      # ATOKnowledgeBase: TF-IDF retrieval + keyword scoring
│   ├── rag_engine.py          # RAGEngine: retrieve → grounding → Claude → composite
│   └── llm_classifier.py      # LLMClassifier: merges RAG result into ClassifiedTransaction
├── storage/
│   ├── database.py            # SQLite schema and migrations
│   └── storage_service.py     # Ephemeral vs. persistent storage abstraction
├── middleware/
│   └── security.py            # Rate limiting, API key auth, security headers
├── main.py                    # FastAPI app, CORS, middleware, lifespan
└── tests/                     # 338 tests across 35 test files
```

### Frontend (`/frontend`) — React 18 + TypeScript + Vite

```
frontend/src/
├── pages/
│   ├── Landing.tsx            # Hero, features, how-it-works, stats strip
│   ├── Upload.tsx             # File upload form, analysis trigger
│   ├── Report.tsx             # Deduction report: summary cards, tabs, detail drawer
│   ├── Rules.tsx              # Classification rules reference (all categories)
│   └── Privacy.tsx            # Privacy policy and ephemeral mode explanation
├── components/
│   ├── Navigation.tsx         # Top navigation bar (Playfair Display logo)
│   ├── Button.tsx             # Primary (gold) / secondary (glass) / tertiary
│   ├── Card.tsx               # Glass-morphism card container
│   ├── Chip.tsx               # Category badge / confidence chip
│   ├── Drawer.tsx             # Transaction detail side panel
│   ├── AnimatedSection.tsx    # Scroll-triggered reveal animations (framer-motion)
│   └── Icon.tsx               # Lucide icon wrapper
├── api/
│   ├── client.ts              # Axios HTTP client + APIError class
│   └── hooks.ts               # React Query hooks (useUploadCSV, useJobStatus)
├── styles/
│   └── design-system.css      # Google Fonts: Playfair Display + Space Mono + DM Sans
└── hooks/
    └── useParallax.ts         # Framer Motion parallax scroll hook
```

### Data Flow

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
  │                    │  4. Classify (rule-based)    │     │
  │                    │  5. [fitness txns only]      │     │
  │                    │     Redact PII               │     │
  │                    │     TF-IDF retrieve chunks   │     │
  │                    │     ────────────────────────>│     │
  │                    │     Claude JSON response     │     │
  │                    │     <────────────────────────│     │
  │                    │     Merge composite score    │     │
  │                    │  6. Generate reports         │     │
  │                    └──────┬──────────────────────-┘     │
  │                           │                            │
  │  Response (inline report) │                            │
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

# Configure environment
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY to enable RAG (optional; degrades gracefully without it)

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
# Anthropic — enables RAG-powered fitness classification
ANTHROPIC_API_KEY=sk-ant-...

# Security
SECRET_KEY=your-secret-key-here-minimum-32-characters
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Upload limits
MAX_UPLOAD_SIZE_MB=10
RATE_LIMIT_PER_MINUTE=10

# Privacy (leave as true — disabling stores raw transaction data)
EPHEMERAL_MODE=true
ENABLE_REDACTION=true
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
| `file` | File | required | CSV or PDF bank statement (max 10 MB) |
| `income_year` | string | auto-detected | e.g. `"2025-2026"`. Detected from transaction dates if omitted. |
| `ephemeral_mode` | bool | `true` | Process in-memory only; discard all data after response |
| `confidence_threshold` | float | `0.60` | Minimum confidence for the "Likely Deductible" bucket |
| `use_rag` | bool | `true` | Enable RAG pipeline for fitness transactions |

**Response `200`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Processing complete",
  "report_data": {
    "income_year": "2025-2026",
    "generated_at": "2026-03-26T14:23:01Z",
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
    "needs_review": [ /* ClassifiedTransaction[] with low confidence */ ],
    "excluded": [ /* ExcludedTransaction[] */ ]
  }
}
```

### `GET /api/jobs/{job_id}`

Poll job status for async processing of large files.

**Response `200`:**
```json
{
  "job_id": "550e8400-...",
  "status": "completed",
  "progress": 100
}
```

`status` values: `queued` · `processing` · `completed` · `failed`

### `GET /api/jobs/{job_id}/download/{format}`

Download the generated report. `format` is one of: `pdf` · `csv` · `json`

### `GET /health`

Returns `{"status": "ok"}`.

### Error Format

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

Rules are evaluated in **descending priority order**. The first matching rule wins. Fitness rules have lower priority (50) and explicitly set `"rag_required": true` to trigger the RAG pipeline.

### ATO Knowledge Base (`backend/config/ato_fitness_knowledge.json`)

17 fitness-specific ATO chunks (v2025-2026). Each chunk drives the RAG grounding score via its `deductible` boolean:

```json
{
  "id": "gym_general",
  "title": "Gym Memberships — General Employee Rule",
  "ato_reference": "ATO ID 2007/182; Section 8-1 ITAA 1997",
  "category": "fitness_gym",
  "deductible": false,
  "occupation_dependent": true,
  "keywords": ["gym", "fitness centre", "anytime fitness", "crossfit"],
  "content": "Gym memberships for general employees are private expenses...",
  "who_can_claim": ["police officers", "firefighters", "fitness instructors"],
  "who_cannot_claim": ["general employees", "office workers", "software developers"],
  "evidence_required": ["receipt", "employer letter confirming fitness requirement", "diary"]
}
```

The `deductible: false` flag means retrieving this chunk lowers the RAG grounding score. The `deductible: true` flag (e.g. for fitness instructors, police, CPR certifications) raises it.

---

## Testing

### Backend — 338 Tests

```bash
cd backend
pytest -v                           # all tests
pytest -v --cov=. --cov-report=html # with coverage report
pytest tests/test_rag_engine.py -v  # RAG tests only
pytest tests/test_rag_knowledge_base.py -v
pytest tests/test_llm_classifier.py -v
```

| Module | Tests | Type |
|---|---|---|
| `rag/knowledge_base.py` | 52 | Unit — TF-IDF retrieval, keyword scoring |
| `rag/rag_engine.py` | 37 | Unit — Anthropic client mocked |
| `rag/llm_classifier.py` | 33 | Unit — RAGEngine mocked |
| `processing/csv_parser.py` | ~30 | Unit + property-based (Hypothesis) |
| `processing/pdf_parser.py` | ~20 | Unit |
| `processing/classification_engine.py` | ~25 | Unit |
| `processing/exclusion_engine.py` | ~15 | Unit |
| `processing/pipeline.py` | ~20 | Integration |
| `api/endpoints.py` | ~20 | Integration (FastAPI TestClient) |
| Property-based (Hypothesis) | 23 | Invariants across random inputs |

**Key invariants tested:**
- Confidence scores are always in `[0.0, 1.0]`
- Audit trail entry exists for every input transaction
- Audit trail output is deterministic across runs
- Raw CSV/PDF data is never written to storage
- BSB codes and account numbers never appear in output
- Exclusion rules always applied before classification
- Every candidate has a non-empty evidence checklist

### Frontend — 168 Tests

```bash
cd frontend
npm test -- --run               # all tests
npm test -- --run --coverage    # with coverage
```

Covers all 5 pages (`Landing`, `Upload`, `Report`, `Rules`, `Privacy`), all components (`Button`, `Card`, `Chip`, `Drawer`, `Modal`, `Table`, `Input`), and end-to-end user journeys.

### Running Both Suites

```bash
cd backend && pytest -q && cd ../frontend && npm test -- --run
```

---

## Privacy & Security

### Ephemeral Mode (Always On)

Raw bank statement data is **never written to disk**. All processing happens in memory. When the API response is sent, the in-memory data is discarded immediately. The only persistent artefact is a minimal job record (job ID, status, timestamps) — no transaction data, no amounts, no merchant names.

### What Is Never Stored

- Account numbers or BSB codes
- Full transaction descriptions
- Raw CSV or PDF file contents
- Merchant names or amounts
- Any personal identifying information

### Redaction Before AI Calls

The `RedactionService` runs **before** any transaction is sent to the Anthropic API:

| Pattern | What is stripped |
|---|---|
| `\d{3}-\d{3}` | BSB codes (e.g. `062-000`) |
| `\d{6,10}` | Bank account numbers |
| `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}` | Card numbers |
| `REF:\s*[A-Z0-9]{6,}` | Transaction reference numbers |
| `#[A-Z0-9]{6,}` | Hash-prefixed reference codes |

Merchant name signals and keywords are preserved so RAG analysis remains useful.

### Security Controls

| Control | Detail |
|---|---|
| Rate limiting | 10 requests/minute per IP (configurable) |
| File validation | Type + size check before any processing begins |
| CORS | Strict origin allowlist via `ALLOWED_ORIGINS` |
| Security headers | CSP, HSTS, X-Frame-Options, X-XSS-Protection, Referrer-Policy |
| Input validation | Pydantic models on all API inputs |
| No analytics | Zero third-party tracking or telemetry |

---

## Deployment

### Frontend — Netlify

```bash
npm install -g netlify-cli
cd frontend && npm run build
netlify deploy --prod --dir=dist
```

Set `VITE_API_BASE_URL` to your backend URL in the Netlify environment variables dashboard.

### Backend Options

**Railway / Render / Fly.io** (recommended):
- Python/FastAPI supported natively
- Set environment variables in the platform dashboard
- HTTPS automatic on all three platforms

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

- [ ] `ANTHROPIC_API_KEY` set (enables RAG analysis for fitness transactions)
- [ ] `SECRET_KEY` is at least 32 characters and randomly generated
- [ ] `ALLOWED_ORIGINS` contains only your frontend domain
- [ ] `EPHEMERAL_MODE=true` (default — do not disable)
- [ ] HTTPS enforced (HSTS header enabled)
- [ ] Rate limiting enabled
- [ ] `DEBUG=false` / Swagger UI disabled in production
- [ ] File size limit appropriate (`MAX_UPLOAD_SIZE_MB=10`)

---

## Changelog

### v1.2.0
- UI redesign: "Financial Ledger" aesthetic — Playfair Display + Space Mono + DM Sans, warm gold/amber palette replacing corporate blue
- Frontend test suite expanded to 168 tests (was ~55 passing); all 168 now pass
- Fixed accessibility: `label[for]` ↔ `input[id]` association on Upload form
- Fixed `Chip` component: always use `label` prop, not children
- Fixed e2e tests: fresh `QueryClient` with `retry: false` to eliminate async timing issues

### v1.1.0
- Expanded from fitness-only to all ATO work-related deduction categories (software, memberships, training, equipment, phone, WFH, travel, donations, bank fees)
- Added full RAG pipeline with TF-IDF knowledge base retrieval, grounding scoring, and Claude Haiku reasoning
- Added comprehensive RAG unit tests (122 tests: knowledge base × engine × LLM classifier)
- Removed ephemeral mode toggle — always on

### v1.0.0
- Initial release: CSV parsing, rule-based classification, PDF/CSV/JSON reports, ephemeral mode

---

## Author

**Samuel Rath**

---

*Built with privacy and security as core principles. Not tax advice.*
