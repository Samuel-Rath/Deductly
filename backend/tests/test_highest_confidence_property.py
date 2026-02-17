"""
Property-Based Test: Highest Confidence Rule Selection

Feature: tax-deduction-analyzer
Property 9: Highest Confidence Rule Selection

For any transaction that matches multiple classification rules, the system should 
select the rule with the highest confidence score, using rule priority as a tie-breaker.

Validates: Requirements 4.3
"""

import pytest
from hypothesis import given, strategies as st, assume
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
    # Generate multiple rules with different confidence scores
    num_rules=st.integers(min_value=2, max_value=5),
    # Use a common keyword that will match all rules
    common_keyword=st.sampled_from(["software", "subscription", "service", "tool"]),
    # Generate random confidence scores
    seed=st.integers(min_value=0, max_value=1000)
)
@pytest.mark.property_test
def test_highest_confidence_rule_selection(num_rules, common_keyword, seed):
    """
    Property 9: Highest Confidence Rule Selection
    
    For any transaction that matches multiple rules, the system should select
    the rule with the highest confidence score, using priority as tie-breaker.
    
    **Validates: Requirements 4.3**
    """
    # Create multiple rules with different confidence scores but same keyword
    rules = []
    confidences = []
    
    for i in range(num_rules):
        # Generate different confidence scores
        confidence = 0.5 + (i * 0.1) % 0.5  # Range from 0.5 to 0.95
        confidences.append(confidence)
        
        rule = Rule(
            rule_id=f"TEST{i:03d}",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100 - i,  # Decreasing priority
            confidence=confidence,
            keywords=[common_keyword],  # All rules have the same keyword
            merchants=[],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
        rules.append(rule)
    
    # Ensure we have different confidence scores
    assume(len(set(confidences)) > 1)
    
    # Create rules engine
    rules_engine = RulesEngine(rules)
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
    )
    
    # Create a transaction that will match all rules (contains the common keyword)
    transaction = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=f"Purchase of {common_keyword} subscription",
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
    
    # Find the rule with highest confidence
    max_confidence = max(confidences)
    rules_with_max_confidence = [r for r in rules if r.confidence == max_confidence]
    
    # If there's a tie, the rule with highest priority should be selected
    expected_rule = max(rules_with_max_confidence, key=lambda r: r.priority)
    
    # Property: The classified transaction should have the highest confidence
    assert classified.confidence == max_confidence, (
        f"Expected confidence {max_confidence}, but got {classified.confidence}"
    )
    
    # Property: The matched rule should be the one with highest confidence (and priority if tied)
    assert classified.matched_rule_id == expected_rule.rule_id, (
        f"Expected rule {expected_rule.rule_id} with confidence {expected_rule.confidence}, "
        f"but got rule {classified.matched_rule_id} with confidence {classified.confidence}"
    )


@given(
    # Test tie-breaking with same confidence but different priorities
    priority1=st.integers(min_value=50, max_value=100),
    priority2=st.integers(min_value=50, max_value=100),
    common_keyword=st.sampled_from(["software", "subscription", "service"])
)
@pytest.mark.property_test
def test_priority_tiebreaker(priority1, priority2, common_keyword):
    """
    Property 9 (Tie-breaker variant): Priority Tie-breaking
    
    When multiple rules have the same confidence, the rule with higher priority wins.
    
    **Validates: Requirements 4.3**
    """
    # Ensure priorities are different
    assume(priority1 != priority2)
    
    # Create two rules with same confidence but different priorities
    same_confidence = 0.85
    
    rule1 = Rule(
        rule_id="TEST001",
        version="1.0",
        category=DeductionCategory.WORK_SOFTWARE,
        priority=priority1,
        confidence=same_confidence,
        keywords=[common_keyword],
        merchants=[],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    rule2 = Rule(
        rule_id="TEST002",
        version="1.0",
        category=DeductionCategory.PROFESSIONAL_MEMBERSHIPS,
        priority=priority2,
        confidence=same_confidence,
        keywords=[common_keyword],
        merchants=[],
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[],
        enabled=True
    )
    
    # Create rules engine
    rules_engine = RulesEngine([rule1, rule2])
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
    )
    
    # Create a transaction that matches both rules
    transaction = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=f"Payment for {common_keyword}",
        merchant="TestMerchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("150.00"),
        signed_amount=Decimal("-150.00"),
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )
    
    # Classify the transaction
    classified = classification_engine._classify_single(transaction)
    
    # Determine which rule should win (higher priority)
    expected_rule = rule1 if priority1 > priority2 else rule2
    
    # Property: The rule with higher priority should be selected
    assert classified.matched_rule_id == expected_rule.rule_id, (
        f"Expected rule {expected_rule.rule_id} with priority {expected_rule.priority}, "
        f"but got rule {classified.matched_rule_id}"
    )
    
    # Property: Confidence should match the tied confidence
    assert classified.confidence == same_confidence, (
        f"Expected confidence {same_confidence}, but got {classified.confidence}"
    )
