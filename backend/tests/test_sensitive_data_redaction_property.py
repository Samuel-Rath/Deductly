"""
Property-based test for sensitive data redaction.

Feature: tax-deduction-analyzer
Property 23: Sensitive Data Redaction

Validates: Requirements 12.3
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date, datetime
import re

from models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    AuditEntry,
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
    ExclusionReason
)
from processing.redaction_service import RedactionService, RedactionConfig


# Strategy for generating sensitive data patterns
@st.composite
def sensitive_data_text(draw):
    """Generate text containing sensitive data patterns."""
    templates = [
        # BSB codes
        lambda: f"Transfer to BSB {draw(st.integers(min_value=100, max_value=999))}-{draw(st.integers(min_value=100, max_value=999))}",
        # Account numbers
        lambda: f"Account {draw(st.integers(min_value=100000, max_value=9999999999))}",
        # Card numbers
        lambda: f"Card ending {draw(st.integers(min_value=1000, max_value=9999))} {draw(st.integers(min_value=1000, max_value=9999))} {draw(st.integers(min_value=1000, max_value=9999))} {draw(st.integers(min_value=1000, max_value=9999))}",
        # Reference numbers
        lambda: f"REF:{draw(st.text(alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', min_size=6, max_size=10))}",
        lambda: f"#{draw(st.text(alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', min_size=6, max_size=10))}",
    ]
    
    template = draw(st.sampled_from(templates))
    return template()


@st.composite
def transaction_with_sensitive_data(draw):
    """Generate a transaction containing sensitive data."""
    sensitive_desc = draw(sensitive_data_text())
    merchant_name = draw(st.text(min_size=3, max_size=20, alphabet=st.characters(whitelist_categories=('Lu', 'Ll'))))
    
    # Add sensitive data to description
    description = f"{merchant_name} {sensitive_desc}"
    
    return NormalisedTransaction(
        date=date(2024, 1, 15),
        description=description,
        merchant=merchant_name,
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("100.00"),
        signed_amount=Decimal("-100.00"),
        payment_rail="card",
        recurring_flag=False,
        raw_data={"original_description": description}
    )


# Feature: tax-deduction-analyzer, Property 23: Sensitive Data Redaction
@given(transaction=transaction_with_sensitive_data())
@pytest.mark.property_test
def test_sensitive_data_redaction_in_transactions(transaction):
    """
    Property 23: Sensitive Data Redaction
    
    For any report generated with redaction enabled, the outputs should not
    contain patterns matching the configured sensitive data patterns
    (account numbers, BSB codes).
    
    Validates: Requirements 12.3
    """
    # Create redaction service with default patterns
    config = RedactionConfig(enabled=True)
    service = RedactionService(config)
    
    # Redact the transaction
    redacted = service.redact_transaction(transaction)
    
    # Check that sensitive patterns are removed from description
    for pattern in config.compiled_patterns:
        matches_in_original = pattern.findall(transaction.description)
        matches_in_redacted = pattern.findall(redacted.description)
        
        # If there were matches in original, they should be gone in redacted
        if matches_in_original:
            assert len(matches_in_redacted) == 0, (
                f"Sensitive pattern {pattern.pattern} still found in redacted description: "
                f"{redacted.description}"
            )
    
    # Check that redaction text appears if sensitive data was present
    has_sensitive_data = any(
        pattern.search(transaction.description)
        for pattern in config.compiled_patterns
    )
    
    if has_sensitive_data:
        assert config.redaction_text in redacted.description, (
            f"Redaction text '{config.redaction_text}' not found in redacted description "
            f"even though sensitive data was present"
        )


@given(
    description=st.text(min_size=10, max_size=100),
    bsb=st.tuples(
        st.integers(min_value=100, max_value=999),
        st.integers(min_value=100, max_value=999)
    )
)
@pytest.mark.property_test
def test_bsb_code_redaction(description, bsb):
    """
    Test that BSB codes in format XXX-XXX are redacted.
    
    Validates: Requirements 12.3
    """
    # Create description with BSB code
    bsb_code = f"{bsb[0]}-{bsb[1]}"
    text_with_bsb = f"{description} BSB {bsb_code}"
    
    # Create redaction service
    service = RedactionService(RedactionConfig(enabled=True))
    
    # Redact the text
    redacted = service.redact_text(text_with_bsb)
    
    # BSB code should be redacted
    assert bsb_code not in redacted, f"BSB code {bsb_code} not redacted in: {redacted}"
    assert "[REDACTED]" in redacted, "Redaction text not found"


@given(
    description=st.text(min_size=10, max_size=100),
    account_number=st.integers(min_value=100000, max_value=9999999999)
)
@pytest.mark.property_test
def test_account_number_redaction(description, account_number):
    """
    Test that account numbers (6-10 digits) are redacted.
    
    Validates: Requirements 12.3
    """
    # Create description with account number
    text_with_account = f"{description} Account {account_number}"
    
    # Create redaction service
    service = RedactionService(RedactionConfig(enabled=True))
    
    # Redact the text
    redacted = service.redact_text(text_with_account)
    
    # Account number should be redacted
    assert str(account_number) not in redacted, (
        f"Account number {account_number} not redacted in: {redacted}"
    )
    assert "[REDACTED]" in redacted, "Redaction text not found"


@given(transaction=transaction_with_sensitive_data())
@pytest.mark.property_test
def test_redaction_preserves_transaction_structure(transaction):
    """
    Test that redaction preserves the transaction structure and non-sensitive fields.
    
    Validates: Requirements 12.3
    """
    service = RedactionService(RedactionConfig(enabled=True))
    
    # Redact the transaction
    redacted = service.redact_transaction(transaction)
    
    # Non-sensitive fields should be preserved
    assert redacted.transaction_id == transaction.transaction_id
    assert redacted.date == transaction.date
    assert redacted.direction == transaction.direction
    assert redacted.absolute_amount == transaction.absolute_amount
    assert redacted.signed_amount == transaction.signed_amount
    assert redacted.payment_rail == transaction.payment_rail
    assert redacted.recurring_flag == transaction.recurring_flag


@given(
    candidates=st.lists(
        st.builds(
            ClassifiedTransaction,
            transaction=transaction_with_sensitive_data(),
            category=st.sampled_from(list(DeductionCategory)),
            confidence=st.floats(min_value=0.0, max_value=1.0),
            matched_rule_id=st.just("R001"),
            matched_rule_version=st.just("1.0"),
            reason=st.text(min_size=5, max_size=50),
            evidence_checklist=st.lists(st.sampled_from(list(EvidenceType)), min_size=1, max_size=3),
            flags=st.lists(st.text(min_size=3, max_size=20), max_size=2)
        ),
        min_size=1,
        max_size=5
    )
)
@pytest.mark.property_test
def test_report_data_redaction_completeness(candidates):
    """
    Test that redaction is applied to all transactions in report data.
    
    Validates: Requirements 12.3
    """
    # Create report data
    report_data = ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=ReportSummary(
            total_deductible=Decimal("1000.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={},
            confidence_distribution={"high": 5, "medium": 0, "low": 0}
        ),
        candidates=candidates,
        needs_review=[],
        excluded=[],
        audit_trail=[]
    )
    
    # Create redaction service
    service = RedactionService(RedactionConfig(enabled=True))
    
    # Redact report data
    redacted_report = service.redact_report_data(report_data)
    
    # Check that all candidates are redacted
    config = RedactionConfig(enabled=True)
    for original, redacted in zip(candidates, redacted_report.candidates):
        # Check if original had sensitive data
        has_sensitive = any(
            pattern.search(original.transaction.description)
            for pattern in config.compiled_patterns
        )
        
        if has_sensitive:
            # Redacted version should not have the sensitive patterns
            for pattern in config.compiled_patterns:
                assert not pattern.search(redacted.transaction.description), (
                    f"Sensitive pattern {pattern.pattern} found in redacted report"
                )


def test_redaction_disabled():
    """
    Test that when redaction is disabled, data is not modified.
    """
    # Create transaction with sensitive data
    transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Transfer to BSB 123-456 Account 1234567890",
        merchant="Test Bank",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("100.00"),
        signed_amount=Decimal("-100.00")
    )
    
    # Create redaction service with redaction disabled
    service = RedactionService(RedactionConfig(enabled=False))
    
    # Redact the transaction
    redacted = service.redact_transaction(transaction)
    
    # Data should be unchanged
    assert redacted.description == transaction.description
    assert "123-456" in redacted.description
    assert "1234567890" in redacted.description


def test_custom_redaction_patterns():
    """
    Test that custom redaction patterns can be configured.
    """
    # Create custom config with specific pattern
    custom_patterns = [r'\bTEST\d+\b']
    config = RedactionConfig(enabled=True, patterns=custom_patterns, redaction_text="[CUSTOM]")
    service = RedactionService(config)
    
    # Test text with custom pattern
    text = "This is TEST123 and TEST456"
    redacted = service.redact_text(text)
    
    # Custom patterns should be redacted
    assert "TEST123" not in redacted
    assert "TEST456" not in redacted
    assert "[CUSTOM]" in redacted


def test_redaction_in_nested_dict():
    """
    Test that redaction works in nested dictionary structures (audit trail).
    """
    # Create audit entry with sensitive data
    entry = AuditEntry(
        transaction_id="test-123",
        normalisation={
            "description": "Transfer to BSB 123-456",
            "merchant": "Test Bank",
            "nested": {
                "account": "Account 1234567890"
            }
        },
        exclusion_checks=[],
        classification_attempts=[],
        final_result={}
    )
    
    # Create redaction service
    service = RedactionService(RedactionConfig(enabled=True))
    
    # Redact the audit entry
    redacted = service.redact_audit_entry(entry)
    
    # Check that nested sensitive data is redacted
    assert "123-456" not in redacted.normalisation["description"]
    assert "1234567890" not in redacted.normalisation["nested"]["account"]
    assert "[REDACTED]" in redacted.normalisation["description"]
    assert "[REDACTED]" in redacted.normalisation["nested"]["account"]
