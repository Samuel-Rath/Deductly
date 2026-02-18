"""
Database schema and initialization for Tax Deduction Analyzer.

This module defines the database schema using raw SQL for SQLite.
Only derived fields are stored, never raw CSV data.

Validates: Requirements 12.1
"""

import sqlite3
from pathlib import Path
from typing import Optional
from contextlib import contextmanager


class Database:
    """
    Database connection manager for SQLite.
    
    Provides connection pooling and context managers for safe database access.
    """
    
    def __init__(self, db_path: str = "tax_deduction_analyzer.db"):
        """
        Initialize database connection.
        
        Args:
            db_path: Path to SQLite database file
        """
        self.db_path = db_path
        self._connection: Optional[sqlite3.Connection] = None
    
    def connect(self) -> sqlite3.Connection:
        """
        Get or create database connection.
        
        Returns:
            SQLite connection object
        """
        if self._connection is None:
            self._connection = sqlite3.connect(self.db_path)
            self._connection.row_factory = sqlite3.Row  # Enable dict-like access
        return self._connection
    
    def close(self):
        """Close database connection if open."""
        if self._connection:
            self._connection.close()
            self._connection = None
    
    @contextmanager
    def transaction(self):
        """
        Context manager for database transactions.
        
        Automatically commits on success or rolls back on error.
        
        Yields:
            SQLite connection object
        """
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    
    def execute(self, query: str, params: tuple = ()):
        """
        Execute a single query.
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            Cursor object
        """
        conn = self.connect()
        return conn.execute(query, params)
    
    def executemany(self, query: str, params_list: list):
        """
        Execute a query multiple times with different parameters.
        
        Args:
            query: SQL query string
            params_list: List of parameter tuples
            
        Returns:
            Cursor object
        """
        conn = self.connect()
        return conn.executemany(query, params_list)
    
    def fetchone(self, query: str, params: tuple = ()):
        """
        Execute query and fetch one result.
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            Single row or None
        """
        cursor = self.execute(query, params)
        return cursor.fetchone()
    
    def fetchall(self, query: str, params: tuple = ()):
        """
        Execute query and fetch all results.
        
        Args:
            query: SQL query string
            params: Query parameters
            
        Returns:
            List of rows
        """
        cursor = self.execute(query, params)
        return cursor.fetchall()


# Database schema SQL
SCHEMA_SQL = """
-- Jobs table: stores job metadata
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('queued', 'processing', 'completed', 'failed')),
    income_year TEXT NOT NULL,
    ephemeral_mode BOOLEAN DEFAULT TRUE,
    confidence_threshold REAL DEFAULT 0.60,
    error TEXT,
    total_transactions INTEGER DEFAULT 0,
    total_candidates INTEGER DEFAULT 0,
    total_needs_review INTEGER DEFAULT 0,
    total_excluded INTEGER DEFAULT 0
);

-- Transactions table: stores ONLY derived fields, never raw CSV data
-- This ensures privacy and compliance with Requirements 12.1
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    date DATE NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('debit', 'credit')),
    payment_rail TEXT,
    recurring_flag BOOLEAN DEFAULT FALSE,
    category TEXT,
    confidence REAL,
    matched_rule_id TEXT,
    matched_rule_version TEXT,
    reason TEXT,
    evidence_checklist TEXT,  -- JSON array stored as text
    flags TEXT,  -- JSON array stored as text
    excluded BOOLEAN DEFAULT FALSE,
    exclusion_reason TEXT,
    exclusion_explanation TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_excluded ON transactions(excluded);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
"""


def init_database(db_path: str = "tax_deduction_analyzer.db") -> Database:
    """
    Initialize database with schema.
    
    Creates tables and indexes if they don't exist.
    
    Args:
        db_path: Path to SQLite database file
        
    Returns:
        Database instance
        
    Validates: Requirements 12.1
    """
    db = Database(db_path)
    
    # Execute schema creation
    conn = db.connect()
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    
    return db


def drop_database(db_path: str = "tax_deduction_analyzer.db"):
    """
    Drop database file (for testing purposes).
    
    Args:
        db_path: Path to SQLite database file
    """
    path = Path(db_path)
    if path.exists():
        path.unlink()
