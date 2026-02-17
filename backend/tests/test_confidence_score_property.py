"""
Property-Based Test: Confidence Score Bounds

Feature: tax-deduction-analyzer
Property 8: Confidence Score Bounds

For any classified transaction, the confidence score should be between 0.0 and 1.0 inclusive.

Validates: Requirements 4.1
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date, timedelta

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    DeductionCategory,
    Rule,
    EvidenceType
)
from backend.processing.rules_engine import RulesEngine
from backend.processing.classification_engine import ClassificationEngine


# Strategy for generating valid dates
@st.composite
def transaction_dates(draw):
    """Generate dates within a reasonable range."""
    days_offset = draw(st.integers(min_value=0, max_value=365))
    base_date = date(2023, 7, 1)  # Start of Australian financial year
    return base_date + timedelta(days=days_offset)


# Strategy for generating transaction descriptions
transaction_descriptions = st.text(
    alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'P', 'Zs')),
    min_size=5,
    max_size=100
)


# Strategy for generating merchant names
merchant_names = st.text(
    alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')),
    min_size=3,
    max_size=50
)


# Strategy for generating amounts
transaction_amounts = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("10000.00"),
    places=2
)


@given(
    description=transaction_descriptions,
    merchant=merchant_names,
    amount=transaction_amounts,
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    transaction_date=transaction_dates()
)
@pytest.mark.property_test
def test_confidence_score_bounds(description, merchant, amount, direction, transaction_date):
    """
    Property 8: Confidence Score Bounds
    
    For any classified transaction, the confidence score should be between 0.0 and 1.0 inclusive.
    
    **Validates: Requirements 4.1**
    """
    # Create a sample rule with valid confidence
    sample_rule = Rule(
        rule_id="TEST001",
        version="1.0",
        category=DeductionCategory.WORK_SOFTWARE,
        priority=100,
        confidence=0.85,  # Valid confidence
        keywords=["test", "software"],
        merchants=["TestMerchant"],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    # Create rules engine with the sample rule
    rules_engine = RulesEngine([sample_rule])
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
    )
    
    # Create a normalised transaction
    signed_amount = -amount if direction == TransactionDirection.DEBIT else amount
    
    transaction = NormalisedTransaction(
        date=transaction_date,
        description=description,
        merchant=merchant,
        direction=direction,
        absolute_amount=amount,
        signed_amount=signed_amount,
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    # Classify the transaction
    classified = classification_engine._classify_single(transaction)
    
    # Property: Confidence score must be between 0.0 and 1.0 inclusive
    assert 0.0 <= classified.confidence <= 1.0, (
        f"Confidence score {classified.confidence} is outside valid range [0.0, 1.0]"
    )
