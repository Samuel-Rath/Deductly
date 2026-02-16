"""
Unit tests for Exclusion Engine.

Tests specific exclusion patterns with concrete examples and edge cases.

Validates: Requirements 3.1-3.6
"""

import pytest
from datetime import date
from decimal import Decimal

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    ExclusionReason
)
from backend.processing.exclusion_engine import ExclusionEngine


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def exclusion_engine():
    """Create an ExclusionEngine instance for testing."""
    return ExclusionEngine()


def create_transaction(description: str, direction: TransactionDirection = TransactionDirection.DEBIT, amount: Decimal = Decimal("100.00")):
    """Helper to create a test transaction."""
    signed_amount = -amount if direction == TransactionDirection.DEBIT else amount
    return NormalisedTransaction(
        date=date(2024, 1, 15),
        description=description,
        merchant=description,
        direction=direction,
        absolute_amount=amount,
        signed_amount=signed_amount
    )


# ============================================================================
# Transfer Exclusion Tests (Requirement 3.1)
# ============================================================================

def test_transfer_to_excluded(exclusion_engine):
    """Test that 'TRANSFER TO' transactions are excluded."""
    transaction = create_transaction("TRANSFER TO SAVINGS ACCOUNT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS
    assert "transfer between accounts" in excluded[0].explanation.lower()


def test_transfer_from_excluded(exclusion_engine):
    """Test that 'TRANSFER FROM' transactions are excluded."""
    transaction = create_transaction("TRANSFER FROM CHECKING")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_osko_payment_excluded(exclusion_engine):
    """Test that OSKO payments are excluded."""
    transaction = create_transaction("OSKO PAYMENT TO JOHN SMITH")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_payid_transfer_excluded(exclusion_engine):
    """Test that PayID transfers are excluded."""
    transaction = create_transaction("PAYID TRANSFER 0412345678")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_bpay_payment_excluded(exclusion_engine):
    """Test that BPAY payments are excluded."""
    transaction = create_transaction("BPAY PAYMENT BILLER CODE 12345")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_internal_transfer_excluded(exclusion_engine):
    """Test that internal transfers are excluded."""
    transaction = create_transaction("INTERNAL TRANSFER")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


# ============================================================================
# Cash Withdrawal Exclusion Tests (Requirement 3.2)
# ============================================================================

def test_atm_withdrawal_excluded(exclusion_engine):
    """Test that ATM withdrawals are excluded."""
    transaction = create_transaction("ATM WITHDRAWAL WESTPAC")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL
    assert "cash withdrawal" in excluded[0].explanation.lower()


def test_atm_only_excluded(exclusion_engine):
    """Test that transactions with just 'ATM' are excluded."""
    transaction = create_transaction("ATM 123 GEORGE ST SYDNEY")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL


def test_cash_out_excluded(exclusion_engine):
    """Test that cash out transactions are excluded."""
    transaction = create_transaction("CASH OUT WOOLWORTHS")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL


def test_eftpos_cash_excluded(exclusion_engine):
    """Test that EFTPOS cash transactions are excluded."""
    transaction = create_transaction("EFTPOS CASH COLES")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL


# ============================================================================
# Loan Repayment Exclusion Tests (Requirement 3.3)
# ============================================================================

def test_loan_repayment_excluded(exclusion_engine):
    """Test that loan repayments are excluded."""
    transaction = create_transaction("LOAN REPAYMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT
    assert "loan" in excluded[0].explanation.lower()


def test_mortgage_payment_excluded(exclusion_engine):
    """Test that mortgage payments are excluded."""
    transaction = create_transaction("MORTGAGE PAYMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT


def test_home_loan_excluded(exclusion_engine):
    """Test that home loan payments are excluded."""
    transaction = create_transaction("HOME LOAN REPAYMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT


def test_personal_loan_excluded(exclusion_engine):
    """Test that personal loan payments are excluded."""
    transaction = create_transaction("PERSONAL LOAN INSTALMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT


def test_car_loan_excluded(exclusion_engine):
    """Test that car loan payments are excluded."""
    transaction = create_transaction("CAR LOAN PAYMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT


# ============================================================================
# Tax Settlement Exclusion Tests (Requirement 3.4)
# ============================================================================

def test_ato_payment_excluded(exclusion_engine):
    """Test that ATO payments are excluded."""
    transaction = create_transaction("ATO PAYMENT")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TAX_SETTLEMENT
    assert "tax" in excluded[0].explanation.lower()


def test_ato_only_excluded(exclusion_engine):
    """Test that transactions with just 'ATO' are excluded."""
    transaction = create_transaction("ATO")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TAX_SETTLEMENT


def test_australian_taxation_office_excluded(exclusion_engine):
    """Test that Australian Taxation Office transactions are excluded."""
    transaction = create_transaction("AUSTRALIAN TAXATION OFFICE")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TAX_SETTLEMENT


def test_tax_refund_excluded(exclusion_engine):
    """Test that tax refunds are excluded."""
    transaction = create_transaction("TAX REFUND", TransactionDirection.CREDIT)
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TAX_SETTLEMENT


# ============================================================================
# Salary Income Exclusion Tests (Requirement 3.4)
# ============================================================================

def test_salary_credit_excluded(exclusion_engine):
    """Test that salary credits are excluded."""
    transaction = create_transaction("SALARY FROM EMPLOYER", TransactionDirection.CREDIT)
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.SALARY_INCOME
    assert "salary" in excluded[0].explanation.lower()


def test_wages_credit_excluded(exclusion_engine):
    """Test that wage credits are excluded."""
    transaction = create_transaction("WAGES", TransactionDirection.CREDIT)
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.SALARY_INCOME


def test_payroll_credit_excluded(exclusion_engine):
    """Test that payroll credits are excluded."""
    transaction = create_transaction("PAYROLL PAYMENT", TransactionDirection.CREDIT)
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.SALARY_INCOME


def test_salary_debit_not_excluded(exclusion_engine):
    """Test that salary-like debits are NOT excluded (only credits are salary income)."""
    transaction = create_transaction("SALARY PACKAGING", TransactionDirection.DEBIT)
    candidates, excluded = exclusion_engine.filter([transaction])
    
    # Should NOT be excluded (salary patterns only apply to credits)
    assert len(candidates) == 1
    assert len(excluded) == 0


# ============================================================================
# Non-Excluded Transaction Tests
# ============================================================================

def test_normal_purchase_not_excluded(exclusion_engine):
    """Test that normal purchases pass through."""
    transaction = create_transaction("ADOBE CREATIVE CLOUD")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 1
    assert len(excluded) == 0
    assert candidates[0] == transaction


def test_merchant_purchase_not_excluded(exclusion_engine):
    """Test that merchant purchases pass through."""
    transaction = create_transaction("OFFICEWORKS SYDNEY")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 1
    assert len(excluded) == 0


def test_subscription_not_excluded(exclusion_engine):
    """Test that subscriptions pass through."""
    transaction = create_transaction("NETFLIX.COM")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 1
    assert len(excluded) == 0


# ============================================================================
# Case Insensitivity Tests
# ============================================================================

def test_lowercase_transfer_excluded(exclusion_engine):
    """Test that lowercase patterns are matched."""
    transaction = create_transaction("transfer to savings")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_mixed_case_atm_excluded(exclusion_engine):
    """Test that mixed case patterns are matched."""
    transaction = create_transaction("Atm Withdrawal")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL


# ============================================================================
# Multiple Transaction Tests
# ============================================================================

def test_filter_multiple_transactions(exclusion_engine):
    """Test filtering multiple transactions at once."""
    transactions = [
        create_transaction("ADOBE CREATIVE CLOUD"),
        create_transaction("TRANSFER TO SAVINGS"),
        create_transaction("ATM WITHDRAWAL"),
        create_transaction("OFFICEWORKS"),
        create_transaction("LOAN REPAYMENT"),
    ]
    
    candidates, excluded = exclusion_engine.filter(transactions)
    
    assert len(candidates) == 2  # Adobe and Officeworks
    assert len(excluded) == 3  # Transfer, ATM, Loan
    
    # Check excluded reasons
    excluded_reasons = [e.reason for e in excluded]
    assert ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS in excluded_reasons
    assert ExclusionReason.CASH_WITHDRAWAL in excluded_reasons
    assert ExclusionReason.LOAN_REPAYMENT in excluded_reasons


def test_empty_transaction_list(exclusion_engine):
    """Test filtering an empty list."""
    candidates, excluded = exclusion_engine.filter([])
    
    assert len(candidates) == 0
    assert len(excluded) == 0


# ============================================================================
# Edge Cases
# ============================================================================

def test_partial_keyword_match(exclusion_engine):
    """Test that partial keyword matches work correctly."""
    # "TRANSFER" should match even when part of a longer description
    transaction = create_transaction("BANK TRANSFER TO ACCOUNT 123456")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS


def test_transaction_with_special_characters(exclusion_engine):
    """Test transactions with special characters."""
    transaction = create_transaction("ATM WITHDRAWAL - $100.00")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL


def test_transaction_with_numbers(exclusion_engine):
    """Test transactions with numbers in description."""
    transaction = create_transaction("TRANSFER TO ACCOUNT 123456789")
    candidates, excluded = exclusion_engine.filter([transaction])
    
    assert len(candidates) == 0
    assert len(excluded) == 1
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS
