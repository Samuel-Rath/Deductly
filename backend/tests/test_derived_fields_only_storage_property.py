"""
Property-based test for derived fields only storage.

Feature: tax-deduction-analyzer
Property 22: Derived Fields Only Storage

For any job processed with persistence enabled, the database should contain
only derived fields (merchant, category, confidence, flags) and should not
contain raw CSV row data.

Validates: Requirements 12.1
"""

import pytest
from hypothesis import given, strategies as st, settings
from decimal import Decimal
from datetime import date, timedelta
import uuid
import tempfile
import os

from backend.storage.database import init_database, drop_database
from backend.storage.storage_service import StorageService
from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    TransactionDirection,
    DeductionCategory,
    EvidenceType
)


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def normalised_transaction_strategy(draw):
    """Generate random NormalisedTransaction with raw_data."""
    return NormalisedTransaction(
        transaction_id=str(uuid.uuid4()),
        date=draw(st.dates(
            min_value=date(2023, 7, 1),
            max_value=date(2024, 6, 30)
        )),
        description=draw(st.text(min_size=5, max_size=100)),
        merchant=draw(st.text(min_size=3, max_size=50)),
        direction=draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT])),
        absolute_amount=Decimal(str(draw(st.floats(min_value=0.01, max_value=10000.0)))).quantize(Decimal('0.01')),
        signed_amount=Decimal(str(draw(st.floats(min_value=-10000.0, max_value=10000.0)))).quantize(Decimal('0.01')),
        payment_rail=draw(st.one_of(st.none(), st.sampled_from(['card', 'paypal', 'bpay', 'osko']))),
        recurring_flag=draw(st.booleans()),
        raw_data={
            'original_description': draw(st.text(min_size=10, max_size=200)),
            'original_amount': str(draw(st.floats(min_value=-10000.0, max_value=10000.0))),
            'account_number': draw(st.text(min_size=8, max_size=16)),
            'bsb': draw(st.text(min_size=6, max_size=6)),
            'sensitive_field': draw(st.text(min_size=10, max_size=50))
        }
    )


@st.composite
def classified_transaction_strategy(draw):
    """Generate random ClassifiedTransaction with raw_data in nested transaction."""
    transaction = draw(normalised_transaction_strategy())
    
    return ClassifiedTransaction(
        transaction=transaction,
        category=draw(st.one_of(st.none(), st.sampled_from(list(DeductionCategory)))),
        confidence=draw(st.floats(min_value=0.0, max_value=1.0)),
        matched_rule_id=draw(st.one_of(st.none(), st.text(min_size=3, max_size=10))),
        matched_rule_version=draw(st.one_of(st.none(), st.text(min_size=3, max_size=10))),
        reason=draw(st.text(min_size=5, max_size=100)),
        evidence_checklist=draw(st.lists(st.sampled_from(list(EvidenceType)), min_size=1, max_size=3)),
        flags=draw(st.lists(st.text(min_size=3, max_size=20), max_size=3))
    )


# ============================================================================
# Property Test
# ============================================================================

