"""
Integration tests for the storage layer.

These tests demonstrate the storage layer working end-to-end with
both ephemeral and persistent modes.
"""

import pytest
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


def test_storage_integration_persistent_mode():
    """Test complete storage workflow in persistent mode."""
    db_path = f"test_integration_persistent_{uuid.uuid4()}.db"
    
    try:
        # Initialize database and storage service
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=False)
        
        job_id = str(uuid.uuid4())
        
        # Create job
        storage.create_job(
            job_id=job_id,
            income_year="2023-2024",
            ephemeral_mode=False,
            confidence_threshold=0.60
        )
        
        # Create sample transactions
        transaction1 = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Adobe Creative Cloud",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("79.99"),
            signed_amount=Decimal("-79.99"),
            payment_rail="card",
            recurring_flag=True,
            raw_data={'original': 'PAYPAL *ADOBE 1234567'}
        )
        
        classified1 = ClassifiedTransaction(
            transaction=transaction1,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="merchant_match: Adobe",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[]
        )
        
        transaction2 = NormalisedTransaction(
            date=date(2024, 2, 10),
            description="Transfer to savings",
            merchant="Transfer",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("500.00"),
            signed_amount=Decimal("-500.00"),
            raw_data={'original': 'TRANSFER TO SAVINGS ACCOUNT'}
        )
        
        excluded1 = ExcludedTransaction(
            transaction=transaction2,
            reason=ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS,
            explanation="Transfer between own accounts"
        )
        
        # Save transactions
        storage.save_classified_transactions(job_id, [classified1])
        storage.save_excluded_transactions(job_id, [excluded1])
        
        # Update job status
        storage.update_job_status(
            job_id=job_id,
            status='completed',
            total_transactions=2,
            total_candidates=1,
            total_excluded=1
        )
        
        # Retrieve and verify job
        job = storage.get_job(job_id)
        assert job is not None
        assert job['status'] == 'completed'
        assert job['total_transactions'] == 2
        assert job['total_candidates'] == 1
        assert job['total_excluded'] == 1
        
        # Retrieve and verify transactions
        all_transactions = storage.get_transactions(job_id)
        assert len(all_transactions) == 2
        
        candidates = storage.get_candidates(job_id)
        assert len(candidates) == 1
        assert candidates[0]['merchant'] == 'Adobe'
        assert candidates[0]['category'] == 'work_software'
        assert 'raw_data' not in candidates[0]  # Raw data not stored
        
        excluded = storage.get_excluded(job_id)
        assert len(excluded) == 1
        assert excluded[0]['merchant'] == 'Transfer'
        assert excluded[0]['excluded'] == True
        assert 'raw_data' not in excluded[0]  # Raw data not stored
        
        # Verify no raw data stored
        assert storage.verify_no_raw_data_stored(job_id)
        
        # Clean up
        storage.delete_job(job_id)
        db.close()
        
        # Verify deletion (after closing connection)
        db2 = init_database(db_path)
        storage2 = StorageService(db2, ephemeral_mode=False)
        assert storage2.get_job(job_id) is None
        assert len(storage2.get_transactions(job_id)) == 0
        db2.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_storage_integration_ephemeral_mode():
    """Test complete storage workflow in ephemeral mode."""
    db_path = f"test_integration_ephemeral_{uuid.uuid4()}.db"
    
    try:
        # Initialize database and storage service in ephemeral mode
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=True)
        
        job_id = str(uuid.uuid4())
        
        # Create job (should not persist)
        storage.create_job(
            job_id=job_id,
            income_year="2023-2024",
            ephemeral_mode=True
        )
        
        # Create sample transaction
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Adobe Creative Cloud",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("79.99"),
            signed_amount=Decimal("-79.99"),
            raw_data={'sensitive': 'data'}
        )
        
        classified = ClassifiedTransaction(
            transaction=transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="merchant_match",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[]
        )
        
        # Save transaction (should not persist)
        storage.save_classified_transactions(job_id, [classified])
        
        # Update status (should not persist)
        storage.update_job_status(job_id, 'completed')
        
        # Verify nothing was persisted
        assert storage.get_job(job_id) is None
        assert len(storage.get_transactions(job_id)) == 0
        assert len(storage.get_candidates(job_id)) == 0
        
        # Verify database is empty
        jobs_count = db.fetchone("SELECT COUNT(*) as count FROM jobs")
        assert jobs_count['count'] == 0
        
        transactions_count = db.fetchone("SELECT COUNT(*) as count FROM transactions")
        assert transactions_count['count'] == 0
        
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)


def test_storage_integration_mixed_transactions():
    """Test storage with multiple classified and excluded transactions."""
    db_path = f"test_integration_mixed_{uuid.uuid4()}.db"
    
    try:
        db = init_database(db_path)
        storage = StorageService(db, ephemeral_mode=False)
        
        job_id = str(uuid.uuid4())
        storage.create_job(job_id, "2023-2024", ephemeral_mode=False)
        
        # Create multiple classified transactions
        classified_transactions = []
        for i in range(5):
            transaction = NormalisedTransaction(
                date=date(2024, 1, i + 1),
                description=f"Software subscription {i}",
                merchant=f"Vendor {i}",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal(f"{50 + i}.00"),
                signed_amount=Decimal(f"-{50 + i}.00")
            )
            
            classified = ClassifiedTransaction(
                transaction=transaction,
                category=DeductionCategory.WORK_SOFTWARE,
                confidence=0.8 + (i * 0.02),
                matched_rule_id=f"R00{i}",
                matched_rule_version="1.0",
                reason="keyword_match",
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[]
            )
            classified_transactions.append(classified)
        
        # Create multiple excluded transactions
        excluded_transactions = []
        for i in range(3):
            transaction = NormalisedTransaction(
                date=date(2024, 2, i + 1),
                description=f"Transfer {i}",
                merchant="Transfer",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal(f"{100 + i}.00"),
                signed_amount=Decimal(f"-{100 + i}.00")
            )
            
            excluded = ExcludedTransaction(
                transaction=transaction,
                reason=ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS,
                explanation="Internal transfer"
            )
            excluded_transactions.append(excluded)
        
        # Save all transactions
        storage.save_classified_transactions(job_id, classified_transactions)
        storage.save_excluded_transactions(job_id, excluded_transactions)
        
        # Update job status
        storage.update_job_status(
            job_id=job_id,
            status='completed',
            total_transactions=8,
            total_candidates=5,
            total_excluded=3
        )
        
        # Verify counts
        job = storage.get_job(job_id)
        assert job['total_transactions'] == 8
        assert job['total_candidates'] == 5
        assert job['total_excluded'] == 3
        
        # Verify all transactions stored
        all_transactions = storage.get_transactions(job_id)
        assert len(all_transactions) == 8
        
        candidates = storage.get_candidates(job_id)
        assert len(candidates) == 5
        
        excluded = storage.get_excluded(job_id)
        assert len(excluded) == 3
        
        # Clean up
        storage.delete_job(job_id)
        db.close()
        
    finally:
        if os.path.exists(db_path):
            drop_database(db_path)
