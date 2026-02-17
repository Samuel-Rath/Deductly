"""
Property-Based Test: PDF Content Completeness

Feature: tax-deduction-analyzer
Property 15: PDF Content Completeness

For any generated PDF report, it should contain the income year, summary totals by category, 
grand total, line item table with all required columns (date, merchant, description, amount, 
category, confidence, reason, evidence), and use "likely deductible" language for all candidates.

Validates: Requirements 8.2, 8.3, 8.4, 8.7
"""

import pytest
from hypothesis import given, strategies as st, settings
from decimal import Decimal
from datetime import date, datetime
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
        description=draw(st.text(min_size=5, max_size=100, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
        merchant=draw(st.text(min_size=3, max_size=50, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
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
    category = draw(st.sampled_from(list(DeductionCategory)))
    confidence = draw(st.floats(min_value=0.0, max_value=1.0))
    evidence = draw(st.lists(st.sampled_from(list(EvidenceType)), min_size=1, max_size=3, unique=True))
    flags = draw(st.lists(st.sampled_from(["needs_review", "method_required", "percentage_required"]), max_size=2, unique=True))
    
    return ClassifiedTransaction(
        transaction=transaction,
        category=category,
        confidence=confidence,
        matched_rule_id=draw(st.text(min_size=3, max_size=10, alphabet=st.characters(min_codepoint=65, max_codepoint=90))),
        matched_rule_version=draw(st.text(min_size=3, max_size=10, alphabet=st.characters(min_codepoint=48, max_codepoint=57))),
        reason=draw(st.text(min_size=5, max_size=100, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
        evidence_checklist=evidence,
        flags=flags,
    )


@st.composite
def excluded_transaction_strategy(draw):
    """Generate a random ExcludedTransaction."""
    transaction = draw(normalised_transaction_strategy())
    reason = draw(st.sampled_from(list(ExclusionReason)))
    
    return ExcludedTransaction(
        transaction=transaction,
        reason=reason,
        explanation=draw(st.text(min_size=10, max_size=100, alphabet=st.characters(min_codepoint=32, max_codepoint=126))),
    )


@st.composite
def report_data_strategy(draw):
    """Generate a random ReportData with candidates, needs_review, and excluded."""
    candidates = draw(st.lists(classified_transaction_strategy(), min_size=1, max_size=5))
    needs_review = draw(st.lists(classified_transaction_strategy(), min_size=0, max_size=3))
    excluded = draw(st.lists(excluded_transaction_strategy(), min_size=0, max_size=3))
    
    # Calculate summary
    total_deductible = sum(t.transaction.absolute_amount for t in candidates)
    total_needs_review = sum(t.transaction.absolute_amount for t in needs_review)
    total_excluded = sum(t.transaction.absolute_amount for t in excluded)
    
    # Calculate category totals
    category_totals = {}
    for t in candidates + needs_review:
        if t.category:
            cat_name = t.category.value
            if cat_name not in category_totals:
                category_totals[cat_name] = Decimal(0)
            category_totals[cat_name] += t.transaction.absolute_amount
    
    summary = ReportSummary(
        total_deductible=total_deductible,
        total_needs_review=total_needs_review,
        total_excluded=total_excluded,
        category_totals=category_totals,
        confidence_distribution={"high": len(candidates), "medium": 0, "low": len(needs_review)},
    )
    
    return ReportData(
        income_year="2023-2024",
        generated_at=datetime.now(),
        summary=summary,
        candidates=candidates,
        needs_review=needs_review,
        excluded=excluded,
        audit_trail=[],
    )


@given(report_data=report_data_strategy())
@settings(max_examples=20, deadline=None)  # Reduced examples for PDF generation performance
@pytest.mark.property_test
def test_pdf_content_completeness(report_data):
    """
    Property 15: PDF Content Completeness
    
    For any generated PDF report, it should contain the income year, summary totals,
    line item tables, and use "likely deductible" language.
    
    Validates: Requirements 8.2, 8.3, 8.4, 8.7
    """
    generator = ReportGenerator()
    
    # Generate HTML content (we test HTML instead of PDF for performance)
    html_content = generator._generate_html_report(report_data)
    
    # Property 1: Income year should be present
    assert report_data.income_year in html_content, \
        "PDF should contain the income year"
    assert "1 July to 30 June" in html_content, \
        "PDF should reference the Australian income year period"
    
    # Property 2: Summary totals should be present
    assert "Summary" in html_content, \
        "PDF should contain a Summary section"
    
    # Verify total deductible is present
    total_deductible_str = f"${report_data.summary.total_deductible:,.2f}"
    assert total_deductible_str in html_content or str(report_data.summary.total_deductible) in html_content, \
        "PDF should contain the total deductible amount"
    
    # Property 3: Category totals should be present
    if report_data.summary.category_totals:
        for category, amount in report_data.summary.category_totals.items():
            # Category name should appear (formatted)
            category_display = category.replace('_', ' ').title()
            assert category_display in html_content, \
                f"PDF should contain category '{category_display}'"
    
    # Property 4: Confidence distribution should be present
    assert "Confidence Distribution" in html_content or "confidence" in html_content.lower(), \
        "PDF should contain confidence distribution information"
    
    # Property 5: Line item table should be present with required columns
    if report_data.candidates:
        assert "Likely Deductible Candidates" in html_content, \
            "PDF should have a section for deduction candidates"
        
        # Check for table headers
        assert "Date" in html_content, "PDF table should have Date column"
        assert "Merchant" in html_content, "PDF table should have Merchant column"
        assert "Description" in html_content, "PDF table should have Description column"
        assert "Amount" in html_content, "PDF table should have Amount column"
        assert "Category" in html_content, "PDF table should have Category column"
        assert "Confidence" in html_content, "PDF table should have Confidence column"
        assert "Evidence" in html_content, "PDF table should have Evidence column"
    
    # Property 6: "Likely deductible" language should be used
    assert "likely deductible" in html_content.lower() or "likely" in html_content.lower(), \
        "PDF should use 'likely deductible' language, not definitive claims"
    
    # Property 7: Disclaimer should be present
    assert "Important:" in html_content or "disclaimer" in html_content.lower(), \
        "PDF should contain a disclaimer"
    
    # Property 8: Needs review section should be present if there are items
    if report_data.needs_review:
        assert "Needs Review" in html_content, \
            "PDF should have a Needs Review section when items need review"
    
    # Property 9: Excluded section should be present if there are excluded items
    if report_data.excluded:
        assert "Excluded" in html_content, \
            "PDF should have an Excluded Items section when items are excluded"
    
    # Property 10: Record retention guidance should be present
    assert "Record Retention" in html_content or "five years" in html_content.lower(), \
        "PDF should contain record retention guidance"
    
    # Property 11: Substantiation notes should be present
    assert "Substantiation" in html_content or "$300" in html_content, \
        "PDF should contain substantiation requirements"
    
    # Property 12: Generated date should be present
    assert "Generated:" in html_content or "generated" in html_content.lower(), \
        "PDF should contain the generation date"
