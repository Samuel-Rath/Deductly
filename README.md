# Tax Deduction Analyzer

Australian tax deduction candidate analysis system for the income year (1 July to 30 June).

## Project Structure

```
.
├── backend/
│   ├── api/              # FastAPI endpoints
│   ├── processing/       # CSV parsing, exclusion, classification
│   ├── models/           # Pydantic data models
│   ├── tests/            # Backend tests
│   ├── main.py           # FastAPI application entry point
│   ├── requirements.txt  # Python dependencies
│   └── pytest.ini        # Pytest configuration
│
└── frontend/
    ├── src/
    │   ├── api/          # API client functions
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   └── test/         # Test utilities
    ├── package.json      # Node dependencies
    ├── vite.config.ts    # Vite configuration
    ├── tailwind.config.js # Tailwind CSS configuration
    └── tsconfig.json     # TypeScript configuration
```

## Backend Setup

### Prerequisites
- Python 3.11+
- pip

### Installation

```bash
cd backend
pip install -r requirements.txt
```

**Note for Windows users:** The default PDF library is ReportLab, which works well on Windows. If you want to use WeasyPrint instead, you'll need to install GTK+ first:
1. Download GTK+ for Windows from https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer
2. Install GTK+
3. Run: `pip install weasyprint`

For development, ReportLab is sufficient and easier to set up.

### Running the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API will be available at http://localhost:8000

### Running Backend Tests

```bash
cd backend
pytest
```

## Frontend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Running the Frontend

```bash
cd frontend
npm run dev
```

The application will be available at http://localhost:3000

### Running Frontend Tests

```bash
cd frontend
npm test
```

## Technology Stack

### Backend
- FastAPI - Web framework
- pandas - Data processing
- rapidfuzz - Fuzzy string matching
- WeasyPrint - PDF generation
- pydantic - Data validation
- hypothesis - Property-based testing
- pytest - Testing framework

### Frontend
- React 18 - UI framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- React Query - API state management
- Vitest - Testing framework
- Vite - Build tool

## Development

### Backend Development
- API endpoints: `backend/api/`
- Processing pipeline: `backend/processing/`
- Data models: `backend/models/`
- Tests: `backend/tests/`

### Frontend Development
- Components: `frontend/src/components/`
- Pages: `frontend/src/pages/`
- API client: `frontend/src/api/`
- Tests: `frontend/src/**/*.test.tsx`

## Testing

### Backend Testing
- Unit tests: `pytest -m unit`
- Property-based tests: `pytest -m property_test`
- Integration tests: `pytest -m integration`
- Coverage: `pytest --cov`

### Frontend Testing
- Run tests: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

## License

Proprietary
