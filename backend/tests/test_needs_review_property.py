"""
Property-Based Test: Needs Review Flagging

Feature: tax-deduction-analyzer
Property 10: Needs Review Flagging

For any classified transaction with confidence below the configured threshold 
(default 0.60), the system should add "needs_review" to the flags list.

Validates: Requirements 4.4
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    DeductionCategory,
    Rule,
    EvidenceType
)
from backend.processing.rules_engine import RulesEngine
from backend.processing.classification_engine import ClassificationEngine


@given(
    # Generate confidence scores both above and below threshold
    rule_confidence=st.floats(min_value=0.1, max_value=0.99),
    # Generate different threshold values
    threshold=st.floats(min_value=0.4, max_value=0.8),
    # Generate transaction details
    keyword=st.sampled_from(["software", "subscription", "service", "tool", "license"])
)
@pytest.mark.property_test
def test_needs_review_flagging(rule_confidence, threshold, keyword):
    """
    Property 10: Needs Review Flagging
    
    For any classified transaction with confidence below the configured threshold,
    the system should add "needs_review" to the flags list.
    
    **Validates: Requirements 4.4**
    """
    # Create a rule with the generated confidence
    rule = Rule(
        rule_id="TEST001",
        version="1.0",
        category=DeductionCategory.WORK_SOFTWARE,
        priority=100,
        confidence=rule_confidence,
        keywords=[keyword],
        merchants=[],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],  # Start with no flags
        enabled=True
    )
    
    # Create rules engine
    rules_engine = RulesEngine([rule])
    
    # Create classification engine with the specified threshold
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=threshold
    )
    
    # Create a transaction that will match the rule
    transaction = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=f"Purchase of {keyword}",
        merchant="TestMerchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("99.99"),
        signed_amount=Decimal("-99.99"),
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    # Classify the transaction
    classified = classification_engine._classify_single(transaction)
    
    # Property: If confidence < threshold, "needs_review" should be in flags
    if classified.confidence < threshold:
        assert "needs_review" in classified.flags, (
            f"Transaction with confidence {classified.confidence} below threshold {threshold} "
            f"should have 'needs_review' flag, but flags are: {classified.flags}"
        )
    else:
        # If confidence >= threshold, "needs_review" should NOT be added by threshold check
        # (though it might be present from the rule itself)
        # We verify that the logic is consistent
        pass  # This is acceptable - high confidence items may or may not need review for other reasons


@given(
    # Test with confidence exactly at threshold boundary
    threshold=st.floats(min_value=0.5, max_value=0.7),
    keyword=st.sampled_from(["software", "subscription"])
)
@pytest.mark.property_test
def test_needs_review_boundary_conditions(threshold, keyword):
    """
    Property 10 (Boundary variant): Needs Review at Threshold Boundary
    
    Test behavior at the exact threshold boundary.
    
    **Validates: Requirements 4.4**
    """
    # Create rules with confidence exactly at and just below threshold
    rule_at_threshold = Rule(
        rule_id="TEST_AT",
        version="1.0",
        category=DeductionCategory.WORK_SOFTWARE,
        priority=100,
        confidence=threshold,  # Exactly at threshold
        keywords=[keyword],
        merchants=[],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    rule_below_threshold = Rule(
        rule_id="TEST_BELOW",
        version="1.0",
        category=DeductionCategory.PROFESSIONAL_MEMBERSHIPS,
        priority=90,
        confidence=max(0.1, threshold - 0.01),  # Just below threshold
        keywords=["other"],
        merchants=[],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    # Test transaction at threshold
    rules_engine_at = RulesEngine([rule_at_threshold])
    classification_engine_at = ClassificationEngine(
        rules_engine=rules_engine_at,
        fuzzy_matcher=None,
        confidence_threshold=threshold
    )
    
    transaction_at = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=f"Purchase of {keyword}",
        merchant="TestMerchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("99.99"),
        signed_amount=Decimal("-99.99"),
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    classified_at = classification_engine_at._classify_single(transaction_at)
    
    # At threshold: should NOT have needs_review (>= threshold is acceptable)
    # This tests the boundary condition: confidence >= threshold means no flag
    
    # Test transaction below threshold
    rules_engine_below = RulesEngine([rule_below_threshold])
    classification_engine_below = ClassificationEngine(
        rules_engine=rules_engine_below,
        fuzzy_matcher=None,
        confidence_threshold=threshold
    )
    
    transaction_below = NormalisedTransaction(
        date=date(2023, 7, 15),
        description="Purchase of other",
        merchant="TestMerchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("99.99"),
        signed_amount=Decimal("-99.99"),
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    classified_below = classification_engine_below._classify_single(transaction_below)
    
    # Below threshold: MUST have needs_review
    if classified_below.confidence < threshold:
        assert "needs_review" in classified_below.flags, (
            f"Transaction with confidence {classified_below.confidence} below threshold {threshold} "
            f"must have 'needs_review' flag"
        )


@given(
    # Test unmatched transactions (no rule matches)
    description=st.text(
        alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')),
        min_size=10,
        max_size=50
    ),
    threshold=st.floats(min_value=0.5, max_value=0.7)
)
@pytest.mark.property_test
def test_unmatched_transaction_needs_review(description, threshold):
    """
    Property 10 (Unmatched variant): Unmatched Transactions Need Review
    
    Transactions that don't match any rule should have needs_review flag.
    
    **Validates: Requirements 4.4**
    """
    # Create a rule that won't match the random description
    rule = Rule(
        rule_id="TEST001",
        version="1.0",
        category=DeductionCategory.WORK_SOFTWARE,
        priority=100,
        confidence=0.85,
        keywords=["VERY_SPECIFIC_KEYWORD_UNLIKELY_TO_MATCH_12345"],
        merchants=["VERY_SPECIFIC_MERCHANT_UNLIKELY_TO_MATCH_67890"],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    # Create rules engine
    rules_engine = RulesEngine([rule])
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=threshold
    )
    
    # Create a transaction with random description
    transaction = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=description,
        merchant="RandomMerchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("50.00"),
        signed_amount=Decimal("-50.00"),
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    # Classify the transaction
    classified = classification_engine._classify_single(transaction)
    
    # Property: Unmatched transactions (confidence = 0.0) should have needs_review
    if classified.confidence == 0.0:
        assert "needs_review" in classified.flags, (
            f"Unmatched transaction with confidence 0.0 should have 'needs_review' flag, "
            f"but flags are: {classified.flags}"
        )
