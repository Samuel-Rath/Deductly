"""
Storage service for Tax Deduction Analyzer.

This service provides methods to save job metadata and derived transaction fields.
Supports ephemeral mode where no data is persisted.

Validates: Requirements 12.1, 12.2
"""

import json
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict
from .database import Database
from backend.models.schemas import (
    ClassifiedTransaction,
    ExcludedTransaction,
    NormalisedTransaction,
    DeductionCategory,
    EvidenceType,
    ExclusionReason
)


class StorageService:
    """
    Service for storing job and transaction data.
    
    Key features:
    - Ephemeral mode: skip all database writes when enabled
    - Derived fields only: never stores raw CSV data
    - Privacy-focused: only stores classification results
    
    Validates: Requirements 12.1, 12.2
    """
    
    def __init__(self, database: Database, ephemeral_mode: bool = True):
        """
        Initialize storage service.
        
        Args:
            database: Database instance
            ephemeral_mode: If True, skip all database writes
        """
        self.db = database
        self.ephemeral_mode = ephemeral_mode
    
    def create_job(
        self,
        job_id: str,
        income_year: str,
        ephemeral_mode: bool = True,
        confidence_threshold: float = 0.60
    ) -> None:
        """
        Create a new job record.
        
        Args:
            job_id: Unique job identifier
            income_year: Income year string (e.g., "2023-2024")
            ephemeral_mode: Whether this job is in ephemeral mode
            confidence_threshold: Confidence threshold for classification
            
        Validates: Requirements 12.2 (respects ephemeral mode)
        """
        if self.ephemeral_mode or ephemeral_mode:
            # Skip database write in ephemeral mode
            return
        
        query = """
            INSERT INTO jobs (job_id, status, income_year, ephemeral_mode, confidence_threshold)
            VALUES (?, ?, ?, ?, ?)
        """
        self.db.execute(query, (job_id, 'queued', income_year, ephemeral_mode, confidence_threshold))
        self.db.connect().commit()
    
    def update_job_status(
        self,
        job_id: str,
        status: str,
        error: Optional[str] = None,
        total_transactions: Optional[int] = None,
        total_candidates: Optional[int] = None,
        total_needs_review: Optional[int] = None,
        total_excluded: Optional[int] = None
    ) -> None:
        """
        Update job status and statistics.
        
        Args:
            job_id: Job identifier
            status: New status ('queued', 'processing', 'completed', 'failed')
            error: Error message if status is 'failed'
            total_transactions: Total number of transactions processed
            total_candidates: Number of deduction candidates
            total_needs_review: Number of items needing review
            total_excluded: Number of excluded transactions
            
        Validates: Requirements 12.2 (respects ephemeral mode)
        """
        if self.ephemeral_mode:
            # Skip database write in ephemeral mode
            return
        
        # Build dynamic update query based on provided fields
        updates = ["status = ?"]
        params = [status]
        
        if error is not None:
            updates.append("error = ?")
            params.append(error)
        
        if total_transactions is not None:
            updates.append("total_transactions = ?")
            params.append(total_transactions)
        
        if total_candidates is not None:
            updates.append("total_candidates = ?")
            params.append(total_candidates)
        
        if total_needs_review is not None:
            updates.append("total_needs_review = ?")
            params.append(total_needs_review)
        
        if total_excluded is not None:
            updates.append("total_excluded = ?")
            params.append(total_excluded)
        
        params.append(job_id)
        
        query = f"UPDATE jobs SET {', '.join(updates)} WHERE job_id = ?"
        self.db.execute(query, tuple(params))
        self.db.connect().commit()
    
    def save_classified_transactions(
        self,
        job_id: str,
        transactions: List[ClassifiedTransaction]
    ) -> None:
        """
        Save classified transactions (derived fields only).
        
        IMPORTANT: This method NEVER stores raw CSV data, only derived fields
        like merchant, category, confidence, and flags.
        
        Args:
            job_id: Job identifier
            transactions: List of classified transactions
            
        Validates: Requirements 12.1 (derived fields only), 12.2 (ephemeral mode)
        """
        if self.ephemeral_mode:
            # Skip database write in ephemeral mode
            return
        
        if not transactions:
            return
        
        query = """
            INSERT INTO transactions (
                transaction_id, job_id, date, merchant, description,
                amount, direction, payment_rail, recurring_flag,
                category, confidence, matched_rule_id, matched_rule_version,
                reason, evidence_checklist, flags, excluded
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params_list = []
        for ct in transactions:
            t = ct.transaction
            params_list.append((
                t.transaction_id,
                job_id,
                t.date.isoformat(),
                t.merchant,  # Derived field
                t.description,  # Derived field (cleaned)
                str(t.absolute_amount),
                t.direction.value,
                t.payment_rail,  # Derived field
                t.recurring_flag,  # Derived field
                ct.category.value if ct.category else None,  # Derived field
                ct.confidence,  # Derived field
                ct.matched_rule_id,  # Derived field
                ct.matched_rule_version,  # Derived field
                ct.reason,  # Derived field
                json.dumps([e.value for e in ct.evidence_checklist]),  # Derived field
                json.dumps(ct.flags),  # Derived field
                False  # Not excluded
            ))
        
        self.db.executemany(query, params_list)
        self.db.connect().commit()
    
    def save_excluded_transactions(
        self,
        job_id: str,
        transactions: List[ExcludedTransaction]
    ) -> None:
        """
        Save excluded transactions (derived fields only).
        
        Args:
            job_id: Job identifier
            transactions: List of excluded transactions
            
        Validates: Requirements 12.1 (derived fields only), 12.2 (ephemeral mode)
        """
        if self.ephemeral_mode:
            # Skip database write in ephemeral mode
            return
        
        if not transactions:
            return
        
        query = """
            INSERT INTO transactions (
                transaction_id, job_id, date, merchant, description,
                amount, direction, payment_rail, recurring_flag,
                excluded, exclusion_reason, exclusion_explanation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params_list = []
        for et in transactions:
            t = et.transaction
            params_list.append((
                t.transaction_id,
                job_id,
                t.date.isoformat(),
                t.merchant,  # Derived field
                t.description,  # Derived field (cleaned)
                str(t.absolute_amount),
                t.direction.value,
                t.payment_rail,  # Derived field
                t.recurring_flag,  # Derived field
                True,  # Excluded
                et.reason.value,  # Derived field
                et.explanation  # Derived field
            ))
        
        self.db.executemany(query, params_list)
        self.db.connect().commit()
    
    def get_job(self, job_id: str) -> Optional[Dict]:
        """
        Retrieve job metadata.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Job data as dictionary or None if not found
        """
        if self.ephemeral_mode:
            # No data to retrieve in ephemeral mode
            return None
        
        query = "SELECT * FROM jobs WHERE job_id = ?"
        row = self.db.fetchone(query, (job_id,))
        
        if row:
            return dict(row)
        return None
    
    def get_transactions(self, job_id: str) -> List[Dict]:
        """
        Retrieve all transactions for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            List of transaction dictionaries
        """
        if self.ephemeral_mode:
            # No data to retrieve in ephemeral mode
            return []
        
        query = "SELECT * FROM transactions WHERE job_id = ? ORDER BY date"
        rows = self.db.fetchall(query, (job_id,))
        
        return [dict(row) for row in rows]
    
    def get_candidates(self, job_id: str) -> List[Dict]:
        """
        Retrieve deduction candidates for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            List of candidate transaction dictionaries
        """
        if self.ephemeral_mode:
            # No data to retrieve in ephemeral mode
            return []
        
        query = """
            SELECT * FROM transactions 
            WHERE job_id = ? AND excluded = FALSE 
            ORDER BY date
        """
        rows = self.db.fetchall(query, (job_id,))
        
        return [dict(row) for row in rows]
    
    def get_excluded(self, job_id: str) -> List[Dict]:
        """
        Retrieve excluded transactions for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            List of excluded transaction dictionaries
        """
        if self.ephemeral_mode:
            # No data to retrieve in ephemeral mode
            return []
        
        query = """
            SELECT * FROM transactions 
            WHERE job_id = ? AND excluded = TRUE 
            ORDER BY date
        """
        rows = self.db.fetchall(query, (job_id,))
        
        return [dict(row) for row in rows]
    
    def delete_job(self, job_id: str) -> None:
        """
        Delete a job and all associated transactions.
        
        Args:
            job_id: Job identifier
        """
        if self.ephemeral_mode:
            # Nothing to delete in ephemeral mode
            return
        
        # Delete transactions first (CASCADE may not work in all SQLite versions)
        self.db.execute("DELETE FROM transactions WHERE job_id = ?", (job_id,))
        
        # Then delete the job
        self.db.execute("DELETE FROM jobs WHERE job_id = ?", (job_id,))
        self.db.connect().commit()
    
    def verify_no_raw_data_stored(self, job_id: str) -> bool:
        """
        Verify that no raw CSV data is stored in the database.
        
        This method checks that the transactions table only contains
        derived fields and not the raw_data field from NormalisedTransaction.
        
        Args:
            job_id: Job identifier
            
        Returns:
            True if no raw data is stored, False otherwise
            
        Validates: Requirements 12.1
        """
        if self.ephemeral_mode:
            # No data stored in ephemeral mode
            return True
        
        # Check that raw_data column doesn't exist in schema
        query = "PRAGMA table_info(transactions)"
        columns = self.db.fetchall(query)
        column_names = [col['name'] for col in columns]
        
        # Verify raw_data column is not present
        return 'raw_data' not in column_names
