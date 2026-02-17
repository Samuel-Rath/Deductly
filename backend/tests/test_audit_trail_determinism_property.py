"""
Property-based test for audit trail determinism.

Feature: tax-deduction-analyzer
Property 17: Audit Trail Determinism

For any CSV file processed with the same rules and configuration,
processing it twice should produce identical audit trails and
identical classification results.

Validates: Requirements 9.3
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date, timedelta
import json

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    DeductionCategory,
    EvidenceType
)
from backend.processing.audit_trail import AuditTrailBuilder
from backend.processing.exclusion_engine import ExclusionEngine
from backend.processing.classification_engine import ClassificationEngine
from backend.processing.rules_engine import RulesEngine, Rule
from backend.processing.fuzzy_matcher import FuzzyMatcher


# ============================================================================
# Test Strategies
# ============================================================================

@st.composite
def transaction_strategy(draw):
    """Generate random normalised transactions."""
    descriptions = [
        "PAYPAL *ADOBE CREATIVE",
        "GITHUB SUBSCRIPTION",
        "JETBRAINS LICENSE",
        "TELSTRA MOBILE PLAN",
        "OPTUS INTERNET",
        "WOOLWORTHS GROCERIES",
        "COLES SUPERMARKET",
        "UBER RIDE",
        "MICROSOFT 365",
        "AWS SERVICES"
    ]
    
    description = draw(st.sampled_from(descriptions))
    direction = draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]))
    amount = draw(st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000"), places=2))
    
    # Generate date within last year
    days_ago = draw(st.integers(min_value=0, max_value=365))
    txn_date = date.today() - timedelta(days=days_ago)
    
    return NormalisedTransaction(
        date=txn_date,
        description=description,
        merchant=description.split()[0],
        direction=direction,
        absolute_amount=amount,
        signed_amount=-amount if direction == TransactionDirection.DEBIT else amount,
        payment_rail=None,
        recurring_flag=False,
        raw_data={}
    )


# ============================================================================
# Helper Functions
# ============================================================================

def process_transactions_with_audit(transactions, rules):
    """
    Process transactions and return audit trail.
    
    Args:
        transactions: List of normalised transactions
        rules: List of classification rules
        
    Returns:
        Tuple of (audit_trail, classified_transactions, excluded_transactions)
    """
    # Create audit trail builder
    audit_builder = AuditTrailBuilder()
    
    # Create processing engines
    rules_engine = RulesEngine(rules)
    exclusion_engine = ExclusionEngine(audit_builder=audit_builder)
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        fuzzy_matcher=None,
        confidence_threshold=0.60,
        audit_builder=audit_builder
    )
    
    # Record normalisation for all transactions
    for txn in transactions:
        audit_builder.record_normalisation(
            transaction=txn,
            original_description=txn.description,
            extracted_merchant=txn.merchant,
            detected_payment_rail=txn.payment_rail,
            recurring_detected=txn.recurring_flag
        )
    
    # Process through exclusion engine
    candidates, excluded = exclusion_engine.filter(transactions)
    
    # Record final results for excluded transactions
    for excluded_txn in excluded:
        audit_builder.record_final_result(
            transaction_id=excluded_txn.transaction.transaction_id,
            category=None,
            confidence=0.0,
            matched_rule_id=None,
            matched_rule_version=None,
            reason=excluded_txn.reason.value,
            evidence_checklist=[],
            flags=[],
            excluded=True,
            exclusion_reason=excluded_txn.reason.value,
            exclusion_explanation=excluded_txn.explanation
        )
    
    # Process candidates through classification engine
    classified = classification_engine.classify(candidates)
    
    # Build audit trail
    audit_trail = audit_builder.build()
    
    return audit_trail, classified, excluded


def serialize_audit_trail(audit_trail):
    """
    Serialize audit trail to JSON for comparison.
    
    Args:
        audit_trail: List of AuditEntry objects
        
    Returns:
        JSON string representation
    """
    # Convert to dict and sort by transaction_id for deterministic comparison
    audit_dicts = []
    for entry in audit_trail:
        audit_dicts.append({
            "transaction_id": entry.transaction_id,
            "normalisation": entry.normalisation,
            "exclusion_checks": entry.exclusion_checks,
            "classification_attempts": entry.classification_attempts,
            "final_result": entry.final_result
        })
    
    # Sort by transaction_id for deterministic ordering
    audit_dicts.sort(key=lambda x: x["transaction_id"])
    
    # Serialize to JSON with sorted keys
    return json.dumps(audit_dicts, sort_keys=True, indent=2)


# ============================================================================
# Property Tests
# ============================================================================

@given(st.lists(transaction_strategy(), min_size=1, max_size=15))
@pytest.mark.property_test
def test_audit_trail_determinism_property(transactions):
    """
    Property 17: Audit Trail Determinism
    
    For any CSV file processed with the same rules and configuration,
    processing it twice should produce identical audit trails and
    identical classification results.
    
    Validates: Requirements 9.3
    """
    # Create sample rules (same rules for both runs)
    rules = [
        Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe", "github", "jetbrains", "microsoft", "aws"],
            merchants=["Adobe", "GitHub", "JetBrains", "Microsoft", "AWS"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        ),
        Rule(
            rule_id="R002",
            version="1.0",
            category=DeductionCategory.PHONE_INTERNET,
            priority=80,
            confidence=0.70,
            keywords=["telstra", "optus"],
            merchants=["Telstra", "Optus"],
            evidence_checklist=[EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
            flags=["percentage_required"],
            enabled=True
        )
    ]
    
    # Process transactions first time
    audit_trail_1, classified_1, excluded_1 = process_transactions_with_audit(transactions, rules)
    
    # Process transactions second time (same transactions, same rules)
    audit_trail_2, classified_2, excluded_2 = process_transactions_with_audit(transactions, rules)
    
    # Property: Audit trails should be identical
    audit_json_1 = serialize_audit_trail(audit_trail_1)
    audit_json_2 = serialize_audit_trail(audit_trail_2)
    
    assert audit_json_1 == audit_json_2, \
        "Audit trails differ between runs with same input and configuration"
    
    # Property: Number of classified transactions should be identical
    assert len(classified_1) == len(classified_2), \
        f"Different number of classified transactions: {len(classified_1)} vs {len(classified_2)}"
    
    # Property: Number of excluded transactions should be identical
    assert len(excluded_1) == len(excluded_2), \
        f"Different number of excluded transactions: {len(excluded_1)} vs {len(excluded_2)}"
    
    # Property: Classification results should be identical
    # Create lookups by transaction_id
    classified_1_by_id = {ct.transaction.transaction_id: ct for ct in classified_1}
    classified_2_by_id = {ct.transaction.transaction_id: ct for ct in classified_2}
    
    for txn_id, ct1 in classified_1_by_id.items():
        assert txn_id in classified_2_by_id, \
            f"Transaction {txn_id} classified in run 1 but not in run 2"
        
        ct2 = classified_2_by_id[txn_id]
        
        # Check category is identical
        assert ct1.category == ct2.category, \
            f"Transaction {txn_id} has different categories: {ct1.category} vs {ct2.category}"
        
        # Check confidence is identical
        assert ct1.confidence == ct2.confidence, \
            f"Transaction {txn_id} has different confidence: {ct1.confidence} vs {ct2.confidence}"
        
        # Check matched rule is identical
        assert ct1.matched_rule_id == ct2.matched_rule_id, \
            f"Transaction {txn_id} matched different rules: {ct1.matched_rule_id} vs {ct2.matched_rule_id}"
        
        # Check flags are identical
        assert sorted(ct1.flags) == sorted(ct2.flags), \
            f"Transaction {txn_id} has different flags: {ct1.flags} vs {ct2.flags}"
    
    # Property: Exclusion results should be identical
    excluded_1_by_id = {et.transaction.transaction_id: et for et in excluded_1}
    excluded_2_by_id = {et.transaction.transaction_id: et for et in excluded_2}
    
    for txn_id, et1 in excluded_1_by_id.items():
        assert txn_id in excluded_2_by_id, \
            f"Transaction {txn_id} excluded in run 1 but not in run 2"
        
        et2 = excluded_2_by_id[txn_id]
        
        # Check exclusion reason is identical
        assert et1.reason == et2.reason, \
            f"Transaction {txn_id} has different exclusion reasons: {et1.reason} vs {et2.reason}"


@given(st.lists(transaction_strategy(), min_size=1, max_size=10))
@pytest.mark.property_test
def test_audit_trail_determinism_with_fuzzy_matching(transactions):
    """
    Test determinism with fuzzy matching enabled.
    
    Fuzzy matching should also be deterministic for the same input.
    """
    # Create canonical merchants for fuzzy matching
    canonical_merchants = [
        "Adobe",
        "GitHub",
        "JetBrains",
        "Telstra",
        "Optus",
        "Microsoft",
        "AWS"
    ]
    
    # Create sample rules
    rules = [
        Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe", "github", "jetbrains", "microsoft", "aws"],
            merchants=["Adobe", "GitHub", "JetBrains", "Microsoft", "AWS"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
    ]
    
    # Process with fuzzy matching - first run
    audit_builder_1 = AuditTrailBuilder()
    rules_engine_1 = RulesEngine(rules)
    fuzzy_matcher_1 = FuzzyMatcher(canonical_merchants, threshold=0.85)
    exclusion_engine_1 = ExclusionEngine(audit_builder=audit_builder_1)
    classification_engine_1 = ClassificationEngine(
        rules_engine=rules_engine_1,
        fuzzy_matcher=fuzzy_matcher_1,
        confidence_threshold=0.60,
        audit_builder=audit_builder_1
    )
    
    for txn in transactions:
        audit_builder_1.record_normalisation(
            transaction=txn,
            original_description=txn.description,
            extracted_merchant=txn.merchant,
            detected_payment_rail=txn.payment_rail,
            recurring_detected=txn.recurring_flag
        )
    
    candidates_1, excluded_1 = exclusion_engine_1.filter(transactions)
    
    for excluded_txn in excluded_1:
        audit_builder_1.record_final_result(
            transaction_id=excluded_txn.transaction.transaction_id,
            category=None,
            confidence=0.0,
            matched_rule_id=None,
            matched_rule_version=None,
            reason=excluded_txn.reason.value,
            evidence_checklist=[],
            flags=[],
            excluded=True,
            exclusion_reason=excluded_txn.reason.value,
            exclusion_explanation=excluded_txn.explanation
        )
    
    classified_1 = classification_engine_1.classify(candidates_1)
    audit_trail_1 = audit_builder_1.build()
    
    # Process with fuzzy matching - second run
    audit_builder_2 = AuditTrailBuilder()
    rules_engine_2 = RulesEngine(rules)
    fuzzy_matcher_2 = FuzzyMatcher(canonical_merchants, threshold=0.85)
    exclusion_engine_2 = ExclusionEngine(audit_builder=audit_builder_2)
    classification_engine_2 = ClassificationEngine(
        rules_engine=rules_engine_2,
        fuzzy_matcher=fuzzy_matcher_2,
        confidence_threshold=0.60,
        audit_builder=audit_builder_2
    )
    
    for txn in transactions:
        audit_builder_2.record_normalisation(
            transaction=txn,
            original_description=txn.description,
            extracted_merchant=txn.merchant,
            detected_payment_rail=txn.payment_rail,
            recurring_detected=txn.recurring_flag
        )
    
    candidates_2, excluded_2 = exclusion_engine_2.filter(transactions)
    
    for excluded_txn in excluded_2:
        audit_builder_2.record_final_result(
            transaction_id=excluded_txn.transaction.transaction_id,
            category=None,
            confidence=0.0,
            matched_rule_id=None,
            matched_rule_version=None,
            reason=excluded_txn.reason.value,
            evidence_checklist=[],
            flags=[],
            excluded=True,
            exclusion_reason=excluded_txn.reason.value,
            exclusion_explanation=excluded_txn.explanation
        )
    
    classified_2 = classification_engine_2.classify(candidates_2)
    audit_trail_2 = audit_builder_2.build()
    
    # Property: Results should be identical
    audit_json_1 = serialize_audit_trail(audit_trail_1)
    audit_json_2 = serialize_audit_trail(audit_trail_2)
    
    assert audit_json_1 == audit_json_2, \
        "Audit trails differ between runs with fuzzy matching"
    
    assert len(classified_1) == len(classified_2), \
        "Different number of classified transactions with fuzzy matching"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
