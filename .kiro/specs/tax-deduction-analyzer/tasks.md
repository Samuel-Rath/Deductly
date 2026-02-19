# Implementation Plan: Tax Deduction Analyzer

## Overview

This implementation plan breaks down the Tax Deduction Analyzer into discrete coding tasks following the three-layer processing pipeline (normalisation, exclusion, classification) plus API, frontend, and reporting components. The approach prioritises building the core backend processing pipeline first, then adding the API layer, and finally the frontend interface.

## Tasks

- [x] 1. Set up project structure and core dependencies
  - Create Python backend directory structure (api/, processing/, models/, tests/)
  - Create React frontend directory structure (src/components/, src/pages/, src/api/)
  - Set up FastAPI project with basic configuration
  - Set up React project with TypeScript and Tailwind CSS
  - Configure pytest for backend testing
  - Configure Jest/Vitest for frontend testing
  - Install core dependencies: FastAPI, pandas, rapidfuzz, WeasyPrint, pydantic, hypothesis
  - Create requirements.txt and package.json
  - _Requirements: All (foundational)_

- [x] 2. Implement data models and validation
  - [x] 2.1 Create Pydantic models for core data structures
    - Implement NormalisedTransaction model with validation
    - Implement ClassifiedTransaction model
    - Implement ExcludedTransaction model
    - Implement Rule model with versioning fields
    - Implement ReportData and ReportSummary models
    - Implement API request/response models (UploadRequest, UploadResponse, JobStatusResponse)
    - _Requirements: 1.3, 4.1, 3.1-3.4, 10.3_
  
  - [x] 2.2 Write property test for amount normalisation
    - **Property 1: CSV Amount Normalisation Consistency**
    - **Validates: Requirements 1.3**
  
  - [x] 2.3 Write unit tests for data model validation
    - Test confidence score bounds (0.0 to 1.0)
    - Test enum validations
    - Test required field validations
    - _Requirements: 4.1_

