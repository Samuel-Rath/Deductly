"""
Pydantic models for Tax Deduction Analyzer.

This module defines all data models used throughout the application,
including transaction models, classification models, and API models.
"""

from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List, Dict
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict
import uuid


# ============================================================================
# Enums
# ============================================================================

class TransactionDirection(str, Enum):
    """Direction of a transaction (debit or credit)."""
    DEBIT = "debit"
    CREDIT = "credit"


class DeductionCategory(str, Enum):
    """Categories for tax deduction classification."""
    WORK_SOFTWARE = "work_software"
    PROFESSIONAL_MEMBERSHIPS = "professional_memberships"
    TRAINING_EDUCATION = "training_education"
    WORK_EQUIPMENT = "work_equipment"
    PHONE_INTERNET = "phone_internet"
    WORKING_FROM_HOME = "working_from_home"
    TRAVEL = "travel"
    DONATIONS = "donations"
    BANK_FEES = "bank_fees"
    # Fitness-related — classified by RAG engine
    FITNESS_RELATED = "fitness_related"


class EvidenceType(str, Enum):
    """Types of evidence required for substantiation."""
    RECEIPT = "receipt"
    INVOICE = "invoice"
    DIARY = "diary"
    PERCENTAGE_RECORD = "percentage_record"
    LOGBOOK = "logbook"
    ELIGIBILITY_CHECK = "eligibility_check"


class ExclusionReason(str, Enum):
    """Reasons for excluding a transaction from deduction candidates."""
    TRANSFER_BETWEEN_ACCOUNTS = "transfer_between_accounts"
    CASH_WITHDRAWAL = "cash_withdrawal"
    LOAN_REPAYMENT = "loan_repayment"
    TAX_SETTLEMENT = "tax_settlement"
    SALARY_INCOME = "salary_income"


# ============================================================================
# Core Transaction Models
# ============================================================================

class NormalisedTransaction(BaseModel):
    """
    Standardised transaction after CSV parsing and normalisation.
    
    Validates: Requirements 1.3, 2.2, 2.3, 2.4, 2.5
    """
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: date
    description: str
    merchant: str
    direction: TransactionDirection
    absolute_amount: Decimal = Field(gt=0)  # Always positive
    signed_amount: Decimal  # Negative for debits, positive for credits
    payment_rail: Optional[str] = None
    recurring_flag: bool = False
    raw_data: Dict = Field(default_factory=dict)

    model_config = ConfigDict(
        json_encoders={
            Decimal: str,
            date: lambda v: v.isoformat()
        }
    )


class ClassifiedTransaction(BaseModel):
    """
    Transaction with classification, confidence score, and evidence requirements.
    
    Validates: Requirements 4.1, 4.3, 4.4, 4.5, 5.1-5.4
    """
    transaction: NormalisedTransaction
    category: Optional[DeductionCategory]
    confidence: float = Field(ge=0.0, le=1.0)  # Bounded between 0 and 1
    matched_rule_id: Optional[str]
    matched_rule_version: Optional[str]
    reason: str
    evidence_checklist: List[EvidenceType]
    flags: List[str] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True,  # Allow from ORM/dataclass
        arbitrary_types_allowed=True,  # Allow arbitrary types
        json_encoders={
            Decimal: str,
            date: lambda v: v.isoformat()
        }
    )


class ExcludedTransaction(BaseModel):
    """
    Transaction excluded from deduction candidates with reason.
    
    Validates: Requirements 3.1-3.6
    """
    transaction: NormalisedTransaction
    reason: ExclusionReason
    explanation: str

    model_config = ConfigDict(
        json_encoders={
            Decimal: str,
            date: lambda v: v.isoformat()
        }
    )


# ============================================================================
# Rules Engine Models
# ============================================================================

class Rule(BaseModel):
    """
    Classification rule with versioning and configuration.
    
    Validates: Requirements 10.1, 10.2, 10.3, 10.4
    """
    rule_id: str
    version: str
    category: DeductionCategory
    priority: int  # Higher = evaluated first
    confidence: float = Field(ge=0.0, le=1.0)
    keywords: List[str] = Field(default_factory=list)
    merchants: List[str] = Field(default_factory=list)
    evidence_checklist: List[EvidenceType]
    flags: List[str] = Field(default_factory=list)
    enabled: bool = True
    created_at: Optional[datetime] = None

    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat()
        }
    )


# ============================================================================
# Report Models
# ============================================================================

class ReportSummary(BaseModel):
    """
    Summary statistics for the deduction report.
    
    Validates: Requirements 8.2, 8.3
    """
    total_deductible: Decimal
    total_needs_review: Decimal
    total_excluded: Decimal
    category_totals: Dict[str, Decimal]  # Category name to total amount
    confidence_distribution: Dict[str, int]  # "high", "medium", "low" counts

    model_config = ConfigDict(
        json_encoders={
            Decimal: str
        }
    )


class AuditEntry(BaseModel):
    """
    Audit trail entry for a single transaction.
    
    Validates: Requirements 3.5, 4.5, 9.2, 10.5
    """
    transaction_id: str
    normalisation: Dict
    exclusion_checks: List[Dict]
    classification_attempts: List[Dict]
    final_result: Dict


class ReportData(BaseModel):
    """
    Complete report data including all transactions and audit trail.
    
    Validates: Requirements 8.1-8.8, 9.1-9.3
    """
    income_year: str  # Format: "2023-2024"
    generated_at: datetime
    summary: ReportSummary
    candidates: List[ClassifiedTransaction]
    needs_review: List[ClassifiedTransaction]
    excluded: List[ExcludedTransaction]
    audit_trail: List[AuditEntry]

    model_config = ConfigDict(
        json_encoders={
            Decimal: str,
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }
    )


# ============================================================================
# API Request/Response Models
# ============================================================================

class UploadRequest(BaseModel):
    """
    Request model for CSV upload.
    
    Validates: Requirements 11.1
    """
    income_year: str = Field(pattern=r"^\d{4}-\d{4}$")  # "2023-2024"
    ephemeral_mode: bool = True
    confidence_threshold: float = Field(default=0.60, ge=0.0, le=1.0)


class UploadResponse(BaseModel):
    """
    Response model for CSV upload.
    
    Validates: Requirements 11.2
    """
    job_id: str
    status: str  # "queued", "processing", "completed", "failed"
    message: str
    report_data: Optional[dict] = None  # Include report data directly in ephemeral mode


class JobStatusResponse(BaseModel):
    """
    Response model for job status query.
    
    Validates: Requirements 11.3, 11.4
    """
    job_id: str
    status: str  # "queued", "processing", "completed", "failed"
    progress: Optional[int] = None  # 0-100
    error: Optional[str] = None
    report_urls: Optional[Dict[str, str]] = None  # {"pdf": "/download/...", "csv": "...", "json": "..."}


class ErrorResponse(BaseModel):
    """
    Standard error response model.
    
    Validates: Requirements 11.5
    """
    error: str  # Error code
    message: str  # Human-readable message
    details: Dict = Field(default_factory=dict)
