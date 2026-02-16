# Design Document

## Tax Deduction Analyzer (Australia)

## 1. Overview

The Tax Deduction Analyzer is a web-based application that processes Australian bank transaction CSV files and generates comprehensive deduction candidate reports. The system consists of a Python FastAPI backend that implements a three-layer processing pipeline (normalisation, exclusion, classification) and a React frontend that provides a premium, trust-focused user experience.

The design emphasises explainability, privacy, and Australian tax compliance. Every classification decision is recorded in an audit trail, and outputs are labeled as "likely deductible" to reinforce that user confirmation and substantiation are required.

### Key Design Principles

1. **Explainability First**: Every transaction classification includes the reasoning (matched rule, confidence score, evidence requirements)
2. **Privacy by Default**: Raw CSV data is not persisted unless explicitly configured
3. **Australian Tax Compliance**: All categories, evidence checklists, and guidance align with ATO record-keeping expectations
4. **Precision Over Recall**: Reduce false positives by flagging uncertain items for review
5. **Premium User Experience**: Clean, monochrome design with clear workflow and trust signals

---

## 2. Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  (Upload, Report Viewer, Rules Explorer, Privacy Info)      │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/REST
┌─────────────────────▼───────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Layer                                │   │
│  │  - Upload endpoint                                    │   │
│  │  - Job status endpoint                                │   │
│  │  - Report download endpoints                          │   │
│  └──────────────────┬───────────────────────────────────┘   │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │         Processing Pipeline                           │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  1. CSV Parser & Normaliser                    │  │   │
│  │  └────────────────┬───────────────────────────────┘  │   │
│  │  ┌────────────────▼───────────────────────────────┐  │   │
│  │  │  2. Exclusion Engine                           │  │   │
│  │  └────────────────┬───────────────────────────────┘  │   │
│  │  ┌────────────────▼───────────────────────────────┐  │   │
│  │  │  3. Classification Engine                      │  │   │
│  │  │     - Rules Engine                             │  │   │
│  │  │     - Fuzzy Matcher                            │  │   │
│  │  └────────────────┬───────────────────────────────┘  │   │
│  │  ┌────────────────▼───────────────────────────────┐  │   │
│  │  │  4. Report Generator                           │  │   │
│  │  │     - PDF (WeasyPrint)                         │  │   │
│  │  │     - CSV                                      │  │   │
│  │  │     - JSON (Audit Trail)                       │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Optional: SQLite Storage                      │   │
│  │  (Derived fields only, ephemeral mode by default)    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

**Backend:**
- Python 3.11+
- FastAPI (async web framework)
- pandas (CSV processing and data manipulation)
- rapidfuzz (fuzzy string matching)
- WeasyPrint or ReportLab (PDF generation)
- SQLite (optional persistence)
- pydantic (data validation)

**Frontend:**
- React 18+
- TypeScript
- Tailwind CSS (with custom design tokens)
- React Query (API state management)
- React Router (navigation)

---

## 3. Components and Interfaces

### 3.1 CSV Parser and Normaliser

**Purpose**: Read bank CSV files and transform them into a standardised format.

**Input**: Raw CSV file (various Australian bank formats)

**Output**: List of `NormalisedTransaction` objects

**Interface**:

```python
class NormalisedTransaction:
    transaction_id: str  # Generated UUID
    date: datetime.date
    description: str  # Original description
    merchant: str  # Extracted merchant name
    direction: Literal["debit", "credit"]
    absolute_amount: Decimal  # Always positive
    signed_amount: Decimal  # Negative for debits, positive for credits
    payment_rail: Optional[str]  # "card", "paypal", "bpay", "osko", "payid", etc.
    recurring_flag: bool
    raw_data: dict  # Original CSV row (for audit trail only)

class CSVParser:
    def detect_format(csv_file: BinaryIO) -> CSVFormat
    def parse(csv_file: BinaryIO, format: CSVFormat) -> List[NormalisedTransaction]
    def extract_merchant(description: str) -> str
    def detect_payment_rail(description: str) -> Optional[str]
    def detect_recurring(transactions: List[NormalisedTransaction]) -> List[NormalisedTransaction]
```

**Implementation Notes**:
- Support common Australian bank formats (CommBank, NAB, Westpac, ANZ, ING, etc.)
- Handle both single "Amount" column and separate "Debit"/"Credit" columns
- Merchant extraction uses regex patterns to remove common prefixes (PAYPAL *, VISA *, etc.) and reference numbers
- Recurring detection: group by similar merchant name and check for regular periodicity (weekly, monthly, yearly)
- Normalise whitespace, convert to uppercase for matching, but preserve original for display

