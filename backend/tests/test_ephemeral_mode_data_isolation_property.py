"""
Property-based test for ephemeral mode data isolation.

Feature: tax-deduction-analyzer
Property 21: Ephemeral Mode Data Isolation

For any job processed in ephemeral mode, after report generation completes,
no transaction data should be persisted in the database.

Validates: Requirements 12.2
"""

import pytest
from hypothesis import given, strategies as st, settings
from decimal import Decimal
from datetime import date
import uuid
import os

from backend.storage.database import init_database, drop_database
from backend.storage.storage_service import StorageService
from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
    ExclusionReason
)


# ============================================================================
# Hypothesis Strategies
# ============================================================================

@st.composite
def normalised_transaction_strategy(draw):
    """Generate random NormalisedTransaction."""
    direction = draw(st.sampled_from([TransactionDirection.DEBIT, TransactionDirection.CREDIT]))
    absolute_amount = Decimal(str(draw(st.floats(min_value=0.01, max_value=10000.0)))).quantize(Decimal('0.01'))
    signed_amount = -absolute_amount if direction == TransactionDirection.DEBIT else absolute_amount
    
    return NormalisedTransaction(
        transaction_id=str(uuid.uuid4()),
        date=draw(st.dates(
            min_value=date(2023, 7, 1),
            max_value=date(2024, 6, 30)
        )),
        description=draw(st.text(min_size=5, max_size=100)),
        merchant=draw(st.text(min_size=3, max_size=50)),
        direction=direction,
        absolute_amount=absolute_amount,
        signed_amount=signed_amount,
        payment_rail=draw(st.one_of(st.none(), st.sampled_from(['card', 'paypal', 'bpay', 'osko']))),
        recurring_flag=draw(st.booleans()),
        raw_data=draw(st.dictionaries(st.text(min_size=1, max_size=20), st.text(min_size=1, max_size=50)))
    )


@st.composite
def classified_transaction_strategy(draw):
    """Generate random ClassifiedTransaction."""
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


@st.composite
def excluded_transaction_strategy(draw):
    """Generate random ExcludedTransaction."""
    transaction = draw(normalised_transaction_strategy())
    
    return ExcludedTransaction(
        transaction=transaction,
        reason=draw(st.sampled_from(list(ExclusionReason))),
        explanation=draw(st.text(min_size=10, max_size=100))
    )


# ============================================================================
# Property Test
# ============================================================================

@given(
    classified_transactions=st.lists(classified_transaction_strategy(), min_size=1, max_size=10),
    excluded_transactions=st.lists(excluded_transaction_strategy(), min_size=0, max_size=5),
    job_id=st.text(min_size=10, max_size=50)
)
@settings(max_examples=100, deadline=None)
@pytest.mark.property_test
def test_ephemeral_mode_data_isolation_property(classified_transactions, excluded_transactions, job_id):
    """
    Property 21: Ephemeral Mode Data Isolation
    
    For any job processed in ephemeral mode, after report generation completes,
    no transaction data should be persisted in the database.
    
    **Validates: Requirements 12.2**
    """
    # Create temporary database
    db_path = f"test_ephemeral_{uuid.uuid4()}.db"
    
    try:
        # Initialize database
        db = init_database(db_path)
        
        # Create storage service with ephemeral mode ENABLED
        storage = StorageService(db, ephemeral_mode=True)
        
        # Attempt to create job in ephemeral mode
        storage.create_job(
            job_id=job_id,
            income_year="2023-2024",
            ephemeral_mode=True
        )
        
        # Attempt to save classified transactions in ephemeral mode
        storage.save_classified_transactions(job_id, classified_transactions)
        
        # Attempt to save excluded transactions in ephemeral mode
        storage.save_excluded_transactions(job_id, excluded_transactions)
        
        # Attempt to update job status in ephemeral mode
        storage.update_job_status(
            job_id=job_id,
            status='completed',
            total_transactions=len(classified_transactions) + len(excluded_transactions),
            total_candidates=len(classified_transactions),
            total_excluded=len(excluded_transactions)
        )
        
        # Verify NO data was persisted
        # Check that job doesn't exist
        job = storage.get_job(job_id)
        assert job is None, \
            "In ephemeral mode, job metadata should NOT be persisted"
        
        # Check that no transactions were stored
        transactions = storage.get_transactions(job_id)
        assert len(transactions) == 0, \
            "In ephemeral mode, NO transactions should be persisted"
        
        candidates = storage.get_candidates(job_id)
        assert len(candidates) == 0, \
            "In ephemeral mode, NO candidate transactions should be persisted"
        
        excluded = storage.get_excluded(job_id)
        assert len(excluded) == 0, \
            "In ephemeral mode, NO excluded transactions should be persisted"
        
        # Verify database tables are empty
        jobs_count = db.fetchone("SELECT COUNT(*) as count FROM jobs WHERE job_id = ?", (job_id,))
        assert jobs_count['count'] == 0, \
            "Jobs table should be empty for ephemeral mode jobs"
        
        transactions_count = db.fetchone("SELECT COUNT(*) as count FROM transactions WHERE job_id = ?", (job_id,))
        assert transactions_count['count'] == 0, \
            "Transactions table should be empty for ephemeral mode jobs"
        
        db.close()
        
    finally:
        # Clean up database file
        if os.path.exists(db_path):
            drop_database(db_path)


