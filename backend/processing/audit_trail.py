"""
Audit Trail Builder for Tax Deduction Analyzer.

This module implements the audit trail system that records all processing
steps for each transaction, providing full transparency and deterministic
reproducibility.

Validates: Requirements 3.5, 4.5, 9.2, 10.5
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    AuditEntry,
    ExclusionReason
)


class AuditTrailBuilder:
    """
    Builder for creating comprehensive audit trails.
    
    Records all processing steps including:
    - Normalisation (merchant extraction, payment rail detection)
    - Exclusion checks (which rules were evaluated and results)
    - Classification attempts (which rules matched and confidence scores)
    - Final result (category, confidence, evidence, flags)
    """
    
    def __init__(self):
        """Initialize the audit trail builder."""
        self.entries: Dict[str, Dict[str, Any]] = {}
    
    def record_normalisation(
        self,
        transaction: NormalisedTransaction,
        original_description: str,
        extracted_merchant: str,
        detected_payment_rail: Optional[str],
        recurring_detected: bool
    ) -> None:
        """
        Record normalisation step for a transaction.
        
        Args:
            transaction: The normalised transaction
            original_description: Original description from CSV
            extracted_merchant: Extracted merchant name
            detected_payment_rail: Detected payment rail (if any)
            recurring_detected: Whether recurring pattern was detected
        """
        if transaction.transaction_id not in self.entries:
            self.entries[transaction.transaction_id] = {
                "transaction_id": transaction.transaction_id,
                "normalisation": {},
                "exclusion_checks": [],
                "classification_attempts": [],
                "final_result": {}
            }
        
        self.entries[transaction.transaction_id]["normalisation"] = {
            "original_description": original_description,
            "extracted_merchant": extracted_merchant,
            "payment_rail": detected_payment_rail,
            "recurring_flag": recurring_detected,
            "date": transaction.date.isoformat(),
            "direction": transaction.direction.value,
            "absolute_amount": str(transaction.absolute_amount),
            "signed_amount": str(transaction.signed_amount)
        }
    
    def record_exclusion_check(
        self,
        transaction_id: str,
        check_name: str,
        pattern: str,
        matched: bool,
        reason: Optional[ExclusionReason] = None
    ) -> None:
        """
        Record an exclusion rule check.
        
        Args:
            transaction_id: ID of the transaction being checked
            check_name: Name of the exclusion check (e.g., "transfer_check")
            pattern: Pattern or rule being checked
            matched: Whether the pattern matched
            reason: Exclusion reason if matched
        """
        if transaction_id not in self.entries:
            self.entries[transaction_id] = {
                "transaction_id": transaction_id,
                "normalisation": {},
                "exclusion_checks": [],
                "classification_attempts": [],
                "final_result": {}
            }
        
        check_entry = {
            "check_name": check_name,
            "pattern": pattern,
            "matched": matched
        }
        
        if reason:
            check_entry["reason"] = reason.value
        
        self.entries[transaction_id]["exclusion_checks"].append(check_entry)
    
    def record_classification_attempt(
        self,
        transaction_id: str,
        rule_id: str,
        rule_version: str,
        category: str,
        confidence: float,
        matched: bool,
        match_reason: str
    ) -> None:
        """
        Record a classification rule attempt.
        
        Args:
            transaction_id: ID of the transaction being classified
            rule_id: ID of the rule being evaluated
            rule_version: Version of the rule
            category: Category the rule would assign
            confidence: Confidence score of the match
            matched: Whether the rule matched
            match_reason: Reason for match/no-match
        """
        if transaction_id not in self.entries:
            self.entries[transaction_id] = {
                "transaction_id": transaction_id,
                "normalisation": {},
                "exclusion_checks": [],
                "classification_attempts": [],
                "final_result": {}
            }
        
        attempt_entry = {
            "rule_id": rule_id,
            "rule_version": rule_version,
            "category": category,
            "confidence": confidence,
            "matched": matched,
            "match_reason": match_reason
        }
        
        self.entries[transaction_id]["classification_attempts"].append(attempt_entry)
    
    def record_final_result(
        self,
        transaction_id: str,
        category: Optional[str],
        confidence: float,
        matched_rule_id: Optional[str],
        matched_rule_version: Optional[str],
        reason: str,
        evidence_checklist: List[str],
        flags: List[str],
        excluded: bool = False,
        exclusion_reason: Optional[str] = None,
        exclusion_explanation: Optional[str] = None
    ) -> None:
        """
        Record the final classification or exclusion result.
        
        Args:
            transaction_id: ID of the transaction
            category: Final category (None if unclassified or excluded)
            confidence: Final confidence score
            matched_rule_id: ID of the matched rule (if any)
            matched_rule_version: Version of the matched rule (if any)
            reason: Reason for classification
            evidence_checklist: List of required evidence types
            flags: List of flags (needs_review, method_required, etc.)
            excluded: Whether the transaction was excluded
            exclusion_reason: Reason for exclusion (if excluded)
            exclusion_explanation: Human-readable explanation (if excluded)
        """
        if transaction_id not in self.entries:
            self.entries[transaction_id] = {
                "transaction_id": transaction_id,
                "normalisation": {},
                "exclusion_checks": [],
                "classification_attempts": [],
                "final_result": {}
            }
        
        final_result = {
            "excluded": excluded,
            "category": category,
            "confidence": confidence,
            "matched_rule_id": matched_rule_id,
            "matched_rule_version": matched_rule_version,
            "reason": reason,
            "evidence_checklist": evidence_checklist,
            "flags": flags
        }
        
        if excluded:
            final_result["exclusion_reason"] = exclusion_reason
            final_result["exclusion_explanation"] = exclusion_explanation
        
        self.entries[transaction_id]["final_result"] = final_result
    
    def build(self) -> List[AuditEntry]:
        """
        Build the complete audit trail.
        
        Returns:
            List of AuditEntry objects, one per transaction
        """
        audit_entries = []
        
        for transaction_id, entry_data in self.entries.items():
            audit_entry = AuditEntry(
                transaction_id=transaction_id,
                normalisation=entry_data.get("normalisation", {}),
                exclusion_checks=entry_data.get("exclusion_checks", []),
                classification_attempts=entry_data.get("classification_attempts", []),
                final_result=entry_data.get("final_result", {})
            )
            audit_entries.append(audit_entry)
        
        return audit_entries
    
    def get_entry(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the audit entry for a specific transaction.
        
        Args:
            transaction_id: ID of the transaction
            
        Returns:
            Audit entry data or None if not found
        """
        return self.entries.get(transaction_id)
    
    def clear(self) -> None:
        """Clear all audit entries."""
        self.entries.clear()


