"""
Exclusion Engine for Tax Deduction Analyzer.

This module implements the exclusion logic that filters out transactions
that are clearly not deduction candidates (transfers, cash withdrawals,
loan repayments, tax settlements, salary income).

Validates: Requirements 3.1-3.6
"""

from typing import List, Tuple
import re
from backend.models.schemas import (
    NormalisedTransaction,
    ExcludedTransaction,
    ExclusionReason,
    TransactionDirection
)


# ============================================================================
# Exclusion Rule Patterns
# ============================================================================

class ExclusionPatterns:
    """
    Pattern definitions for identifying non-deductible transactions.
    
    Validates: Requirements 3.1, 3.2, 3.3, 3.4
    """
    
    # Transfer patterns (Requirement 3.1)
    TRANSFER_PATTERNS = [
        r'\bTRANSFER\s+TO\b',
        r'\bTRANSFER\s+FROM\b',
        r'\bOSKO\b',
        r'\bPAYID\b',
        r'\bBPAY\b',
        r'\bINTERNAL\s+TRANSFER\b',
        r'\bTRANSFER\s+DEBIT\b',
        r'\bTRANSFER\s+CREDIT\b',
        r'\bACCOUNT\s+TRANSFER\b',
    ]
    
    # Cash withdrawal patterns (Requirement 3.2)
    CASH_WITHDRAWAL_PATTERNS = [
        r'\bATM\s+WITHDRAWAL\b',
        r'\bATM\b',
        r'\bCASH\s+OUT\b',
        r'\bCASH\s+WITHDRAWAL\b',
        r'\bEFTPOS\s+CASH\b',
        r'\bWITHDRAWAL\s+ATM\b',
    ]
    
    # Loan repayment patterns (Requirement 3.3)
    LOAN_REPAYMENT_PATTERNS = [
        r'\bLOAN\s+REPAYMENT\b',
        r'\bLOAN\s+PAYMENT\b',
        r'\bMORTGAGE\b',
        r'\bHOME\s+LOAN\b',
        r'\bPERSONAL\s+LOAN\b',
        r'\bCAR\s+LOAN\b',
        r'\bLOAN\s+INSTALMENT\b',
    ]
    
    # Tax settlement patterns (Requirement 3.4)
    TAX_SETTLEMENT_PATTERNS = [
        r'\bATO\s+PAYMENT\b',
        r'\bATO\b',
        r'\bAUSTRALIAN\s+TAXATION\s+OFFICE\b',
        r'\bTAX\s+OFFICE\b',
        r'\bTAX\s+PAYMENT\b',
        r'\bTAX\s+REFUND\b',
        r'\bTAX\s+RETURN\b',
    ]
    
    # Salary income patterns (Requirement 3.4)
    # Note: Only applied to credit transactions
    SALARY_INCOME_PATTERNS = [
        r'\bSALARY\b',
        r'\bWAGES\b',
        r'\bPAYROLL\b',
        r'\bPAY\s+FROM\b',
        r'\bEMPLOYER\s+PAYMENT\b',
    ]


# ============================================================================
# Exclusion Engine
# ============================================================================

class ExclusionEngine:
    """
    Engine that applies exclusion rules to filter non-deductible transactions.
    
    Validates: Requirements 3.1-3.6
    """
    
    def __init__(self):
        """Initialize the exclusion engine with compiled regex patterns."""
        # Compile patterns for performance
        self.transfer_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in ExclusionPatterns.TRANSFER_PATTERNS
        ]
        self.cash_withdrawal_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in ExclusionPatterns.CASH_WITHDRAWAL_PATTERNS
        ]
        self.loan_repayment_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in ExclusionPatterns.LOAN_REPAYMENT_PATTERNS
        ]
        self.tax_settlement_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in ExclusionPatterns.TAX_SETTLEMENT_PATTERNS
        ]
        self.salary_income_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in ExclusionPatterns.SALARY_INCOME_PATTERNS
        ]
    
    def filter(
        self, 
        transactions: List[NormalisedTransaction]
    ) -> Tuple[List[NormalisedTransaction], List[ExcludedTransaction]]:
        """
        Filter transactions into candidates and excluded lists.
        
        Args:
            transactions: List of normalised transactions to filter
            
        Returns:
            Tuple of (candidates, excluded_transactions)
            
        Validates: Requirements 3.1-3.6
        """
        candidates = []
        excluded = []
        
        for transaction in transactions:
            exclusion_result = self._check_exclusion(transaction)
            
            if exclusion_result:
                reason, explanation = exclusion_result
                excluded.append(ExcludedTransaction(
                    transaction=transaction,
                    reason=reason,
                    explanation=explanation
                ))
            else:
                candidates.append(transaction)
        
        return candidates, excluded
    
    def _check_exclusion(
        self, 
        transaction: NormalisedTransaction
    ) -> Tuple[ExclusionReason, str] | None:
        """
        Check if a transaction should be excluded.
        
        Args:
            transaction: Transaction to check
            
        Returns:
            Tuple of (reason, explanation) if excluded, None otherwise
            
        Validates: Requirements 3.1-3.6
        """
        description = transaction.description.upper()
        
        # Check transfer patterns (Requirement 3.1)
        for pattern in self.transfer_patterns:
            if pattern.search(description):
                return (
                    ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS,
                    "Transaction appears to be a transfer between accounts"
                )
        
        # Check cash withdrawal patterns (Requirement 3.2)
        for pattern in self.cash_withdrawal_patterns:
            if pattern.search(description):
                return (
                    ExclusionReason.CASH_WITHDRAWAL,
                    "Transaction is a cash withdrawal or ATM transaction"
                )
        
        # Check loan repayment patterns (Requirement 3.3)
        for pattern in self.loan_repayment_patterns:
            if pattern.search(description):
                return (
                    ExclusionReason.LOAN_REPAYMENT,
                    "Transaction is a loan or mortgage repayment"
                )
        
        # Check tax settlement patterns (Requirement 3.4)
        for pattern in self.tax_settlement_patterns:
            if pattern.search(description):
                return (
                    ExclusionReason.TAX_SETTLEMENT,
                    "Transaction is a tax payment or refund"
                )
        
        # Check salary income patterns (Requirement 3.4)
        # Only apply to credit transactions
        if transaction.direction == TransactionDirection.CREDIT:
            for pattern in self.salary_income_patterns:
                if pattern.search(description):
                    return (
                        ExclusionReason.SALARY_INCOME,
                        "Transaction is salary or wage income"
                    )
        
        return None
