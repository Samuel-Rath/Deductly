# Architecture

How Deductly parses, classifies, and reports on bank transactions.

## Pipeline overview

Every uploaded file flows through seven sequential steps:

```
Bank Statement (CSV or PDF)
        │
        ▼
┌───────────────────┐
│  1. Validation    │  MIME type, extension, file size ≤ 10 MB
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  2. Parsing       │  CSV: auto-detect column layout
│                   │  PDF: pdfplumber primary, PyPDF2 fallback
└─────────┬─────────┘
          │  List[RawTransaction]
          ▼
┌───────────────────┐
│  3. Normalisation │  Date parse, merchant extraction, payment rail
│                   │  detection, recurring flag, income year detection
└─────────┬─────────┘
          │  List[NormalisedTransaction]
          ▼
┌───────────────────┐
│  4. Exclusion     │  Transfers, ATM, loans, ATO payments, salary credits
└─────────┬─────────┘
          │  Candidates only (excluded saved separately)
          ▼
┌─────────────────────────┐
│  5. Rule-Based Engine   │  Keyword + fuzzy merchant matching
│     (ALL candidates)    │  Priority-sorted rules → category + confidence
└─────────┬───────────────┘
          ▼
┌─────────────────────────────────────────┐
│  6. RAG Pipeline  ← FITNESS ONLY        │
│                                         │
│  a. Keyword score         (0–30)        │
│  b. TF-IDF retrieval → top-5 ATO chunks │
│  c. RAG grounding score   (0–40)        │
│  d. Claude Haiku reasoning (0–30)       │
│  e. Composite score       (0–100)       │
└─────────┬───────────────────────────────┘
          ▼
┌───────────────────┐
│  7. Report        │  Aggregate → PDF · CSV · JSON
└───────────────────┘
```

## Step 1 — File validation

