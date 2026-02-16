"""
Unit tests for Pydantic models.

Tests validation, serialization, and model constraints.
"""

import pytest
from decimal import Decimal
from datetime import date, datetime
from models import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    Rule,
    ReportSummary,
    AuditEntry,
    ReportData,
    UploadRequest,
    UploadResponse,
    JobStatusResponse,
    ErrorResponse,
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
    ExclusionReason,
)


class TestNormalisedTransaction:
    """Test NormalisedTransaction model validation."""
    
    def test_valid_transaction(self):
        """Test creating a valid normalised transaction."""
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="PAYPAL *ADOBE",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("29.99"),
            signed_amount=Decimal("-29.99"),
        )
        
        assert transaction.date == date(2024, 1, 15)
        assert transaction.merchant == "Adobe"
        assert transaction.absolute_amount == Decimal("29.99")
        assert transaction.signed_amount == Decimal("-29.99")
        assert transaction.direction == TransactionDirection.DEBIT
        assert transaction.recurring_flag is False
        assert transaction.payment_rail is None
    
    def test_absolute_amount_must_be_positive(self):
        """Test that absolute_amount must be positive."""
        with pytest.raises(ValueError):
            NormalisedTransaction(
                date=date(2024, 1, 15),
                description="Test",
                merchant="Test Merchant",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("-29.99"),  # Invalid: negative
                signed_amount=Decimal("-29.99"),
            )
    
    def test_transaction_with_payment_rail(self):
        """Test transaction with payment rail information."""
        transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="PAYPAL *ADOBE",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("29.99"),
            signed_amount=Decimal("-29.99"),
            payment_rail="paypal",
        )
        
        assert transaction.payment_rail == "paypal"


class TestClassifiedTransaction:
    """Test ClassifiedTransaction model validation."""
    
    def test_valid_classified_transaction(self):
        """Test creating a valid classified transaction."""
        base_transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="PAYPAL *ADOBE",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("29.99"),
            signed_amount=Decimal("-29.99"),
        )
        
        classified = ClassifiedTransaction(
            transaction=base_transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match: adobe",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )
        
        assert classified.category == DeductionCategory.WORK_SOFTWARE
        assert classified.confidence == 0.95
        assert classified.matched_rule_id == "R001"
        assert EvidenceType.RECEIPT in classified.evidence_checklist
    
    def test_confidence_bounds(self):
        """Test that confidence must be between 0 and 1."""
        base_transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="Test",
            merchant="Test",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("10.00"),
            signed_amount=Decimal("-10.00"),
        )
        
        # Test confidence > 1.0
        with pytest.raises(ValueError):
            ClassifiedTransaction(
                transaction=base_transaction,
                category=DeductionCategory.WORK_SOFTWARE,
                confidence=1.5,  # Invalid: > 1.0
                matched_rule_id="R001",
                matched_rule_version="1.0",
                reason="test",
                evidence_checklist=[EvidenceType.RECEIPT],
            )
        
        # Test confidence < 0.0
        with pytest.raises(ValueError):
            ClassifiedTransaction(
                transaction=base_transaction,
                category=DeductionCategory.WORK_SOFTWARE,
                confidence=-0.1,  # Invalid: < 0.0
                matched_rule_id="R001",
                matched_rule_version="1.0",
                reason="test",
                evidence_checklist=[EvidenceType.RECEIPT],
            )


class TestExcludedTransaction:
    """Test ExcludedTransaction model."""
    
    def test_valid_excluded_transaction(self):
        """Test creating a valid excluded transaction."""
        base_transaction = NormalisedTransaction(
            date=date(2024, 1, 15),
            description="TRANSFER TO SAVINGS",
            merchant="Transfer",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("500.00"),
            signed_amount=Decimal("-500.00"),
        )
        
        excluded = ExcludedTransaction(
            transaction=base_transaction,
            reason=ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS,
            explanation="Transfer between own accounts",
        )
        
        assert excluded.reason == ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS
        assert "Transfer" in excluded.explanation


