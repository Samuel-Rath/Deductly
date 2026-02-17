"""
Unit Tests for Classification Engine

Tests classification with sample rules, fuzzy merchant matching,
evidence checklist generation, and method-required flagging.

Validates: Requirements 4.1-4.5, 5.1-5.4, 6.1-6.3
"""

import pytest
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
from backend.processing.fuzzy_matcher import FuzzyMatcher
from backend.processing.classification_engine import ClassificationEngine


class TestClassificationEngine:
    """Test suite for ClassificationEngine."""
    
    def test_classification_with_sample_rules(self):
        """Test classification using sample Australian deduction rules."""
        # Create sample rules
        rules = [
            Rule(
                rule_id="R001",
                version="1.0",
                category=DeductionCategory.WORK_SOFTWARE,
                priority=100,
                confidence=0.95,
                keywords=["adobe", "microsoft 365"],
                merchants=["Adobe", "Microsoft"],
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
                enabled=True
            ),
            Rule(
                rule_id="R002",
                version="1.0",
                category=DeductionCategory.DONATIONS,
                priority=90,
                confidence=0.85,
                keywords=["red cross", "charity"],
                merchants=["Red Cross"],
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
                enabled=True
            )
        ]
        
        rules_engine = RulesEngine(rules)
        classification_engine = ClassificationEngine(rules_engine)
        
        # Test Adobe transaction
        adobe_transaction = NormalisedTransaction(
            date=date(2023, 7, 15),
            description="ADOBE CREATIVE CLOUD",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("79.99"),
            signed_amount=Decimal("-79.99")
        )
        
        classified = classification_engine._classify_single(adobe_transaction)
        
        assert classified.category == DeductionCategory.WORK_SOFTWARE
        assert classified.confidence == 0.95
        assert classified.matched_rule_id == "R001"
        assert EvidenceType.RECEIPT in classified.evidence_checklist
    
    def test_fuzzy_merchant_matching_variations(self):
        """Test fuzzy matching with merchant name variations."""
        # Create canonical merchant list with full names
        canonical_merchants = ["Adobe", "Adobe Systems", "Microsoft", "GitHub", "Slack"]
        # Use a reasonable threshold
        fuzzy_matcher = FuzzyMatcher(canonical_merchants, threshold=0.80)
        
        # Create a rule that only matches by merchant (no keywords)
        rule = Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=[],  # No keywords - force merchant matching
            merchants=["Adobe", "Adobe Systems"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
        
        rules_engine = RulesEngine([rule])
        classification_engine = ClassificationEngine(rules_engine, fuzzy_matcher)
        
        # Test variations that should match with fuzzy matching
        # Using realistic variations that would actually match
        test_cases = [
            ("PAYPAL *ADOBE", "Adobe"),  # Prefix removal
            ("ADOBE *1234", "Adobe"),  # Reference number removal
            ("VISA ADOBE SYSTEMS", "Adobe Systems"),  # Prefix + full name
        ]
        
        for variation, expected_canonical in test_cases:
            transaction = NormalisedTransaction(
                date=date(2023, 7, 15),
                description=variation,
                merchant=variation,
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("79.99"),
                signed_amount=Decimal("-79.99")
            )
            
            classified = classification_engine._classify_single(transaction)
            
            # Should match Adobe rule via fuzzy matching
            assert classified.category == DeductionCategory.WORK_SOFTWARE, (
                f"Variation '{variation}' should match WORK_SOFTWARE category"
            )
            # The classified transaction should have the canonical merchant
            assert classified.transaction.merchant == expected_canonical, (
                f"Classified transaction merchant should be '{expected_canonical}', got '{classified.transaction.merchant}'"
            )
            # Reason should include merchant_match since fuzzy matching was used
            assert "merchant_match" in classified.reason, (
                f"Reason should include 'merchant_match', got '{classified.reason}'"
            )
            # Verify the canonical merchant name appears in the reason
            assert expected_canonical in classified.reason, (
                f"Reason should include canonical merchant '{expected_canonical}', got '{classified.reason}'"
            )
    
    def test_evidence_checklist_generation_by_category(self):
        """Test that each category gets appropriate evidence checklist."""
        test_cases = [
            (
                DeductionCategory.WORK_SOFTWARE,
                [EvidenceType.RECEIPT],
                "Adobe subscription"
            ),
            (
                DeductionCategory.PHONE_INTERNET,
                [EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
                "Telstra mobile plan"
            ),
            (
                DeductionCategory.WORKING_FROM_HOME,
                [EvidenceType.RECEIPT, EvidenceType.DIARY],
                "AGL electricity"
            ),
            (
                DeductionCategory.DONATIONS,
                [EvidenceType.RECEIPT],  # ELIGIBILITY_CHECK will be added by engine
                "Red Cross donation"
            ),
        ]
        
        for category, evidence_list, description in test_cases:
            rule = Rule(
                rule_id=f"TEST_{category.value}",
                version="1.0",
                category=category,
                priority=100,
                confidence=0.85,
                keywords=[description.split()[0].lower()],
                merchants=[],
                evidence_checklist=evidence_list,
                flags=[],
                enabled=True
            )
            
            rules_engine = RulesEngine([rule])
            classification_engine = ClassificationEngine(rules_engine)
            
            transaction = NormalisedTransaction(
                date=date(2023, 7, 15),
                description=description,
                merchant="TestMerchant",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("100.00"),
                signed_amount=Decimal("-100.00")
            )
            
            classified = classification_engine._classify_single(transaction)
            
            # Check that evidence from rule is present
            for evidence in evidence_list:
                assert evidence in classified.evidence_checklist, (
                    f"Category {category} should have {evidence} in evidence checklist"
                )
            
            # Special check for donations - should have eligibility check added
            if category == DeductionCategory.DONATIONS:
                assert EvidenceType.ELIGIBILITY_CHECK in classified.evidence_checklist, (
                    "Donations should have ELIGIBILITY_CHECK added"
                )
    
    def test_method_required_flagging(self):
        """Test that method_required flag is added for appropriate categories."""
        method_required_categories = [
            (DeductionCategory.WORKING_FROM_HOME, "home office"),
            (DeductionCategory.TRAVEL, "qantas flight"),
        ]
        
        for category, keyword in method_required_categories:
            rule = Rule(
                rule_id=f"TEST_{category.value}",
                version="1.0",
                category=category,
                priority=100,
                confidence=0.85,
                keywords=[keyword.split()[0]],
                merchants=[],
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
                enabled=True
            )
            
            rules_engine = RulesEngine([rule])
            classification_engine = ClassificationEngine(rules_engine)
            
            transaction = NormalisedTransaction(
                date=date(2023, 7, 15),
                description=keyword,
                merchant="TestMerchant",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("200.00"),
                signed_amount=Decimal("-200.00")
            )
            
            classified = classification_engine._classify_single(transaction)
            
            assert "method_required" in classified.flags, (
                f"Category {category} should have method_required flag"
            )
    
    def test_percentage_required_flagging(self):
        """Test that percentage_required flag is added for phone/internet."""
        rule = Rule(
            rule_id="PHONE001",
            version="1.0",
            category=DeductionCategory.PHONE_INTERNET,
            priority=100,
            confidence=0.70,
            keywords=["telstra", "optus"],
            merchants=["Telstra"],
            evidence_checklist=[EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
            flags=[],
            enabled=True
        )
        
        rules_engine = RulesEngine([rule])
        classification_engine = ClassificationEngine(rules_engine)
        
        transaction = NormalisedTransaction(
            date=date(2023, 7, 15),
            description="Telstra mobile plan",
            merchant="Telstra",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("89.00"),
            signed_amount=Decimal("-89.00")
        )
        
        classified = classification_engine._classify_single(transaction)
        
        assert "percentage_required" in classified.flags, (
            "Phone/Internet category should have percentage_required flag"
        )
    
    def test_unmatched_transaction(self):
        """Test handling of transactions that don't match any rule."""
        rule = Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe"],
            merchants=["Adobe"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
        
        rules_engine = RulesEngine([rule])
        classification_engine = ClassificationEngine(rules_engine)
        
        # Transaction that won't match
        transaction = NormalisedTransaction(
            date=date(2023, 7, 15),
            description="Random grocery purchase",
            merchant="Woolworths",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("45.67"),
            signed_amount=Decimal("-45.67")
        )
        
        classified = classification_engine._classify_single(transaction)
        
        assert classified.category is None
        assert classified.confidence == 0.0
        assert classified.matched_rule_id is None
        assert "needs_review" in classified.flags
        assert classified.reason == "no_rule_matched"
    
    def test_confidence_threshold_adjustment(self):
        """Test that confidence threshold can be adjusted."""
        rule = Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.65,  # Between 0.60 and 0.70
            keywords=["software"],
            merchants=[],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True
        )
        
        rules_engine = RulesEngine([rule])
        
        transaction = NormalisedTransaction(
            date=date(2023, 7, 15),
            description="software subscription",
            merchant="TestSoftware",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("50.00"),
            signed_amount=Decimal("-50.00")
        )
        
        # Test with default threshold (0.60) - should NOT have needs_review
        engine_low_threshold = ClassificationEngine(rules_engine, confidence_threshold=0.60)
        classified_low = engine_low_threshold._classify_single(transaction)
        assert "needs_review" not in classified_low.flags
        
        # Test with higher threshold (0.70) - should have needs_review
        engine_high_threshold = ClassificationEngine(rules_engine, confidence_threshold=0.70)
        classified_high = engine_high_threshold._classify_single(transaction)
        assert "needs_review" in classified_high.flags
    
    def test_multiple_transactions_batch_classification(self):
        """Test classifying multiple transactions at once."""
        rules = [
            Rule(
                rule_id="R001",
                version="1.0",
                category=DeductionCategory.WORK_SOFTWARE,
                priority=100,
                confidence=0.95,
                keywords=["adobe"],
                merchants=["Adobe"],
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
                enabled=True
            ),
            Rule(
                rule_id="R002",
                version="1.0",
                category=DeductionCategory.DONATIONS,
                priority=90,
                confidence=0.85,
                keywords=["charity"],
                merchants=[],
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
                enabled=True
            )
        ]
        
        rules_engine = RulesEngine(rules)
        classification_engine = ClassificationEngine(rules_engine)
        
        transactions = [
            NormalisedTransaction(
                date=date(2023, 7, 15),
                description="Adobe subscription",
                merchant="Adobe",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("79.99"),
                signed_amount=Decimal("-79.99")
            ),
            NormalisedTransaction(
                date=date(2023, 8, 20),
                description="Charity donation",
                merchant="Red Cross",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("50.00"),
                signed_amount=Decimal("-50.00")
            ),
            NormalisedTransaction(
                date=date(2023, 9, 10),
                description="Grocery shopping",
                merchant="Woolworths",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("120.45"),
                signed_amount=Decimal("-120.45")
            )
        ]
        
        classified_list = classification_engine.classify(transactions)
        
        assert len(classified_list) == 3
        assert classified_list[0].category == DeductionCategory.WORK_SOFTWARE
        assert classified_list[1].category == DeductionCategory.DONATIONS
        assert classified_list[2].category is None  # Unmatched
