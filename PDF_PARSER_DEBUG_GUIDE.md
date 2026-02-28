# PDF Parser Debug Guide

## Problem
PDF uploads are showing $0.00 for deductible amounts - transactions aren't being classified as deductible.

## Possible Causes

1. **PDF not being parsed** - No transactions extracted
2. **Amounts not extracted** - Transactions found but amounts are $0
3. **Descriptions not clean** - Merchant names not extracted properly
4. **Classification failing** - Transactions don't match deduction rules

## Debug Steps Added

I've added extensive debug logging to the PDF parser. When you upload a PDF, you'll now see in the backend console:

```
=== PDF PARSER DEBUG: First 20 lines ===
0: Bank Statement
1: Account: 123456789
2: Date Particulars Debits Credits Balance
3: 23 Oct 25 ATLASSIAN 49.00 1000.00
...
=== END DEBUG ===

Started new transaction: date=23 Oct 25, desc_start=ATLASSIAN 49.00 1000.00
Extracting amount from: ATLASSIAN 49.00 1000.00
  Found amount: $49.0 at position 10
  Found amount: $1000.0 at position 16
  Total amounts found: 2
  Using second-to-last amount as transaction: $49.0
  Is credit: False
  Final: amount=$-49.0, desc=ATLASSIAN

Created transaction: ATLASSIAN - $49.0
=== TOTAL TRANSACTIONS PARSED: 1 ===
```

## How to Debug

1. **Restart backend**:
   ```bash
   # Stop current backend (Ctrl+C)
   start-backend.bat
   ```

2. **Upload your PDF** through the frontend

3. **Check backend console** - Look for the debug output

4. **Share the output** with me so I can see:
   - What the PDF structure looks like
   - If transactions are being found
   - If amounts are being extracted
   - If descriptions are clean

## Common Issues & Fixes

### Issue 1: No transactions found
**Symptoms**: `TOTAL TRANSACTIONS PARSED: 0`

**Causes**:
- Date pattern doesn't match your bank's format
- Transaction section not detected

**Fix**: Adjust date pattern or section detection

### Issue 2: Amounts are $0
**Symptoms**: Transactions found but `amount=$0`

**Causes**:
- Amount pattern doesn't match format
- Amounts in wrong position

**Fix**: Adjust amount extraction logic

### Issue 3: Descriptions are wrong
**Symptoms**: Descriptions like "Transaction" or numbers

**Causes**:
- Description cleaning too aggressive
- Amounts not being removed properly

**Fix**: Adjust description cleanup logic

### Issue 4: Not classified as deductible
**Symptoms**: Transactions parsed correctly but $0 deductible

**Causes**:
- Merchant names not extracted
- Descriptions don't match rules

**Fix**: Check classification rules in `backend/config/rules.json`

## Quick Test

To verify the parser is working, check if you see these logs:

✅ `Found transaction section` - Parser found the transactions
✅ `Started new transaction` - Date pattern matched
✅ `Found amount: $X` - Amount extraction working
✅ `Created transaction` - Transaction successfully created
✅ `TOTAL TRANSACTIONS PARSED: X` - X should be > 0

If any of these are missing, that's where the problem is.

## Next Steps

1. Run the backend with debug logging
2. Upload your PDF
3. Copy the console output
4. Share it with me
5. I'll fix the specific issue

## Manual Test

You can also test the parser directly:

```python
from backend.processing.pdf_parser import PDFParser
import io

parser = PDFParser()

with open('your_statement.pdf', 'rb') as f:
    pdf_bytes = io.BytesIO(f.read())
    transactions = parser.parse(pdf_bytes)
    
print(f"Found {len(transactions)} transactions")
for txn in transactions[:5]:  # First 5
    print(f"{txn.date} - {txn.description} - ${txn.absolute_amount}")
```

This will show you exactly what's being parsed.
