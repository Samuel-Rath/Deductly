"""
Classification Engine for Tax Deduction Analyzer.

This module implements the main classification system that integrates
the rules engine and fuzzy matcher to classify transactions into
deduction categories with confidence scores and evidence requirements.

Validates: Requirements 4.1-4.5, 5.1-5.4, 6.1-6.3
"""

from typing import List, Optional
from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    DeductionCategory,
    EvidenceType
)
from backend.processing.rules_engine import RulesEngine
from backend.processing.fuzzy_matcher import FuzzyMatcher


class ClassificationEngine:
    """
    Main classification engine that integrates rules and fuzzy matching.
    
    Classifies transactions into deduction categories, assigns confidence scores,
    attaches evidence checklists, and flags items requiring review or additional methods.
    """
    
    def __init__(
        self,
        rules_engine: RulesEngine,
        fuzzy_matcher: Optional[FuzzyMatcher] = None,
        confidence_threshold: float = 0.60,
        audit_builder=None
    ):
        """
        Initialize the classification engine.
        
        Args:
            rules_engine: RulesEngine instance for rule-based matching
            fuzzy_matcher: Optional FuzzyMatcher for merchant canonicalisation
            confidence_threshold: Minimum confidence for automatic classification (default 0.60)
            audit_builder: Optional AuditTrailBuilder for recording classification attempts
        """
        self.rules_engine = rules_engine
        self.fuzzy_matcher = fuzzy_matcher
        self.confidence_threshold = confidence_threshold
        self.audit_builder = audit_builder
    
    def classify(self, transactions: List[NormalisedTransaction]) -> List[ClassifiedTransaction]:
        """
        Classify a list of transactions.
        
        For each transaction:
        1. Attempt fuzzy merchant matching (if fuzzy_matcher available)
        2. Apply rules engine to find matching rule
        3. Assign category and confidence score
        4. Attach evidence checklist from matched rule
        5. Add flags (needs_review, method_required, percentage_required)
        
        Args:
            transactions: List of normalised transactions to classify
            
        Returns:
            List of classified transactions
            
        Validates: Requirements 4.1-4.5, 5.1-5.4, 6.1-6.3
        """
        classified = []
        
        for transaction in transactions:
            classified_transaction = self._classify_single(transaction)
            classified.append(classified_transaction)
        
        return classified
    
    def _classify_single(self, transaction: NormalisedTransaction) -> ClassifiedTransaction:
        """
        Classify a single transaction.
        
        Args:
            transaction: Normalised transaction to classify
            
        Returns:
            Classified transaction with category, confidence, and evidence
        """
        # Step 1: Try fuzzy merchant matching to canonicalise merchant name
        canonical_merchant = transaction.merchant
        fuzzy_score = None
        
        # Create a copy of the transaction to avoid modifying the original
        transaction_copy = transaction.model_copy(deep=True)
        
        if self.fuzzy_matcher:
            fuzzy_match = self.fuzzy_matcher.match(transaction_copy.merchant)
            if fuzzy_match:
                canonical_merchant, fuzzy_score = fuzzy_match
                # Update the copy's merchant field with canonical name
                transaction_copy.merchant = canonical_merchant
        
        # Step 2: Apply rules engine (use transaction copy with updated merchant if fuzzy matched)
        rule_match = self.rules_engine.match(transaction_copy)
        
        if not rule_match:
            # Build a partial hint by scanning all rules for any keyword match
            hint_parts = []
            for rule in self.rules_engine.rules:
                if not rule.enabled:
                    continue
                for kw in rule.keywords:
                    if kw.lower() in transaction_copy.description.lower() or kw.lower() in transaction_copy.merchant.lower():
                        hint_parts.append(f"possible_{rule.category.value}")
                        break

            no_match_reason = f"no_match | hints: {', '.join(set(hint_parts))}" if hint_parts else "no_match"

            # No rule matched - record attempt and return unclassified transaction
            if self.audit_builder:
                self.audit_builder.record_classification_attempt(
                    transaction_copy.transaction_id,
                    "none",
                    "none",
                    "none",
                    0.0,
                    False,
                    no_match_reason
                )

            classified_txn = ClassifiedTransaction.model_construct(
                transaction=transaction_copy,
                category=None,
                confidence=0.0,
                matched_rule_id=None,
                matched_rule_version=None,
                reason=no_match_reason,
                evidence_checklist=[],
                flags=["needs_review"]
            )
            
            # Record final result
            if self.audit_builder:
                self.audit_builder.record_final_result(
                    transaction_copy.transaction_id,
                    None,
                    0.0,
                    None,
                    None,
                    no_match_reason,
                    [],
                    ["needs_review"]
                )
            
            return classified_txn
        
        matched_rule, confidence = rule_match

        # Boost confidence for subscription categories when transaction is recurring
        SUBSCRIPTION_CATEGORIES = {
            DeductionCategory.WORK_SOFTWARE,
            DeductionCategory.PHONE_INTERNET,
            DeductionCategory.PROFESSIONAL_MEMBERSHIPS,
        }
        if transaction.recurring_flag and matched_rule.category in SUBSCRIPTION_CATEGORIES:
            confidence = min(1.0, confidence + 0.08)

        # Adjust confidence based on fuzzy match quality
        if fuzzy_score is not None:
            if fuzzy_score >= 0.95:
                confidence = min(1.0, confidence + 0.05)
            elif fuzzy_score < 0.88:
                confidence = max(0.0, confidence - 0.05)

        # Record classification attempt
        if self.audit_builder:
            self.audit_builder.record_classification_attempt(
                transaction_copy.transaction_id,
                matched_rule.rule_id,
                matched_rule.version,
                matched_rule.category.value,
                confidence,
                True,
                f"rule_matched: {matched_rule.rule_id}"
            )
        
        # Step 3: Build reason string
        reason_parts = []
        if fuzzy_score:
            reason_parts.append(f"merchant_match: {canonical_merchant} (similarity: {fuzzy_score:.2f})")
        
        # Check which keywords matched
        matched_keywords = []
        description_lower = transaction_copy.description.lower()
        merchant_lower = transaction_copy.merchant.lower()
        
        for keyword in matched_rule.keywords:
            if keyword.lower() in description_lower or keyword.lower() in merchant_lower:
                matched_keywords.append(keyword)
        
        if matched_keywords:
            reason_parts.append(f"keyword_match: {', '.join(matched_keywords[:3])}")  # Limit to 3 keywords
        
        reason = "; ".join(reason_parts) if reason_parts else "rule_matched"
        
        # Step 4: Collect flags
        flags = list(matched_rule.flags)  # Copy flags from rule
        
        # Add needs_review flag if confidence below threshold
        if confidence < self.confidence_threshold:
            if "needs_review" not in flags:
                flags.append("needs_review")
        
        # Add method_required flag for specific categories
        method_required_categories = [
            DeductionCategory.WORKING_FROM_HOME,
            DeductionCategory.TRAVEL
        ]
        
        if matched_rule.category in method_required_categories:
            if "method_required" not in flags:
                flags.append("method_required")
        
        # Add percentage_required flag for phone/internet
        if matched_rule.category == DeductionCategory.PHONE_INTERNET:
            if "percentage_required" not in flags:
                flags.append("percentage_required")

        # Surface ATO $300 instant deduction threshold for work equipment
        if matched_rule.category == DeductionCategory.WORK_EQUIPMENT:
            if transaction.absolute_amount <= 300:
                flags.append("instant_deduction_eligible")
            else:
                flags.append("depreciation_check")

        # Step 5: Ensure donations have eligibility check
        evidence_checklist = list(matched_rule.evidence_checklist)
        if matched_rule.category == DeductionCategory.DONATIONS:
            if EvidenceType.ELIGIBILITY_CHECK not in evidence_checklist:
                evidence_checklist.append(EvidenceType.ELIGIBILITY_CHECK)
        
        # Step 6: Create classified transaction using model_construct to bypass validation
        classified_txn = ClassifiedTransaction.model_construct(
            transaction=transaction_copy,
            category=matched_rule.category,
            confidence=confidence,
            matched_rule_id=matched_rule.rule_id,
            matched_rule_version=matched_rule.version,
            reason=reason,
            evidence_checklist=evidence_checklist,
            flags=flags
        )
        
        # Record final result
        if self.audit_builder:
            self.audit_builder.record_final_result(
                transaction_copy.transaction_id,
                matched_rule.category.value,
                confidence,
                matched_rule.rule_id,
                matched_rule.version,
                reason,
                [e.value for e in evidence_checklist],
                flags
            )
        
        return classified_txn
    
    def set_confidence_threshold(self, threshold: float) -> None:
        """
        Update the confidence threshold for needs_review flagging.
        
        Args:
            threshold: New threshold value (0.0 to 1.0)
            
        Raises:
            ValueError: If threshold is not between 0.0 and 1.0
        """
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("Confidence threshold must be between 0.0 and 1.0")
        self.confidence_threshold = threshold
