# Code Documentation

## Overview

This document provides comprehensive documentation for the Tax Deduction Analyzer codebase.

**Author**: Samuel Rath  
**Last Updated**: March 2026

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Documentation](#backend-documentation)
3. [Frontend Documentation](#frontend-documentation)
4. [API Reference](#api-reference)
5. [Data Flow](#data-flow)
6. [Testing](#testing)

---

## Architecture Overview

### System Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │─────▶│   Frontend   │─────▶│   Backend   │
│  (React)    │◀─────│  (Vite/TS)   │◀─────│  (FastAPI)  │
└─────────────┘      └──────────────┘      └─────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │  Processing  │
                                            │   Pipeline   │
                                            └──────────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                            ┌──────────┐    ┌──────────┐    ┌──────────┐
                            │   CSV    │    │Exclusion │    │Classify  │
                            │  Parser  │───▶│  Engine  │───▶│  Engine  │
                            └──────────┘    └──────────┘    └──────────┘
                                                                    │
                                                                    ▼
                                                            ┌──────────────┐
                                                            │    Report    │
                                                            │  Generator   │
                                                            └──────────────┘
```

### Technology Stack

**Backend**:
- Python 3.11+
- FastAPI (web framework)
- Pydantic (data validation)
- PyPDF2/pdfplumber (PDF parsing)
- Pandas (data processing)
- ReportLab (PDF generation)

**Frontend**:
- React 18
- TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Query (state management)
- React Router (routing)

---

## Backend Documentation

### Core Modules

#### 1. API Layer (`backend/api/`)

**`endpoints.py`** - Main API endpoints

```python
@router.post("/upload")
async def upload_csv(
    file: UploadFile,
    income_year: Optional[str],
    ephemeral_mode: bool = True,
    confidence_threshold: float = 0.60
) -> UploadResponse
```

**Purpose**: Handle file uploads and process transactions  
**Validates**: File type, size, income year format, confidence threshold  
**Returns**: Job ID, status, and report data (in ephemeral mode)

**Key Features**:
- File validation (CSV/PDF only, max 10MB)
- Auto-detect income year from transactions
- Ephemeral mode (no data persistence)
- Automatic file cleanup

---

#### 2. Processing Pipeline (`backend/processing/`)

**`pipeline.py`** - Orchestrates the entire processing flow

```python
class ProcessingPipeline:
    def process_and_generate_reports(
        self,
        csv_file: Optional[BinaryIO] = None,
        transactions: Optional[List[NormalisedTransaction]] = None,
        income_year: str,
        output_dir: Path,
        job_id: str,
        generate_pdf: bool = True,
        generate_csv: bool = True,
        generate_json: bool = True
    ) -> Tuple[ReportData, Dict[str, str]]
```

**Flow**:
1. Parse CSV/PDF → `NormalisedTransaction` objects
2. Apply exclusion rules → Filter non-deductible items
3. Classify transactions → Assign categories and confidence
4. Generate reports → PDF, CSV, JSON outputs

---

**`csv_parser.py`** - Parse CSV bank statements

```python
class CSVParser:
    def parse(self, csv_file: BinaryIO) -> List[NormalisedTransaction]
    def extract_merchant(self, description: str) -> str
    def detect_payment_rail(self, description: str) -> Optional[str]
    def detect_recurring(self, transactions: List) -> List
```

**Supported Banks**: CommBank, NAB, Westpac, ANZ, ING

**Date Formats**:
- `DD/MM/YYYY`
- `DD-MM-YYYY`
- `DD Mon YY` (NAB format)

**Merchant Extraction**:
- Removes transaction codes
- Cleans up formatting
- Extracts business names

---

**`pdf_parser.py`** - Parse PDF bank statements

```python
class PDFParser:
    def parse(self, pdf_file: BytesIO) -> List[NormalisedTransaction]
    def _parse_with_state_machine(self, text: str) -> List
    def _extract_amount_from_description(self, transaction: dict) -> None
```

**Features**:
- State machine for multi-line transactions
- Dual parser (pdfplumber + PyPDF2 fallback)
- Amount extraction with heuristics
- Date pattern matching

**Challenges**:
- Multi-line descriptions
- Varying column layouts
- Amount vs balance detection

---

**`exclusion_engine.py`** - Filter non-deductible transactions

```python
class ExclusionEngine:
    def process(self, transactions: List) -> Tuple[List, List]
```

**Exclusion Rules**:
- Cash withdrawals (ATM, EFTPOS cash out)
- Personal transfers (between own accounts)
- Loan repayments (principal only)
- Savings/investments
- Personal expenses (groceries, entertainment)

**Returns**: (remaining_transactions, excluded_transactions)

---

**`classification_engine.py`** - Classify deductible transactions

```python
class ClassificationEngine:
    def classify(self, transactions: List) -> Tuple[List, List]
```

**Categories**:
- Work software/subscriptions
- Professional development
- Travel (work-related)
- Home office expenses
- Professional memberships
- Work equipment
- Donations (DGR-registered)

**Confidence Scoring**:
- **High (0.80-1.00)**: Strong pattern match
- **Medium (0.60-0.79)**: Partial match
- **Low (<0.60)**: Weak match (needs review)

**Evidence Checklist**:
- Receipt required
- Logbook/diary
- Work-related percentage calculation
- Method selection (actual cost vs cents per km)

---

**`report_generator.py`** - Generate output reports

```python
class ReportGenerator:
    def generate_pdf(self, report_data: ReportData, output_path: Path)
    def generate_csv(self, report_data: ReportData, output_path: Path)
    def generate_json(self, report_data: ReportData, output_path: Path)
```

**PDF Report Sections**:
1. Summary (totals, confidence distribution)
2. Deduction Candidates (high/medium confidence)
3. Needs Review (low confidence)
4. Excluded Transactions
5. Evidence Checklist
6. Disclaimer

---

**`redaction_service.py`** - Redact sensitive data

```python
class RedactionService:
    def redact_account_numbers(self, text: str) -> str
    def redact_bsb_codes(self, text: str) -> str
    def redact_transaction(self, transaction: NormalisedTransaction)
```

**Redacts**:
- Account numbers (replaced with `XXXX-XXXX`)
- BSB codes (replaced with `XXX-XXX`)
- Card numbers
- Reference numbers

---

#### 3. Data Models (`backend/models/schemas.py`)

**Core Models**:

```python
class NormalisedTransaction(BaseModel):
    """Standardized transaction format"""
    transaction_id: str
    date: date
    description: str
    merchant: str
    direction: TransactionDirection  # DEBIT or CREDIT
    absolute_amount: Decimal
    signed_amount: Decimal
    payment_rail: Optional[str]
    recurring_flag: bool
    raw_data: dict

class ClassifiedTransaction(BaseModel):
    """Transaction with classification"""
    transaction: NormalisedTransaction
    category: DeductionCategory
    confidence: float  # 0.0 to 1.0
    matched_rule_id: str
    matched_rule_version: str
    reason: str
    evidence_checklist: List[EvidenceType]
    flags: List[str]

class ReportData(BaseModel):
    """Complete report data"""
    income_year: str
    generated_at: datetime
    summary: ReportSummary
    candidates: List[ClassifiedTransaction]
    needs_review: List[ClassifiedTransaction]
    excluded: List[ExcludedTransaction]
    audit_trail: List[AuditEntry]
```

---

#### 4. Security (`backend/middleware/`, `backend/security_config.py`)

**Security Middleware**:
- Rate limiting (30 requests/minute)
- CORS protection
- Security headers (CSP, HSTS, X-Frame-Options)
- Input validation
- File type/size restrictions

**Configuration**:
```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = ["text/csv", "application/pdf"]
RATE_LIMIT = "30/minute"
```

---

## Frontend Documentation

### Component Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Chip.tsx
│   ├── Drawer.tsx
│   ├── Icon.tsx
│   └── Navigation.tsx
├── pages/              # Route pages
│   ├── Landing.tsx     # Home page
│   ├── Upload.tsx      # File upload
│   ├── Report.tsx      # Results display
│   ├── Rules.tsx       # Deduction rules
│   └── Privacy.tsx     # Privacy policy
├── api/                # API client
│   ├── client.ts       # HTTP client
│   └── hooks.ts        # React Query hooks
└── App.tsx             # Root component
```

### Key Components

#### Upload Page (`Upload.tsx`)

```typescript
export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [ephemeralMode, setEphemeralMode] = useState(true)
  
  const uploadMutation = useUploadFile({
    onSuccess: (data) => {
      if (data.report_data) {
        // Ephemeral mode - navigate with data
        navigate(`/report/${data.job_id}`, {
          state: { reportData: data.report_data }
        })
      } else {
        // Persistent mode - poll for completion
        navigate(`/report/${data.job_id}`)
      }
    }
  })
}
```

**Features**:
- Drag & drop file upload
- File validation (client-side)
- Ephemeral mode toggle
- Confidence threshold slider
- Income year selection

---

#### Report Page (`Report.tsx`)

```typescript
export default function Report() {
  const { jobId } = useParams()
  const location = useLocation()
  
  // Check for report data from navigation state (ephemeral mode)
  const stateReportData = location.state?.reportData
  
  // Normalize data (handle snake_case and camelCase)
  const normalizeReportData = (data: any) => { /* ... */ }
  
  // Poll for status if no data from state
  const { data: jobStatus } = useJobStatus(jobId, {
    enabled: !!jobId && !stateReportData,
    refetchInterval: 5000
  })
}
```

**Sections**:
1. Summary cards (totals, confidence distribution)
2. Charts (confidence distribution, category breakdown)
3. Transaction tables (candidates, needs review, excluded)
4. Transaction detail drawer
5. Download buttons (PDF, CSV, JSON)

---

### API Client (`api/client.ts`)

```typescript
export const uploadFile = async (
  file: File,
  options: UploadOptions
): Promise<UploadResponse> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('ephemeral_mode', String(options.ephemeralMode))
  formData.append('confidence_threshold', String(options.confidenceThreshold))
  
  const response = await axios.post('/api/upload', formData)
  return response.data
}

export const getJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await axios.get(`/api/jobs/${jobId}`)
  return response.data
}

export const downloadReport = async (
  jobId: string,
  format: 'pdf' | 'csv' | 'json'
): Promise<Blob> => {
  const response = await axios.get(
    `/api/jobs/${jobId}/download/${format}`,
    { responseType: 'blob' }
  )
  return response.data
}
```

---

## API Reference

### Endpoints

#### POST `/api/upload`

Upload and process a bank statement file.

**Request**:
```typescript
FormData {
  file: File                    // CSV or PDF file
  income_year?: string          // "YYYY-YYYY" format
  ephemeral_mode: boolean       // Default: true
  confidence_threshold: number  // 0.0-1.0, default: 0.60
}
```

**Response**:
```typescript
{
  job_id: string
  status: "completed" | "processing" | "failed"
  message: string
  report_data?: {              // Only in ephemeral mode
    income_year: string
    generated_at: string
    summary: {
      total_deductible: number
      total_needs_review: number
      total_excluded: number
      category_totals: Record<string, number>
      confidence_distribution: {
        high: number
        medium: number
        low: number
      }
    }
    candidates: Transaction[]
    needs_review: Transaction[]
    excluded: Transaction[]
  }
}
```

---

#### GET `/api/jobs/{job_id}`

Get job status and download URLs.

**Response**:
```typescript
{
  job_id: string
  status: "completed" | "processing" | "failed"
  progress?: number
  error?: string
  report_urls?: {
    pdf: string
    csv: string
    json: string
  }
}
```

---

#### GET `/api/jobs/{job_id}/download/{format}`

Download generated report.

**Parameters**:
- `format`: `pdf` | `csv` | `json`

**Response**: File download (binary)

---

## Data Flow

### Upload Flow (Ephemeral Mode)

```
1. User uploads CSV/PDF
   ↓
2. Frontend validates file
   ↓
3. POST /api/upload (ephemeral_mode=true)
   ↓
4. Backend processes:
   - Parse file → transactions
   - Apply exclusions
   - Classify transactions
   - Generate reports
   - Include report_data in response
   - Delete generated files
   ↓
5. Frontend receives report_data
   ↓
6. Navigate to Report page with data in state
   ↓
7. Display results immediately (no polling)
```

### Upload Flow (Persistent Mode)

```
1. User uploads CSV/PDF
   ↓
2. POST /api/upload (ephemeral_mode=false)
   ↓
3. Backend processes and saves files
   ↓
4. Frontend receives job_id
   ↓
5. Poll GET /api/jobs/{job_id} every 5s
   ↓
6. When status="completed", fetch report
   ↓
7. Display results with download buttons
```

---

## Testing

### Backend Tests

**Location**: `backend/tests/`

**Test Categories**:
1. **Unit Tests**: Individual components
2. **Integration Tests**: End-to-end flows
3. **Property-Based Tests**: Hypothesis testing

**Run Tests**:
```bash
cd backend
python -m pytest tests/ -v
python -m pytest tests/ --cov=backend --cov-report=html
```

**Key Test Files**:
- `test_api_endpoints.py` - API endpoint tests
- `test_csv_parser.py` - CSV parsing tests
- `test_pdf_parser.py` - PDF parsing tests
- `test_classification_engine.py` - Classification tests
- `test_exclusion_engine.py` - Exclusion tests

---

### Frontend Tests

**Location**: `frontend/src/`

**Test Types**:
1. **Component Tests**: React Testing Library
2. **API Tests**: Mock API responses
3. **E2E Tests**: Full user flows

**Run Tests**:
```bash
cd frontend
npm test
npm run test:coverage
```

---

## Configuration

### Backend Configuration

**Environment Variables** (`.env`):
```bash
# Server
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development

# Security
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000

# Storage
DATABASE_URL=sqlite:///./tax_analyzer.db
EPHEMERAL_MODE_DEFAULT=true

# Logging
LOG_LEVEL=INFO
```

---

### Frontend Configuration

**Environment Variables** (`.env`):
```bash
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Tax Deduction Analyzer
```

---

## Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

**Quick Deploy**:
1. Backend: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
2. Frontend: `npm run build` → Deploy `dist/` folder

---

## Contributing

### Code Style

**Python**:
- PEP 8 compliant
- Type hints required
- Docstrings for all public functions

**TypeScript**:
- ESLint + Prettier
- Strict type checking
- JSDoc comments for complex functions

### Adding New Features

1. Update data models in `schemas.py`
2. Add processing logic in `processing/`
3. Update API endpoints in `endpoints.py`
4. Add frontend components/pages
5. Write tests
6. Update documentation

---

## Troubleshooting

### Common Issues

**PDF Parser Not Working**:
- Check debug logs in backend console
- Verify date format matches bank statement
- Ensure amounts are being extracted

**Classification Not Working**:
- Check `backend/config/rules.json`
- Verify merchant names are extracted correctly
- Adjust confidence threshold

**Frontend Not Connecting**:
- Check CORS settings in `backend/main.py`
- Verify API URL in `.env`
- Check network tab in browser DevTools

---

## License

[Your License Here]

## Author

**Samuel Rath**

---

*Last updated: March 2026*
