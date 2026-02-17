"""
Property-based test for audit trail completeness.

Feature: tax-deduction-analyzer
Property 7: Audit Trail Completeness

For any processed transaction (whether excluded, classified, or unmatched),
the audit trail should contain all processing steps including normalisation
inputs, exclusion checks, classification attempts, and final results.

Validates: Requirements 3.5, 4.5, 10.5
"""

import pytest
from hypothesis import given, strategies as st
from decimal import Decimal
from datetime import date, timedelta
import random

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    DeductionCategory,
    EvidenceType
)
from backend.processing.audit_trail import AuditTrailBuilder, create_audit_trail_from_processing
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
        "PAYPAL *ADOBE",
        "TRANSFER TO SAVINGS",
        "ATM WITHDRAWAL",
        "GITHUB SUBSCRIPTION",
        "TELSTRA MOBILE",
        "SALARY PAYMENT",
        "MORTGAGE REPAYMENT",
        "WOOLWORTHS GROCERIES",
        "JETBRAINS LICENSE",
        "ATO PAYMENT"
    ]
    
    description = draw(st.sampled_from(descriptions))
    direction = draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]))
    amount = draw(st.decimals(min_value=Decimal("0.01"), max_value=Decimal("10000"), places=2))
    
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
# Property Tests
# ============================================================================

@given(st.lists(transaction_strategy(), min_size=1, max_size=20))
@pytest.mark.property_test
def test_audit_trail_completeness_property(transactions):
    """
    Property 7: Audit Trail Completeness
    
    For any processed transaction (whether excluded, classified, or unmatched),
    the audit trail should contain all processing steps including normalisation
    inputs, exclusion checks, classification attempts, and final results.
    
    Validates: Requirements 3.5, 4.5, 10.5
    """
    # Create audit trail builder
    audit_builder = AuditTrailBuilder()
    
    # Create sample rules for classification
    rules = [
        Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe", "github", "jetbrains"],
            merchants=["Adobe", "GitHub", "JetBrains"],
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
    
    rules_engine = RulesEngine(rules)
    
    # Create processing engines with audit builder
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
    
    # Property: Every transaction should have an audit entry
    assert len(audit_trail) == len(transactions), \
        f"Expected {len(transactions)} audit entries, got {len(audit_trail)}"
    
    # Create lookup for audit entries
    audit_by_id = {entry.transaction_id: entry for entry in audit_trail}
    
    # Property: Every transaction should have complete audit trail
    for txn in transactions:
        assert txn.transaction_id in audit_by_id, \
            f"Transaction {txn.transaction_id} missing from audit trail"
        
        entry = audit_by_id[txn.transaction_id]
        
        # Check normalisation is recorded
        assert entry.normalisation, \
            f"Transaction {txn.transaction_id} missing normalisation data"
        assert "original_description" in entry.normalisation, \
            f"Transaction {txn.transaction_id} missing original_description in normalisation"
        assert "extracted_merchant" in entry.normalisation, \
            f"Transaction {txn.transaction_id} missing extracted_merchant in normalisation"
        
        # Check exclusion checks are recorded
        assert entry.exclusion_checks, \
            f"Transaction {txn.transaction_id} missing exclusion checks"
        assert len(entry.exclusion_checks) > 0, \
            f"Transaction {txn.transaction_id} has empty exclusion checks"
        
        # Check final result is recorded
        assert entry.final_result, \
            f"Transaction {txn.transaction_id} missing final result"
        assert "excluded" in entry.final_result, \
            f"Transaction {txn.transaction_id} missing 'excluded' in final result"
        assert "confidence" in entry.final_result, \
            f"Transaction {txn.transaction_id} missing 'confidence' in final result"
        
        # If transaction was classified (not excluded), check classification attempts
        if not entry.final_result.get("excluded", False):
            # Should have at least one classification attempt (even if no rule matched)
            assert entry.classification_attempts is not None, \
                f"Transaction {txn.transaction_id} missing classification attempts"


@given(st.lists(transaction_strategy(), min_size=1, max_size=10))
@pytest.mark.property_test
def test_audit_trail_convenience_function(transactions):
    """
    Test the convenience function for creating audit trails.
    
    This tests create_audit_trail_from_processing which creates audit trails
    from already-processed transactions.
    """
    # Create sample rules
    rules = [
        Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe", "github"],
            merchants=["Adobe", "GitHub"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
    ]
    
    rules_engine = RulesEngine(rules)
    
    # Process without audit builder
    exclusion_engine = ExclusionEngine()
    classification_engine = ClassificationEngine(
        rules_engine=rules_engine,
        confidence_threshold=0.60
    )
    
    candidates, excluded = exclusion_engine.filter(transactions)
    classified = classification_engine.classify(candidates)
    
    # Create audit trail using convenience function
    audit_trail = create_audit_trail_from_processing(
        normalised_transactions=transactions,
        excluded_transactions=excluded,
        classified_transactions=classified
    )
    
    # Property: Should have one audit entry per transaction
    assert len(audit_trail) == len(transactions), \
        f"Expected {len(transactions)} audit entries, got {len(audit_trail)}"
    
    # Property: All entries should have required fields
    for entry in audit_trail:
        assert entry.transaction_id, "Missing transaction_id"
        assert entry.normalisation, "Missing normalisation"
        assert entry.exclusion_checks is not None, "Missing exclusion_checks"
        assert entry.classification_attempts is not None, "Missing classification_attempts"
        assert entry.final_result, "Missing final_result"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