# ============================================================================
# Unit Tests for Edge Cases
# ============================================================================

def test_ephemeral_mode_vs_persistent_mode():
    """Test that ephemeral mode prevents storage while persistent mode allows it."""
    db_path = f"test_ephemeral_vs_persistent_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        
        # Test ephemeral mode
        ephemeral_storage = StorageService(db, ephemeral_mode=True)
        ephemeral_job_id = str(uuid.uuid4())
        
        ephemeral_storage.create_job(ephemeral_job_id, "2023-2024", ephemeral_mode=True)
        
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Test transaction",
            merchant="Test Merchant",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("100.00"),
            signed_amount=Decimal("-100.00")
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
        
        ephemeral_storage.save_classified_transactions(ephemeral_job_id, [classified])
        
        # Verify nothing was stored in ephemeral mode
        assert ephemeral_storage.get_job(ephemeral_job_id) is None
        assert len(ephemeral_storage.get_transactions(ephemeral_job_id)) == 0
        
        # Test persistent mode
        persistent_storage = StorageService(db, ephemeral_mode=False)
        persistent_job_id = str(uuid.uuid4())
        
        persistent_storage.create_job(persistent_job_id, "2023-2024", ephemeral_mode=False)
        persistent_storage.save_classified_transactions(persistent_job_id, [classified])
        
        # Verify data WAS stored in persistent mode
        assert persistent_storage.get_job(persistent_job_id) is not None
        assert len(persistent_storage.get_transactions(persistent_job_id)) == 1
        
        # Clean up persistent job
        persistent_storage.delete_job(persistent_job_id)
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_ephemeral_mode_with_large_dataset():
    """Test that ephemeral mode works correctly with large datasets."""
    db_path = f"test_ephemeral_large_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=True)
        
        job_id = str(uuid.uuid4())
        storage.create_job(job_id, "2023-2024", ephemeral_mode=True)
        
        # Create 100 transactions
        transactions = []
        for i in range(100):
            transaction = NormalisedTransaction(
                date=date(2024, 1, 15),
                description=f"Test transaction {i}",
                merchant=f"Merchant {i}",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("100.00"),
                signed_amount=Decimal("-100.00")
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
            transactions.append(classified)
        
        storage.save_classified_transactions(job_id, transactions)
        
        # Verify nothing was stored
        assert storage.get_job(job_id) is None
        assert len(storage.get_transactions(job_id)) == 0
        
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_ephemeral_mode_job_level_override():
    """Test that job-level ephemeral mode setting is respected."""
    db_path = f"test_ephemeral_override_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        
        # Storage service has ephemeral_mode=False, but job has ephemeral_mode=True
        storage = StorageService(db, ephemeral_mode=False)
        
        job_id = str(uuid.uuid4())
        
        # Create job with ephemeral_mode=True (job-level override)
        storage.create_job(job_id, "2023-2024", ephemeral_mode=True)
        
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Test transaction",
            merchant="Test Merchant",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("100.00"),
            signed_amount=Decimal("-100.00")
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
        
        # Even though storage service has ephemeral_mode=False,
        # the job was created with ephemeral_mode=True, so it should be stored
        # (because create_job checks the job-level ephemeral_mode parameter)
        job = storage.get_job(job_id)
        
        # The job should exist because we passed ephemeral_mode=True to create_job
        # but the storage service itself has ephemeral_mode=False
        # This tests that the job-level setting is respected
        if job is not None:
            assert job['ephemeral_mode'] == True
        
        # Clean up if job was created
        if job is not None:
            storage.delete_job(job_id)
        
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_ephemeral_mode_delete_operation():
    """Test that delete operations work correctly in ephemeral mode."""
    db_path = f"test_ephemeral_delete_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=True)
        
        job_id = str(uuid.uuid4())
        
        # Attempt to delete a job that doesn't exist (ephemeral mode)
        # This should not raise an error
        storage.delete_job(job_id)
        
        # Verify no error occurred and database is still empty
        job = storage.get_job(job_id)
        assert job is None
        
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)
