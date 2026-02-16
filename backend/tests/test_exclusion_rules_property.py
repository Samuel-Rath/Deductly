"""
Property-based tests for Exclusion Engine.

Feature: tax-deduction-analyzer
Property 6: Exclusion Rules Completeness

Validates: Requirements 3.1, 3.2, 3.3, 3.4
"""

from hypothesis import given, strategies as st
from datetime import date, timedelta
from decimal import Decimal
import pytest

from backend.models.schemas import (
    NormalisedTransaction,
    TransactionDirection,
    ExclusionReason
)
from backend.processing.exclusion_engine import ExclusionEngine


# ============================================================================
# Test Data Generators
# ============================================================================

def generate_date():
    """Generate random dates within a reasonable range."""
    return st.dates(
        min_value=date(2020, 1, 1),
        max_value=date(2024, 12, 31)
    )


def generate_amount():
    """Generate random transaction amounts."""
    return st.decimals(
        min_value=Decimal("0.01"),
        max_value=Decimal("10000.00"),
        places=2
    )


def generate_transfer_description():
    """Generate descriptions that should match transfer patterns."""
    transfer_keywords = [
        "TRANSFER TO SAVINGS",
        "TRANSFER FROM CHECKING",
        "OSKO PAYMENT",
        "PAYID TRANSFER",
        "BPAY PAYMENT",
        "INTERNAL TRANSFER",
        "TRANSFER DEBIT",
        "TRANSFER CREDIT",
        "ACCOUNT TRANSFER",
    ]
    return st.sampled_from(transfer_keywords)


def generate_cash_withdrawal_description():
    """Generate descriptions that should match cash withdrawal patterns."""
    cash_keywords = [
        "ATM WITHDRAWAL",
        "ATM WESTPAC",
        "CASH OUT WOOLWORTHS",
        "CASH WITHDRAWAL",
        "EFTPOS CASH",
        "WITHDRAWAL ATM",
    ]
    return st.sampled_from(cash_keywords)


def generate_loan_repayment_description():
    """Generate descriptions that should match loan repayment patterns."""
    loan_keywords = [
        "LOAN REPAYMENT",
        "LOAN PAYMENT",
        "MORTGAGE PAYMENT",
        "HOME LOAN",
        "PERSONAL LOAN",
        "CAR LOAN",
        "LOAN INSTALMENT",
    ]
    return st.sampled_from(loan_keywords)


def generate_tax_settlement_description():
    """Generate descriptions that should match tax settlement patterns."""
    tax_keywords = [
        "ATO PAYMENT",
        "ATO",
        "AUSTRALIAN TAXATION OFFICE",
        "TAX OFFICE",
        "TAX PAYMENT",
        "TAX REFUND",
        "TAX RETURN",
    ]
    return st.sampled_from(tax_keywords)


def generate_salary_income_description():
    """Generate descriptions that should match salary income patterns."""
    salary_keywords = [
        "SALARY",
        "WAGES",
        "PAYROLL",
        "PAY FROM EMPLOYER",
        "EMPLOYER PAYMENT",
    ]
    return st.sampled_from(salary_keywords)


def generate_non_excluded_description():
    """Generate descriptions that should NOT match any exclusion pattern."""
    normal_keywords = [
        "ADOBE CREATIVE CLOUD",
        "OFFICEWORKS",
        "BUNNINGS",
        "WOOLWORTHS",
        "COLES",
        "UBER",
        "AMAZON",
    ]
    return st.sampled_from(normal_keywords)


def create_transaction(description: str, direction: TransactionDirection, amount: Decimal, txn_date: date):
    """Helper to create a NormalisedTransaction."""
    signed_amount = -amount if direction == TransactionDirection.DEBIT else amount
    return NormalisedTransaction(
        date=txn_date,
        description=description,
        merchant=description,
        direction=direction,
        absolute_amount=amount,
        signed_amount=signed_amount
    )


# ============================================================================
# Property Tests
# ============================================================================

