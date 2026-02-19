# Sensitive Data Redaction

The Tax Deduction Analyzer includes a configurable redaction service to protect sensitive information in generated reports.

## Overview

The redaction service automatically removes sensitive data patterns from all report outputs (PDF, CSV, JSON) before they are generated. This helps protect user privacy by removing account numbers, BSB codes, and other sensitive banking information.

## Default Behavior

By default, redaction is **enabled** and will replace the following patterns with `[REDACTED]`:

- **BSB codes**: XXX-XXX format (e.g., 123-456)
- **Account numbers**: 6-10 digit numbers (e.g., 1234567890)
- **Card numbers**: 4 groups of 4 digits (e.g., 1234 5678 9012 3456)
- **Reference numbers**: REF:XXXXXX or #XXXXXX format

## Configuration

### Basic Usage

```python
from processing.report_generator import ReportGenerator
from processing.redaction_service import RedactionConfig

# Enable redaction with default settings
generator = ReportGenerator(
    confidence_threshold=0.60,
    redaction_config=RedactionConfig(enabled=True)
)
```

### Disable Redaction

```python
# Disable redaction (not recommended for production)
generator = ReportGenerator(
    confidence_threshold=0.60,
    redaction_config=RedactionConfig(enabled=False)
)
```

### Custom Redaction Text

```python
# Use custom redaction text
config = RedactionConfig(
    enabled=True,
    redaction_text="***HIDDEN***"
)
generator = ReportGenerator(redaction_config=config)
```

### Custom Patterns

```python
# Define custom patterns to redact
custom_patterns = [
    r'\bTFN\s*\d{9}\b',  # Tax File Numbers
    r'\bABN\s*\d{11}\b',  # Australian Business Numbers
]

config = RedactionConfig(
    enabled=True,
    patterns=custom_patterns
)
generator = ReportGenerator(redaction_config=config)
```

## What Gets Redacted

The redaction service processes:

1. **Transaction descriptions**: Original bank transaction text
2. **Merchant names**: Extracted merchant identifiers
3. **Classification reasons**: Explanation text for categorization
4. **Audit trail data**: All processing step records
5. **Raw data fields**: Original CSV row data

## What Doesn't Get Redacted

The following data is preserved:

- **Amounts**: Transaction amounts and totals
- **Dates**: Transaction dates
- **Categories**: Deduction categories
- **Confidence scores**: Classification confidence values
- **Evidence checklists**: Required substantiation types
- **Flags**: Method-required and other flags

## Examples

### Before Redaction

```
Description: "Transfer to BSB 123-456 Account 9876543210"
Merchant: "Test Bank"
```

### After Redaction

```
Description: "Transfer to BSB [REDACTED] Account [REDACTED]"
Merchant: "Test Bank"
```

## API Integration

When using the API, redaction is controlled by the report generator configuration:

```python
from api.endpoints import app
from processing.report_generator import ReportGenerator
from processing.redaction_service import RedactionConfig

# Configure redaction for API
report_generator = ReportGenerator(
    redaction_config=RedactionConfig(enabled=True)
)
```

## Testing

The redaction service includes comprehensive property-based tests:

```bash
# Run redaction tests
pytest backend/tests/test_sensitive_data_redaction_property.py -v

# Run integration tests
pytest backend/tests/test_redaction_integration.py -v
```

## Privacy Recommendations

For maximum privacy protection:

1. **Enable redaction**: Always use redaction in production environments
2. **Ephemeral mode**: Enable ephemeral mode to avoid storing raw data
3. **Review patterns**: Customize patterns based on your specific needs
4. **Test thoroughly**: Verify redaction works with your bank's CSV format

## Performance

Redaction adds minimal overhead to report generation:

- **CSV export**: ~5-10ms per 1000 transactions
- **JSON export**: ~10-15ms per 1000 transactions
- **PDF export**: ~20-30ms per 1000 transactions

The service uses compiled regex patterns for efficient matching.

## Compliance

The redaction service helps meet privacy requirements by:

- Removing personally identifiable information (PII)
- Protecting financial account details
- Maintaining data minimization principles
- Supporting configurable retention policies

## Limitations

- Redaction is pattern-based and may not catch all sensitive data
- Custom bank formats may require additional patterns
- Redaction cannot be reversed once applied
- Users should review outputs to ensure adequate protection

## Support

For issues or questions about redaction:

1. Check the test files for examples
2. Review the RedactionService source code
3. Consult the requirements document (12.3)
4. Contact the development team
