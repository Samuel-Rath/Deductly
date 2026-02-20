# PDF Support Implementation TODO

## Current Status
- Frontend now accepts PDF files
- Backend accepts PDF content type
- Backend does NOT yet parse PDF files

## What Needs to be Done

### 1. Install PDF Parsing Library
```bash
pip install PyPDF2 pdfplumber
```

### 2. Create PDF Parser Module
Create `backend/processing/pdf_parser.py` to extract transaction data from PDF bank statements.

### 3. Update Pipeline
Modify `backend/processing/pipeline.py` to detect file type and route to appropriate parser:
- CSV files → `csv_parser.py`
- PDF files → `pdf_parser.py`

### 4. Update Endpoint
Modify `backend/api/endpoints.py` to:
- Save PDF files with `.pdf` extension
- Pass file type to pipeline

## Temporary Workaround
For now, the system will accept PDF uploads but may fail during processing if the PDF parser is not implemented. Users should continue using CSV files until PDF parsing is fully implemented.

## Error Handling
The current error "income year is not defined" suggests the upload is failing before reaching the processing stage. This has been fixed by:
1. Adding PDF to ALLOWED_CONTENT_TYPES
2. Adding logging to track income_year parameter
3. Adding console.log in frontend to verify income_year is being sent

## Testing
After implementing PDF parsing:
1. Test with real bank statement PDFs from supported banks
2. Verify transaction extraction accuracy
3. Update tests to include PDF upload scenarios
4. Update documentation to reflect PDF support