@given(
    description=generate_transfer_description(),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_transfer_exclusion_completeness(description, direction, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Transfer Patterns
    
    For any transaction matching transfer patterns (TRANSFER TO/FROM, OSKO, PAYID, BPAY),
    the Exclusion_Engine should exclude it and assign TRANSFER_BETWEEN_ACCOUNTS reason.
    
    Validates: Requirement 3.1
    """
    engine = ExclusionEngine()
    transaction = create_transaction(description, direction, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should be excluded
    assert len(candidates) == 0, f"Transfer transaction should be excluded: {description}"
    assert len(excluded) == 1, f"Transfer transaction should appear in excluded list: {description}"
    
    # Should have correct exclusion reason
    assert excluded[0].reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS
    assert excluded[0].transaction == transaction


@given(
    description=generate_cash_withdrawal_description(),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_cash_withdrawal_exclusion_completeness(description, direction, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Cash Withdrawal Patterns
    
    For any transaction matching cash withdrawal patterns (ATM, CASH OUT, EFTPOS CASH),
    the Exclusion_Engine should exclude it and assign CASH_WITHDRAWAL reason.
    
    Validates: Requirement 3.2
    """
    engine = ExclusionEngine()
    transaction = create_transaction(description, direction, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should be excluded
    assert len(candidates) == 0, f"Cash withdrawal should be excluded: {description}"
    assert len(excluded) == 1, f"Cash withdrawal should appear in excluded list: {description}"
    
    # Should have correct exclusion reason
    assert excluded[0].reason == ExclusionReason.CASH_WITHDRAWAL
    assert excluded[0].transaction == transaction


@given(
    description=generate_loan_repayment_description(),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_loan_repayment_exclusion_completeness(description, direction, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Loan Repayment Patterns
    
    For any transaction matching loan repayment patterns (LOAN, MORTGAGE, HOME LOAN),
    the Exclusion_Engine should exclude it and assign LOAN_REPAYMENT reason.
    
    Validates: Requirement 3.3
    """
    engine = ExclusionEngine()
    transaction = create_transaction(description, direction, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should be excluded
    assert len(candidates) == 0, f"Loan repayment should be excluded: {description}"
    assert len(excluded) == 1, f"Loan repayment should appear in excluded list: {description}"
    
    # Should have correct exclusion reason
    assert excluded[0].reason == ExclusionReason.LOAN_REPAYMENT
    assert excluded[0].transaction == transaction


@given(
    description=generate_tax_settlement_description(),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_tax_settlement_exclusion_completeness(description, direction, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Tax Settlement Patterns
    
    For any transaction matching tax settlement patterns (ATO PAYMENT, AUSTRALIAN TAXATION OFFICE),
    the Exclusion_Engine should exclude it and assign TAX_SETTLEMENT reason.
    
    Validates: Requirement 3.4
    """
    engine = ExclusionEngine()
    transaction = create_transaction(description, direction, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should be excluded
    assert len(candidates) == 0, f"Tax settlement should be excluded: {description}"
    assert len(excluded) == 1, f"Tax settlement should appear in excluded list: {description}"
    
    # Should have correct exclusion reason
    assert excluded[0].reason == ExclusionReason.TAX_SETTLEMENT
    assert excluded[0].transaction == transaction


@given(
    description=generate_salary_income_description(),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_salary_income_exclusion_completeness(description, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Salary Income Patterns
    
    For any CREDIT transaction matching salary income patterns (SALARY, WAGES, PAYROLL),
    the Exclusion_Engine should exclude it and assign SALARY_INCOME reason.
    
    Validates: Requirement 3.4
    """
    engine = ExclusionEngine()
    # Salary income only applies to credit transactions
    transaction = create_transaction(description, TransactionDirection.CREDIT, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should be excluded
    assert len(candidates) == 0, f"Salary income should be excluded: {description}"
    assert len(excluded) == 1, f"Salary income should appear in excluded list: {description}"
    
    # Should have correct exclusion reason
    assert excluded[0].reason == ExclusionReason.SALARY_INCOME
    assert excluded[0].transaction == transaction


@given(
    description=generate_salary_income_description(),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_salary_income_debit_not_excluded(description, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Salary Income Only on Credits
    
    For any DEBIT transaction matching salary income patterns,
    the Exclusion_Engine should NOT exclude it (salary patterns only apply to credits).
    
    Validates: Requirement 3.4
    """
    engine = ExclusionEngine()
    # Salary income patterns should NOT apply to debit transactions
    transaction = create_transaction(description, TransactionDirection.DEBIT, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should NOT be excluded (salary patterns only apply to credits)
    assert len(candidates) == 1, f"Debit with salary keyword should not be excluded: {description}"
    assert len(excluded) == 0, f"Debit with salary keyword should not appear in excluded list: {description}"


@given(
    description=generate_non_excluded_description(),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]),
    amount=generate_amount(),
    txn_date=generate_date()
)
@pytest.mark.property_test
def test_non_excluded_transactions_pass_through(description, direction, amount, txn_date):
    """
    Property 6: Exclusion Rules Completeness - Non-Excluded Transactions
    
    For any transaction that does NOT match exclusion patterns,
    the Exclusion_Engine should include it in candidates list.
    
    Validates: Requirements 3.1-3.4
    """
    engine = ExclusionEngine()
    transaction = create_transaction(description, direction, amount, txn_date)
    
    candidates, excluded = engine.filter([transaction])
    
    # Transaction should pass through as candidate
    assert len(candidates) == 1, f"Non-excluded transaction should be in candidates: {description}"
    assert len(excluded) == 0, f"Non-excluded transaction should not be excluded: {description}"
    assert candidates[0] == transaction