Before any parsing:
- **Extension** must be `.csv` or `.pdf`
- **MIME type** is checked independently of the extension (it's client-controlled)
- **Size** must not exceed `MAX_UPLOAD_SIZE_MB` (default 10 MB)

Invalid files return a structured error with `error_code` and `message`. No parsing is attempted.

## Step 2 — Parsing

### CSV parser

The CSV parser has **no bank-specific logic**. It matches column headers against known patterns:

| Column | Accepted header names |
|---|---|
| Date | `date`, `transaction date`, `trans date`, `posting date`, `value date` |
| Description | `description`, `details`, `narrative`, `transaction details`, `merchant`, `payee`, `memo` |
| Amount (single) | `amount`, `value`, `transaction amount` |
| Debit (split) | `debit`, `debit amount`, `withdrawal`, `withdrawals`, `money out` |
| Credit (split) | `credit`, `credit amount`, `deposit`, `deposits`, `money in` |

Amount parsing handles `$89.95`, `89.95`, `-89.95`, `(89.95)`, `89,950.00`.

**Date formats** supported:

| Format | Example | Used by |
|---|---|---|
| `DD/MM/YYYY` | `15/01/2024` | CommBank, ANZ, Westpac, ING (most) |
| `DD-MM-YYYY` | `15-01-2024` | Some older exports |
| `YYYY-MM-DD` | `2024-01-15` | ISO format, digital banks |
| `DD/MM/YY` | `15/01/24` | Shortened year |
| `DD Mon YYYY` | `15 Jan 2024` | Some formatted exports |
| `DD Mon YY` | `23 Oct 25` | NAB online banking |
| `DD Month YYYY` | `15 January 2024` | Full month name variant |

### PDF parser

Two-engine strategy:
1. **pdfplumber** (primary) — extracts tables and text with high fidelity on machine-generated PDFs
2. **PyPDF2** (fallback) — raw text extraction when pdfplumber fails to identify a layout

The parser drives a **state machine** from date-pattern detection: a date at the start of a line begins a new transaction; subsequent lines (no leading date) accumulate into the description. The amount is extracted from the accumulated text.

Direction is inferred from credit keywords (`SALARY`, `WAGES`, `DEPOSIT`, `REFUND`); everything else defaults to debit.

PDF parsing is inherently less reliable than CSV — if results look off, download the same period as CSV.

## Step 3 — Normalisation

Every raw transaction becomes a `NormalisedTransaction`:

**Merchant extraction** strips, in order:
1. Payment-rail prefixes (`PAYPAL *`, `VISA`, `MASTERCARD`, `EFTPOS`, `CARD`, `DEBIT CARD`)
2. Reference numbers (`REF:ABC123`, `#TXN84732`, `*1234` card suffixes)
3. Collapses whitespace and title-cases the result

**Payment rail detection** identifies how the payment was made: `paypal`, `osko`, `payid`, `bpay`, card types, `eftpos`, `direct_debit`. Recorded in the audit trail.

**Recurring flag** groups transactions by merchant (case-insensitive), calculates inter-transaction intervals, and flags if 70%+ fall within:
- Weekly: ~7 days ± 3
- Monthly: ~30 days ± 7
- Yearly: ~365 days ± 30

**Income year detection** scans transaction dates and picks the Australian income year (`YYYY-YYYY`, ending 30 June) with the most transactions. Overridden if the caller passes `income_year` explicitly.

## Step 4 — Exclusion

Transactions that are structurally non-deductible are removed before classification:

| Reason | Detected patterns |
|---|---|
| **Transfer between accounts** | OSKO, PAYID, BPAY, TRANSFER TO/FROM, ACCOUNT TRANSFER, INTERNAL TRANSFER |
| **Cash withdrawal** | ATM WITHDRAWAL, ATM, CASH OUT, EFTPOS CASH, WITHDRAWAL ATM |
| **Loan repayment** | MORTGAGE, HOME LOAN, CAR LOAN, PERSONAL LOAN, LOAN REPAYMENT, LOAN INSTALMENT |
| **Tax payment** | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE, TAX OFFICE, TAX PAYMENT, TAX REFUND |
| **Superannuation** | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER, HESTA, REST SUPER |
| **Salary / income credit** | SALARY, WAGES, PAYROLL, PAY FROM (credit-direction transactions only) |

> The exclusion engine applies direction context: salary keywords only exclude credits. A debit that mentions "ATO" in the reference isn't excluded as salary.

## Step 5 — Rule-based classification

Every non-excluded transaction is matched against the rules in [`backend/config/rules.json`](../backend/config/rules.json). Rules are sorted by **priority** descending; the first match wins.

**Matching logic:**
1. **Keyword match** — case-insensitive substring check of description and merchant against the rule's `keywords`
2. **Fuzzy merchant match** — extracted merchant compared to the rule's `merchants` via `rapidfuzz`; a similarity above threshold scores as a hit

**When a rule matches:**
- Transaction gets the rule's `category` and `confidence`
- `evidence_checklist` is attached (receipt, invoice, logbook, diary, etc.)
- Category-specific flags are added:
  - `needs_review` — confidence below threshold
  - `method_required` — WFH/travel need an ATO calculation method
  - `percentage_required` — phone/internet need a work-use %
  - `eligibility_check` — donations need DGR verification
  - `rag_required` — fitness rules set this to trigger the RAG pipeline

Fitness rules (R011–R014) intentionally set **low base confidence** (0.15–0.20) and `rag_required`. Rule-based matching alone is not sufficient for fitness — the RAG pipeline produces the real confidence.

## Step 6 — RAG pipeline (fitness only)

The RAG (Retrieval-Augmented Generation) pipeline runs **only** on transactions flagged `rag_required`. All other categories are handled by the rule-based engine and skip this step.

### Why RAG for fitness specifically?

Most categories are deterministic — GitHub subscriptions for a developer are always deductible. Fitness expenses are occupation-dependent in a way keyword rules can't capture:

- A gym membership is **deductible** for a police officer required to maintain fitness (ATO ID 2007/182)
- It's **deductible** for a fitness instructor who must demonstrate exercises to clients
- It's **not deductible** for a software developer who goes for general health

A static rule can't know the occupation. The RAG pipeline retrieves the specific ATO guidance that applies, then passes it with the transaction to Claude for occupation-aware reasoning.

### Detection: what triggers RAG

Before RAG runs, `ATOKnowledgeBase.is_fitness_related()` tests description and merchant against **11 keyword groups**:

| Group | Example keywords |
|---|---|
| `gym` | gym, fitness centre, anytime fitness, crossfit, f45 |
| `personal_training` | personal trainer, pt session, pt fee |
| `supplements` | supplement, protein powder, creatine, pre-workout |
| `equipment` | weights, dumbbells, treadmill, resistance band |
| `activewear` | lululemon, nike activewear, under armour, 2xu |
| `sports_stores` | rebel sport, decathlon, athlete's foot |
| `wearables` | garmin, fitbit, apple watch activity, whoop |
| `memberships` | yoga studio, pilates, crossfit membership |
| `fitness_apps` | myfitnesspal, strava, zwift, garmin connect |
| `medical_fitness` | physiotherapy, sports massage, chiropractic |
| `certifications` | cert iii fitness, cpr, first aid, hltaid |

A match in **any** group triggers RAG.

### RAG step-by-step

```
Transaction (description, merchant, amount)
        │
        ▼  PII redacted — BSB, account numbers, card numbers stripped
        │  before any data leaves the backend
        │
        ▼  STEP 1 — Keyword Score (0–30)
        │  Multi-word phrases score higher than single words.
        │  "personal trainer" (2 words) > "gym" (1 word).
        │  Aggregate across 11 groups, normalise to [0, 30].
        │
        ▼  STEP 2 — Retrieve ATO Context (top-5 chunks)
        │  ATOKnowledgeBase.retrieve(query, k=5)
        │  Pure TF-IDF, no embeddings:
        │    Σ IDF(term) for terms in both query and chunk
        │    IDF = log((total+1) / (chunks_with_term+1)) + 1
        │    Bonus +2.0 for each term in the chunk's keyword list
        │  Knowledge base: 17 ATO chunks (v2025-2026) covering
        │    gym, personal training, supplements, equipment,
        │    activewear, fitness pros, athletes, police/military,
        │    sports associations, apps, medicine, first aid, certs.
        │
        ▼  STEP 3 — RAG Grounding Score (0–40)
        │  support = chunks where deductible=True
        │  against = chunks where deductible=False
        │  score = (support/total × 40) − (against/total × 10)
        │  Bounded to [0, 40].
        │  Examples:
        │    All 5 deductible:      40
        │    2 yes, 3 no:           10
        │    All 5 not deductible:   0
        │
        ▼  STEP 4 — Claude Haiku Reasoning (0–30)
        │  Model: claude-haiku-4-5-20251001 (fast, cost-efficient)
        │  Max tokens: 512
        │  System persona: expert Australian tax accountant
        │    (conservative bias — most fitness is private)
        │  User message: redacted transaction + top-5 ATO chunks
        │  Returns strict JSON:
        │    is_fitness_related, is_potentially_deductible,
        │    occupation_dependent, category, confidence (0-100),
        │    reason, ato_citation, conditions, evidence_required,
        │    disclaimer
        │  claude_score = int((confidence/100) × 30)
        │
        ▼  STEP 5 — Composite
        composite = min(keyword + grounding + claude, 100)
        confidence_float = composite / 100   →  0.0 – 1.0
```

### Worked example

Input: `"ANYTIME FITNESS MEMBERSHIP  REF:TXN-84732"`, AUD $79.95 debit, 15/01/2025.

1. **Normalise**: date → 2025-01-15, ref stripped, merchant → "Anytime Fitness"
2. **Exclusion**: no match, proceeds
3. **Rule-based**: R011 matches "anytime fitness" → `confidence=0.20`, flags `["needs_review", "occupation_dependent", "rag_required"]`
4. **RAG triggered**:
   - Keyword: 12/30
   - TF-IDF retrieves `gym_general` (deductible:false) and `police_military_fitness` (deductible:true) etc.
   - Grounding: 1 yes / 4 no → `(1/5 × 40) − (4/5 × 10) = 0`
   - Claude: confidence 30/100 → claude_score = 9
   - **Composite: 12 + 0 + 9 = 21 → 0.21**
5. **Finalised**: confidence 0.21 < 0.60 → **Needs Review**. Evidence: receipt, employer fitness requirement letter, diary. ATO citation: `ATO ID 2007/182; Section 8-1 ITAA 1997`.

For a "fitness instructor" occupation, the same input would retrieve `fitness_professionals` chunks, raising grounding to ~30–40 and Claude to higher confidence — composite ~0.70–0.80.

### Graceful degradation (no API key)

If `ANTHROPIC_API_KEY` is missing or the `anthropic` package is unavailable:
- Steps 2–4 are skipped
- Fitness transactions get `confidence = keyword_score` only (max 0.30)
- `is_potentially_deductible` defaults to `False` (conservative)
- The reason field notes RAG is unavailable

Rule-based classification still runs on everything. Only fitness loses the Claude reasoning component.

### Merging RAG back into the transaction

`LLMClassifier.enhance()` merges the RAG result:

| Condition | Behaviour |
|---|---|
| Not fitness-related | Pass through unchanged |
| RAG confidence > existing | Adopt RAG composite confidence |
| RAG confidence ≤ existing | Keep original |
| Always | Append RAG reason, ATO citation, score breakdown to `reason` |
| Always | Merge evidence requirements (deduped) |
| Always | Add `rag_analysed` flag |
| `occupation_dependent = true` | Add `occupation_dependent` flag |
| `is_potentially_deductible = false` | Add `needs_review` flag |

## Step 7 — Report generation

**Bucketing:**

| Bucket | Condition |
|---|---|
| Likely Deductible | Confidence ≥ 0.60 AND no `needs_review` flag |
| Needs Review | Confidence < 0.60, or `needs_review` / `occupation_dependent` flag |
| Excluded | Matched an exclusion rule before classification |

**Summary statistics:**
- Total deductible, needs-review, excluded amounts
- Category breakdown
- Confidence distribution: high (≥0.80), medium (0.60–0.79), low (<0.60)

**Output formats:**
- **PDF** — ReportLab-generated formatted report
- **CSV** — flat transaction export
- **JSON** — complete audit trail for every transaction

**Redaction** via `RedactionService` strips BSB codes, account numbers, and card numbers from description fields before reports are serialised.

---

## Confidence scores explained

### Rule-based (non-fitness)

| Confidence | Meaning | Examples |
|---|---|---|
| 0.90–0.95 | Near-certain — deterministic ATO rules | Adobe Creative Cloud, CPA membership |
| 0.80–0.89 | Very likely — minor ambiguity possible | Udemy course, Apple Store hardware |
| 0.70–0.79 | Likely — requires evidence or usage split | Uber (logbook), Telstra (% work use) |
| 0.60–0.69 | Conditional — method/eligibility required | WFH internet, bank fees |
| <0.60 | Uncertain — flagged Needs Review | Generic equipment, borderline merchants |

### RAG composite (fitness)

```
Final = keyword (0-30) + rag_grounding (0-40) + claude (0-30)
      ────────────────────────────────────────────────────────
      Max 100  →  / 100  →  0.0 – 1.0
```

A gym membership for a general employee typically scores 0.20–0.30 (Needs Review). For a listed fitness-related occupation it can hit 0.70–0.85 (Likely Deductible).

---

## Deduction categories

### Work-related (rule-based engine — no AI call)

| Category | Rule | Confidence | What it captures |
|---|---|---|---|
| Work Software & Subscriptions | R001 | 0.95 | Adobe, Microsoft 365, GitHub, JetBrains, Atlassian, Canva, Xero, MYOB |
| Professional Memberships | R002 | 0.90 | CPA Australia, Law Society, AMA, Engineers Australia |
| Self-Education & Training | R003 | 0.85 | Udemy, Coursera, TAFE, conferences, textbooks |
| Work Equipment & Technology | R004 | 0.80 | JB Hi-Fi, Apple Store, Officeworks, peripherals |
| Phone & Internet | R005 | 0.70 | Telstra, Optus, TPG — work-use percentage required |
| Working From Home | R006 | 0.65 | Home internet, electricity — ATO WFH method required |
| Work-Related Travel | R007 | 0.75 | Uber, Qantas, Virgin — logbook required for vehicles |
| Donations to DGR | R008 | 0.85 | Registered charities with DGR status |
| Bank Fees | R009 | 0.70 | Account-keeping fees on income-earning accounts |

### Fitness-related (rule-based + RAG)

Low base confidence; the composite RAG score replaces it.

| Rule | Subcategory | Base | Note |
|---|---|---|---|
| R011 | Gym memberships & fitness centres | 0.20 | Almost always occupation-dependent |
| R012 | Personal training & coaching | 0.18 | Deductible for fitness instructors, police, military |
| R013 | Supplements & nutrition | 0.15 | Rarely deductible; professional athletes only |
| R014 | Fitness equipment & activewear | 0.15 | Deductible for fitness professionals |

### Exclusion rules (removed before classification)

| Rule | Pattern examples |
|---|---|
| Transfers | OSKO, PAYID, BPAY, TRANSFER TO/FROM |
| Cash | ATM, ATM WITHDRAWAL, CASH OUT, EFTPOS CASH |
| Loans | MORTGAGE, HOME LOAN, CAR LOAN, LOAN REPAYMENT |
| Tax | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE, TAX PAYMENT |
| Superannuation | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER, HESTA |
| Salary | SALARY, WAGES, PAYROLL (credit transactions only) |

---

## Reading the report (user-facing)

### Summary panel
- **Likely Deductible** — claimable with the right evidence
- **Needs Review** — might be claimable depending on occupation/circumstances
- **Excluded** — non-deductible, for reference only

Plus category breakdown and confidence distribution.

### Transaction detail panel

| Field | What it means |
|---|---|
| Category | ATO deduction category assigned |
| Confidence | How confident the system is that this is deductible |
| Reason | Matched keyword or rule ID + RAG score breakdown for fitness |
| Evidence required | Receipt, invoice, logbook, diary, employer letter, etc. |
| ATO citation | ATO ruling or ITAA section (fitness transactions only) |
| Flags | `occupation_dependent`, `method_required`, `percentage_required`, `needs_review` |
| Disclaimer | Fitness-specific notice about occupation dependence |

### Needs Review tab

These aren't write-offs — they're **possible deductions** that need more context:
- **Fitness** — occupation-dependent
- **Phone/internet** — work-use percentage
- **WFH** — ATO calculation method
- **Travel** — logbook or diary

Many are legitimate deductions. Take them to your tax agent.

### Audit Trail tab

Per-transaction record of every decision: normalisation output, exclusion rules tested, classification rules evaluated, final result. Compliance and debugging.

---

## Repository layout

### Backend (`/backend`) — Python 3.11 + FastAPI

```
backend/
├── main.py                   # FastAPI app, CORS, middleware, lifespan
├── api/endpoints.py          # POST /api/upload, GET /api/jobs/{id}, downloads
├── config/
│   ├── rules.json            # Classification rules (R001–R014)
│   └── ato_fitness_knowledge.json  # 17 ATO fitness knowledge chunks
├── models/schemas.py         # Pydantic: NormalisedTransaction, ClassifiedTransaction, …
├── processing/
│   ├── pipeline.py           # Parse → exclude → classify → RAG → report
│   ├── csv_parser.py         # Column-detection CSV parser
│   ├── pdf_parser.py         # pdfplumber + PyPDF2 dual-engine
│   ├── classification_engine.py
│   ├── exclusion_engine.py
│   ├── rules_engine.py
│   ├── fuzzy_matcher.py      # Merchant canonicalisation (rapidfuzz)
│   ├── report_generator.py   # PDF (ReportLab), CSV, JSON
│   ├── audit_trail.py
│   └── redaction_service.py  # BSB, account, card numbers stripped
├── rag/
│   ├── knowledge_base.py     # ATOKnowledgeBase: TF-IDF + keyword scoring
│   ├── rag_engine.py         # retrieve → grounding → Claude → composite
│   └── llm_classifier.py     # Merge RAG result into ClassifiedTransaction
├── storage/
│   ├── database.py           # SQLite schema
│   └── storage_service.py    # Ephemeral vs. persistent abstraction
├── middleware/security.py    # Rate limiting, API key, security headers
└── tests/                    # 300+ tests across ~35 files
```

### Frontend (`/frontend`) — React 18 + TypeScript + Vite

```
frontend/src/
├── pages/
│   ├── Landing.tsx
│   ├── Upload.tsx
│   ├── Report.tsx            # Summary + tabs (Deductible/Review/Excluded/Audit)
│   ├── Rules.tsx
│   └── Privacy.tsx
├── components/
│   ├── Navigation.tsx
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Chip.tsx
│   ├── Drawer.tsx
│   ├── AnimatedSection.tsx   # Scroll-triggered reveal (reduced-motion aware)
│   └── Icon.tsx
├── api/
│   ├── client.ts             # Axios + APIError
│   └── hooks.ts              # React Query hooks
├── styles/design-system.css  # Playfair Display + Space Mono + DM Sans
└── hooks/useParallax.ts
```

### Data flow — request to response

```
Browser                FastAPI                         Anthropic API
  │                       │                                │
  │  POST /api/upload     │                                │
  │  multipart/form-data  │                                │
  ├──────────────────────▶│                                │
  │                       │ 1. Validate                    │
  │                       │ 2. Parse CSV or PDF            │
  │                       │ 3. Normalise                   │
  │                       │ 4. Exclusion                   │
  │                       │ 5. Classify (rule-based)       │
  │                       │ 6. Fitness only:               │
  │                       │    Redact PII                  │
  │                       │    TF-IDF retrieve chunks      │
  │                       │    ───────────────────────────▶│
  │                       │    Claude JSON response        │
  │                       │    ◀───────────────────────────│
  │                       │    Composite score             │
  │                       │ 7. Generate report             │
  │                       │ 8. Redact output               │
  │  UploadResponse       │                                │
  │◀──────────────────────│                                │
  │  Navigate /report/:id │                                │
```
