# Deductly — Australian Tax Deduction Analyser

A privacy-first web application that parses Australian bank statements (CSV and PDF) and produces ATO-grounded deduction candidate reports. Upload your bank statement and receive an itemised analysis of potential work-related deductions — with composite confidence scores, evidence checklists, ATO citations, and a full audit trail.

> **Disclaimer:** Deductly provides indicative analysis only and does not constitute tax advice. Always verify all classifications with a registered tax agent or the ATO before lodging any claim.

---

## Table of Contents

1. [What Deductly Does](#what-deductly-does)
2. [User Journey](#user-journey)
3. [How the Pipeline Works](#how-the-pipeline-works)
   - [Step 1 — File Validation](#step-1--file-validation)
   - [Step 2 — Parsing](#step-2--parsing-csv--pdf)
   - [Step 3 — Normalisation](#step-3--normalisation)
   - [Step 4 — Exclusion](#step-4--exclusion)
   - [Step 5 — Rule-Based Classification](#step-5--rule-based-classification)
   - [Step 6 — RAG Pipeline (Fitness Only)](#step-6--rag-pipeline-fitness-transactions-only)
   - [Step 7 — Report Generation](#step-7--report-generation)
4. [Reading Your Report](#reading-your-report)
5. [Confidence Scores Explained](#confidence-scores-explained)
6. [Deduction Categories](#deduction-categories)
7. [The RAG Pipeline In Depth](#the-rag-pipeline-in-depth)
8. [Supported Bank Statements](#supported-bank-statements)
9. [Architecture](#architecture)
10. [Quick Start](#quick-start)
11. [API Reference](#api-reference)
12. [Configuration](#configuration)
13. [Testing](#testing)
14. [Privacy & Security](#privacy--security)
15. [Deployment](#deployment)

---

## What Deductly Does

You upload a bank statement. Deductly parses every transaction, filters out non-deductible items (transfers, ATM withdrawals, loan repayments, salary credits), then runs each remaining transaction through a rules engine that maps it to an ATO deduction category and assigns a confidence score.

For fitness-related transactions — where deductibility is occupation-dependent and cannot be determined by keywords alone — a second layer runs: a RAG pipeline retrieves the most relevant ATO guidance chunks from a fitness knowledge base, scores how strongly that guidance supports a deduction, then calls Claude AI with both the (redacted) transaction and the retrieved ATO context to produce an occupation-aware reasoning result.

The final report groups transactions into three buckets: **Likely Deductible**, **Needs Review**, and **Excluded**. For each transaction you see the category, confidence, evidence you need to keep, and (for fitness) the ATO reference that informed the classification.

All processing happens in memory. Nothing is written to disk or retained after the response is sent.

---

## User Journey

### 1. Land on the homepage

The landing page explains how the tool works and lists the deduction categories it can find. Click **Analyse My Statement** to proceed.

### 2. Upload your bank statement

Drag and drop (or click to browse) your CSV or PDF bank statement. The file is validated immediately in the browser:
- Must be `.csv` or `.pdf`
- Must be under 10 MB

Once you click **Start Analysis**, the file is sent to the backend. A progress bar appears while processing runs.

### 3. Your report appears

Processing is synchronous — most statements complete in under a few seconds. The report page opens automatically with four tabs:

| Tab | Contents |
|---|---|
| **Likely Deductible** | Transactions with confidence ≥ 0.60 and no ambiguity flags |
| **Needs Review** | Low-confidence or occupation-dependent transactions — possible deductions, consult a tax agent |
| **Excluded** | Transactions filtered out before classification (transfers, ATM, salary, etc.) |
| **Audit Trail** | Complete per-transaction record of every decision made by the pipeline |

### 4. Review each transaction

Click any transaction row to open the detail panel. It shows:
- Full cleaned description and extracted merchant name
- Category with confidence badge
- Evidence you need to keep (receipt, invoice, logbook, etc.)
- Why the system reached this classification
- For fitness transactions: ATO reference, conditions to satisfy, disclaimer

### 5. Download your report

Three formats are available:
- **PDF** — formatted report suitable for handing to your tax agent
- **CSV** — flat spreadsheet for your own records
- **JSON** — complete audit trail for compliance or debugging

---

## How the Pipeline Works

Every uploaded file passes through seven sequential steps. Here is exactly what happens at each stage.

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

---

### Step 1 — File Validation

Before any parsing begins, the backend validates:
- **Extension:** must be `.csv` or `.pdf`
- **MIME type:** checked independently of the extension
- **Size:** must not exceed `MAX_UPLOAD_SIZE_MB` (default 10 MB)

If validation fails, a structured error is returned immediately with an `error_code` and human-readable `message`. No parsing is attempted on invalid files.

---

### Step 2 — Parsing (CSV & PDF)

#### CSV Parser

The CSV parser does **not** contain bank-specific logic. It auto-detects the column layout by matching header names against known patterns:

| Column | Accepted header names |
|---|---|
| Date | `date`, `transaction date`, `trans date`, `posting date`, `value date` |
| Description | `description`, `details`, `narrative`, `transaction details`, `merchant`, `payee`, `memo` |
| Amount (single) | `amount`, `value`, `transaction amount` |
| Debit (split) | `debit`, `debit amount`, `withdrawal`, `withdrawals`, `money out` |
| Credit (split) | `credit`, `credit amount`, `deposit`, `deposits`, `money in` |

This means any Australian bank CSV that uses recognisable column names will work, including banks not explicitly listed in this document.

Amount parsing handles all common formats: `$89.95`, `89.95`, `-89.95`, `(89.95)`, `89,950.00`.

**Date formats supported:**

| Format | Example | Used by |
|---|---|---|
| `DD/MM/YYYY` | `15/01/2024` | CommBank, ANZ, Westpac, ING, most |
| `DD-MM-YYYY` | `15-01-2024` | Some older exports |
| `YYYY-MM-DD` | `2024-01-15` | ISO format, digital banks |
| `DD/MM/YY` | `15/01/24` | Shortened year |
| `DD Mon YYYY` | `15 Jan 2024` | Some formatted exports |
| `DD Mon YY` | `23 Oct 25` | NAB online banking |
| `DD Month YYYY` | `15 January 2024` | Full month name variant |

#### PDF Parser

PDFs are parsed with a two-engine strategy:
1. **pdfplumber** (primary) — extracts tables and text with high fidelity on machine-generated PDFs
2. **PyPDF2** (fallback) — raw text extraction when pdfplumber cannot identify the layout

The parser uses a **state machine** driven by date pattern detection. When it finds a date-like string at the start of a line, it starts a new transaction. Subsequent lines (without a leading date) are accumulated as continuation of the description. The amount is extracted from the accumulated text using a regex pattern.

Direction (debit vs credit) is inferred from credit keywords in the description (SALARY, WAGES, DEPOSIT, REFUND, etc.). Transactions without a credit keyword default to debit.

PDF parsing is inherently less reliable than CSV. If results are unexpected, download the same period as a CSV.

---

### Step 3 — Normalisation

Every raw transaction is normalised into a consistent `NormalisedTransaction` structure:

**Merchant extraction:** The raw description often contains noise — payment rail prefixes, reference numbers, card suffixes. These are stripped in order:
1. Remove common prefixes: `PAYPAL *`, `VISA`, `MASTERCARD`, `EFTPOS`, `CARD`, `DEBIT CARD`
2. Remove reference numbers: `REF:ABC123`, `#TXN84732`, `*1234` (last-four card digits)
3. Collapse multiple spaces; title-case the result

**Payment rail detection:** Identifies how the payment was made: `paypal`, `osko`, `payid`, `bpay`, card types, `eftpos`, `direct_debit`. This is recorded in the audit trail.

**Recurring flag:** Transactions are grouped by merchant (case-insensitive). Inter-transaction intervals are calculated. If 70%+ of intervals fall within a tolerance window, the transaction is flagged as recurring:
- Weekly: ~7 days ± 3 days
- Monthly: ~30 days ± 7 days
- Yearly: ~365 days ± 30 days

**Income year detection:** The system scans all transaction dates and determines the Australian income year (`YYYY-YYYY`, ending 30 June) automatically. If you pass `income_year` explicitly, that value is used instead.

---

### Step 4 — Exclusion

Before classification runs, transactions that are structurally non-deductible are removed. The exclusion engine applies regex-based patterns to the description:

| Exclusion reason | Detected patterns |
|---|---|
| **Transfer between accounts** | OSKO, PAYID, BPAY, TRANSFER TO/FROM, ACCOUNT TRANSFER, INTERNAL TRANSFER |
| **Cash withdrawal** | ATM WITHDRAWAL, ATM, CASH OUT, EFTPOS CASH, WITHDRAWAL ATM |
| **Loan repayment** | MORTGAGE, HOME LOAN, CAR LOAN, PERSONAL LOAN, LOAN REPAYMENT, LOAN INSTALMENT |
| **Tax payment** | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE, TAX OFFICE, TAX PAYMENT, TAX REFUND |
| **Superannuation** | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER, HESTA, REST SUPER |
| **Salary / income credit** | SALARY, WAGES, PAYROLL, PAY FROM (credit-direction transactions only) |

Excluded transactions are saved separately and shown in the **Excluded** tab of the report. The exclusion reason and explanation are recorded in the audit trail.

> The exclusion engine applies direction context: salary keywords only exclude credits. Debit transactions with those keywords (e.g., an employer that also happens to say "ATO" in the reference) are not excluded.

---

### Step 5 — Rule-Based Classification

Every non-excluded transaction is evaluated against the classification rules in `backend/config/rules.json`. Rules are sorted by **priority** (highest first); the first matching rule wins.

**Matching logic:**
1. **Keyword match** — case-insensitive substring check of the transaction description and merchant against the rule's `keywords` list
2. **Fuzzy merchant match** — the extracted merchant is compared against the rule's `merchants` list using `rapidfuzz` string similarity; a match above the threshold scores as a hit

When a rule matches:
- The transaction receives the rule's `category` and `confidence`
- The `evidence_checklist` from the rule is attached (receipt, invoice, logbook, diary, etc.)
- Additional `flags` are added based on category:
  - `needs_review` — confidence below threshold
  - `method_required` — WFH and travel categories require a specific ATO calculation method
  - `percentage_required` — phone/internet require a work-use percentage
  - `eligibility_check` — donations require DGR status verification
  - `rag_required` — fitness rules set this to trigger the RAG pipeline

Fitness rules (R011–R014) intentionally set **low base confidence** (0.15–0.20) and set the `rag_required` flag. This signals that rule-based matching alone is not sufficient — the RAG pipeline must run to produce a meaningful confidence score.

---

### Step 6 — RAG Pipeline (Fitness Transactions Only)

The RAG (Retrieval-Augmented Generation) pipeline runs **only** on transactions flagged `rag_required`. All other categories are fully handled by the rule-based engine and skip this step entirely.

**Why RAG for fitness specifically?**

Most ATO deduction categories are deterministic. A subscription to GitHub for a software developer is deductible — full stop. But fitness expenses are occupation-dependent in a way that keyword rules cannot capture:

- The same gym membership is **deductible** for a police officer required to maintain fitness standards (ATO ID 2007/182)
- It is **deductible** for a fitness instructor who must demonstrate exercises to clients
- It is **not deductible** for a software developer who goes to the gym for general health

A static rule cannot know your occupation. The RAG pipeline retrieves the specific ATO guidance that applies to this type of transaction and passes it — along with the transaction — to Claude, enabling occupation-aware nuanced reasoning.

The full RAG pipeline is detailed in [The RAG Pipeline In Depth](#the-rag-pipeline-in-depth).

---

### Step 7 — Report Generation

After all transactions are classified, the pipeline assembles the report:

**Bucketing:**

| Bucket | Condition |
|---|---|
| **Likely Deductible** | Confidence ≥ 0.60 AND no `needs_review` flag |
| **Needs Review** | Confidence < 0.60, or `needs_review` / `occupation_dependent` flag |
| **Excluded** | Matched an exclusion rule before classification |

**Summary statistics:**
- Total deductible amount, total needs-review amount, total excluded amount
- Category breakdown (e.g., `work_software: $549.00, professional_memberships: $549.00`)
- Confidence distribution: count of high (≥ 0.80), medium (0.60–0.79), low (< 0.60)

**Output formats:**
- **PDF** — ReportLab-generated formatted report
- **CSV** — flat transaction export with headers
- **JSON** — complete audit trail including every normalisation, exclusion check, and classification attempt for every transaction

**Redaction:** Before reports are serialised or sent to the browser, the `RedactionService` strips BSB codes, account numbers, and card numbers from all description fields.

---

## Reading Your Report

### Summary panel

The top of the report page shows three headline figures:

- **Likely Deductible** — the amount you could claim if you have the required evidence
- **Needs Review** — the amount that might be claimable depending on your occupation or circumstances
- **Excluded** — the total excluded as non-deductible (for reference only)

Below that is a category breakdown and a confidence distribution — useful for quickly seeing whether the report is dominated by clear-cut deductions or uncertain ones.

### Transaction rows

Each transaction row shows:
- **Date** and cleaned **merchant name**
- **Amount**
- **Category badge** — the deduction category (work software, travel, etc.)
- **Confidence chip** — percentage + colour-coded level (green ≥ 80%, amber 60–79%, red < 60%)

Click any row to open the detail panel:

| Field | What it means |
|---|---|
| **Category** | The ATO deduction category assigned |
| **Confidence** | How confident the system is that this is deductible (see [Confidence Scores](#confidence-scores-explained)) |
| **Reason** | Why the system made this classification — the matched keyword or rule ID, plus RAG score breakdown for fitness transactions |
| **Evidence required** | What you need to keep to support a claim — receipt, invoice, logbook, diary, employer letter, etc. |
| **ATO citation** | The ATO ruling or ITAA section that applies (fitness transactions only) |
| **Flags** | `occupation_dependent`, `method_required`, `percentage_required`, `needs_review` |
| **Disclaimer** | Fitness-specific notice that deductibility depends on your occupation |

### Needs Review tab

Transactions here are not write-offs — they are **possible deductions** that require more context than the system has access to. Common reasons a transaction lands here:

- **Fitness transactions** — deductibility depends on your occupation (the system does not know your occupation)
- **Phone/internet** — requires a work-use percentage only you can calculate
- **WFH expenses** — require a specific ATO calculation method
- **Travel** — requires a logbook or diary

Take the **Needs Review** list to your tax agent. For many users these represent legitimate deductions.

### Audit Trail tab

The audit trail JSON shows every decision for every transaction: what the normaliser extracted, which exclusion rules were tested, which classification rules were evaluated, and the final result. This is primarily a compliance and debugging tool.

---

## Confidence Scores Explained

### Rule-Based (non-fitness categories)

Each rule in `rules.json` carries a **base confidence** reflecting how reliably that rule identifies a deductible expense:

| Confidence | Meaning | Examples |
|---|---|---|
| 0.90–0.95 | Near-certain — deterministic ATO rules apply | Adobe Creative Cloud, CPA membership |
| 0.80–0.89 | Very likely — minor ambiguity possible | Udemy course, Apple Store hardware |
| 0.70–0.79 | Likely — requires evidence or usage split | Uber (logbook), Telstra (% work use) |
| 0.60–0.69 | Conditional — method or eligibility required | WFH internet, bank fees |
| < 0.60 | Uncertain — flagged Needs Review | Generic equipment, borderline merchants |

### RAG-Composite (fitness transactions)

Fitness transactions have a three-part composite score:

```
Final = keyword_score (0–30)
      + rag_grounding_score (0–40)
      + claude_score (0–30)
      ────────────────────────────
      Max 100  →  divide by 100  →  0.0 – 1.0
```

| Component | Max | What it measures |
|---|---|---|
| **Keyword score** | 30 | Specificity of the fitness keyword match — multi-word phrases score higher than single words |
| **RAG grounding** | 40 | Ratio of retrieved ATO chunks that say `deductible: true` vs `deductible: false` |
| **Claude score** | 30 | Claude's confidence (0–100) linearly scaled to 0–30 |

A gym membership for a general employee typically scores around 0.20–0.30 (mostly Needs Review). The same transaction for a listed fitness-related occupation can score 0.70–0.85 (Likely Deductible).

---

## Deduction Categories

### Work-Related (Rule-Based Engine — no AI call)

| Category | Rule | Confidence | What it captures |
|---|---|---|---|
| **Work Software & Subscriptions** | R001 | 0.95 | Adobe, Microsoft 365, GitHub, JetBrains, Atlassian, Canva, Xero, MYOB |
| **Professional Memberships** | R002 | 0.90 | CPA Australia, Law Society, AMA, Engineers Australia, industry associations |
| **Self-Education & Training** | R003 | 0.85 | Udemy, Coursera, TAFE, conference registrations, textbooks, online courses |
| **Work Equipment & Technology** | R004 | 0.80 | JB Hi-Fi, Apple Store, Officeworks, hardware, peripherals, stationery |
| **Phone & Internet** | R005 | 0.70 | Telstra, Optus, TPG, Aussie Broadband — work-use percentage required |
| **Working From Home** | R006 | 0.65 | Home internet, electricity contributions — ATO-approved WFH method required |
| **Work-Related Travel** | R007 | 0.75 | Uber, Qantas, Virgin, Transurban — logbook required for vehicles |
| **Donations to DGR** | R008 | 0.85 | Registered charities with Deductible Gift Recipient status |
| **Bank Fees** | R009 | 0.70 | Account-keeping fees on income-earning accounts |

### Fitness-Related (Rule-Based + RAG)

These rules match at low base confidence and trigger the RAG pipeline. The composite RAG score replaces the base confidence.

| Rule | Subcategory | Base confidence | Note |
|---|---|---|---|
| R011 | Gym memberships & fitness centres | 0.20 | Almost always occupation-dependent |
| R012 | Personal training & coaching | 0.18 | Deductible for fitness instructors, police, military |
| R013 | Supplements & nutrition | 0.15 | Rarely deductible; professional athletes only |
| R014 | Fitness equipment & activewear | 0.15 | Deductible for fitness professionals |

### Exclusion Rules (removed before classification)

| Rule | Pattern examples |
|---|---|
| Transfers | OSKO, PAYID, BPAY, TRANSFER TO/FROM |
| Cash | ATM, ATM WITHDRAWAL, CASH OUT, EFTPOS CASH |
| Loans | MORTGAGE, HOME LOAN, CAR LOAN, LOAN REPAYMENT |
| Tax | ATO PAYMENT, AUSTRALIAN TAXATION OFFICE, TAX PAYMENT |
| Superannuation | SUPERANNUATION, HOSTPLUS, AUSTRALIAN SUPER, HESTA |
| Salary | SALARY, WAGES, PAYROLL (credit transactions only) |

---

## The RAG Pipeline In Depth

### How fitness transactions are detected

Before RAG runs, `ATOKnowledgeBase.is_fitness_related()` tests the description and merchant against **11 keyword groups**:

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

A match in **any** keyword group triggers RAG.

### Step-by-step RAG process

```
Transaction (description, merchant, amount)
        │
        ▼  PII redacted — BSB codes, account numbers, card numbers stripped
        │  before any data leaves the backend
        │
        ▼  STEP 1 — Keyword Score (0–30)
┌───────────────────────────────────────────────────────────────┐
│  Score each keyword group by match specificity:               │
│    Multi-word phrases score higher than single words          │
│    "personal trainer" (2 words) > "gym" (1 word)             │
│                                                               │
│  Aggregate across all 11 groups                               │
│  Normalise to [0.0, 0.30], capped at 0.30                    │
│  Rescale → integer 0–30                                       │
└───────────────────────────────────────────────────────────────┘
        │  keyword_score ∈ [0, 30]
        ▼
        ▼  STEP 2 — Retrieve ATO Context (top-5 chunks)
┌───────────────────────────────────────────────────────────────┐
│  ATOKnowledgeBase.retrieve(query, k=5)                        │
│                                                               │
│  Pure TF-IDF — no machine learning, no embeddings:           │
│    Tokenise query → lowercase, remove punctuation            │
│    Score each of the 17 ATO chunks:                          │
│      Σ IDF(term) for terms appearing in both query and chunk  │
│      IDF = log((total_chunks + 1) / (chunks_with_term + 1)) + 1
│      Bonus: +2.0 for each term in the chunk's keyword list   │
│    Return top-5 chunks sorted by score                       │
│                                                               │
│  Knowledge base: 17 ATO chunks (v2025-2026)                  │
│    gym memberships · personal training · supplements          │
│    equipment · activewear · fitness professionals            │
│    professional athletes · police/military fitness           │
│    sports associations · fitness apps · sports medicine      │
│    first aid & CPR · fitness certifications                  │
│                                                               │
│  Each chunk contains:                                        │
│    ato_reference · deductible (bool) · occupation_dependent  │
│    who_can_claim · who_cannot_claim · evidence_required      │
└───────────────────────────────────────────────────────────────┘
        │  chunks: List[Dict] (top-5 most relevant)
        ▼
        ▼  STEP 3 — RAG Grounding Score (0–40)
┌───────────────────────────────────────────────────────────────┐
│  Measures how strongly the retrieved ATO guidance             │
│  supports (or refutes) a deduction claim.                     │
│                                                               │
│  support = chunks where deductible=True                       │
│  against = chunks where deductible=False                      │
│                                                               │
│  score = (support / total × 40) − (against / total × 10)     │
│  Bounded to [0, 40]                                           │
│                                                               │
│  Examples:                                                    │
│    All 5 say deductible:   (5/5×40) − (0/5×10) = 40          │
│    2 yes, 3 no:            (2/5×40) − (3/5×10) = 10          │
│    All 5 say not deduct:   (0/5×40) − (5/5×10) = 0           │
│                                                               │
│  If retrieved ATO guidance says "not deductible",             │
│  grounding score is suppressed even if keywords matched.      │
└───────────────────────────────────────────────────────────────┘
        │  rag_grounding ∈ [0, 40]
        ▼
        ▼  STEP 4 — Claude Haiku Reasoning (0–30)
┌───────────────────────────────────────────────────────────────┐
│  Model: claude-haiku-4-5-20251001  (fast, cost-efficient)     │
│  Max tokens: 512                                              │
│                                                               │
│  System prompt persona: Expert Australian tax accountant      │
│    Conservative bias — most fitness expenses are private.     │
│                                                               │
│  User message contains:                                       │
│    Redacted transaction (description, merchant, amount)       │
│    Top-5 retrieved ATO chunks (each truncated at 600 chars)   │
│                                                               │
│  Claude returns strict JSON:                                  │
│    is_fitness_related        bool                             │
│    is_potentially_deductible bool                             │
│    occupation_dependent      bool                             │
│    category                  string (fitness_gym | fitness_pt │
│                              | supplements | equipment |      │
│                              | activewear | non_deductible)   │
│    confidence                integer 0–100                    │
│    reason                    1–2 sentences citing ATO rules   │
│    ato_citation               e.g. "ATO ID 2007/182; s8-1"   │
│    conditions                list[string]                     │
│    evidence_required         list[string]                     │
│    disclaimer                string                           │
│                                                               │
│  claude_score = int((confidence / 100) × 30)  →  0–30        │
└───────────────────────────────────────────────────────────────┘
        │  claude_score ∈ [0, 30]
        ▼
        ▼  STEP 5 — Composite Score
┌───────────────────────────────────────────────────────────────┐
│  composite = min(keyword + grounding + claude, 100)           │
│  confidence_float = composite / 100   →  0.0 – 1.0           │
│                                                               │
│  Score breakdown surfaced in report reason field:             │
│    "[RAG] reason | ATO: citation                              │
│     | Score: keyword=X/30 grounding=Y/40 claude=Z/30"        │
│                                                               │
│  Examples:                                                    │
│    keyword=20 + grounding=30 + claude=25 = 75 → 0.75         │
│    keyword=10 + grounding=40 + claude=30 = 80 → 0.80         │
│    keyword=30 + grounding=40 + claude=30 = 100 → 1.00        │
└───────────────────────────────────────────────────────────────┘
```

### Worked example: fitness transaction through the full pipeline

```
Input:  Description = "ANYTIME FITNESS MEMBERSHIP  REF:TXN-84732"
        Amount      = AUD $79.95 (debit)
        Date        = 15/01/2025
```

**Step 1 — Normalise**
- Date parsed as `2025-01-15`
- `REF:TXN-84732` stripped during redaction
- Merchant extracted: `"Anytime Fitness"`
- Direction: debit

**Step 2 — Exclusion check**
- No exclusion pattern match (not ATM, not BPAY, not salary)
- Transaction proceeds to classification

**Step 3 — Rule-based classification**
- Rule R011 (`fitness_related`, priority 50) matches keyword `"anytime fitness"`
- Assigned `confidence = 0.20`, flags: `["needs_review", "occupation_dependent", "rag_required"]`

**Step 4 — RAG triggered** (flag `rag_required` is set)
- Keyword score: "anytime fitness" → ~12/30
- TF-IDF retrieves top-5 chunks including `gym_general` (`deductible: false`) and `police_military_fitness` (`deductible: true`)
- Grounding score: 1 deductible / 5 total → (1/5 × 40) − (4/5 × 10) = **0**
- Claude receives redacted transaction + 5 ATO chunks; returns confidence 30/100 → claude_score = 9
- Composite: 12 + 0 + 9 = **21** → confidence = **0.21**

**Step 5 — Finalised**
- Confidence 0.21 < 0.60 → **Needs Review**
- Evidence: `["receipt", "employer fitness requirement letter", "diary"]`
- ATO citation: `"ATO ID 2007/182; Section 8-1 ITAA 1997"`

> The same transaction for a "fitness instructor" occupation would retrieve `fitness_professionals` (`deductible: true`) chunks, raising the grounding score to ~30–40, and Claude would return a higher confidence — likely producing a composite of 0.70–0.80.

### Graceful degradation (no API key)

If `ANTHROPIC_API_KEY` is not set or the `anthropic` package is unavailable:
- Steps 2–4 (retrieval, grounding, Claude) are skipped
- Fitness transactions receive `confidence = keyword_score` only (max 0.30)
- `is_potentially_deductible` defaults to `False` (conservative)
- The reason field explicitly notes RAG is unavailable

Rule-based classification still runs on all transactions regardless. Only fitness transactions lose the Claude reasoning component.

### After RAG: merging back into the transaction

`LLMClassifier.enhance()` merges the RAG result into the `ClassifiedTransaction`:

| Condition | Behaviour |
|---|---|
| Not fitness-related | Pass through unchanged |
| RAG confidence > existing confidence | Adopt RAG composite confidence |
| RAG confidence ≤ existing confidence | Keep original confidence |
| Always | Append RAG reason, ATO citation, score breakdown to reason field |
| Always | Merge RAG evidence requirements into checklist (deduped) |
| Always | Add `rag_analysed` flag |
| `occupation_dependent = true` | Add `occupation_dependent` flag |
| `is_potentially_deductible = false` | Add `needs_review` flag |

---

## Supported Bank Statements

### CSV — How format detection works

The CSV parser uses column-name pattern matching, not bank-specific logic. Any CSV with recognisable column names for date, description, and amount will parse correctly — including banks not listed below.

### Verified Australian banks — CSV export instructions

#### Commonwealth Bank (CommBank)

**Columns:** `Date, Description, Amount` (negative = debit)

1. Log in → **Accounts** → select account
2. Click **Export** (top right of transaction list)
3. Choose date range → select **CSV**
4. Download and upload directly

---

#### NAB (National Australia Bank)

**Columns:** `Date, Amount, Type, Description` — uses `DD Mon YY` dates (e.g. `23 Oct 25`)

1. Log in → **Accounts** → select account
2. Click **Download transactions** → choose date range
3. Select **CSV** → Download
4. Upload directly — NAB's date format is handled automatically

---

#### Westpac

**Columns:** `Date, Narrative, Debit Amount, Credit Amount, Balance` — separate debit/credit columns

1. Log in → **Accounts** → select account
2. Click **Search & export** tab
3. Choose date range → **Comma Separated Values (.csv)**
4. Download and upload directly

---

#### ANZ

**Columns:** `Date, Amount, Description` (negative = debit)

1. Log in → **Accounts** → select account
2. Click **Export** → choose date range → **CSV**
3. Upload directly

---

#### ING

**Columns:** `Date, Description, Credit, Debit` — separate credit/debit columns

1. Log in → **My accounts** → select account
2. Click the **download** icon → choose date range
3. Select **CSV** → Download and upload directly

---

#### Bendigo Bank

**Columns:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → **Transaction History**
2. Click **Export** → choose date range → **CSV**

---

#### Macquarie Bank

**Columns:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → select account → **Transactions**
2. Click **Export** → date range → **CSV**

---

#### Bank of Queensland (BOQ)

**Columns:** `Date, Description, Debit, Credit`

1. Log in → **Accounts** → select account
2. **Export / Download** → date range → **CSV**

---

#### Suncorp

**Columns:** `Date, Description, Amount`

1. Log in → **Accounts** → select account → **Transaction history**
2. Click **Export** → date range → **CSV**

---

#### St. George / Bank of Melbourne / BankSA (Westpac Group)

Same format as Westpac — `Date, Narrative, Debit Amount, Credit Amount`

1. Log in → **Accounts** → select account
2. **Search & export** → date range → **CSV**

---

#### BankWest (now part of Commonwealth Bank)

**Columns:** `Date, Narrative, Debit, Credit`

1. Log in → **Accounts** → select account
2. Click **Download** icon → date range → **CSV**

---

#### Up Bank / Ubank / 86 400 (digital banks)

Most digital banks export ISO dates (`YYYY-MM-DD`) with standard `Description, Amount` columns — supported automatically.

---

### PDF bank statements

PDF support uses pdfplumber (primary) with PyPDF2 as fallback. Machine-generated PDFs (downloaded from internet banking) parse much more reliably than scanned images or print-to-PDF documents.

**Tips for better PDF results:**
- Use the bank's **Download statement** option, not Print to PDF
- Statements with clear tabular formatting parse best
- If PDF parsing returns unexpected results, download the same period as a CSV — CSV is always more reliable

### Preparing your statement — common gotchas

| Issue | What to do |
|---|---|
| Date range too short | Export at least 3 months; 12 months ideal for a full income year |
| Multiple accounts | Export each account separately and upload one at a time |
| Foreign currency | Include them — amounts are left as-is; no FX conversion is performed |
| Excel `.xlsx` format | Save as CSV first (File → Save As → CSV in Excel or Google Sheets) |
| Opening balance row | The exclusion engine will filter it out automatically |
| File won't upload | Check it is under 10 MB and has a `.csv` or `.pdf` extension |

---

## Architecture

### Backend (`/backend`) — Python 3.11 + FastAPI

```
backend/
├── main.py                    # FastAPI app, CORS, middleware, lifespan
├── api/
│   └── endpoints.py           # POST /api/upload, GET /api/jobs/{id}, downloads
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
│   ├── classification_engine.py  # Rule-based classification engine
│   ├── exclusion_engine.py    # Pre-classification exclusion filter
│   ├── rules_engine.py        # Rule matching and priority evaluation
│   ├── fuzzy_matcher.py       # Merchant name canonicalisation (rapidfuzz)
│   ├── report_generator.py    # PDF (ReportLab), CSV, JSON generation
│   ├── audit_trail.py         # Per-transaction audit event recording
│   └── redaction_service.py   # BSB, account, card numbers stripped
├── rag/
│   ├── knowledge_base.py      # ATOKnowledgeBase: TF-IDF retrieval + keyword scoring
│   ├── rag_engine.py          # RAGEngine: retrieve → grounding → Claude → composite
│   └── llm_classifier.py      # Merges RAG result into ClassifiedTransaction
├── storage/
│   ├── database.py            # SQLite schema and migrations
│   └── storage_service.py     # Ephemeral vs. persistent storage abstraction
├── middleware/
│   └── security.py            # Rate limiting, API key auth, security headers
└── tests/                     # 338 tests across 35 test files
```

### Frontend (`/frontend`) — React 18 + TypeScript + Vite

```
frontend/src/
├── pages/
│   ├── Landing.tsx            # Hero, features, how-it-works, stats
│   ├── Upload.tsx             # Drag-drop upload form
│   ├── Report.tsx             # Summary, tabs (Deductible / Review / Excluded / Audit)
│   ├── Rules.tsx              # Classification rules reference
│   └── Privacy.tsx            # Privacy policy and ephemeral mode explanation
├── components/
│   ├── Navigation.tsx         # Top nav bar (Playfair Display logo, gold CTA)
│   ├── Button.tsx             # Primary (gold gradient) / secondary (glass) / tertiary
│   ├── Card.tsx               # Glass-morphism card container
│   ├── Chip.tsx               # Category badge / confidence chip with gold bar
│   ├── Drawer.tsx             # Transaction detail side panel
│   ├── AnimatedSection.tsx    # Scroll-triggered reveal (framer-motion, reduced-motion aware)
│   └── Icon.tsx               # Lucide icon wrapper
├── api/
│   ├── client.ts              # Axios client + APIError class
│   └── hooks.ts               # React Query hooks (useUploadCSV, useJobStatus)
├── styles/
│   └── design-system.css      # Google Fonts: Playfair Display + Space Mono + DM Sans
└── hooks/
    └── useParallax.ts         # Framer Motion parallax scroll hook
```

### Data flow — request to response

```
Browser                    FastAPI                    Anthropic API
  │                           │                            │
  │  POST /api/upload          │                            │
  │  multipart/form-data       │                            │
  ├──────────────────────────>│                            │
  │                           │                            │
  │                    ┌──────┴──────────────────────┐     │
  │                    │  1. Validate file            │     │
  │                    │  2. Parse CSV or PDF         │     │
  │                    │  3. Normalise transactions   │     │
  │                    │  4. Apply exclusion rules    │     │
  │                    │  5. Classify (rule-based)    │     │
  │                    │  6. Fitness txns only:       │     │
  │                    │     Redact PII               │     │
  │                    │     TF-IDF retrieve chunks   │     │
  │                    │     ────────────────────────>│     │
  │                    │     Claude JSON response     │     │
  │                    │     <────────────────────────│     │
  │                    │     Merge composite score    │     │
  │                    │  7. Generate report          │     │
  │                    │  8. Redact output            │     │
  │                    └──────┬──────────────────────┘      │
  │                           │                            │
  │  UploadResponse           │                            │
  │  (job_id, report_data)    │                            │
  │<──────────────────────────│                            │
  │                           │                            │
  │  Navigate to /report/:id  │                            │
  │  Display report tabs      │                            │
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Anthropic API key — enables RAG-powered fitness classification; the system degrades gracefully without it

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY
# Set ANTHROPIC_API_KEY to enable RAG (optional)

# Run tests
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

# Run tests
npx vitest run

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment variables

**Backend `.env`:**
```env
# Anthropic — enables RAG fitness classification
ANTHROPIC_API_KEY=sk-ant-...

# Security (required)
SECRET_KEY=your-randomly-generated-secret-key-32-chars-minimum
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Upload limits
MAX_UPLOAD_SIZE_MB=10
RATE_LIMIT_PER_MINUTE=10

# Privacy — leave as true (disabling stores raw transaction data to disk)
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

Upload a bank statement for analysis.

**Request:** `multipart/form-data`

| Field | Type | Default | Description |
|---|---|---|---|
| `file` | File | required | CSV or PDF bank statement, max 10 MB |
| `income_year` | string | auto-detected | e.g. `"2025-2026"` — detected from transaction dates if omitted |
| `ephemeral_mode` | bool | `true` | Process in-memory only; all data discarded after response |
| `confidence_threshold` | float | `0.60` | Minimum confidence for the Likely Deductible bucket |
| `use_rag` | bool | `true` | Enable RAG pipeline for fitness transactions (requires API key) |

**Response `200`:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Processing complete",
  "report_data": {
    "income_year": "2025-2026",
    "generated_at": "2026-03-28T14:23:01Z",
    "rag_enabled": true,
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
    "candidates": [ /* ClassifiedTransaction[] — Likely Deductible */ ],
    "needs_review": [ /* ClassifiedTransaction[] — Needs Review */ ],
    "excluded": [ /* ExcludedTransaction[] */ ]
  }
}
```

**ClassifiedTransaction shape:**
```json
{
  "id": "txn-uuid",
  "date": "2025-01-15",
  "description": "Adobe Creative Cloud Annual",
  "merchant": "Adobe",
  "amount": "89.99",
  "category": "work_software",
  "confidence": 0.95,
  "confidence_pct": 95,
  "reason": "keyword_match: adobe | rule: R001",
  "evidence": ["receipt"],
  "flags": [],
  "matched_rule_id": "R001",
  "rag_analysed": false,
  "ato_citation": null,
  "disclaimer": null
}
```

**ExcludedTransaction shape:**
```json
{
  "id": "txn-uuid",
  "date": "2025-01-01",
  "description": "OSKO TRANSFER TO SAVINGS",
  "merchant": "Internal Transfer",
  "amount": "500.00",
  "exclusion_reason": "transfer_between_accounts",
  "explanation": "OSKO/PayID transfer between accounts — not a deductible expense"
}
```

### `GET /api/jobs/{job_id}`

Poll job status for large files processed asynchronously.

```json
{ "job_id": "550e8400-...", "status": "completed", "progress": 100 }
```

`status` values: `queued` · `processing` · `completed` · `failed`

### `GET /api/jobs/{job_id}/download/{format}`

Download a generated report. `format`: `pdf` · `csv` · `json`

### `GET /health`

Returns `{"status": "ok"}`. No authentication required.

### Error format

```json
{
  "error": "file_too_large",
  "message": "File exceeds 10 MB limit",
  "details": {}
}
```

| HTTP | Code | When |
|---|---|---|
| 400 | `invalid_file_type` | Not CSV or PDF |
| 400 | `file_too_large` | Exceeds `MAX_UPLOAD_SIZE_MB` |
| 400 | `parse_error` | Could not parse the file |
| 404 | `job_not_found` | Unknown `job_id` |
| 429 | `rate_limit_exceeded` | Too many requests |
| 500 | `processing_error` | Internal pipeline error |

---

## Configuration

### Classification rules (`backend/config/rules.json`)

Each rule defines one deduction category. The first rule (by descending priority) to match a transaction wins.

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

Fitness rules add two fields:
```json
{
  "rule_id": "R011",
  "category": "fitness_related",
  "priority": 50,
  "confidence": 0.20,
  "keywords": ["gym", "anytime fitness", "crossfit", "f45"],
  "flags": ["rag_required", "occupation_dependent"],
  "enabled": true
}
```

`priority` is evaluated in descending order. Higher numbers run first. Fitness rules have lower priority (50) so they only match transactions that were not claimed by a higher-priority category rule.

### ATO fitness knowledge base (`backend/config/ato_fitness_knowledge.json`)

17 ATO chunks covering the range of fitness expense scenarios. Each chunk's `deductible` boolean drives the RAG grounding score.

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

`deductible: false` — retrieving this chunk lowers the grounding score.
`deductible: true` (e.g. police fitness, CPR certifications) — raises the grounding score.

---

## Testing

### Backend — 338 tests

```bash
cd backend
pytest -v                               # all tests
pytest -v --cov=. --cov-report=html    # with coverage report
pytest tests/test_rag_engine.py -v     # RAG tests only
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
- Every input transaction has an audit trail entry
- BSB codes and account numbers never appear in output
- Exclusion always runs before classification
- Every candidate has a non-empty evidence checklist
- Audit trail is deterministic across runs

### Frontend — 168 tests

```bash
cd frontend
npx vitest run               # all tests
npx vitest run --coverage    # with coverage
```

Covers all 5 pages, all components, and end-to-end user journeys (upload flow, error handling, job polling, report display, download).

### Running both suites

```bash
cd backend && pytest -q && cd ../frontend && npx vitest run
```

---

## Privacy & Security

### Ephemeral mode — always on

Raw bank statement data is **never written to disk**. All processing happens in memory. When the API response is sent, the in-memory data is discarded immediately. The only persistent artefact is a minimal job record (ID, status, timestamps) — no transaction data, no amounts, no merchant names.

### What is never stored

- Account numbers or BSB codes
- Full transaction descriptions
- Raw CSV or PDF file contents
- Merchant names or amounts
- Any personally identifying information

### Redaction before AI calls

The `RedactionService` runs before any transaction description is sent to the Anthropic API:

| Pattern | What is stripped |
|---|---|
| `\d{3}-\d{3}` | BSB codes (e.g. `062-000`) |
| `\d{6,10}` | Bank account numbers |
| `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}` | Card numbers |
| `REF:\s*[A-Z0-9]{6,}` | Transaction reference numbers |
| `#[A-Z0-9]{6,}` | Hash-prefixed reference codes |

Merchant name signals and keywords are preserved so RAG analysis remains useful.

### Security controls

| Control | Detail |
|---|---|
| Rate limiting | 10 requests/minute per IP (configurable in `.env`) |
| File validation | MIME type + extension + size check before any parsing |
| CORS | Strict origin allowlist via `ALLOWED_ORIGINS` |
| Security headers | CSP, HSTS, X-Frame-Options, X-XSS-Protection, Referrer-Policy |
| Input validation | Pydantic v2 models on all API inputs |
| No analytics | Zero third-party tracking or telemetry |

---

## Deployment

### Frontend — Netlify

```bash
npm install -g netlify-cli
cd frontend && npm run build
netlify deploy --prod --dir=dist
```

Set `VITE_API_BASE_URL` to your backend URL in Netlify environment variables.

### Backend — Railway / Render / Fly.io (recommended)

All three platforms support Python/FastAPI natively with automatic HTTPS. Set environment variables in the platform dashboard.

### Backend — Docker

```bash
docker build -t deductly-backend .
docker run -p 8000:8000 --env-file .env deductly-backend
```

### Backend — AWS Lambda (serverless)

Add `handler = Mangum(app)` to `main.py` (requires the `mangum` package). Deploy via SAM or Serverless Framework.

### Production checklist

- [ ] `ANTHROPIC_API_KEY` set (enables RAG analysis for fitness transactions)
- [ ] `SECRET_KEY` is at least 32 characters and randomly generated
- [ ] `ALLOWED_ORIGINS` contains only your frontend domain
- [ ] `EPHEMERAL_MODE=true` (default — do not disable)
- [ ] HTTPS enforced (HSTS header is set automatically)
- [ ] Rate limiting enabled
- [ ] `DEBUG=false` / Swagger UI disabled in production
- [ ] `MAX_UPLOAD_SIZE_MB=10`

---

## Changelog

### v1.3.0
- Accessibility pass: skip-to-content link, `<main>` landmark, `aria-live` on upload errors, `focus-visible` focus rings
- AnimatedSection now respects `prefers-reduced-motion` — renders without animation when system setting is enabled
- Button base styles include `touch-action: manipulation` to eliminate 300ms tap delay on mobile
- Confidence bar in Chip component updated to gold gradient (was blue)
- `index.html` now preloads critical Google Fonts to prevent FOIT

### v1.2.0
- UI redesign: "Financial Ledger" aesthetic — Playfair Display + Space Mono + DM Sans, warm gold/amber palette
- Frontend test suite expanded to 168 tests; all 168 passing
- Fixed `label[for]` ↔ `input[id]` association on Upload form
- Fixed `Chip` component: use `label` prop, not children
- Fixed e2e tests: fresh `QueryClient` with `retry: false` per test

### v1.1.0
- Expanded from fitness-only to all ATO work-related deduction categories
- Added full RAG pipeline with TF-IDF retrieval, grounding scoring, Claude Haiku reasoning
- 122 RAG unit tests (knowledge base × engine × LLM classifier)

### v1.0.0
- Initial release: CSV parsing, rule-based classification, PDF/CSV/JSON reports, ephemeral mode

---

## Author

**Samuel Rath**

---

*Built with privacy and security as core principles. Not tax advice.*