---

### 3.2 Exclusion Engine

**Purpose**: Filter out transactions that are clearly not deduction candidates.

**Input**: List of `NormalisedTransaction`

**Output**: Tuple of (candidates: List[NormalisedTransaction], excluded: List[ExcludedTransaction])

**Interface**:

```python
class ExclusionReason(Enum):
    TRANSFER_BETWEEN_ACCOUNTS = "transfer_between_accounts"
    CASH_WITHDRAWAL = "cash_withdrawal"
    LOAN_REPAYMENT = "loan_repayment"
    TAX_SETTLEMENT = "tax_settlement"
    SALARY_INCOME = "salary_income"

class ExcludedTransaction:
    transaction: NormalisedTransaction
    reason: ExclusionReason
    explanation: str  # Human-readable explanation

class ExclusionEngine:
    def __init__(self, rules: List[ExclusionRule])
    def filter(transactions: List[NormalisedTransaction]) -> Tuple[List[NormalisedTransaction], List[ExcludedTransaction]]
```

**Exclusion Rules**:
- Transfer patterns: "TRANSFER TO", "TRANSFER FROM", "OSKO", "PAYID", "BPAY" with account numbers
- Cash withdrawal: "ATM WITHDRAWAL", "CASH OUT", "EFTPOS CASH"
- Loan repayment: "LOAN REPAYMENT", "MORTGAGE", "HOME LOAN"
- Tax settlement: "ATO PAYMENT", "AUSTRALIAN TAXATION OFFICE"
- Salary income: "SALARY", "WAGES", "PAYROLL" (credit transactions only)

---

### 3.3 Classification Engine

**Purpose**: Categorise deduction candidates with confidence scores and evidence requirements.

**Input**: List of `NormalisedTransaction` (after exclusions)

**Output**: List of `ClassifiedTransaction`

**Interface**:

```python
class DeductionCategory(Enum):
    WORK_SOFTWARE = "work_software"
    PROFESSIONAL_MEMBERSHIPS = "professional_memberships"
    TRAINING_EDUCATION = "training_education"
    WORK_EQUIPMENT = "work_equipment"
    PHONE_INTERNET = "phone_internet"
    WORKING_FROM_HOME = "working_from_home"
    TRAVEL = "travel"
    DONATIONS = "donations"
    BANK_FEES = "bank_fees"

class EvidenceType(Enum):
    RECEIPT = "receipt"
    INVOICE = "invoice"
    DIARY = "diary"
    PERCENTAGE_RECORD = "percentage_record"
    LOGBOOK = "logbook"
    ELIGIBILITY_CHECK = "eligibility_check"

class ClassifiedTransaction:
    transaction: NormalisedTransaction
    category: Optional[DeductionCategory]
    confidence: float  # 0.0 to 1.0
    matched_rule_id: Optional[str]
    matched_rule_version: Optional[str]
    reason: str  # "keyword_match: software", "merchant_match: Adobe", etc.
    evidence_checklist: List[EvidenceType]
    flags: List[str]  # "method_required", "percentage_required", "needs_review"

class ClassificationEngine:
    def __init__(self, rules_engine: RulesEngine, fuzzy_matcher: FuzzyMatcher)
    def classify(transactions: List[NormalisedTransaction]) -> List[ClassifiedTransaction]
```

---

### 3.4 Rules Engine

**Purpose**: Match transactions to categories using keyword and merchant patterns.

**Interface**:

```python
class Rule:
    rule_id: str
    version: str
    category: DeductionCategory
    priority: int  # Higher = evaluated first
    confidence: float
    keywords: List[str]  # Case-insensitive substring matches
    merchants: List[str]  # Canonical merchant names
    evidence_checklist: List[EvidenceType]
    flags: List[str]
    enabled: bool

class RulesEngine:
    def __init__(self, rules: List[Rule])
    def match(transaction: NormalisedTransaction) -> Optional[Tuple[Rule, float]]
    def load_rules(filepath: str) -> List[Rule]
```

**Example Rules**:

