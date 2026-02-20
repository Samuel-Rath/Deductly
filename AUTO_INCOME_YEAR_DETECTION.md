# Automatic Income Year Detection

## Overview
The system now automatically detects the income year from transaction dates in uploaded files. Users no longer need to specify the income year manually.

## Changes Made

### 1. Backend Changes (`backend/api/endpoints.py`)

#### Made Income Year Optional
- Changed `income_year: str = Form(...)` to `income_year: Optional[str] = Form(None)`
- Income year is now optional in the upload endpoint
- If not provided, it will be auto-detected from transaction dates

#### Added Auto-Detection Function
Created `_detect_income_year_from_csv()` helper function that:
- Reads the CSV file and finds the date column
- Parses all transaction dates using multiple date formats
- Determines which Australian income year (July 1 - June 30) contains the most transactions
- Returns the detected income year in "YYYY-YYYY" format

#### Auto-Detection Logic
```python
# For each transaction date:
if month >= 7:  # July to December
    income_year = f"{year}-{year + 1}"
else:  # January to June
    income_year = f"{year - 1}-{year}"

# Returns the income year with the most transactions
```

#### Fallback Behavior
If auto-detection fails:
- Defaults to current income year based on today's date
- Logs the failure and the default value used
- Processing continues normally

### 2. Frontend Changes

#### API Client (`frontend/src/api/client.ts`)
- Made `incomeYear` optional in `UploadRequest` interface
- Only appends `income_year` to FormData if provided
- Otherwise, backend will auto-detect

#### Upload Page (`frontend/src/pages/Upload.tsx`)
- Removed manual income year calculation
- Simplified `handleUpload` function
- No longer sends income year to backend (will be auto-detected)

### 3. Updated UI Text
- Info section now says: "The income year will be automatically detected from your transaction dates"
- No income year selector visible to users
- Cleaner, simpler upload experience

## How It Works

### Upload Flow
1. User uploads CSV or PDF file
2. Backend receives file without income year parameter
3. If PDF, converts to CSV first
4. Auto-detection function:
   - Finds date column in CSV
   - Parses all transaction dates
   - Counts transactions per income year
   - Returns the income year with most transactions
5. Processing continues with detected income year
6. Report is generated with correct income year

### Example Scenarios

#### Scenario 1: Full Year Statement
- Transactions from July 2023 to June 2024
- Detected income year: "2023-2024" ✅

#### Scenario 2: Partial Year Statement
- Transactions from January 2024 to March 2024
- All dates fall in "2023-2024" income year
- Detected income year: "2023-2024" ✅

#### Scenario 3: Multi-Year Statement
- Transactions from:
  - 10 transactions in "2022-2023"
  - 50 transactions in "2023-2024"
  - 5 transactions in "2024-2025"
- Detected income year: "2023-2024" (most transactions) ✅

#### Scenario 4: Detection Fails
- No valid dates found or parsing error
- Falls back to current income year
- User can still process the file ✅

## Benefits

### For Users
1. **Simpler Experience** - No need to select income year
2. **No Errors** - Can't select wrong income year
3. **Faster Upload** - One less field to fill
4. **Works with Any Statement** - Handles any date range

### For System
1. **Accurate Detection** - Based on actual transaction dates
2. **Flexible** - Works with partial year statements
3. **Robust** - Fallback to current year if detection fails
4. **Logged** - All detection events are logged for debugging

## Logging

New log events:
- `income_year_auto_detection_started` - When detection begins
- `income_year_auto_detected` - When successfully detected (includes detected year)
- `income_year_detection_failed` - When detection fails (includes error)
- `income_year_defaulted` - When fallback to current year (includes default year)

## Testing

### Manual Testing
1. Upload a CSV with transactions from 2023-2024
2. Check backend logs for detected income year
3. Verify report shows correct income year
4. Try with different date ranges

### Edge Cases Tested
- ✅ Full year statement (July to June)
- ✅ Partial year statement (few months)
- ✅ Multi-year statement (spans multiple income years)
- ✅ Invalid dates (falls back to current year)
- ✅ No dates found (falls back to current year)

## Future Enhancements

1. **Show Detected Year** - Display detected income year to user before processing
2. **Allow Override** - Let users override detected year if needed
3. **Multiple Years** - Support generating reports for multiple income years from one statement
4. **Date Range Display** - Show transaction date range in report

## Backwards Compatibility

The system still accepts `income_year` parameter if provided:
- Old API clients can still send income year
- New clients can omit it for auto-detection
- Both approaches work seamlessly

## Conclusion

Users can now upload any bank statement from any time period, and the system will automatically determine the correct income year. This makes the tool more flexible and easier to use, while maintaining accuracy through intelligent date analysis.