def create_audit_trail_from_processing(
    normalised_transactions: List[NormalisedTransaction],
    excluded_transactions: List[ExcludedTransaction],
    classified_transactions: List[ClassifiedTransaction]
) -> List[AuditEntry]:
    """
    Create audit trail from processed transactions.
    
    This is a convenience function for creating audit trails when
    the processing components don't directly integrate with AuditTrailBuilder.
    
    Args:
        normalised_transactions: All normalised transactions
        excluded_transactions: Excluded transactions
        classified_transactions: Classified transactions
        
    Returns:
        List of AuditEntry objects
    """
    builder = AuditTrailBuilder()
    
    # Create lookup for excluded transactions
    excluded_by_id = {
        et.transaction.transaction_id: et 
        for et in excluded_transactions
    }
    
    # Create lookup for classified transactions
    classified_by_id = {
        ct.transaction.transaction_id: ct 
        for ct in classified_transactions
    }
    
    # Process all normalised transactions
    for transaction in normalised_transactions:
        # Record normalisation
        builder.record_normalisation(
            transaction=transaction,
            original_description=transaction.description,
            extracted_merchant=transaction.merchant,
            detected_payment_rail=transaction.payment_rail,
            recurring_detected=transaction.recurring_flag
        )
        
        # Check if excluded
        if transaction.transaction_id in excluded_by_id:
            excluded = excluded_by_id[transaction.transaction_id]
            
            # Record exclusion check
            builder.record_exclusion_check(
                transaction_id=transaction.transaction_id,
                check_name=excluded.reason.value,
                pattern=excluded.reason.value,
                matched=True,
                reason=excluded.reason
            )
            
            # Record final result as excluded
            builder.record_final_result(
                transaction_id=transaction.transaction_id,
                category=None,
                confidence=0.0,
                matched_rule_id=None,
                matched_rule_version=None,
                reason=excluded.reason.value,
                evidence_checklist=[],
                flags=[],
                excluded=True,
                exclusion_reason=excluded.reason.value,
                exclusion_explanation=excluded.explanation
            )
        
        # Check if classified
        elif transaction.transaction_id in classified_by_id:
            classified = classified_by_id[transaction.transaction_id]
            
            # Record that exclusion checks passed
            builder.record_exclusion_check(
                transaction_id=transaction.transaction_id,
                check_name="all_exclusion_checks",
                pattern="none",
                matched=False
            )
            
            # Record classification attempt
            if classified.matched_rule_id:
                builder.record_classification_attempt(
                    transaction_id=transaction.transaction_id,
                    rule_id=classified.matched_rule_id,
                    rule_version=classified.matched_rule_version or "unknown",
                    category=classified.category.value if classified.category else "none",
                    confidence=classified.confidence,
                    matched=True,
                    match_reason=classified.reason
                )
            
            # Record final result
            builder.record_final_result(
                transaction_id=transaction.transaction_id,
                category=classified.category.value if classified.category else None,
                confidence=classified.confidence,
                matched_rule_id=classified.matched_rule_id,
                matched_rule_version=classified.matched_rule_version,
                reason=classified.reason,
                evidence_checklist=[e.value for e in classified.evidence_checklist],
                flags=classified.flags,
                excluded=False
            )
    
    return builder.build()