```python
Rule(
    rule_id="R001",
    version="1.0",
    category=DeductionCategory.WORK_SOFTWARE,
    priority=100,
    confidence=0.95,
    keywords=["adobe", "microsoft 365", "github", "jetbrains"],
    merchants=["Adobe", "Microsoft", "GitHub", "JetBrains"],
    evidence_checklist=[EvidenceType.RECEIPT],
    flags=[],
    enabled=True
)

Rule(
    rule_id="R015",
    version="1.0",
    category=DeductionCategory.PHONE_INTERNET,
    priority=80,
    confidence=0.70,
    keywords=["telstra", "optus", "vodafone", "nbn"],
    merchants=["Telstra", "Optus", "Vodafone"],
    evidence_checklist=[EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
    flags=["percentage_required"],
    enabled=True
)
```

---

### 3.5 Fuzzy Matcher

**Purpose**: Handle merchant name variations and canonicalise to known merchants.

**Interface**:

```python
class FuzzyMatcher:
    def __init__(self, canonical_merchants: List[str], threshold: float = 0.85)
    def match(merchant: str) -> Optional[Tuple[str, float]]  # (canonical_name, similarity_score)
    def normalise_merchant(merchant: str) -> str  # Remove prefixes, suffixes, reference numbers
```

**Implementation**:
- Use `rapidfuzz` library for fuzzy string matching
- Normalisation steps:
  1. Remove common prefixes: "PAYPAL *", "VISA ", "MASTERCARD ", "EFTPOS "
  2. Remove reference numbers: regex `\*\d+`, `#\d+`, `\d{4,}`
  3. Strip whitespace and convert to uppercase
- Match against canonical merchant list using token_sort_ratio
- Return match only if similarity >= threshold (default 0.85)

---

### 3.6 Report Generator

**Purpose**: Produce human-readable and machine-readable outputs.

**Interface**:

```python
class ReportData:
    income_year: str  # "2023-2024"
    generated_at: datetime
    summary: ReportSummary
    candidates: List[ClassifiedTransaction]
    needs_review: List[ClassifiedTransaction]
    excluded: List[ExcludedTransaction]
    audit_trail: List[AuditEntry]

class ReportSummary:
    total_deductible: Decimal
    total_needs_review: Decimal
    total_excluded: Decimal
    category_totals: Dict[DeductionCategory, Decimal]
    confidence_distribution: Dict[str, int]  # "high", "medium", "low"

class AuditEntry:
    transaction_id: str
    normalisation: dict
    exclusion_checks: List[dict]
    classification_attempts: List[dict]
    final_result: dict

class ReportGenerator:
    def generate_pdf(data: ReportData, output_path: str) -> None
    def generate_csv(data: ReportData, output_path: str) -> None
    def generate_audit_trail(data: ReportData, output_path: str) -> None
```

**PDF Structure**:
1. Header: Income year, generated date, disclaimer
2. Summary section: Category totals, grand total, confidence distribution chart
3. Deduction candidates table
4. Needs review section
5. Excluded items section
6. Footer: Record retention guidance, substantiation notes

**CSV Structure**:
Columns: date, merchant, description, amount, category, confidence, reason, evidence_needed, flags

**JSON Audit Trail Structure**:
```json
{
  "income_year": "2023-2024",
  "generated_at": "2024-01-15T10:30:00Z",
  "transactions": [
    {
      "transaction_id": "uuid",
      "normalisation": {
        "original_description": "...",
        "extracted_merchant": "...",
        "payment_rail": "..."
      },
      "exclusion_checks": [
        {"rule": "transfer_check", "matched": false}
      ],
      "classification_attempts": [
        {"rule_id": "R001", "confidence": 0.95, "matched": true}
      ],
      "final_result": {
        "category": "work_software",
        "confidence": 0.95,
        "evidence": ["receipt"]
      }
    }
  ]
}
```

---

## 4. Data Models

### 4.1 Core Data Models

