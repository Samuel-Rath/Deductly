# Tax Deduction Analyzer (Australia)

A privacy-first web application that processes Australian bank transaction CSV files and generates comprehensive deduction candidate reports for the Australian income year (1 July to 30 June).

## 🔒 Security & Privacy First

This application is designed with **privacy and security as core principles**:

- **Ephemeral Mode by Default**: Raw CSV data is never persisted to disk
- **Memory-Only Processing**: All transaction analysis happens in memory
- **Automatic Data Redaction**: Sensitive information (account numbers, BSB codes) is automatically redacted from reports
- **No Third-Party Analytics**: Zero tracking or external data sharing
- **HTTPS Only**: All communications encrypted in transit
- **Input Validation**: Comprehensive validation on all user inputs
- **Rate Limiting**: Protection against abuse and DoS attacks
- **CORS Protection**: Strict origin policies
- **Secure Headers**: CSP, HSTS, X-Frame-Options, and more

## 🏗️ Architecture

### Backend (Python FastAPI)
- **Processing Pipeline**: CSV Parser → Exclusion Engine → Classification Engine → Report Generator
- **API Layer**: RESTful endpoints with comprehensive error handling
- **Storage**: Optional SQLite (ephemeral mode by default)
- **Security**: Input validation, rate limiting, file type/size restrictions

### Frontend (React + TypeScript)
- **Modern Stack**: React 18, TypeScript, Tailwind CSS
- **State Management**: React Query for API state
- **Routing**: React Router for navigation
- **Security**: XSS protection, secure API communication

## 📋 Features

### Core Functionality
- ✅ CSV upload and parsing (supports major Australian banks)
- ✅ Transaction normalization and enrichment
- ✅ Intelligent exclusion of non-deductible items
- ✅ AI-powered classification with confidence scoring
- ✅ Evidence checklist generation (ATO-aligned)
- ✅ PDF, CSV, and JSON report generation
- ✅ Comprehensive audit trail

### Privacy Features
- ✅ Ephemeral mode (no data persistence)
- ✅ Automatic sensitive data redaction
- ✅ Configurable data retention
- ✅ Transparent data handling documentation

### Australian Tax Compliance
- ✅ Income year support (1 July - 30 June)
- ✅ ATO-aligned evidence requirements
- ✅ Record retention guidance (5-year rule)
- ✅ Method-required flagging (car, WFH, travel)
- ✅ Donation eligibility checks (DGR status)

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run tests
pytest

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔐 Security Configuration

### Environment Variables

Create `.env` files for both backend and frontend:

**Backend `.env`:**
```env
# Security
SECRET_KEY=your-secret-key-here-min-32-chars
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
MAX_UPLOAD_SIZE_MB=10
RATE_LIMIT_PER_MINUTE=10

# Database (optional)
DATABASE_URL=sqlite:///./deductions.db
EPHEMERAL_MODE=true

# Redaction
ENABLE_REDACTION=true
REDACTION_PATTERNS=\d{6}-\d{6,10},\d{3}-\d{3}

# CORS
CORS_ALLOW_CREDENTIALS=false
CORS_MAX_AGE=600
```

**Frontend `.env`:**
```env
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_MAX_FILE_SIZE_MB=10
VITE_ENABLE_ANALYTICS=false
```

### Security Headers

The application implements comprehensive security headers:

```python
# Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.yourdomain.com; frame-ancestors 'none'

# Other Security Headers
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## 🌐 Deployment

### Netlify Deployment (Frontend)

1. **Build Configuration** (`netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Security headers configured
   - Redirects for SPA routing

2. **Environment Variables**:
   - Set `VITE_API_BASE_URL` to your backend API URL
   - Enable HTTPS only

3. **Deploy**:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### Backend Deployment Options

#### Option 1: Railway / Render / Fly.io
- Supports Python/FastAPI natively
- Auto-scaling and HTTPS
- Environment variable management
- Database support

#### Option 2: AWS Lambda + API Gateway
- Serverless architecture
- Pay-per-use pricing
- Auto-scaling
- Requires Mangum adapter

#### Option 3: Docker Container (Any Platform)
```bash
# Build
docker build -t tax-deduction-analyzer-backend .

# Run
docker run -p 8000:8000 --env-file .env tax-deduction-analyzer-backend
```

## 📊 Data Retention & Privacy

