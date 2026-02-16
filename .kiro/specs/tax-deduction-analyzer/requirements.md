# Requirements Document

## Tax Deduction Analyzer (Australia)

## 1. Introduction

The Tax Deduction Analyzer (the System) processes Australian bank transaction CSV files and generates a deduction candidate report for the Australian income year (1 July to 30 June). (Australian Taxation Office)

The System uses a three-layer pipeline:
1. Normalisation and enrichment
2. Exclusions
3. Classification with explainability

The System outputs human-readable and machine-readable reports that help users identify likely deductible transactions, plus the evidence they may need to substantiate claims.

### 1.1 Scope (Australia)

**In scope:**
- Australian individual taxpayers and sole traders preparing records for tax time
- Work-related deductions, donations, travel, and other common deduction categories
- Evidence and record-keeping prompts aligned with Australian record-keeping expectations (Australian Taxation Office)

**Out of scope:**
- Providing tax advice, legal conclusions, or guaranteeing deductibility
- Lodging a tax return or directly integrating with myGov
- Determining intent where the bank statement alone is insufficient (the System flags these as "Needs review")

### 1.2 Definitions and Compliance Notes

The System must label outputs as "likely deductible" and require user confirmation.

Record retention guidance in the report must reference the common five-year retention rule from the date the tax return is lodged, and warn that some records may need to be kept longer depending on circumstances. (Australian Taxation Office)

For many work-related deductions, written evidence rules and exceptions apply, including the commonly referenced $300 threshold which has caveats. (Australian Taxation Office)

## 2. Glossary

- **System**: The Tax Deduction Analyzer application
- **CSV_Parser**: Reads and normalises bank CSV files
- **Transaction**: A single financial record from the bank CSV
- **Normalised_Transaction**: Standardised form with date, description, amount, direction, merchant
- **Exclusion_Engine**: Filters out transactions that are clearly not deduction candidates
- **Classification_Engine**: Categorises potential deduction candidates
- **Rules_Engine**: Keyword and merchant-based matching
- **Fuzzy_Matcher**: Handles merchant name variations (eg PayPal prefixes, reference numbers)
- **Confidence_Score**: Numeric value from 0 to 1 indicating classification certainty
- **Evidence_Checklist**: List of records that may be needed to substantiate a claim (Australian Taxation Office)
- **Deduction_Candidate**: A transaction flagged as likely deductible, subject to confirmation
- **Audit_Trail**: The reasoning record for how each transaction was processed
- **Report_Generator**: Component that produces PDF, CSV, and JSON outputs
- **Income_Year**: Australian financial year from 1 July to 30 June (Australian Taxation Office)

## 3. Assumptions and Constraints

- The income year is 1 July to 30 June and the report must display the selected income year period. (Australian Taxation Office)
- A bank CSV does not reliably capture purpose or work-related use percentage, so the System must surface uncertainty and avoid definitive statements.
- CSV formats differ across Australian banks, so the CSV_Parser must support flexible column mapping.
- Privacy by default: raw CSV data should not be retained beyond the processing session unless explicitly configured.

## 4. Functional Requirements

### Requirement 1: CSV Upload and Parsing

**User Story:** As a user, I want to upload a bank CSV so the System can analyse transactions.

#### Acceptance Criteria

1. WHEN a user uploads a CSV file, THE System SHALL accept CSV files up to a configurable maximum size
2. WHEN a CSV is uploaded, THE CSV_Parser SHALL detect and map common column variants for date, description, and amount (including separate debit and credit columns)
3. WHEN parsing amounts, THE System SHALL normalise to direction (debit or credit), absolute_amount (positive), and signed_amount (negative for debits, positive for credits)
4. WHEN the CSV format cannot be mapped, THE System SHALL return a descriptive error message listing missing required fields
5. WHEN parsing is complete, THE System SHALL produce a Normalised_Transaction dataset

### Requirement 2: Transaction Normalisation and Enrichment

**User Story:** As a user, I want messy transaction text cleaned so classification is more accurate.

#### Acceptance Criteria

1. THE System SHALL normalise whitespace, casing, and obvious reference suffixes in descriptions
2. THE System SHALL extract a best-effort merchant name from the description
3. WHEN merchant extraction fails, THE System SHALL use the original description as the merchant value
4. THE System SHALL detect recurring patterns (similar description and regular periodicity) and flag them as recurring
5. THE System SHALL detect payment rail hints including card, PayPal, BPAY, Osko, and PayID where present in description text

### Requirement 3: Exclusion of Non-Candidate Transactions

**User Story:** As a user, I want the System to remove obvious non-deduction items so the report is focused.

#### Acceptance Criteria

