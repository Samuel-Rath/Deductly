"""
Models package for Tax Deduction Analyzer.

Exports all Pydantic models for use throughout the application.
"""

from .schemas import (
    # Enums
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
    ExclusionReason,
    
    # Core Transaction Models
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    
    # Rules Engine Models
    Rule,
    
    # Report Models
    ReportSummary,
    AuditEntry,
    ReportData,
    
    # API Models
    UploadRequest,
    UploadResponse,
    JobStatusResponse,
    ErrorResponse,
)

__all__ = [
    # Enums
    "TransactionDirection",
    "DeductionCategory",
    "EvidenceType",
    "ExclusionReason",
    
    # Core Transaction Models
    "NormalisedTransaction",
    "ClassifiedTransaction",
    "ExcludedTransaction",
    
    # Rules Engine Models
    "Rule",
    
    # Report Models
    "ReportSummary",
    "AuditEntry",
    "ReportData",
    
    # API Models
    "UploadRequest",
    "UploadResponse",
    "JobStatusResponse",
    "ErrorResponse",
]
