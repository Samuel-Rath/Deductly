"""
Property-Based Test: Evidence Checklist Presence

Feature: tax-deduction-analyzer
Property 12: Evidence Checklist Presence

For any transaction classified as a deduction candidate, the system should 
attach an evidence checklist containing at least one evidence type appropriate 
to the category.

Validates: Requirements 5.1, 5.2
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
    # Generate different categories
    category=st.sampled_from(list(DeductionCategory)),
    # Generate evidence types (at least one)
    num_evidence_types=st.integers(min_value=1, max_value=3),
    # Generate transaction details
    keyword=st.sampled_from(["software", "subscription", "membership", "training", "equipment"])
)
@pytest.mark.property_test
def test_evidence_checklist_presence(category, num_evidence_types, keyword):
    """
    Property 12: Evidence Checklist Presence
    
    For any transaction classified as a deduction candidate, the system should
    attach an evidence checklist containing at least one evidence type.
    
    **Validates: Requirements 5.1, 5.2**
    """
    # Create evidence checklist with the specified number of types
    evidence_types = [EvidenceType.RECEIPT]
    if num_evidence_types > 1:
        evidence_types.append(EvidenceType.INVOICE)
    if num_evidence_types > 2:
        evidence_types.append(EvidenceType.DIARY)
    
    # Create a rule with evidence checklist
    rule = Rule(
        rule_id="TEST001",
        version="1.0",
        category=category,
        priority=100,
        confidence=0.85,
        keywords=[keyword],
        merchants=[],
        evidence_checklist=evidence_types,
        flags=[],
        enabled=True
    )
    
    # Create rules engine
    rules_engine = RulesEngine([rule])
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
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
    
    # Property: Classified transactions must have at least one evidence type
    if classified.category is not None:  # Only check if transaction was classified
        assert len(classified.evidence_checklist) >= 1, (
            f"Classified transaction with category {classified.category} "
            f"should have at least one evidence type, but has: {classified.evidence_checklist}"
        )
        
        # Property: Evidence checklist should contain valid evidence types
        for evidence in classified.evidence_checklist:
            assert isinstance(evidence, EvidenceType), (
                f"Evidence checklist should contain EvidenceType enum values, "
                f"but found: {type(evidence)}"
            )


@given(
    # Test all categories to ensure each has appropriate evidence
    category=st.sampled_from(list(DeductionCategory)),
    keyword=st.sampled_from(["test", "sample", "example"])
)
@pytest.mark.property_test
def test_category_specific_evidence(category, keyword):
    """
    Property 12 (Category variant): Category-Specific Evidence
    
    Each category should have appropriate evidence types attached.
    
    **Validates: Requirements 5.1, 5.2**
    """
    # Define appropriate evidence for each category
    category_evidence_map = {
        DeductionCategory.WORK_SOFTWARE: [EvidenceType.RECEIPT],
        DeductionCategory.PROFESSIONAL_MEMBERSHIPS: [EvidenceType.RECEIPT, EvidenceType.INVOICE],
        DeductionCategory.TRAINING_EDUCATION: [EvidenceType.RECEIPT, EvidenceType.INVOICE],
        DeductionCategory.WORK_EQUIPMENT: [EvidenceType.RECEIPT],
        DeductionCategory.PHONE_INTERNET: [EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
        DeductionCategory.WORKING_FROM_HOME: [EvidenceType.RECEIPT, EvidenceType.DIARY],
        DeductionCategory.TRAVEL: [EvidenceType.RECEIPT, EvidenceType.DIARY],
        DeductionCategory.DONATIONS: [EvidenceType.RECEIPT, EvidenceType.ELIGIBILITY_CHECK],
        DeductionCategory.BANK_FEES: [EvidenceType.RECEIPT],
    }
    
    evidence_types = category_evidence_map.get(category, [EvidenceType.RECEIPT])
    
    # Create a rule with category-appropriate evidence
    rule = Rule(
        rule_id="TEST001",
        version="1.0",
        category=category,
        priority=100,
        confidence=0.85,
        keywords=[keyword],
        merchants=[],
        evidence_checklist=evidence_types,
        flags=[],
        enabled=True
    )
    
    # Create rules engine
    rules_engine = RulesEngine([rule])
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
    )
    
    # Create a transaction that will match the rule
    transaction = NormalisedTransaction(
        date=date(2023, 7, 15),
        description=f"Payment for {keyword}",
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
    
    # Property: Classified transaction should have the evidence from the rule
    if classified.category == category:
        assert len(classified.evidence_checklist) >= 1, (
            f"Category {category} should have at least one evidence type"
        )
        
        # Check that the evidence checklist contains expected types
        for expected_evidence in evidence_types:
            assert expected_evidence in classified.evidence_checklist, (
                f"Category {category} should include {expected_evidence} in evidence checklist, "
                f"but checklist is: {classified.evidence_checklist}"
            )


@given(
    # Test with multiple rules to ensure evidence is preserved
    num_rules=st.integers(min_value=1, max_value=3),
    keyword=st.sampled_from(["software", "tool", "service"])
)
@pytest.mark.property_test
def test_evidence_preservation_across_rules(num_rules, keyword):
    """
    Property 12 (Preservation variant): Evidence Preservation
    
    Evidence checklist from the matched rule should be preserved in classification.
    
    **Validates: Requirements 5.1, 5.2**
    """
    # Create multiple rules with different evidence requirements
    rules = []
    for i in range(num_rules):
        evidence = [EvidenceType.RECEIPT]
        if i % 2 == 0:
            evidence.append(EvidenceType.INVOICE)
        if i % 3 == 0:
            evidence.append(EvidenceType.DIARY)
        
        rule = Rule(
            rule_id=f"TEST{i:03d}",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100 - i,
            confidence=0.8 + (i * 0.05),
            keywords=[keyword] if i == 0 else [f"other{i}"],
            merchants=[],
            evidence_checklist=evidence,
            flags=[],
            enabled=True
        )
        rules.append(rule)
    
    # Create rules engine
    rules_engine = RulesEngine(rules)
    
    # Create classification engine
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60
    )
    
    # Create a transaction that will match the first rule
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
    
    # Property: Evidence checklist should be non-empty for classified transactions
    if classified.category is not None:
        assert len(classified.evidence_checklist) >= 1, (
            f"Classified transaction should have evidence checklist, but has: {classified.evidence_checklist}"
        )
        
        # Property: All evidence types should be valid EvidenceType enums
        for evidence in classified.evidence_checklist:
            assert evidence in list(EvidenceType), (
                f"Invalid evidence type: {evidence}"
            )