1. WHEN a transaction is identified as a transfer between accounts (including common Osko or PayID patterns), THE Exclusion_Engine SHALL exclude it by default
2. WHEN a transaction is a cash withdrawal or ATM withdrawal, THE Exclusion_Engine SHALL exclude it by default
3. WHEN a transaction is a loan repayment or mortgage repayment, THE Exclusion_Engine SHALL exclude it by default
4. WHEN a transaction appears to be a tax settlement payment or refund (eg ATO payment patterns), THE Exclusion_Engine SHALL exclude it and label it as tax settlement activity
5. WHEN a transaction is excluded, THE System SHALL record the exclusion reason in the Audit_Trail
6. THE System SHALL maintain an Exclusion list output section for transparency

### Requirement 4: Deduction Candidate Classification and Confidence Scoring

**User Story:** As a user, I want likely deductible items categorised with a confidence score so I can prioritise review.

#### Acceptance Criteria

1. WHEN a transaction matches a rule, THE Classification_Engine SHALL assign a category and confidence score from 0 to 1
2. WHEN merchant names vary (eg "ADOBE *1234", "PAYPAL ADOBE"), THE Fuzzy_Matcher SHALL attempt canonicalisation and matching
3. WHEN multiple rules match, THE System SHALL select the highest confidence result, with rule priority as a deterministic tie-breaker
4. WHEN confidence is below a configurable threshold (default 0.60), THE System SHALL flag the item as "Needs review"
5. THE System SHALL store the classification reason (rule id, keyword match, merchant match) in the Audit_Trail

### Requirement 5: Australia-Aligned Evidence Checklist Generation

**User Story:** As a user, I want to know what records I may need to substantiate each candidate deduction.

#### Acceptance Criteria

1. WHEN a transaction is classified as a Deduction_Candidate, THE System SHALL attach an Evidence_Checklist appropriate to the category (Australian Taxation Office)
2. THE Evidence_Checklist SHALL distinguish between written evidence (receipt or invoice), diary-style records where relevant, percentage basis records (work use percentage), and logbook-style records for car claims where relevant (Australian Taxation Office)
3. WHEN the report includes work-related deductions, THE System SHALL include a substantiation note covering the commonly referenced $300 rule and that exceptions apply (Australian Taxation Office)
4. WHEN the category is Donations, THE System SHALL require eligibility verification, including that gifts must be to an organisation with deductible gift recipient status (Australian Taxation Office)

### Requirement 6: Method-Required Items (Australia Specific)

**User Story:** As a user, I want the System to flag items where Australian claims require a method choice and extra records.

#### Acceptance Criteria

1. WHEN transactions appear car-related, THE System SHALL label them "Method required" and include method-specific evidence prompts such as logbook record-keeping (Australian Taxation Office)
2. WHEN transactions appear working-from-home related, THE System SHALL label them "Method required" and reference that record requirements depend on the method used (Australian Taxation Office)
3. WHEN transactions appear overnight travel related, THE System SHALL include travel record prompts, and note that travel diary requirements can apply in specific circumstances (Australian Taxation Office)

### Requirement 7: Deduction Category Support

**User Story:** As a user, I want practical categories that map to common Australian deduction groupings.

#### Acceptance Criteria

1. THE System SHALL support classification into "Work-related software and subscriptions" category
2. THE System SHALL support classification into "Professional memberships, licences, and registrations" category
3. THE System SHALL support classification into "Training and education (job-related)" category
4. THE System SHALL support classification into "Work-related equipment and supplies" category
5. THE System SHALL support classification into "Phone and internet (percentage required)" category
6. THE System SHALL support classification into "Working from home expenses (method required)" category (Australian Taxation Office)
7. THE System SHALL support classification into "Travel (context required)" category (Australian Taxation Office)
8. THE System SHALL support classification into "Donations (eligibility check required)" category (Australian Taxation Office)
9. THE System SHALL support classification into "Bank and account fees (income producing accounts, needs review)" category

### Requirement 8: Report Generation (PDF)

**User Story:** As a user, I want a PDF report to review and share with my accountant.

#### Acceptance Criteria

1. WHEN report generation is requested, THE Report_Generator SHALL produce a PDF file named "deduction_report.pdf"
2. THE PDF SHALL display the Income_Year period (1 July to 30 June) selected for the report (Australian Taxation Office)
3. THE PDF SHALL include summary totals by category and a grand total of candidate deductions
4. THE PDF SHALL include a line item table with date, merchant, description, amount, category, confidence score, reason, and Evidence_Checklist
5. THE PDF SHALL include a "Needs Review" section for low-confidence or method-required items
6. THE PDF SHALL include an "Excluded Items" section with exclusion reasons
7. THE PDF SHALL label all candidates as "likely deductible" and state that user confirmation and substantiation may be required (Australian Taxation Office)
8. THE PDF SHALL include record retention guidance referencing the five-year rule and that some records may need to be kept longer depending on circumstances (Australian Taxation Office)

