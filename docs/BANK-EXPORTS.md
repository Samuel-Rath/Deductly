# Bank statement export instructions

The CSV parser auto-detects column names — any Australian bank CSV with recognisable headers for date, description, and amount (or debit/credit) will parse without bank-specific configuration. This page lists the export path for banks that have been verified to work.

If your bank isn't listed, export to CSV and try it — the parser is header-driven, not bank-specific.

## Commonwealth Bank (CommBank)

**Columns:** `Date, Description, Amount` (negative = debit)

1. Log in → **Accounts** → select account
2. Click **Export** (top right of transaction list)
3. Choose date range → select **CSV**
4. Download and upload directly

## NAB (National Australia Bank)

**Columns:** `Date, Amount, Type, Description` — uses `DD Mon YY` dates (e.g. `23 Oct 25`)

1. Log in → **Accounts** → select account
2. **Download transactions** → choose date range
3. Select **CSV** → Download
4. Upload directly — NAB's date format is handled automatically

## Westpac

**Columns:** `Date, Narrative, Debit Amount, Credit Amount, Balance` — separate debit/credit columns

1. Log in → **Accounts** → select account
2. **Search & export** tab
3. Choose date range → **Comma Separated Values (.csv)**
4. Download and upload directly

## ANZ

**Columns:** `Date, Amount, Description` (negative = debit)

1. Log in → **Accounts** → select account
2. **Export** → choose date range → **CSV**

## ING

**Columns:** `Date, Description, Credit, Debit` — separate credit/debit columns

1. Log in → **My accounts** → select account
2. Click the **download** icon → choose date range
3. Select **CSV** → Download

## Bendigo Bank

**Columns:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → **Transaction History**
2. **Export** → choose date range → **CSV**

## Macquarie Bank

**Columns:** `Date, Description, Debit, Credit, Balance`

1. Log in → **Accounts** → select account → **Transactions**
2. **Export** → date range → **CSV**

## Bank of Queensland (BOQ)

**Columns:** `Date, Description, Debit, Credit`

1. Log in → **Accounts** → select account
2. **Export / Download** → date range → **CSV**

## Suncorp

**Columns:** `Date, Description, Amount`

1. Log in → **Accounts** → select account → **Transaction history**
2. **Export** → date range → **CSV**

## St. George / Bank of Melbourne / BankSA (Westpac Group)

Same format as Westpac — `Date, Narrative, Debit Amount, Credit Amount`.

1. Log in → **Accounts** → select account
2. **Search & export** → date range → **CSV**

## BankWest

**Columns:** `Date, Narrative, Debit, Credit`

1. Log in → **Accounts** → select account
2. **Download** icon → date range → **CSV**

## Up Bank / Ubank / 86 400

Digital banks typically export ISO dates (`YYYY-MM-DD`) with standard `Description, Amount` columns — supported automatically.

## PDF statements

PDF support uses pdfplumber (primary) with PyPDF2 as fallback. Machine-generated PDFs from internet banking parse much more reliably than scanned images or print-to-PDF documents.

Tips for better PDF results:

- Use the bank's **Download statement** option, not Print to PDF
- Statements with clear tabular formatting parse best
- If PDF parsing returns unexpected results, download the same period as a CSV — CSV is always more reliable

## Common gotchas

| Issue | What to do |
|---|---|
| Date range too short | Export at least 3 months; 12 months ideal for a full income year |
| Multiple accounts | Export each account separately and upload one at a time |
| Foreign currency | Include them — amounts are left as-is; no FX conversion is performed |
| Excel `.xlsx` format | Save as CSV first (File → Save As → CSV) |
| Opening balance row | The exclusion engine filters it out automatically |
| File won't upload | Must be ≤10 MB and have a `.csv` or `.pdf` extension |

## How column detection works

The parser matches header names against these patterns (case-insensitive):

| Column | Accepted header names |
|---|---|
| Date | `date`, `transaction date`, `trans date`, `posting date`, `value date` |
| Description | `description`, `details`, `narrative`, `transaction details`, `merchant`, `payee`, `memo` |
| Amount (single) | `amount`, `value`, `transaction amount` |
| Debit (split) | `debit`, `debit amount`, `withdrawal`, `withdrawals`, `money out` |
| Credit (split) | `credit`, `credit amount`, `deposit`, `deposits`, `money in` |

Full parser walk-through: [`ARCHITECTURE.md`](ARCHITECTURE.md#step-2--parsing).
