# PDF Support Implementation Complete

## Overview
PDF bank statement parsing has been fully implemented. Users can now upload both CSV and PDF files.

## Installation Required

### Install PDF Parsing Libraries
Run this command in your backend directory:

```bash
pip install PyPDF2>=3.0.0 pdfplumber>=0.10.0
```

Or install all requirements:

```bash
pip install -r backend/requirements.txt
```

## Implementation Details

### 1. PDF Parser Module (`backend/processing/pdf_parser.py`)
Created a comprehensive PDF parser that:
- Supports two parsing methods: pdfplumber (primary) and PyPDF2 (fallback)
- Extracts transaction data from PDF tables and text
- Handles multiple date formats (DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY)
- Parses monetary amounts with various formats ($123.45, -50.00, 1,234.56)
- Converts extracted data to CSV format for processing

### 2. Backend Endpoint Updates (`backend/api/endpoints.py`)
- Added PDF to `ALLOWED_CONTENT_TYPES`
- Imports `PDFParser` and `io` modules
- Detects PDF files by content type
- Converts PDF to CSV before processing
- Handles PDF parsing errors gracefully
- Logs PDF conversion events

### 3. Frontend Updates
- Re-enabled PDF file acceptance in file input (`accept=".csv,.pdf"`)
- Updated validation to accept both CSV and PDF
- Updated UI text to show "CSV or PDF" support
- Updated Landing page to mention both formats

### 4. Dependencies (`backend/requirements.txt`)
Added:
- `PyPDF2>=3.0.0` - PDF reading and text extraction
- `pdfplumber>=0.10.0` - Advanced PDF table extraction

## How It Works

### PDF Processing Flow
1. User uploads PDF file
2. Backend validates file type and size
3. PDF is saved temporarily
4. `PDFParser` extracts transactions:
   - First tries `pdfplumber` for table extraction
   - Falls back to `PyPDF2` for text extraction
   - Uses regex patterns to identify dates, descriptions, amounts
5. Transactions are converted to CSV format
6. CSV is processed through existing pipeline
7. Reports are generated as normal

### Supported PDF Formats
The parser handles:
- **Table-based statements** (most common) - extracted via pdfplumber
- **Text-based statements** - extracted via PyPDF2 with regex
- **Multiple date formats**: DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY
- **Various amount formats**: $123.45, -50.00, 1,234.56, 1,234.56

### Supported Banks
Works with PDF statements from:
- CommBank
- NAB
- Westpac
- ANZ
- ING

## Testing

### Manual Testing
1. Restart the backend server (to load new dependencies)
2. Upload a PDF bank statement
3. Verify transactions are extracted correctly
4. Check that reports are generated

### Error Handling
If PDF parsing fails:
- User receives 400 error with message "Failed to parse PDF: [error details]"
- Backend logs the error for debugging
- User can try uploading CSV instead

## Logging

PDF-related events logged:
- `pdf_conversion_started` - When PDF parsing begins
- `pdf_conversion_completed` - When PDF successfully converted (includes transaction count)
- `pdf_conversion_failed` - When PDF parsing fails (includes error details)

## Known Limitations

1. **PDF Format Variations**: Some banks may use unique PDF formats that require custom parsing logic
2. **Scanned PDFs**: PDFs that are scanned images (not text-based) won't work without OCR
3. **Complex Layouts**: PDFs with very complex layouts may not parse correctly

## Future Improvements

1. **OCR Support**: Add OCR for scanned PDF statements using `pytesseract`
2. **Bank-Specific Parsers**: Create specialized parsers for each bank's PDF format
3. **PDF Validation**: Add preview of extracted transactions before processing
4. **Better Error Messages**: Show specific parsing issues to help users

## Troubleshooting

### "Failed to parse PDF" Error
- Ensure PDF is text-based (not a scanned image)
- Try exporting statement as CSV instead
- Check if PDF is password-protected (not supported)

### No Transactions Found
- PDF may have unusual format
- Try a different date range
- Export as CSV for guaranteed compatibility

### Installation Issues
If `pdfplumber` fails to install:
```bash
# Try installing dependencies separately
pip install Pillow
pip install pdfminer.six
pip install pdfplumber
```

## Files Modified

### Backend
- `backend/processing/pdf_parser.py` (NEW) - PDF parsing logic
- `backend/api/endpoints.py` - Added PDF handling
- `backend/requirements.txt` - Added PDF libraries

### Frontend
- `frontend/src/pages/Upload.tsx` - Re-enabled PDF support
- `frontend/src/pages/Landing.tsx` - Updated text for PDF support

## Next Steps

1. **Install dependencies**: `pip install -r backend/requirements.txt`
2. **Restart backend**: Stop and restart the backend server
3. **Test with PDF**: Upload a PDF bank statement
4. **Monitor logs**: Check for any parsing errors
5. **Iterate**: Improve parser based on real-world PDF formats