```python
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List, Dict
from enum import Enum
from pydantic import BaseModel, Field

class TransactionDirection(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"

class NormalisedTransaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: date
    description: str
    merchant: str
    direction: TransactionDirection
    absolute_amount: Decimal
    signed_amount: Decimal
    payment_rail: Optional[str] = None
    recurring_flag: bool = False
    raw_data: Dict = Field(default_factory=dict)

class DeductionCategory(str, Enum):
    WORK_SOFTWARE = "work_software"
    PROFESSIONAL_MEMBERSHIPS = "professional_memberships"
    TRAINING_EDUCATION = "training_education"
    WORK_EQUIPMENT = "work_equipment"
    PHONE_INTERNET = "phone_internet"
    WORKING_FROM_HOME = "working_from_home"
    TRAVEL = "travel"
    DONATIONS = "donations"
    BANK_FEES = "bank_fees"

class EvidenceType(str, Enum):
    RECEIPT = "receipt"
    INVOICE = "invoice"
    DIARY = "diary"
    PERCENTAGE_RECORD = "percentage_record"
    LOGBOOK = "logbook"
    ELIGIBILITY_CHECK = "eligibility_check"

class ClassifiedTransaction(BaseModel):
    transaction: NormalisedTransaction
    category: Optional[DeductionCategory]
    confidence: float = Field(ge=0.0, le=1.0)
    matched_rule_id: Optional[str]
    matched_rule_version: Optional[str]
    reason: str
    evidence_checklist: List[EvidenceType]
    flags: List[str] = Field(default_factory=list)

class ExclusionReason(str, Enum):
    TRANSFER_BETWEEN_ACCOUNTS = "transfer_between_accounts"
    CASH_WITHDRAWAL = "cash_withdrawal"
    LOAN_REPAYMENT = "loan_repayment"
    TAX_SETTLEMENT = "tax_settlement"
    SALARY_INCOME = "salary_income"

class ExcludedTransaction(BaseModel):
    transaction: NormalisedTransaction
    reason: ExclusionReason
    explanation: str
```

### 4.2 API Models

```python
class UploadRequest(BaseModel):
    income_year: str = Field(pattern=r"^\d{4}-\d{4}$")  # "2023-2024"
    ephemeral_mode: bool = True
    confidence_threshold: float = Field(default=0.60, ge=0.0, le=1.0)

class UploadResponse(BaseModel):
    job_id: str
    status: str  # "queued", "processing", "completed", "failed"
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: Optional[int] = None  # 0-100
    error: Optional[str] = None
    report_urls: Optional[Dict[str, str]] = None  # {"pdf": "/download/...", "csv": "...", "json": "..."}

class ReportSummaryResponse(BaseModel):
    income_year: str
    total_deductible: Decimal
    total_needs_review: Decimal
    total_excluded: Decimal
    category_totals: Dict[str, Decimal]
    confidence_distribution: Dict[str, int]
```

### 4.3 Database Schema (Optional SQLite)

```sql
CREATE TABLE jobs (
    job_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    income_year TEXT NOT NULL,
    ephemeral_mode BOOLEAN DEFAULT TRUE,
    error TEXT
);

CREATE TABLE transactions (
    transaction_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    date DATE NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    category TEXT,
    confidence REAL,
    flags TEXT,  -- JSON array
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
);

CREATE INDEX idx_job_id ON transactions(job_id);
CREATE INDEX idx_category ON transactions(category);
```

---

## 5. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Before writing the correctness properties, I need to analyze the acceptance criteria from the requirements document to determine which are testable as properties.


### Property 1: CSV Amount Normalisation Consistency
*For any* valid CSV row with amount data (single amount column or separate debit/credit columns), parsing should produce a NormalisedTransaction where absolute_amount is always positive, signed_amount has correct sign based on direction, and direction matches the transaction type.
**Validates: Requirements 1.3**

### Property 2: File Size Validation
*For any* uploaded file, if the file size exceeds the configured maximum, the system should reject it with an error; if below the maximum, it should be accepted for processing.
**Validates: Requirements 1.1**

### Property 3: CSV Format Error Handling
*For any* CSV file missing required columns (date, description, or amount), the system should return an error message that lists all missing required fields.
**Validates: Requirements 1.4**

### Property 4: Merchant Extraction Fallback
*For any* transaction description, if merchant extraction produces no result or fails, the merchant field should equal the original description.
**Validates: Requirements 2.3**

### Property 5: Payment Rail Detection
*For any* transaction description containing payment rail keywords (card, PayPal, BPAY, Osko, PayID), the payment_rail field should be populated with the detected rail type.
**Validates: Requirements 2.5**

### Property 6: Exclusion Rules Completeness
*For any* transaction matching exclusion patterns (transfers, cash withdrawals, loan repayments, tax settlements), the Exclusion_Engine should exclude it from deduction candidates and assign the appropriate exclusion reason.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 7: Audit Trail Completeness
*For any* processed transaction (whether excluded, classified, or unmatched), the audit trail should contain all processing steps including normalisation inputs, exclusion checks, classification attempts, and final results.
**Validates: Requirements 3.5, 4.5, 10.5**

### Property 8: Confidence Score Bounds
*For any* classified transaction, the confidence score should be between 0.0 and 1.0 inclusive.
**Validates: Requirements 4.1**

### Property 9: Highest Confidence Rule Selection
*For any* transaction that matches multiple classification rules, the system should select the rule with the highest confidence score, using rule priority as a tie-breaker.
**Validates: Requirements 4.3**

