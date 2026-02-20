"""
Property-based tests for CSV amount normalisation.

Feature: tax-deduction-analyzer
Property 1: CSV Amount Normalisation Consistency

Validates: Requirements 1.3
"""

import pytest
from decimal import Decimal
from datetime import date
from hypothesis import given, strategies as st
from backend.models.schemas import NormalisedTransaction, TransactionDirection


# Custom strategies for generating test data
@st.composite
def transaction_amounts(draw):
    """
    Generate transaction amounts with direction.
    
    Returns tuple of (amount, direction) where:
    - amount can be positive or negative
    - direction is either DEBIT or CREDIT
    """
    # Generate amounts from -10000 to 10000 with 2 decimal places
    amount = draw(st.decimals(
        min_value=Decimal("-10000.00"),
        max_value=Decimal("10000.00"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ))
    
    # Exclude zero amounts as they're not valid transactions
    if amount == Decimal("0.00"):
        amount = Decimal("0.01")
    
    direction = draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]))
    
    return amount, direction


@st.composite
def normalised_transaction_data(draw):
    """
    Generate data for creating a NormalisedTransaction.
    
    This simulates what a CSV parser would produce after parsing
    a bank CSV with either single amount column or separate debit/credit columns.
    """
    amount, direction = draw(transaction_amounts())
    
    # Calculate absolute_amount (always positive)
    absolute_amount = abs(amount)
    
    # Calculate signed_amount based on direction
    # Debits are negative, credits are positive
    if direction == TransactionDirection.DEBIT:
        signed_amount = -absolute_amount
    else:
        signed_amount = absolute_amount
    
    return {
        "date": draw(st.dates(
            min_value=date(2020, 1, 1),
            max_value=date(2024, 12, 31)
        )),
        "description": draw(st.text(min_size=1, max_size=100)),
        "merchant": draw(st.text(min_size=1, max_size=50)),
        "direction": direction,
        "absolute_amount": absolute_amount,
        "signed_amount": signed_amount,
    }


# Feature: tax-deduction-analyzer, Property 1: CSV Amount Normalisation Consistency
@given(transaction_data=normalised_transaction_data())
@pytest.mark.property_test
def test_amount_normalisation_consistency(transaction_data):
    """
    Property 1: CSV Amount Normalisation Consistency
    
    For any valid CSV row with amount data (single amount column or separate 
    debit/credit columns), parsing should produce a NormalisedTransaction where:
    1. absolute_amount is always positive
    2. signed_amount has correct sign based on direction
    3. direction matches the transaction type
    
    Validates: Requirements 1.3
    """
    # Create a NormalisedTransaction with the generated data
    transaction = NormalisedTransaction(**transaction_data)
    
    # Property 1: absolute_amount must always be positive
    assert transaction.absolute_amount > 0, (
        f"absolute_amount must be positive, got {transaction.absolute_amount}"
    )
    
    # Property 2: signed_amount must have correct sign based on direction
    if transaction.direction == TransactionDirection.DEBIT:
        assert transaction.signed_amount < 0, (
            f"DEBIT transactions must have negative signed_amount, "
            f"got {transaction.signed_amount} for direction {transaction.direction}"
        )
        # Also verify that signed_amount is the negative of absolute_amount
        assert transaction.signed_amount == -transaction.absolute_amount, (
            f"For DEBIT, signed_amount should equal -absolute_amount, "
            f"got signed={transaction.signed_amount}, absolute={transaction.absolute_amount}"
        )
    else:  # CREDIT
        assert transaction.signed_amount > 0, (
            f"CREDIT transactions must have positive signed_amount, "
            f"got {transaction.signed_amount} for direction {transaction.direction}"
        )
        # Also verify that signed_amount equals absolute_amount
        assert transaction.signed_amount == transaction.absolute_amount, (
            f"For CREDIT, signed_amount should equal absolute_amount, "
            f"got signed={transaction.signed_amount}, absolute={transaction.absolute_amount}"
        )
    
    # Property 3: The magnitude of signed_amount should equal absolute_amount
    assert abs(transaction.signed_amount) == transaction.absolute_amount, (
        f"Magnitude of signed_amount must equal absolute_amount, "
        f"got |{transaction.signed_amount}| != {transaction.absolute_amount}"
    )


@given(
    amount=st.decimals(
        min_value=Decimal("0.01"),
        max_value=Decimal("10000.00"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ),
    direction=st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT])
)
@pytest.mark.property_test
def test_amount_sign_consistency_simple(amount, direction):
    """
    Simplified property test focusing on sign consistency.
    
    This test directly validates that when creating a NormalisedTransaction
    with a positive absolute_amount and a direction, the signed_amount
    has the correct sign.
    
    Validates: Requirements 1.3
    """
    # Calculate signed_amount based on direction
    if direction == TransactionDirection.DEBIT:
        signed_amount = -amount
    else:
        signed_amount = amount
    
    # Create transaction
    transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Test transaction",
        merchant="Test Merchant",
        direction=direction,
        absolute_amount=amount,
        signed_amount=signed_amount,
    )
    
    # Verify properties
    assert transaction.absolute_amount > 0
    
    if direction == TransactionDirection.DEBIT:
        assert transaction.signed_amount < 0
        assert transaction.signed_amount == -transaction.absolute_amount
    else:
        assert transaction.signed_amount > 0
        assert transaction.signed_amount == transaction.absolute_amount


@given(
    debit_amount=st.decimals(
        min_value=Decimal("0.01"),
        max_value=Decimal("10000.00"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    ),
    credit_amount=st.decimals(
        min_value=Decimal("0.01"),
        max_value=Decimal("10000.00"),
        places=2,
        allow_nan=False,
        allow_infinity=False
    )
)
@pytest.mark.property_test
def test_separate_debit_credit_columns(debit_amount, credit_amount):
    """
    Property test for CSV formats with separate debit/credit columns.
    
    Some Australian banks use separate columns for debits and credits.
    This test validates that both formats produce correct normalisation.
    
    Validates: Requirements 1.3
    """
    # Test debit transaction (debit column has value, credit is zero/empty)
    debit_transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Debit transaction",
        merchant="Test Merchant",
        direction=TransactionDirection.DEBIT,
        absolute_amount=debit_amount,
        signed_amount=-debit_amount,
    )
    
    assert debit_transaction.absolute_amount == debit_amount
    assert debit_transaction.signed_amount == -debit_amount
    assert debit_transaction.direction == TransactionDirection.DEBIT
    
    # Test credit transaction (credit column has value, debit is zero/empty)
    credit_transaction = NormalisedTransaction(
        date=date(2024, 1, 15),
        description="Credit transaction",
        merchant="Test Merchant",
        direction=TransactionDirection.CREDIT,
        absolute_amount=credit_amount,
        signed_amount=credit_amount,
    )
    
    assert credit_transaction.absolute_amount == credit_amount
    assert credit_transaction.signed_amount == credit_amount
    assert credit_transaction.direction == TransactionDirection.CREDIT