class TestRule:
    """Test Rule model validation."""
    
    def test_valid_rule(self):
        """Test creating a valid rule."""
        rule = Rule(
            rule_id="R001",
            version="1.0",
            category=DeductionCategory.WORK_SOFTWARE,
            priority=100,
            confidence=0.95,
            keywords=["adobe", "photoshop"],
            merchants=["Adobe"],
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
            enabled=True,
        )
        
        assert rule.rule_id == "R001"
        assert rule.category == DeductionCategory.WORK_SOFTWARE
        assert rule.confidence == 0.95
        assert "adobe" in rule.keywords
    
    def test_rule_confidence_bounds(self):
        """Test that rule confidence must be between 0 and 1."""
        with pytest.raises(ValueError):
            Rule(
                rule_id="R001",
                version="1.0",
                category=DeductionCategory.WORK_SOFTWARE,
                priority=100,
                confidence=1.5,  # Invalid: > 1.0
                keywords=["test"],
                merchants=[],
                evidence_checklist=[EvidenceType.RECEIPT],
            )


class TestReportModels:
    """Test report-related models."""
    
    def test_report_summary(self):
        """Test ReportSummary model."""
        summary = ReportSummary(
            total_deductible=Decimal("1500.00"),
            total_needs_review=Decimal("300.00"),
            total_excluded=Decimal("5000.00"),
            category_totals={"work_software": Decimal("500.00")},
            confidence_distribution={"high": 10, "medium": 5, "low": 2},
        )
        
        assert summary.total_deductible == Decimal("1500.00")
        assert summary.confidence_distribution["high"] == 10
    
    def test_audit_entry(self):
        """Test AuditEntry model."""
        entry = AuditEntry(
            transaction_id="test-id",
            normalisation={"merchant": "Adobe"},
            exclusion_checks=[{"rule": "transfer_check", "matched": False}],
            classification_attempts=[{"rule_id": "R001", "confidence": 0.95}],
            final_result={"category": "work_software", "confidence": 0.95},
        )
        
        assert entry.transaction_id == "test-id"
        assert entry.normalisation["merchant"] == "Adobe"


class TestAPIModels:
    """Test API request/response models."""
    
    def test_upload_request(self):
        """Test UploadRequest validation."""
        request = UploadRequest(
            income_year="2023-2024",
            ephemeral_mode=True,
            confidence_threshold=0.60,
        )
        
        assert request.income_year == "2023-2024"
        assert request.ephemeral_mode is True
        assert request.confidence_threshold == 0.60
    
    def test_upload_request_invalid_year_format(self):
        """Test that income_year must match pattern."""
        with pytest.raises(ValueError):
            UploadRequest(
                income_year="2023",  # Invalid: doesn't match YYYY-YYYY pattern
                ephemeral_mode=True,
            )
    
    def test_upload_response(self):
        """Test UploadResponse model."""
        response = UploadResponse(
            job_id="test-job-123",
            status="queued",
            message="Job queued for processing",
        )
        
        assert response.job_id == "test-job-123"
        assert response.status == "queued"
    
    def test_job_status_response(self):
        """Test JobStatusResponse model."""
        response = JobStatusResponse(
            job_id="test-job-123",
            status="completed",
            progress=100,
            report_urls={
                "pdf": "/api/jobs/test-job-123/download/pdf",
                "csv": "/api/jobs/test-job-123/download/csv",
                "json": "/api/jobs/test-job-123/download/json",
            },
        )
        
        assert response.status == "completed"
        assert response.progress == 100
        assert "pdf" in response.report_urls
    
    def test_error_response(self):
        """Test ErrorResponse model."""
        error = ErrorResponse(
            error="invalid_file",
            message="File format not supported",
            details={"supported_formats": ["csv"]},
        )
        
        assert error.error == "invalid_file"
        assert "csv" in error.details["supported_formats"]