### Property 10: Needs Review Flagging
*For any* classified transaction with confidence below the configured threshold (default 0.60), the system should add "needs_review" to the flags list.
**Validates: Requirements 4.4**

### Property 11: Fuzzy Merchant Canonicalisation
*For any* merchant name variation (with prefixes like "PAYPAL *", "VISA ", or reference numbers), the Fuzzy_Matcher should normalise it and attempt to match it to a canonical merchant name if similarity exceeds the threshold.
**Validates: Requirements 4.2**

### Property 12: Evidence Checklist Presence
*For any* transaction classified as a deduction candidate, the system should attach an evidence checklist containing at least one evidence type appropriate to the category.
**Validates: Requirements 5.1, 5.2**

### Property 13: Donation Eligibility Requirement
*For any* transaction classified in the Donations category, the evidence checklist should include ELIGIBILITY_CHECK as a required evidence type.
**Validates: Requirements 5.4**

### Property 14: Method Required Flagging
*For any* transaction classified as car-related, working-from-home, or overnight travel, the system should add "method_required" to the flags list.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 15: PDF Content Completeness
*For any* generated PDF report, it should contain the income year, summary totals by category, grand total, line item table with all required columns (date, merchant, description, amount, category, confidence, reason, evidence), and use "likely deductible" language for all candidates.
**Validates: Requirements 8.2, 8.3, 8.4, 8.7**

### Property 16: CSV Export Completeness
*For any* generated deductions.csv file, it should contain all deduction candidates with their complete classification data (category, confidence, reason, evidence, flags).
**Validates: Requirements 9.1**

### Property 17: Audit Trail Determinism
*For any* CSV file processed with the same rules and configuration, processing it twice should produce identical audit trails and identical classification results.
**Validates: Requirements 9.3**

### Property 18: API Job Identifier Response
*For any* successful CSV upload via the POST endpoint, the response should contain a unique job_id string.
**Validates: Requirements 11.2**

### Property 19: Report Download Availability
*For any* job with status "completed", the job status response should include download URLs for all three report formats (PDF, CSV, JSON).
**Validates: Requirements 11.4**

### Property 20: HTTP Error Status Codes
*For any* API error condition (invalid file type, missing fields, processing failure), the system should return an appropriate HTTP error status code (4xx for client errors, 5xx for server errors) and a descriptive error message.
**Validates: Requirements 11.5**

### Property 21: Ephemeral Mode Data Isolation
*For any* job processed in ephemeral mode, after report generation completes, no transaction data should be persisted in the database.
**Validates: Requirements 12.2**

### Property 22: Derived Fields Only Storage
*For any* job processed with persistence enabled, the database should contain only derived fields (merchant, category, confidence, flags) and should not contain raw CSV row data.
**Validates: Requirements 12.1**

### Property 23: Sensitive Data Redaction
*For any* report generated with redaction enabled, the outputs should not contain patterns matching the configured sensitive data patterns (account numbers, BSB codes).
**Validates: Requirements 12.3**

---

## 6. Error Handling

### 6.1 CSV Parsing Errors

**Error Types:**
- Invalid file format (not CSV)
- Missing required columns
- Invalid date formats
- Invalid amount formats
- File size exceeds limit
- Empty file

**Handling Strategy:**
- Return HTTP 400 with descriptive error message
- Include list of missing/invalid fields
- Provide example of expected format
- Do not create job record for invalid uploads

### 6.2 Processing Errors

**Error Types:**
- Rule engine configuration errors
- Fuzzy matching failures
- PDF generation failures
- Storage failures (if persistence enabled)

**Handling Strategy:**
- Mark job status as "failed"
- Record error details in job record
- Return error via job status endpoint
- Provide actionable error messages
- Log full stack trace for debugging

### 6.3 API Errors

**Error Types:**
- Invalid job_id (404)
- Unauthorized access (401)
- Rate limit exceeded (429)
- Server errors (500)

**Handling Strategy:**
- Use standard HTTP status codes
- Return JSON error response with structure:
  ```json
  {
    "error": "error_code",
    "message": "Human-readable message",
    "details": {}
  }
  ```

### 6.4 Graceful Degradation

- If fuzzy matching fails, fall back to exact matching
- If merchant extraction fails, use original description
- If PDF generation fails, still provide CSV and JSON outputs
- If optional storage fails, continue with ephemeral mode

---

## 7. Testing Strategy