- [x] 3. Implement CSV Parser and Normaliser
  - [x] 3.1 Create CSV format detection and column mapping
    - Implement column header normalisation (lowercase, remove spaces)
    - Create pattern matching for common Australian bank formats (CommBank, NAB, Westpac, ANZ, ING)
    - Implement flexible column mapping for date, description, amount, debit/credit
    - Handle both single amount column and separate debit/credit columns
    - _Requirements: 1.2, 1.3_
  
  - [x] 3.2 Implement merchant extraction logic
    - Create regex patterns to remove common prefixes (PAYPAL *, VISA, MASTERCARD, EFTPOS)
    - Remove reference numbers and transaction IDs
    - Implement fallback to original description if extraction fails
    - _Requirements: 2.2, 2.3_
  
  - [x] 3.3 Implement payment rail detection
    - Create keyword matching for card, PayPal, BPAY, Osko, PayID
    - Populate payment_rail field in NormalisedTransaction
    - _Requirements: 2.5_
  
  - [x] 3.4 Implement recurring transaction detection
    - Group transactions by similar merchant names
    - Detect regular periodicity (weekly, monthly, yearly)
    - Set recurring_flag on matching transactions
    - _Requirements: 2.4_
  
  - [x] 3.5 Write property test for merchant extraction fallback
    - **Property 4: Merchant Extraction Fallback**
    - **Validates: Requirements 2.3**
  
  - [x] 3.6 Write property test for payment rail detection
    - **Property 5: Payment Rail Detection**
    - **Validates: Requirements 2.5**
  
  - [x] 3.7 Write unit tests for CSV parser
    - Test parsing of sample Australian bank CSV formats
    - Test error handling for missing required columns
    - Test edge cases (empty descriptions, special characters, zero amounts)
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 4. Checkpoint - Ensure CSV parsing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Exclusion Engine
  - [x] 5.1 Create exclusion rule patterns
    - Define patterns for transfers (TRANSFER TO/FROM, OSKO, PAYID, BPAY)
    - Define patterns for cash withdrawals (ATM, CASH OUT, EFTPOS CASH)
    - Define patterns for loan repayments (LOAN, MORTGAGE, HOME LOAN)
    - Define patterns for tax settlements (ATO PAYMENT, AUSTRALIAN TAXATION OFFICE)
    - Define patterns for salary income (SALARY, WAGES, PAYROLL on credit transactions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 5.2 Implement ExclusionEngine class
    - Create filter method that applies all exclusion rules
    - Return tuple of (candidates, excluded_transactions)
    - Assign appropriate ExclusionReason to each excluded transaction
    - Generate human-readable explanation for each exclusion
    - _Requirements: 3.1-3.6_
  
  - [x] 5.3 Write property test for exclusion rules completeness
    - **Property 6: Exclusion Rules Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 5.4 Write unit tests for exclusion engine
    - Test each exclusion pattern with specific examples
    - Test that excluded transactions have correct reasons
    - Test that non-matching transactions pass through
    - _Requirements: 3.1-3.6_

- [-] 6. Implement Rules Engine and Classification
  - [x] 6.1 Create rules configuration system
    - Define JSON/YAML schema for rules
    - Implement rule loading from configuration file
    - Support rule versioning (rule_id, version, enabled flag)
    - Create sample rules for Australian deduction categories
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 6.2 Implement RulesEngine class
    - Create keyword matching logic (case-insensitive substring)
    - Create merchant list matching logic
    - Implement rule priority sorting
    - Return matched rule with confidence score
    - _Requirements: 4.1, 4.3, 10.4_
  
  - [x] 6.3 Implement FuzzyMatcher class
    - Use rapidfuzz for fuzzy string matching
    - Implement merchant name normalisation (remove prefixes, reference numbers)
    - Match against canonical merchant list with configurable threshold (default 0.85)
    - Return canonical merchant name and similarity score
    - _Requirements: 4.2, 11.1-11.5_
  
  - [x] 6.4 Implement ClassificationEngine class
    - Integrate RulesEngine and FuzzyMatcher
    - Apply rules to each transaction
    - Handle multiple rule matches (select highest confidence)
    - Flag low-confidence items as "needs_review" (below threshold)
    - Attach evidence checklist based on category
    - Add method-required flags for car, WFH, and travel categories
    - _Requirements: 4.1-4.5, 5.1-5.4, 6.1-6.3_
  
  - [x] 6.5 Write property test for confidence score bounds
    - **Property 8: Confidence Score Bounds**
    - **Validates: Requirements 4.1**
  
  - [x] 6.6 Write property test for highest confidence rule selection
    - **Property 9: Highest Confidence Rule Selection**
    - **Validates: Requirements 4.3**
  
  - [x] 6.7 Write property test for needs review flagging
    - **Property 10: Needs Review Flagging**
    - **Validates: Requirements 4.4**
  
  - [x] 6.8 Write property test for evidence checklist presence
    - **Property 12: Evidence Checklist Presence**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 6.9 Write property test for donation eligibility requirement
    - **Property 13: Donation Eligibility Requirement**
    - **Validates: Requirements 5.4**
  
  - [x] 6.10 Write unit tests for classification engine
    - Test classification with sample rules
    - Test fuzzy merchant matching with variations
    - Test evidence checklist generation for each category
    - Test method-required flagging
    - _Requirements: 4.1-4.5, 5.1-5.4, 6.1-6.3_

- [x] 7. Checkpoint - Ensure classification tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Audit Trail system
  - [x] 8.1 Create AuditEntry model and audit trail builder
    - Define AuditEntry structure (normalisation, exclusion_checks, classification_attempts, final_result)
    - Implement audit trail builder that records each processing step
    - Ensure all processing components write to audit trail
    - _Requirements: 3.5, 4.5, 10.5_
  
  - [x] 8.2 Write property test for audit trail completeness
    - **Property 7: Audit Trail Completeness**
    - **Validates: Requirements 3.5, 4.5, 10.5**
  
  - [x] 8.3 Write property test for audit trail determinism
    - **Property 17: Audit Trail Determinism**
    - **Validates: Requirements 9.3**

- [x] 9. Implement Report Generator
  - [x] 9.1 Create report data aggregation
    - Implement ReportSummary calculation (category totals, grand total)
    - Calculate confidence distribution (high/medium/low)
    - Separate transactions into candidates, needs_review, and excluded lists
    - _Requirements: 8.2, 8.3_
  
  - [x] 9.2 Implement CSV export
    - Create CSV writer with all required columns
    - Format dates, amounts, and categories consistently
    - Include all deduction candidates with classification data
    - _Requirements: 9.1_
  
  - [x] 9.3 Implement JSON audit trail export
    - Serialize audit trail to JSON format
    - Include all processing steps for each transaction
    - Ensure deterministic output (same input = same output)
    - _Requirements: 9.2, 9.3_
  
  - [x] 9.4 Implement PDF generation
    - Choose PDF library (WeasyPrint or ReportLab)
    - Create HTML template with design system styles
    - Include header with income year and generated date
    - Include summary section with category totals and chart
    - Include line item table with all required columns
    - Include needs review section
    - Include excluded items section
    - Include footer with record retention guidance and substantiation notes
    - Use "likely deductible" language throughout
    - _Requirements: 8.1-8.8_
  
  - [x] 9.5 Write property test for CSV export completeness
    - **Property 16: CSV Export Completeness**
    - **Validates: Requirements 9.1**
  
  - [x] 9.6 Write property test for PDF content completeness
    - **Property 15: PDF Content Completeness**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.7**
  
  - [x] 9.7 Write unit tests for report generator
    - Test PDF generation with sample data
    - Test CSV formatting
    - Test JSON audit trail structure
    - Verify all required sections present in PDF
    - _Requirements: 8.1-8.8, 9.1-9.3_

- [x] 10. Implement data storage layer (optional SQLite)
  - [x] 10.1 Create database schema and models
    - Define jobs table schema
    - Define transactions table schema (derived fields only)
    - Create SQLAlchemy models or use raw SQL
    - Implement database initialization
    - _Requirements: 12.1_
  
  - [x] 10.2 Implement storage service
    - Create methods to save job metadata
    - Create methods to save derived transaction fields
    - Implement ephemeral mode (skip database writes)
    - Ensure raw CSV data is never stored
    - _Requirements: 12.1, 12.2_
  
  - [x] 10.3 Write property test for derived fields only storage
    - **Property 22: Derived Fields Only Storage**
    - **Validates: Requirements 12.1**
  
  - [x] 10.4 Write property test for ephemeral mode data isolation
    - **Property 21: Ephemeral Mode Data Isolation**
    - **Validates: Requirements 12.2**

- [x] 11. Implement FastAPI endpoints
  - [x] 11.1 Create upload endpoint
    - Implement POST /api/upload endpoint
    - Validate file type (CSV only)
    - Enforce file size limits
    - Create job record with unique job_id
    - Queue processing (synchronous for MVP, async later)
    - Return UploadResponse with job_id
    - _Requirements: 11.1, 11.2_
  
  - [x] 11.2 Create job status endpoint
    - Implement GET /api/jobs/{job_id} endpoint
    - Return job status (queued, processing, completed, failed)
    - Include progress percentage if available
    - Include download URLs when status is completed
    - Return 404 for invalid job_id
    - _Requirements: 11.3, 11.4_
  
  - [x] 11.3 Create report download endpoints
    - Implement GET /api/jobs/{job_id}/download/pdf endpoint
    - Implement GET /api/jobs/{job_id}/download/csv endpoint
    - Implement GET /api/jobs/{job_id}/download/json endpoint
    - Return FileResponse with appropriate content-type
    - Return 404 if report not found
    - _Requirements: 11.4_
  
  - [x] 11.4 Implement error handling and validation
    - Add global exception handler
    - Return appropriate HTTP status codes (400, 404, 429, 500)
    - Return JSON error responses with error code and message
    - Add request validation using Pydantic
    - _Requirements: 11.5_
  
  - [x] 11.5 Write property test for API job identifier response
    - **Property 18: API Job Identifier Response**
    - **Validates: Requirements 11.2**
  
  - [x] 11.6 Write property test for report download availability
    - **Property 19: Report Download Availability**
    - **Validates: Requirements 11.4**
  
  - [x] 11.7 Write property test for HTTP error status codes
    - **Property 20: HTTP Error Status Codes**
    - **Validates: Requirements 11.5**
  
  - [x] 11.8 Write integration tests for API endpoints
    - Test upload endpoint with valid and invalid files
    - Test job status polling
    - Test report downloads
    - Test error conditions
    - _Requirements: 11.1-11.5_

- [x] 12. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement processing pipeline orchestration
  - [x] 13.1 Create main processing pipeline
    - Wire together CSV Parser, Exclusion Engine, Classification Engine, Report Generator
    - Implement end-to-end processing function
    - Add audit trail recording at each step
    - Handle errors gracefully with fallbacks
    - _Requirements: All backend requirements_
  
  - [x] 13.2 Write integration test for full pipeline
    - Test complete flow from CSV upload to report generation
    - Use sample Australian bank CSV files
    - Verify all outputs (PDF, CSV, JSON) are generated
    - Verify audit trail completeness
    - _Requirements: All backend requirements_

- [x] 14. Implement React frontend - Design system and components
  - [x] 14.1 Set up Tailwind CSS with design tokens
    - Configure Tailwind with custom colour palette (Ink, Slate, Accent)
    - Configure typography scale (Inter font, size scale)
    - Configure spacing scale (base 8px)
    - Configure border radius values (16px cards, 12px inputs, 999px pills)
    - _Requirements: Frontend design system_
  
  - [x] 14.2 Create core UI components
    - Implement Button component (primary, secondary, tertiary variants)
    - Implement Input component with focus states and error handling
    - Implement Card component with elevation and borders
    - Implement Chip component for categories and confidence
    - Implement Table component with sticky header
    - Implement Modal/Drawer component for transaction details
    - _Requirements: Frontend design system_
  
  - [x] 14.3 Write unit tests for UI components
    - Test button variants and interactions
    - Test input validation and error states
    - Test keyboard navigation
    - Test accessibility (ARIA labels, focus management)
    - _Requirements: NFR 4_

- [x] 15. Implement React frontend - Pages
  - [x] 15.1 Create Landing page
    - Implement hero section with headline and CTA
    - Implement trust strip (Privacy, Explainability, Australian income year)
    - Implement "How it works" section
    - Implement example preview of report card
    - Add navigation to Upload page
    - _Requirements: Frontend design_
  
  - [x] 15.2 Create Upload page
    - Implement drag-and-drop upload zone
    - Implement income year selector (default to current year)
    - Implement privacy toggle (ephemeral mode, default on)
    - Implement file validation (CSV only, size limits)
    - Show upload progress
    - Navigate to Report page on successful upload
    - _Requirements: 1.1, 1.4, 12.2_
  
  - [x] 15.3 Create Report page - Summary section
    - Implement summary cards (total deductible, needs review, excluded, confidence distribution)
    - Implement confidence distribution chart (histogram)
    - Implement category totals chart (bar chart)
    - Use monochrome design with accent highlights
    - _Requirements: 8.2, 8.3_
  
  - [x] 15.4 Create Report page - Table and tabs
    - Implement tabs (Candidates, Needs Review, Excluded, Audit Trail)
    - Implement transaction table with all columns
    - Implement row selection and highlighting
    - Implement confidence visualization (label + bar)
    - Implement category chips
    - _Requirements: 8.4_
  
  - [x] 15.5 Create Report page - Detail panel
    - Implement transaction detail drawer/panel
    - Show matched rule and reason
    - Show evidence checklist
    - Show flags (method required, percentage required)
    - Include "More detail" expansion for explanations
    - _Requirements: 8.4_
  
  - [x] 15.6 Create Report page - Export functionality
    - Implement download buttons for PDF, CSV, JSON
    - Show download progress
    - Handle download errors
    - _Requirements: 8.1, 9.1, 9.2_
  
  - [x] 15.7 Create Rules page
    - Display rule sets by category
    - Show merchant matching examples
    - Explain confidence computation
    - Explain exclusion logic
    - Show rule version history
    - _Requirements: 10.1-10.5_
  
  - [x] 15.8 Create Privacy page
    - Explain what data is processed
    - Explain what is stored by default
    - Explain ephemeral mode
    - Explain report generation
    - Provide redaction recommendations
    - _Requirements: 12.1-12.4_
  
  - [x] 15.9 Write integration tests for frontend pages
    - Test upload flow
    - Test report viewing and interaction
    - Test export functionality
    - Test navigation between pages
    - _Requirements: All frontend requirements_

- [x] 16. Implement API client and state management
  - [x] 16.1 Create API client functions
    - Implement uploadCSV function
    - Implement getJobStatus function
    - Implement downloadReport function
    - Handle API errors and retries
    - _Requirements: 11.1-11.5_
  
  - [x] 16.2 Set up React Query for state management
    - Configure React Query client
    - Create upload mutation
    - Create job status query with polling
    - Create download mutations
    - Handle loading and error states
    - _Requirements: 11.1-11.5_

- [x] 17. Implement sensitive data redaction
  - [x] 17.1 Create redaction service
    - Define patterns for sensitive data (account numbers, BSB codes)
    - Implement redaction function that replaces matches with [REDACTED]
    - Apply redaction to all report outputs (PDF, CSV, JSON)
    - Make redaction configurable
    - _Requirements: 12.3_
  
  - [x] 17.2 Write property test for sensitive data redaction
    - **Property 23: Sensitive Data Redaction**
    - **Validates: Requirements 12.3**

- [x] 18. Final integration and polish
  - [x] 18.1 Wire frontend to backend API
    - Connect all frontend pages to API endpoints
    - Test end-to-end flow from upload to download
    - Handle all error states gracefully
    - Add loading indicators
    - _Requirements: All_
  
  - [x] 18.2 Add accessibility improvements
    - Ensure keyboard navigation works throughout
    - Add ARIA labels to all interactive elements
    - Test with screen reader
    - Verify colour contrast meets WCAG AA
    - _Requirements: NFR 4_
  
  - [x] 18.3 Performance optimization
    - Optimize CSV parsing for large files (streaming/chunking)
    - Add progress indicators for long-running operations
    - Optimize PDF generation
    - Add caching where appropriate
    - _Requirements: NFR 2_
  
  - [x] 18.4 Write end-to-end tests
    - Test complete user journey from landing to export
    - Test with various Australian bank CSV formats
    - Test error scenarios
    - Test accessibility
    - _Requirements: All_

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Documentation and deployment preparation
  - [x] 20.1 Write README documentation
    - Document installation and setup
    - Document API endpoints
    - Document configuration options
    - Document data retention behavior
    - Include sample CSV formats
    - _Requirements: 12.4_
  
  - [x] 20.2 Create deployment configuration
    - Create Dockerfile for backend
    - Create Dockerfile for frontend
    - Create docker-compose.yml for local development
    - Document environment variables
    - Create sample .env file
    - _Requirements: Deployment_
  
  - [x] 20.3 Create sample rules configuration
    - Create comprehensive rules file with Australian merchants
    - Include rules for all deduction categories
    - Document rule format and fields
    - Include version information
    - _Requirements: 10.1-10.5_

## Notes

- Tasks marked with `*` are optional property-based and unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- The implementation follows a backend-first approach, then API layer, then frontend
- All components are designed to work together through the processing pipeline
- Privacy and explainability are built into every layer
