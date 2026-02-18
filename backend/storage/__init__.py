"""
Storage layer for Tax Deduction Analyzer.

This module provides database storage functionality with support for
ephemeral mode and derived-fields-only storage.
"""

from .database import Database, init_database
from .storage_service import StorageService

__all__ = ['Database', 'init_database', 'StorageService']
