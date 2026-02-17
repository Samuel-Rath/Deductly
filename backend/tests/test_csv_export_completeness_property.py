"""
Property-Based Test: CSV Export Completeness

Feature: tax-deduction-analyzer
Property 16: CSV Export Completeness

For any generated deductions.csv file, it should contain all deduction candidates 
with their complete classification data (category, confidence, reason, evidence, flags).

Validates: Requirements 9.1
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date, datetime
import csv
import tempfile
from pathlib import Path

from models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    AuditEntry,
    DeductionCategory,
    EvidenceType,
    TransactionDirection,
    ExclusionReason,
)
from processing.report_generator import ReportGenerator


# Custom strategies for generating test data
@st.composite
def normalised_transaction_strategy(draw):
    """Generate a random NormalisedTransaction."""
    return NormalisedTransaction(
        date=draw(st.dates(min_value=date(2023, 7, 1), max_value=date(2024, 6, 30))),
        description=draw(st.text(min_size=5, max_size=100)),
        merchant=draw(st.text(min_size=3, max_size=50)),
        direction=draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT])),
        absolute_amount=Decimal(str(draw(st.floats(min_value=1.0, max_value=10000.0, allow_nan=False, allow_infinity=False)))),
        signed_amount=Decimal(str(draw(st.floats(min_value=-10000.0, max_value=10000.0, allow_nan=False, allow_infinity=False)))),
        payment_rail=draw(st.one_of(st.none(), st.sampled_from(["card", "paypal", "bpay"]))),
        recurring_flag=draw(st.booleans()),
    )


@st.composite
def classified_transaction_strategy(draw):
    """Generate a random ClassifiedTransaction."""
    transaction = draw(normalised_transaction_strategy())
    category = draw(st.one_of(st.none(), st.sampled_from(list(DeductionCategory))))
    confidence = draw(st.floats(min_value=0.0, max_value=1.0))
    evidence = draw(st.lists(st.sampled_from(list(EvidenceType)), min_size=1, max_size=3, unique=True))
    flags = draw(st.lists(st.sampled_from(["needs_review", "method_required", "percentage_required"]), max_size=2, unique=True))
    
    return ClassifiedTransaction(
        transaction=transaction,
        category=category,
        confidence=confidence,
        matched_rule_id=draw(st.one_of(st.none(), st.text(min_size=3, max_size=10))),
        matched_rule_version=draw(st.one_of(st.none(), st.text(min_size=3, max_size=10))),
        reason=draw(st.text(min_size=5, max_size=100)),
        evidence_checklist=evidence,
        flags=flags,
    )


@st.composite
def report_data_strategy(draw):
    """Generate a random ReportData with candidates."""
    candidates = draw(st.lists(classified_transaction_strategy(), min_size=1, max_size=10))
    
    # Calculate summary
    total_deductible = sum(t.transaction.absolute_amount for t in candidates)
    
    summary = ReportSummary(
        total_deductible=total_deductible,
        total_needs_review=Decimal(0),
        total_excluded=Decimal(0),
        category_totals={},
        confidence_distribution={"high": 0, "medium": 0, "low": 0},
    )
    
    return ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=summary,
        candidates=candidates,
        needs_review=[],
        excluded=[],
        audit_trail=[],
    )


@given(report_data=report_data_strategy())
@pytest.mark.property_test
def test_csv_export_completeness(report_data):
    """
    Property 16: CSV Export Completeness
    
    For any generated deductions.csv file, it should contain all deduction candidates 
    with their complete classification data.
    
    Validates: Requirements 9.1
    """
    generator = ReportGenerator()
    
    # Generate CSV to temporary file
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = Path(tmpdir) / "deductions.csv"
        generator.generate_csv(report_data, str(csv_path))
        
        # Verify file was created
        assert csv_path.exists(), "CSV file should be created"
        
        # Read CSV and verify contents
        with open(csv_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            rows = list(reader)
        
        # Property 1: Number of rows should match number of candidates
        all_candidates = report_data.candidates + report_data.needs_review
        assert len(rows) == len(all_candidates), \
            f"CSV should contain {len(all_candidates)} rows, found {len(rows)}"
        
        # Property 2: All required columns should be present
        required_columns = {
            'date', 'merchant', 'description', 'amount', 
            'category', 'confidence', 'reason', 'evidence_needed', 'flags'
        }
        if rows:
            actual_columns = set(rows[0].keys())
            assert required_columns == actual_columns, \
                f"CSV should have columns {required_columns}, found {actual_columns}"
        
        # Property 3: Each row should have complete data
        for i, row in enumerate(rows):
            candidate = all_candidates[i]
            
            # Verify date is present and formatted
            assert row['date'], f"Row {i} should have a date"
            assert '/' in row['date'], f"Row {i} date should be formatted with /"
            
            # Verify merchant is present
            assert row['merchant'], f"Row {i} should have a merchant"
            
            # Verify description is present
            assert row['description'], f"Row {i} should have a description"
            
            # Verify amount is present and formatted
            assert row['amount'], f"Row {i} should have an amount"
            try:
                float(row['amount'])
            except ValueError:
                pytest.fail(f"Row {i} amount should be a valid number")
            
            # Verify confidence is present and formatted
            assert row['confidence'], f"Row {i} should have a confidence score"
            try:
                conf_value = float(row['confidence'])
                assert 0.0 <= conf_value <= 1.0, f"Row {i} confidence should be between 0 and 1"
            except ValueError:
                pytest.fail(f"Row {i} confidence should be a valid number")
            
            # Verify reason is present
            assert row['reason'], f"Row {i} should have a reason"
            
            # Verify evidence_needed is present (can be empty string if no evidence)
            assert 'evidence_needed' in row, f"Row {i} should have evidence_needed field"
            
            # If transaction has evidence, verify it's in the CSV
            if candidate.evidence_checklist:
                assert row['evidence_needed'], \
                    f"Row {i} should have evidence listed when evidence_checklist is not empty"