### 7.1 Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific CSV format examples (CommBank, NAB, Westpac, ANZ, ING)
- Edge cases (empty descriptions, zero amounts, special characters)
- Error conditions (missing columns, invalid dates)
- Integration points (API endpoints, database operations)
- Specific merchant extraction patterns

**Property-Based Tests** focus on:
- Universal properties across all inputs (see Correctness Properties section)
- Randomized transaction generation
- Fuzzy matching behavior across variations
- Classification consistency
- Audit trail completeness

### 7.2 Property-Based Testing Configuration

**Library**: Use `hypothesis` for Python property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `# Feature: tax-deduction-analyzer, Property N: [property text]`
- Custom generators for:
  - Australian bank CSV formats
  - Transaction descriptions with merchant variations
  - Amount values (positive, negative, decimal precision)
  - Date ranges within income years

**Example Property Test Structure**:
```python
from hypothesis import given, strategies as st
import pytest

# Feature: tax-deduction-analyzer, Property 1: CSV Amount Normalisation Consistency
@given(
    amount=st.decimals(min_value=-10000, max_value=10000, places=2),
    direction=st.sampled_from(["debit", "credit"])
)
@pytest.mark.property_test
def test_amount_normalisation_consistency(amount, direction):
    transaction = parse_transaction(amount, direction)
    assert transaction.absolute_amount > 0
    if direction == "debit":
        assert transaction.signed_amount < 0
    else:
        assert transaction.signed_amount > 0
```

### 7.3 Test Coverage Requirements

- Minimum 80% code coverage for core processing pipeline
- 100% coverage for classification rules
- All exclusion patterns tested
- All API endpoints tested
- All error conditions tested

### 7.4 Test Data

**Sample CSV Files**:
- Create fixtures for major Australian banks
- Include edge cases (missing columns, special characters, large files)
- Include known merchant patterns for validation

**Test Rules**:
- Maintain a test rules configuration with known merchants
- Include rules with varying confidence levels
- Test rule priority and tie-breaking

---

## 8. Frontend Design System

### 8.1 Design Goals

**Product Goals:**
- Make uploading and analysing a bank CSV feel safe, fast, and premium
- Present results as a trustworthy evidence pack, not a gimmicky classifier
- Reduce cognitive load with a clear workflow: Upload → Review → Export
- Provide explainability for every line item

**User Goals:**
- Quickly see how much is likely deductible for the selected income year
- Understand which items are high confidence versus needs review
- Export clean reports to share with an accountant

### 8.2 Brand and Visual Direction

**Brand Attributes:**
- Professional
- Precise
- Calm
- Privacy conscious
- Evidence based

**Tone of Voice:**
- Clear and direct
- No legal-sounding claims
- Always uses "likely deductible" or "candidate" language
- Short guidance copy with optional detail expansion

### 8.3 Colour System

**Neutrals:**
- Ink 950: #0A0A0A (main background)
- Ink 900: #111111 (surface elevated)
- Ink 800: #1A1A1A (surface hover)
- Line 700: #2A2A2A (borders and dividers)
- Slate 500: #8A8A8A (secondary text)
- Slate 300: #CFCFCF (muted text)
- White: #FFFFFF (primary text on dark)

**Accent:**
- Primary: #FFFFFF for primary buttons on dark
- Secondary: #9BB2FF (Electric Grey Blue) for emphasis and charts only

**Usage Rules:**
- Default UI is monochrome
- Use secondary accent only for: active states, focus rings, key chart highlights, selected chips
- Never use red or green alone to convey meaning (use icons and labels too)
- Maintain WCAG AA contrast for all text

### 8.4 Typography

**Typefaces:**
- Primary: Inter
- Fallback: system-ui, Segoe UI, Roboto, Helvetica Neue, Arial

**Type Scale:**
- Display: 40-48px, weight 600, tight tracking
- H1: 32px, weight 600
- H2: 24px, weight 600
- H3: 18px, weight 600
- Body: 16px, weight 400
- Small: 14px, weight 400
- Micro: 12px, weight 500

**Typography Rules:**
- Use sentence case for headings
- Consistent numeric formatting with separators and AUD
- Monospace only for IDs and audit keys

### 8.5 Layout and Grid

**Grid:**
- 12 column grid on desktop
- 8 column grid on tablet
- Single column on mobile

**Spacing:**
- Base spacing unit: 8px
- Common gaps: 16px, 24px, 32px
- Section padding: 48px desktop, 24px mobile

**Surfaces:**
- Background: Ink 950
- Card surface: Ink 900
- Cards have 1px border Line 700 and subtle shadow
- Rounded corners: 16px for cards, 12px for inputs, 999px for pills

