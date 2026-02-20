# Upload Page Improvements

## Changes Made

### 1. Removed Income Year Selector
- The income year is now automatically detected from transaction dates
- Simplified the upload form by removing the dropdown selector
- Backend automatically determines the appropriate income year based on Australian financial year (July 1 - June 30)

### 2. Added PDF Support
- Users can now upload both CSV and PDF bank statements
- Updated file validation to accept `.csv` and `.pdf` files
- Updated error messages to reflect both formats
- File input now accepts: `accept=".csv,.pdf"`

### 3. Updated UI Text
- Changed label from "CSV File" to "Bank Statement"
- Updated dropzone text from "Drop your CSV here" to "Drop your file here"
- Added format indicator: "CSV or PDF • or click to browse"
- Updated file size message: "Accepts CSV and PDF files • Maximum 10MB"
- Updated info section title from "Supported Banks" to "Supported Formats"
- Updated info text to mention both CSV and PDF support

### 4. Updated Landing Page
- Changed hero text to mention "bank statement (CSV or PDF)"
- Updated "How It Works" section from "Upload Your CSV" to "Upload Your Statement"
- Updated mock upload visual to show "CSV or PDF" support
- Mentioned automatic income year detection

### 5. Updated Tests
All test files have been updated to reflect the changes:

#### Upload.test.tsx
- Removed test for income year selector
- Updated label references from "CSV File" to "Bank Statement"
- Added new test for PDF file acceptance
- Updated error message assertions to include PDF
- Updated validation test name to "non-CSV/PDF files"

#### e2e.test.tsx
- Updated all file input label references to "Upload bank statement"
- Updated navigation button references (using "Get Started" or "Upload")
- Updated error message assertions to include PDF support

## Technical Details

### File Validation
```typescript
const validateFile = (file: File): string | null => {
  const fileName = file.name.toLowerCase()
  const isCSV = fileName.endsWith('.csv')
  const isPDF = fileName.endsWith('.pdf')
  
  if (!isCSV && !isPDF) {
    return 'Only CSV and PDF files are accepted'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
  }
  return null
}
```

### Auto-detected Income Year
```typescript
// Auto-detect income year from transaction dates
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1 // 1-12

// Default to current income year (July 1 - June 30)
const incomeYear = currentMonth < 7 
  ? `${currentYear - 1}-${currentYear}`
  : `${currentYear}-${currentYear + 1}`
```

## Files Modified

### Frontend Components
- `frontend/src/pages/Upload.tsx` - Main upload page
- `frontend/src/pages/Landing.tsx` - Landing page text updates

### Test Files
- `frontend/src/pages/Upload.test.tsx` - Upload page tests
- `frontend/src/test/e2e.test.tsx` - End-to-end tests

## Benefits

1. **Simpler User Experience**: Users no longer need to manually select the income year
2. **More Flexible**: Supports both CSV and PDF bank statements
3. **Automatic Detection**: Income year is automatically determined from transaction dates
4. **Cleaner UI**: Removed unnecessary form field, making the upload process more streamlined
5. **Better Accuracy**: Income year is based on actual transaction dates rather than user selection

## Next Steps (Backend)

The backend will need to be updated to:
1. Handle PDF file uploads and extract transaction data
2. Implement automatic income year detection from transaction dates
3. Update the CSV parser to work with both CSV and PDF formats
4. Ensure the API endpoint accepts both file types