### Requirement 9: Report Generation (CSV and JSON)

**User Story:** As a user, I want exports I can import and an audit trail I can trust.

#### Acceptance Criteria

1. THE Report_Generator SHALL produce a CSV file named "deductions.csv" containing all Deduction_Candidates and their assigned fields
2. THE Report_Generator SHALL produce a JSON file named "audit_trail.json" containing, for each transaction: normalised inputs, exclusion checks and outcomes, classification attempts and outcomes, and final category, confidence, reason, and Evidence_Checklist
3. THE Audit_Trail SHALL be sufficient to reproduce the report outputs deterministically

### Requirement 10: Rules Engine Configuration

**User Story:** As a system operator, I want to configure rules for Australian-relevant merchants and patterns.

#### Acceptance Criteria

1. THE Rules_Engine SHALL support keyword matching on description text
2. THE Rules_Engine SHALL support merchant list matching using canonical merchant names
3. THE Rules_Engine SHALL support rule versioning (version id, created at, enabled flag)
4. THE Rules_Engine SHALL support rule priority and confidence weighting
5. THE System SHALL log the matched rule id and version into the Audit_Trail

### Requirement 11: Fuzzy Merchant Matching

**User Story:** As a user, I want the System to recognise merchant name variations so transactions are correctly classified despite formatting differences.

#### Acceptance Criteria

1. WHEN a merchant name contains transaction identifiers, THE Fuzzy_Matcher SHALL normalise the name by removing them
2. WHEN comparing merchant names, THE Fuzzy_Matcher SHALL handle variations like "ADOBE *1234" and "PAYPAL ADOBE"
3. WHEN a fuzzy match is found, THE System SHALL use the canonical merchant name in the report
4. WHEN multiple fuzzy matches are possible, THE System SHALL select the match with the highest similarity score
5. WHEN no fuzzy match exceeds the similarity threshold, THE System SHALL use the original merchant name

### Requirement 12: API Endpoints

**User Story:** As a developer, I want REST endpoints so I can integrate the analyser into a web or desktop client.

#### Acceptance Criteria

1. THE System SHALL provide a POST endpoint to upload a CSV file
2. THE System SHALL return a job identifier immediately after upload
3. THE System SHALL provide a GET endpoint to retrieve job status
4. WHEN processing is complete, THE System SHALL provide endpoints to download the PDF, CSV, and JSON reports
5. THE System SHALL return appropriate HTTP status codes and descriptive error messages for failures

### Requirement 13: Data Storage and Privacy

**User Story:** As a user, I want my sensitive banking data handled safely.

#### Acceptance Criteria

1. WHERE persistence is enabled, THE System SHALL store only derived fields (merchant, category, confidence, flags) and SHALL avoid storing raw CSV rows by default
2. THE System SHALL support an ephemeral mode where no data is stored after the report is generated
3. THE System SHALL provide configuration to redact sensitive strings in outputs (eg account numbers) before writing reports
4. THE System SHALL document its data retention behaviour in the README

## 5. Non-Functional Requirements

### NFR 1: Accuracy and Quality Controls

1. THE System SHOULD prioritise precision over recall to reduce false positives
2. THE System SHALL surface uncertainty via confidence scoring and "Needs review" rather than making definitive claims
3. THE System SHOULD include a test suite with sample Australian bank CSV fixtures

### NFR 2: Performance

1. THE System SHALL process a 10,000 row CSV within a configurable time target on typical hardware
2. THE System SHALL stream or chunk processing to avoid excessive memory use for large files

### NFR 3: Security

1. THE System SHALL validate file types and reject non-CSV uploads
2. THE System SHALL enforce upload size limits and rate limits
3. THE System SHALL store secrets (if any) outside source control

### NFR 4: Accessibility and Usability

1. WHERE a UI is present, THE System SHOULD provide keyboard navigation and readable interfaces
2. THE report outputs SHOULD use plain English explanations suitable for a non-specialist user

## 6. Appendix: Australian Guidance References Included in Report Copy

- Income year is 1 July to 30 June (Australian Taxation Office)
- Records generally kept for five years from lodging, with some cases requiring longer retention (Australian Taxation Office)
- Written evidence and substantiation guidance including common $300 rule and caveats (Australian Taxation Office)
- Working from home record-keeping depends on method (Australian Taxation Office)
- Car expenses methods and logbook record-keeping (Australian Taxation Office)
- Donations require deductible gift recipient status (Australian Taxation Office)
- Overnight travel record-keeping and travel diary conditions (Australian Taxation Office)