### 8.6 Core Pages

**Landing Page:**
- Hero: "Turn your bank CSV into an evidence-ready deduction report"
- Trust strip: Privacy, Explainability, Australian income year
- How it works: Upload → Classify → Export
- Example preview of report card
- Call to action: Upload CSV

**Upload Page:**
- Drag and drop upload zone
- Income year selector (default current)
- Privacy toggle: ephemeral mode on by default
- Start analysis button
- Microcopy: "We generate likely deductible candidates. You confirm. Keep records."

**Report Page (Primary Interface):**

Sections:
1. Summary cards:
   - Likely deductible total
   - Needs review total
   - Excluded total
   - Confidence distribution

2. Tabs:
   - Candidates
   - Needs review
   - Excluded
   - Audit trail

3. Table columns:
   - Date
   - Merchant
   - Description
   - Amount
   - Category
   - Confidence
   - Evidence
   - Reason

4. Detail panel (right side or drawer):
   - Explanation card for selected transaction
   - Matched rule
   - Evidence checklist
   - Flags: method required, percentage required

**Rules Page:**
- Rule sets by category
- Examples of merchant matching
- How confidence is computed
- How exclusions work
- Version history of rules

**Privacy Page:**
- What data is processed
- What is stored by default
- Ephemeral mode explanation
- How reports are generated
- Recommended redaction settings

### 8.7 Component Library

**Buttons:**
- Primary: white on black, with black text
- Secondary: transparent, 1px border Line 700
- Tertiary: text only

**Inputs:**
- Dark surface with clear focus ring using accent
- Error states show message plus icon and border change

**Chips:**
- Category chips: neutral outlines, filled only when selected
- Confidence chips: label plus subtle meter

**Cards:**
- Stats cards: large number, label, small helper text
- Explanation cards: show reason, evidence checklist, and flags

**Icons:**
- Minimal line icons only
- Icons paired with labels in critical contexts

### 8.8 Data Visualisation

**Charts:**
- Confidence distribution histogram
- Category totals bar chart
- Recurring transactions list

**Rules:**
- Default monochrome chart elements
- Only highlight one series using secondary accent
- Always show exact numbers on hover and in a table

### 8.9 Accessibility

- Keyboard navigation for all interactive components
- Visible focus states on every control
- Proper table semantics and ARIA labels
- Colour contrast meets WCAG AA
- Avoid small grey text below 14px
- Downloadable outputs as accessible PDFs

### 8.10 Content and Formatting Rules

- Always use "likely deductible" not "deductible"
- Use AUD formatting and consistent date format (DD/MM/YYYY)
- Use plain English, avoid tax jargon unless explained
- Keep line item explanations short with "More detail" expansion

---

## 9. Implementation Notes

### 9.1 CSV Parser Implementation

**Column Detection Strategy:**
1. Read first row as headers
2. Normalise header names (lowercase, remove spaces/underscores)
3. Match against known patterns:
   - Date: "date", "transaction date", "posted date", "value date"
   - Description: "description", "details", "narrative", "transaction details"
   - Amount: "amount", "value", "transaction amount"
   - Debit: "debit", "withdrawal", "debit amount"
   - Credit: "credit", "deposit", "credit amount"
4. If no match found, return error with missing fields

**Merchant Extraction Patterns:**
```python
# Remove common prefixes
prefixes = ["PAYPAL *", "VISA ", "MASTERCARD ", "EFTPOS ", "DIRECT DEBIT "]

# Remove reference numbers
patterns = [
    r'\*\d+',  # *1234
    r'#\d+',   # #5678
    r'\d{4,}', # 123456
    r'REF:\s*\w+',  # REF: ABC123
]

# Remove trailing location codes
patterns.append(r'\s+[A-Z]{2,3}$')  # " NSW", " VIC"
```

### 9.2 Rules Engine Implementation

**Rule Storage:**
- Store rules in JSON or YAML configuration file
- Load rules at startup
- Support hot-reloading for rule updates

**Rule Matching Algorithm:**
```python
def match_transaction(transaction: NormalisedTransaction, rules: List[Rule]) -> Optional[Tuple[Rule, float]]:
    matches = []
    
    for rule in sorted(rules, key=lambda r: r.priority, reverse=True):
        if not rule.enabled:
            continue
            
        # Check keyword matches
        for keyword in rule.keywords:
            if keyword.lower() in transaction.description.lower():
                matches.append((rule, rule.confidence))
                break
        
        # Check merchant matches
        if transaction.merchant in rule.merchants:
            matches.append((rule, rule.confidence))
    
    if not matches:
        return None
    
    # Return highest confidence match
    return max(matches, key=lambda m: (m[1], m[0].priority))
```

