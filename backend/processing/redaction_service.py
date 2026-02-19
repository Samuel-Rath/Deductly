"""
Redaction service for sensitive data in reports.

This module provides functionality to redact sensitive information like
account numbers and BSB codes from transaction data and reports.

Validates: Requirements 12.3
"""

import re
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import date, datetime

from models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    AuditEntry,
    TransactionDirection
)


class RedactionConfig:
    """Configuration for redaction patterns and behavior."""
    
    def __init__(
        self,
        enabled: bool = True,
        redaction_text: str = "[REDACTED]",
        patterns: Optional[List[str]] = None
    ):
        """
        Initialize redaction configuration.
        
        Args:
            enabled: Whether redaction is enabled
            redaction_text: Text to replace sensitive data with
            patterns: List of regex patterns to match sensitive data
        """
        self.enabled = enabled
        self.redaction_text = redaction_text
        
        # Default patterns for Australian banking sensitive data
        if patterns is None:
            self.patterns = [
                # BSB codes: XXX-XXX format
                r'\b\d{3}-\d{3}\b',
                # Account numbers: 6-10 digits
                r'\b\d{6,10}\b',
                # Card numbers: 4 groups of 4 digits
                r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
                # Reference numbers in format REF:XXXXXX or #XXXXXX
                r'\bREF:\s*[A-Z0-9]{6,}\b',
                r'#[A-Z0-9]{6,}\b',
            ]
        else:
            self.patterns = patterns
        
        # Compile patterns for efficiency
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.patterns]


class RedactionService:
    """Service for redacting sensitive data from reports."""
    
    def __init__(self, config: Optional[RedactionConfig] = None):
        """
        Initialize redaction service.
        
        Args:
            config: Redaction configuration (uses defaults if None)
        """
        self.config = config or RedactionConfig()
    
    def redact_text(self, text: str) -> str:
        """
        Redact sensitive data from a text string.
        
        Args:
            text: Text to redact
            
        Returns:
            Text with sensitive data replaced by redaction text
        """
        if not self.config.enabled or not text:
            return text
        
        redacted = text
        for pattern in self.config.compiled_patterns:
            redacted = pattern.sub(self.config.redaction_text, redacted)
        
        return redacted
    
    def redact_transaction(self, transaction: NormalisedTransaction) -> NormalisedTransaction:
        """
        Redact sensitive data from a normalised transaction.
        
        Args:
            transaction: Transaction to redact
            
        Returns:
            New transaction with redacted fields
        """
        if not self.config.enabled:
            return transaction
        
        # Create a copy with redacted fields
        return NormalisedTransaction(
            transaction_id=transaction.transaction_id,
            date=transaction.date,
            description=self.redact_text(transaction.description),
            merchant=self.redact_text(transaction.merchant),
            direction=transaction.direction,
            absolute_amount=transaction.absolute_amount,
            signed_amount=transaction.signed_amount,
            payment_rail=transaction.payment_rail,
            recurring_flag=transaction.recurring_flag,
            raw_data=self._redact_dict(transaction.raw_data)
        )
    
    def redact_classified_transaction(
        self,
        classified: ClassifiedTransaction
    ) -> ClassifiedTransaction:
        """
        Redact sensitive data from a classified transaction.
        
        Args:
            classified: Classified transaction to redact
            
        Returns:
            New classified transaction with redacted fields
        """
        if not self.config.enabled:
            return classified
        
        return ClassifiedTransaction(
            transaction=self.redact_transaction(classified.transaction),
            category=classified.category,
            confidence=classified.confidence,
            matched_rule_id=classified.matched_rule_id,
            matched_rule_version=classified.matched_rule_version,
            reason=self.redact_text(classified.reason),
            evidence_checklist=classified.evidence_checklist,
            flags=classified.flags
        )
    
    def redact_excluded_transaction(
        self,
        excluded: ExcludedTransaction
    ) -> ExcludedTransaction:
        """
        Redact sensitive data from an excluded transaction.
        
        Args:
            excluded: Excluded transaction to redact
            
        Returns:
            New excluded transaction with redacted fields
        """
        if not self.config.enabled:
            return excluded
        
        return ExcludedTransaction(
            transaction=self.redact_transaction(excluded.transaction),
            reason=excluded.reason,
            explanation=self.redact_text(excluded.explanation)
        )
    
    def redact_audit_entry(self, entry: AuditEntry) -> AuditEntry:
        """
        Redact sensitive data from an audit trail entry.
        
        Args:
            entry: Audit entry to redact
            
        Returns:
            New audit entry with redacted fields
        """
        if not self.config.enabled:
            return entry
        
        return AuditEntry(
            transaction_id=entry.transaction_id,
            normalisation=self._redact_dict(entry.normalisation),
            exclusion_checks=[self._redact_dict(check) for check in entry.exclusion_checks],
            classification_attempts=[self._redact_dict(attempt) for attempt in entry.classification_attempts],
            final_result=self._redact_dict(entry.final_result)
        )
    
    def redact_report_data(self, report_data: ReportData) -> ReportData:
        """
        Redact sensitive data from complete report data.
        
        This is the main entry point for redacting all report outputs.
        
        Args:
            report_data: Report data to redact
            
        Returns:
            New report data with all sensitive fields redacted
        """
        if not self.config.enabled:
            return report_data
        
        return ReportData(
            income_year=report_data.income_year,
            generated_at=report_data.generated_at,
            summary=report_data.summary,  # Summary contains only aggregates, no sensitive data
            candidates=[
                self.redact_classified_transaction(t)
                for t in report_data.candidates
            ],
            needs_review=[
                self.redact_classified_transaction(t)
                for t in report_data.needs_review
            ],
            excluded=[
                self.redact_excluded_transaction(t)
                for t in report_data.excluded
            ],
            audit_trail=[
                self.redact_audit_entry(entry)
                for entry in report_data.audit_trail
            ]
        )
    
    def _redact_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively redact sensitive data from a dictionary.
        
        Args:
            data: Dictionary to redact
            
        Returns:
            New dictionary with redacted values
        """
        if not data:
            return data
        
        redacted = {}
        for key, value in data.items():
            if isinstance(value, str):
                redacted[key] = self.redact_text(value)
            elif isinstance(value, dict):
                redacted[key] = self._redact_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    self._redact_dict(item) if isinstance(item, dict)
                    else self.redact_text(item) if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                # Keep non-string values as-is (numbers, dates, etc.)
                redacted[key] = value
        
        return redacted
