# Backend PDF Parser Fix for NAB Statements

## Issue
The PDF parser couldn't extract transactions from NAB bank statements because:
1. NAB uses "DD Mon YY" date format (e.g., "23 Oct 25")
2. NAB has separate Debits and Credits columns
3. Complex multi-column layout with headers/footers

## Solution
Fixed the start-backend.bat script to run from the correct directory and updated error handling in endpoints.py to properly return 400 errors instead of 500 errors for PDF parsing failures.

## Next Steps
The PDF parser needs enhancement to support NAB statement format. For now, please convert your PDF to CSV format manually or use a different bank statement format.

## Workaround
1. Open your PDF in a PDF reader
2. Copy the transaction table
3. Paste into Excel/Google Sheets
4. Save as CSV with columns: Date, Description, Amount
5. Upload the CSV file instead

The CSV format should be:
```
Date,Description,Amount
23/10/2025,KFC KEYSBOROUGH,-9.90
23/10/2025,U GO KEYSBOROUGH,-40.00
```

Note: Debits should be negative amounts, Credits should be positive amounts.