@given(
    transactions=st.lists(classified_transaction_strategy(), min_size=1, max_size=10),
    job_id=st.text(min_size=10, max_size=50)
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
def test_derived_fields_only_storage_property(transactions, job_id):
    """
    Property 22: Derived Fields Only Storage
    
    For any job processed with persistence enabled, the database should contain
    only derived fields (merchant, category, confidence, flags) and should not
    contain raw CSV row data.
    
    **Validates: Requirements 12.1**
    """
    # Create temporary database
    db_path = f"test_derived_fields_{uuid.uuid4()}.db"
    
    try:
        # Initialize database and storage service with persistence enabled
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=False)
        
        # Create job
        storage.create_job(
            job_id=job_id,
            income_year="2023-2024",
            ephemeral_mode=False
        )
        
        # Save classified transactions (which contain raw_data in nested transaction)
        storage.save_classified_transactions(job_id, transactions)
        
        # Verify no raw data is stored
        assert storage.verify_no_raw_data_stored(job_id), \
            "Database schema should not contain raw_data column"
        
        # Retrieve stored transactions
        stored_transactions = storage.get_transactions(job_id)
        
        # Verify transactions were stored
        assert len(stored_transactions) == len(transactions), \
            "All transactions should be stored"
        
        # Verify only derived fields are present
        for stored_tx in stored_transactions:
            # Check that derived fields are present
            assert 'merchant' in stored_tx, "Merchant (derived field) should be stored"
            assert 'category' in stored_tx, "Category (derived field) should be stored"
            assert 'confidence' in stored_tx, "Confidence (derived field) should be stored"
            assert 'flags' in stored_tx, "Flags (derived field) should be stored"
            assert 'payment_rail' in stored_tx, "Payment rail (derived field) should be stored"
            assert 'recurring_flag' in stored_tx, "Recurring flag (derived field) should be stored"
            
            # Check that raw_data is NOT present
            assert 'raw_data' not in stored_tx, \
                "Raw CSV data should NEVER be stored in database"
            assert 'account_number' not in stored_tx, \
                "Sensitive raw fields should not be stored"
            assert 'bsb' not in stored_tx, \
                "Sensitive raw fields should not be stored"
            assert 'sensitive_field' not in stored_tx, \
                "Sensitive raw fields should not be stored"
        
        # Verify database schema doesn't have raw_data column
        columns_query = "PRAGMA table_info(transactions)"
        columns = db.fetchall(columns_query)
        column_names = [col['name'] for col in columns]
        
        assert 'raw_data' not in column_names, \
            "Database schema should not have raw_data column"
        assert 'account_number' not in column_names, \
            "Database schema should not have sensitive raw fields"
        assert 'bsb' not in column_names, \
            "Database schema should not have sensitive raw fields"
        
        # Clean up
        storage.delete_job(job_id)
        db.close()
        
    finally:
        # Clean up database file
        if os.path.exists(db_path):
            drop_database(db_path)


# ============================================================================
# Unit Tests for Edge Cases
# ============================================================================

def test_derived_fields_only_with_empty_raw_data():
    """Test that even with empty raw_data, no raw data column exists."""
    db_path = f"test_empty_raw_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=False)
        
        job_id = str(uuid.uuid4())
        storage.create_job(job_id, "2023-2024", ephemeral_mode=False)
        
        # Create transaction with empty raw_data
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Test transaction",
            merchant="Test Merchant",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("100.00"),
            signed_amount=Decimal("-100.00"),
            raw_data={}  # Empty raw data
        )
        
        classified = ClassifiedTransaction(
            transaction=transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[]
        )
        
        storage.save_classified_transactions(job_id, [classified])
        
        # Verify no raw_data column exists
        assert storage.verify_no_raw_data_stored(job_id)
        
        stored = storage.get_transactions(job_id)
        assert len(stored) == 1
        assert 'raw_data' not in stored[0]
        
        storage.delete_job(job_id)
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_derived_fields_only_with_sensitive_raw_data():
    """Test that sensitive data in raw_data is never stored."""
    db_path = f"test_sensitive_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=False)
        
        job_id = str(uuid.uuid4())
        storage.create_job(job_id, "2023-2024", ephemeral_mode=False)
        
        # Create transaction with sensitive raw_data
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Test transaction",
            merchant="Test Merchant",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("100.00"),
            signed_amount=Decimal("-100.00"),
            raw_data={
                'account_number': '12345678',
                'bsb': '123-456',
                'card_number': '4111111111111111',
                'cvv': '123'
            }
        )
        
        classified = ClassifiedTransaction(
            transaction=transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[]
        )
        
        storage.save_classified_transactions(job_id, [classified])
        
        # Verify sensitive data is not stored
        stored = storage.get_transactions(job_id)
        assert len(stored) == 1
        
        stored_tx = stored[0]
        assert 'account_number' not in stored_tx
        assert 'bsb' not in stored_tx
        assert 'card_number' not in stored_tx
        assert 'cvv' not in stored_tx
        assert 'raw_data' not in stored_tx
        
        storage.delete_job(job_id)
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)
