"""
Integration test for redaction service with report generation.

This test demonstrates end-to-end redaction functionality across
all report formats (PDF, CSV, JSON).
"""

import pytest
from decimal import Decimal
from datetime import date, datetime
from pathlib import Path
import csv
import json

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
from processing.report_generator import ReportGenerator
from processing.redaction_service import RedactionConfig


def test_redaction_in_csv_export(tmp_path):
    """
    Test that sensitive data is redacted in CSV exports.
    """
    # Create transaction with sensitive data
    transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Transfer to BSB 123-456 Account 9876543210",
        merchant="Test Bank",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("100.00"),
        signed_amount=Decimal("-100.00")
    )
    
    classified = ClassifiedTransaction(
        transaction=transaction,
        category=DeductionCategory.BANK_FEES,
        confidence=0.85,
        matched_rule_id="R001",
        matched_rule_version="1.0",
        reason="Bank fee detected",
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[]
    )
    
    # Create report data
    report_data = ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=ReportSummary(
            total_deductible=Decimal("100.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={"bank_fees": Decimal("100.00")},
            confidence_distribution={"high": 1, "medium": 0, "low": 0}
        ),
        candidates=[classified],
        needs_review=[],
        excluded=[],
        audit_trail=[]
    )
    
    # Generate CSV with redaction enabled
    generator = ReportGenerator(
        confidence_threshold=0.60,
        redaction_config=RedactionConfig(enabled=True)
    )
    
    csv_path = tmp_path / "test_report.csv"
    generator.generate_csv(report_data, str(csv_path))
    
    # Read CSV and verify redaction
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
        assert len(rows) == 1
        row = rows[0]
        
        # Sensitive data should be redacted
        assert "123-456" not in row['description']
        assert "9876543210" not in row['description']
        assert "[REDACTED]" in row['description']


def test_redaction_in_json_export(tmp_path):
    """
    Test that sensitive data is redacted in JSON audit trail exports.
    """
    # Create audit entry with sensitive data
    audit_entry = AuditEntry(
        transaction_id="test-123",
        normalisation={
            "original_description": "Transfer to BSB 123-456",
            "merchant": "Test Bank",
            "account_number": "9876543210"
        },
        exclusion_checks=[],
        classification_attempts=[],
        final_result={}
    )
    
    # Create report data
    report_data = ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=ReportSummary(
            total_deductible=Decimal("0.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={},
            confidence_distribution={"high": 0, "medium": 0, "low": 0}
        ),
        candidates=[],
        needs_review=[],
        excluded=[],
        audit_trail=[audit_entry]
    )
    
    # Generate JSON with redaction enabled
    generator = ReportGenerator(
        confidence_threshold=0.60,
        redaction_config=RedactionConfig(enabled=True)
    )
    
    json_path = tmp_path / "test_audit.json"
    generator.generate_audit_trail(report_data, str(json_path))
    
    # Read JSON and verify redaction
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        assert len(data['transactions']) == 1
        transaction = data['transactions'][0]
        
        # Sensitive data should be redacted
        assert "123-456" not in transaction['normalisation']['original_description']
        assert "9876543210" not in transaction['normalisation']['account_number']
        assert "[REDACTED]" in transaction['normalisation']['original_description']
        assert "[REDACTED]" in transaction['normalisation']['account_number']


def test_redaction_disabled_preserves_data(tmp_path):
    """
    Test that when redaction is disabled, data is preserved.
    """
    # Create transaction with sensitive data
    transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Transfer to BSB 123-456 Account 9876543210",
        merchant="Test Bank",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("100.00"),
        signed_amount=Decimal("-100.00")
    )
    
    classified = ClassifiedTransaction(
        transaction=transaction,
        category=DeductionCategory.BANK_FEES,
        confidence=0.85,
        matched_rule_id="R001",
        matched_rule_version="1.0",
        reason="Bank fee detected",
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[]
    )
    
    # Create report data
    report_data = ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=ReportSummary(
            total_deductible=Decimal("100.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={"bank_fees": Decimal("100.00")},
            confidence_distribution={"high": 1, "medium": 0, "low": 0}
        ),
        candidates=[classified],
        needs_review=[],
        excluded=[],
        audit_trail=[]
    )
    
    # Generate CSV with redaction disabled
    generator = ReportGenerator(
        confidence_threshold=0.60,
        redaction_config=RedactionConfig(enabled=False)
    )
    
    csv_path = tmp_path / "test_report_no_redaction.csv"
    generator.generate_csv(report_data, str(csv_path))
    
    # Read CSV and verify data is preserved
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
        assert len(rows) == 1
        row = rows[0]
        
        # Sensitive data should be preserved
        assert "123-456" in row['description']
        assert "9876543210" in row['description']
        assert "[REDACTED]" not in row['description']


def test_custom_redaction_text(tmp_path):
    """
    Test that custom redaction text can be configured.
    """
    # Create transaction with sensitive data
    transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Transfer to BSB 123-456",
        merchant="Test Bank",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("100.00"),
        signed_amount=Decimal("-100.00")
    )
    
    classified = ClassifiedTransaction(
        transaction=transaction,
        category=DeductionCategory.BANK_FEES,
        confidence=0.85,
        matched_rule_id="R001",
        matched_rule_version="1.0",
        reason="Bank fee detected",
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[]
    )
    
    # Create report data
    report_data = ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=ReportSummary(
            total_deductible=Decimal("100.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={"bank_fees": Decimal("100.00")},
            confidence_distribution={"high": 1, "medium": 0, "low": 0}
        ),
        candidates=[classified],
        needs_review=[],
        excluded=[],
        audit_trail=[]
    )
    
    # Generate CSV with custom redaction text
    generator = ReportGenerator(
        confidence_threshold=0.60,
        redaction_config=RedactionConfig(enabled=True, redaction_text="***HIDDEN***")
    )
    
    csv_path = tmp_path / "test_report_custom.csv"
    generator.generate_csv(report_data, str(csv_path))
    
    # Read CSV and verify custom redaction text
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        
        assert len(rows) == 1
        row = rows[0]
        
        # Custom redaction text should be used
        assert "123-456" not in row['description']
        assert "***HIDDEN***" in row['description']
        assert "[REDACTED]" not in row['description']
