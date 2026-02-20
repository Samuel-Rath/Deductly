# Income Year Auto-Detection Fix

## Issue
User reported "income year is not defined" error when uploading files.

## Root Cause
The income year selector was removed from the UI, but the income year calculation was moved inside the upload handler. The backend was expecting the income_year parameter but there may have been issues with how it was being sent or validated.

## Changes Made

### 1. Backend Changes (backend/api/endpoints.py)
- Made `income_year` a required parameter: `Form(...)` instead of `Form("2023-2024")`
- Added PDF to `ALLOWED_CONTENT_TYPES` list
- Added explicit check to reject PDF files with helpful error message (PDF parsing not yet implemented)
- Added better logging for income_year validation errors
- Updated error messages to mention both CSV and PDF

### 2. Frontend Changes (frontend/src/pages/Upload.tsx)
- Income year is now auto-calculated based on current date and Australian financial year (July 1 - June 30)
- Added console.log to debug income year calculation
- Added validation to reject PDF files with message "PDF support is coming soon"
- Updated UI text to say "CSV files only • PDF support coming soon"
- Reverted file input to only accept `.csv` files
- Updated info section to clarify CSV only for now

### 3. Landing Page Updates (frontend/src/pages/Landing.tsx)
- Reverted text to mention CSV only
- Removed PDF references until parsing is implemented

## Income Year Calculation Logic

```typescript
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1 // 1-12

// Australian financial year runs July 1 - June 30
const incomeYear = currentMonth < 7 
  ? `${currentYear - 1}-${currentYear}`  // Before July: use previous year
  : `${currentYear}-${currentYear + 1}`  // July onwards: use current year
```

### Examples:
- February 2026 → "2025-2026" (we're in the 2025-2026 financial year)
- August 2026 → "2026-2027" (we're in the 2026-2027 financial year)

## PDF Support Status

### Current State
- Frontend: Validates and rejects PDF files with helpful message
- Backend: Rejects PDF files with 400 error and message "PDF support is coming soon"
- UI: Shows "CSV files only • PDF support coming soon"

### To Implement PDF Support
See `PDF_SUPPORT_TODO.md` for implementation details.

## Testing
1. Upload a CSV file - should work with auto-detected income year
2. Try to upload a PDF file - should show error message "PDF support is coming soon"
3. Check browser console - should see "Uploading with income year: YYYY-YYYY"
4. Check backend logs - should see income_year being received

## Next Steps
1. Test CSV upload to verify income year is working
2. Implement PDF parsing (see PDF_SUPPORT_TODO.md)
3. Once PDF parsing is ready, remove the PDF rejection logic
4. Update UI to show PDF support is available