### 9.3 PDF Generation

**Library Choice:** WeasyPrint (better CSS support) or ReportLab (more control)

**PDF Template Structure:**
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        /* Use design system colours and typography */
        body { font-family: Inter, sans-serif; }
        .summary { background: #111111; padding: 24px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; border-bottom: 1px solid #2A2A2A; }
    </style>
</head>
<body>
    <header>
        <h1>Tax Deduction Report</h1>
        <p>Income Year: {{ income_year }}</p>
        <p>Generated: {{ generated_at }}</p>
    </header>
    
    <section class="summary">
        <h2>Summary</h2>
        <!-- Category totals -->
    </section>
    
    <section class="candidates">
        <h2>Likely Deductible Candidates</h2>
        <table>
            <!-- Transaction rows -->
        </table>
    </section>
    
    <section class="needs-review">
        <h2>Needs Review</h2>
        <!-- Low confidence items -->
    </section>
    
    <section class="excluded">
        <h2>Excluded Items</h2>
        <!-- Excluded transactions -->
    </section>
    
    <footer>
        <p>Record Retention: Keep records for 5 years from lodging date...</p>
        <p>Substantiation: Written evidence generally required for work-related expenses over $300...</p>
    </footer>
</body>
</html>
```

### 9.4 API Implementation

**FastAPI Route Structure:**
```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

app = FastAPI()

@app.post("/api/upload")
async def upload_csv(
    file: UploadFile = File(...),
    income_year: str = "2023-2024",
    ephemeral_mode: bool = True
) -> UploadResponse:
    # Validate file
    # Create job
    # Queue processing
    # Return job_id

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str) -> JobStatusResponse:
    # Retrieve job status
    # Return status and download URLs if complete

@app.get("/api/jobs/{job_id}/download/{format}")
async def download_report(job_id: str, format: str) -> FileResponse:
    # Validate format (pdf, csv, json)
    # Return file
```

### 9.5 Frontend State Management

**React Query for API State:**
```typescript
// Upload mutation
const uploadMutation = useMutation({
  mutationFn: (file: File) => uploadCSV(file),
  onSuccess: (data) => {
    // Navigate to report page with job_id
  }
});

// Job status polling
const { data: jobStatus } = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => getJobStatus(jobId),
  refetchInterval: (data) => 
    data?.status === 'completed' ? false : 2000,
});
```

---

## 10. Deployment Considerations

### 10.1 Environment Configuration

**Required Environment Variables:**
- `DATABASE_URL`: SQLite connection string (optional)
- `UPLOAD_MAX_SIZE`: Maximum CSV file size in bytes
- `CONFIDENCE_THRESHOLD`: Default confidence threshold (0.60)
- `EPHEMERAL_MODE_DEFAULT`: Default ephemeral mode setting (true)
- `RULES_CONFIG_PATH`: Path to rules configuration file

### 10.2 Scaling Considerations

**Current Design (MVP):**
- Single-server deployment
- Synchronous processing
- Local file storage

**Future Scaling:**
- Add job queue (Celery + Redis)
- Async processing workers
- S3 for report storage
- PostgreSQL for job metadata

### 10.3 Security

- Validate file types (CSV only)
- Enforce file size limits
- Rate limit API endpoints
- Sanitize file names
- Use secure headers (CORS, CSP)
- No authentication required for MVP (add later)

---

## 11. Future Enhancements

### 11.1 Machine Learning Integration

- Train embeddings model on Australian merchant data
- Use semantic similarity for better merchant matching
- Learn from user corrections (if feedback mechanism added)

### 11.2 Advanced Features

- Multi-year analysis
- Comparison with previous years
- Integration with accounting software (Xero, MYOB)
- Mobile app for receipt capture
- OCR for receipt processing

### 11.3 Compliance Updates

- Track ATO guidance changes
- Update rules and evidence checklists automatically
- Notify users of relevant tax law changes

---

## 12. Design Quality Checklist

A component/page is ready when:
- It has a single clear primary action
- It explains uncertainty without alarming the user
- It looks premium in monochrome and readable on low brightness
- Every decision has an explanation path
- Exports are one click and obvious
- Keyboard navigation works for all interactions
- Colour contrast meets WCAG AA
- Error states are clear and actionable