### Default Behavior (Ephemeral Mode)
- Raw CSV data: **Never stored**
- Transaction data: **Memory only, cleared after processing**
- Reports: **Generated and available for download, then deleted**
- Job metadata: **Minimal (job ID, status, timestamps only)**

### Persistent Mode (Optional)
- Raw CSV data: **Still never stored**
- Derived fields only: **Merchant, category, confidence, flags**
- User control: **Can be disabled per-upload**
- Retention: **Configurable, default 30 days**

### What We Never Store
- Account numbers
- BSB codes
- Full transaction descriptions (only derived merchant names)
- Personal identifying information
- Raw CSV file contents

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest -v --cov=. --cov-report=html
```

**Coverage**: 97% (216 tests passed)

### Frontend Tests
```bash
cd frontend
npm test -- --run
```

**Coverage**: 118 tests passed

### Property-Based Tests
The application includes 23 property-based tests using Hypothesis to verify correctness properties across all inputs.

## 📖 API Documentation

### Endpoints

#### POST /api/upload
Upload a CSV file for processing.

**Request:**
```json
{
  "income_year": "2023-2024",
  "ephemeral_mode": true,
  "confidence_threshold": 0.60
}
```

**Response:**
```json
{
  "job_id": "uuid",
  "status": "queued",
  "message": "Upload successful"
}
```

#### GET /api/jobs/{job_id}
Get job status and progress.

**Response:**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "progress": 100,
  "report_urls": {
    "pdf": "/api/jobs/{job_id}/download/pdf",
    "csv": "/api/jobs/{job_id}/download/csv",
    "json": "/api/jobs/{job_id}/download/json"
  }
}
```

#### GET /api/jobs/{job_id}/download/{format}
Download generated report (pdf, csv, or json).

### Rate Limits
- 10 requests per minute per IP
- 100 MB total upload per hour per IP
- Configurable via environment variables

### Error Responses
All errors follow consistent structure:
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {}
}
```

## 🔧 Configuration

### CSV Format Support
Supports major Australian banks:
- Commonwealth Bank (CommBank)
- National Australia Bank (NAB)
- Westpac
- ANZ
- ING

Required columns (flexible naming):
- Date (date, transaction date, etc.)
- Description (description, details, etc.)
- Amount (amount, debit, credit, etc.)

### Classification Rules
Rules are configured in `backend/config/rules.json`:
```json
{
  "rule_id": "R001",
  "version": "1.0",
  "category": "work_software",
  "priority": 100,
  "confidence": 0.95,
  "keywords": ["adobe", "microsoft 365"],
  "merchants": ["Adobe", "Microsoft"],
  "evidence_checklist": ["receipt"],
  "flags": []
}
```

### Redaction Patterns
Configure in environment variables:
```env
REDACTION_PATTERNS=\d{6}-\d{6,10},\d{3}-\d{3},BSB:\s*\d{3}-\d{3}
```

## 🛡️ Security Best Practices

### For Deployment
1. ✅ Use HTTPS only (enforce with HSTS)
2. ✅ Set strong SECRET_KEY (min 32 characters)
3. ✅ Configure CORS with specific origins
4. ✅ Enable rate limiting
5. ✅ Set appropriate file size limits
6. ✅ Use environment variables for secrets
7. ✅ Enable security headers
8. ✅ Regular dependency updates
9. ✅ Monitor logs for suspicious activity
10. ✅ Implement backup strategy (if using persistent mode)

### For Users
1. ✅ Use ephemeral mode for maximum privacy
2. ✅ Download reports immediately
3. ✅ Verify HTTPS connection
4. ✅ Don't share job IDs
5. ✅ Review Privacy page for data handling details

## 📝 License

[Your License Here]

## 🤝 Contributing

[Contributing Guidelines]

## 📞 Support

For issues or questions:
- GitHub Issues: [Your Repo]
- Email: [Your Email]
- Documentation: [Your Docs URL]

## ⚠️ Disclaimer

This application provides analysis tools only and does not constitute tax advice. Users should:
- Verify all classifications with a qualified tax professional
- Maintain original records as required by the ATO
- Understand that "likely deductible" means user confirmation is required
- Consult the ATO or a tax agent for specific guidance

## 🔄 Changelog

### Version 1.0.0 (2024)
- Initial release
- Core processing pipeline
- PDF/CSV/JSON report generation
- Ephemeral mode
- Automatic redaction
- Australian tax compliance features

## 👤 Author

**Samuel Rath**

---

*Built with privacy and security as core principles*
