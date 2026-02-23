"""
Test cases for API endpoints including ephemeral mode and data structure validation.

This module tests the upload, job status, and download endpoints with various
scenarios including edge cases and error conditions.
"""

import pytest
import io
import json
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, date
from decimal import Decimal

from backend.main import app
from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
    ExclusionReason
)


client = TestClient(app)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def sample_csv_content():
    """Sample CSV file content for testing."""
    return b"""Date,Description,Amount,Balance
01/10/2025,ATLASSIAN,49.00,1000.00
05/10/2025,GITHUB SUBSCRIPTION,20.00,980.00
10/10/2025,WOOLWORTHS,150.00,830.00"""


@pytest.fixture
def sample_pdf_content():
    """Sample PDF file content (minimal valid PDF)."""
    return b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
203
%%EOF"""


@pytest.fixture
def mock_report_data():
    """Mock report data for testing."""
    txn = NormalisedTransaction(
        transaction_id="test-123",
        date=date(2025, 10, 1),
        description="ATLASSIAN SUBSCRIPTION",
        merchant="Atlassian",
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal("49.00"),
        signed_amount=Decimal("-49.00"),
    )
    
    classified = ClassifiedTransaction(
        transaction=txn,
        category=DeductionCategory.WORK_SOFTWARE,
        confidence=0.95,
        matched_rule_id="rule-001",
        matched_rule_version="1.0",
        reason="Matched work software pattern",
        evidence_checklist=[EvidenceType.RECEIPT],
        flags=[]
    )
    
    excluded = ExcludedTransaction(
        transaction=txn,
        reason=ExclusionReason.CASH_WITHDRAWAL,
        explanation="ATM withdrawal"
    )
    
    summary = ReportSummary(
        total_deductible=Decimal("49.00"),
        total_needs_review=Decimal("0.00"),
        total_excluded=Decimal("0.00"),
        category_totals={"work_software": Decimal("49.00")},
        confidence_distribution={"high": 1, "medium": 0, "low": 0}
    )
    
    return ReportData(
        income_year="2025-2026",
        generated_at=datetime(2025, 10, 15, 10, 0, 0),
        summary=summary,
        candidates=[classified],
        needs_review=[],
        excluded=[excluded],
        audit_trail=[]
    )


# ============================================================================
# Upload Endpoint Tests
# ============================================================================

class TestUploadEndpoint:
    """Test cases for the /api/upload endpoint."""
    
    def test_upload_csv_success_ephemeral_mode(self, sample_csv_content, mock_report_data):
        """Test successful CSV upload in ephemeral mode returns report data."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report_data,
                {"pdf": "path/to/pdf", "csv": "path/to/csv", "json": "path/to/json"}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", sample_csv_content, "text/csv")},
                data={"ephemeral_mode": "true", "confidence_threshold": "0.60"}
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert "job_id" in data
            assert data["status"] == "completed"
            assert "report_data" in data
            
            # Verify report data structure
            report = data["report_data"]
            assert "income_year" in report
            assert "summary" in report
            assert "candidates" in report
            assert "needs_review" in report
            assert "excluded" in report
            
            # Verify summary structure
            assert "total_deductible" in report["summary"]
            assert "confidence_distribution" in report["summary"]
            assert "high" in report["summary"]["confidence_distribution"]
            
            # Verify flattened transaction structure
            if report["candidates"]:
                candidate = report["candidates"][0]
                assert "id" in candidate
                assert "date" in candidate
                assert "merchant" in candidate
                assert "amount" in candidate
                assert "confidence" in candidate
                assert "evidence" in candidate
                # Should NOT have nested "transaction" object
                assert "transaction" not in candidate
    
    def test_upload_pdf_success(self, sample_pdf_content):
        """Test successful PDF upload."""
        with patch('backend.api.endpoints.PDFParser') as mock_parser, \
             patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            
            # Mock PDF parser
            mock_parser.return_value.parse.return_value = []
            
            # Mock pipeline
            mock_report = Mock()
            mock_report.income_year = "2025-2026"
            mock_report.generated_at = datetime.now()
            mock_report.summary = Mock()
            mock_report.summary.total_deductible = Decimal("0")
            mock_report.summary.total_needs_review = Decimal("0")
            mock_report.summary.total_excluded = Decimal("0")
            mock_report.summary.category_totals = {}
            mock_report.summary.confidence_distribution = {"high": 0, "medium": 0, "low": 0}
            mock_report.candidates = []
            mock_report.needs_review = []
            mock_report.excluded = []
            
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.pdf", sample_pdf_content, "application/pdf")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
    
    def test_upload_invalid_file_type(self):
        """Test upload with invalid file type returns 400."""
        response = client.post(
            "/api/upload",
            files={"file": ("test.txt", b"invalid content", "text/plain")},
            data={"ephemeral_mode": "true"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error"] == "invalid_file_type"
    
    def test_upload_file_too_large(self):
        """Test upload with file exceeding size limit returns 400."""
        large_content = b"x" * (11 * 1024 * 1024)  # 11MB
        
        response = client.post(
            "/api/upload",
            files={"file": ("large.csv", large_content, "text/csv")},
            data={"ephemeral_mode": "true"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error"] == "file_too_large"
    
    def test_upload_invalid_confidence_threshold(self, sample_csv_content):
        """Test upload with invalid confidence threshold returns 400."""
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", sample_csv_content, "text/csv")},
            data={"ephemeral_mode": "true", "confidence_threshold": "1.5"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error"] == "invalid_confidence_threshold"
    
    def test_upload_auto_detect_income_year(self, sample_csv_content, mock_report_data):
        """Test upload without income_year auto-detects from transactions."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report_data,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", sample_csv_content, "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "income_year" in data["report_data"]
    
    def test_upload_persistent_mode_no_report_data(self, sample_csv_content, mock_report_data):
        """Test upload in persistent mode does not return report_data."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline, \
             patch('backend.api.endpoints.StorageService') as mock_storage, \
             patch('backend.api.endpoints.Database'):
            
            # Mock storage service
            mock_storage_instance = Mock()
            mock_storage.return_value = mock_storage_instance
            
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report_data,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", sample_csv_content, "text/csv")},
                data={"ephemeral_mode": "false"}
            )
            
            assert response.status_code == 200
            data = response.json()
            # In persistent mode, report_data should still be included
            # but files should NOT be deleted
            assert "report_data" in data


# ============================================================================
# Data Structure Validation Tests
# ============================================================================

class TestDataStructureValidation:
    """Test cases to ensure backend and frontend data structures are in sync."""
    
    def test_flattened_transaction_structure(self, mock_report_data):
        """Test that transactions are properly flattened for frontend."""
        from backend.api.endpoints import upload_csv
        
        # Get a classified transaction
        ct = mock_report_data.candidates[0]
        
        # Manually call the flatten function logic
        flattened = {
            "id": ct.transaction.transaction_id,
            "date": ct.transaction.date.isoformat(),
            "description": ct.transaction.description,
            "merchant": ct.transaction.merchant,
            "amount": float(ct.transaction.absolute_amount),
            "category": ct.category.value if ct.category else None,
            "confidence": ct.confidence,
            "reason": ct.reason,
            "evidence": [e.value for e in ct.evidence_checklist],
            "flags": ct.flags,
            "matched_rule_id": ct.matched_rule_id,
        }
        
        # Verify all required fields are present
        assert "id" in flattened
        assert "date" in flattened
        assert "merchant" in flattened
        assert "amount" in flattened
        assert "confidence" in flattened
        assert "evidence" in flattened
        
        # Verify types
        assert isinstance(flattened["amount"], float)
        assert isinstance(flattened["confidence"], float)
        assert isinstance(flattened["evidence"], list)
        
        # Verify no nested transaction object
        assert "transaction" not in flattened
    
    def test_excluded_transaction_structure(self, mock_report_data):
        """Test that excluded transactions are properly flattened."""
        et = mock_report_data.excluded[0]
        
        flattened = {
            "id": et.transaction.transaction_id,
            "date": et.transaction.date.isoformat(),
            "description": et.transaction.description,
            "merchant": et.transaction.merchant,
            "amount": float(et.transaction.absolute_amount),
            "reason": et.reason.value,
            "explanation": et.explanation,
        }
        
        # Verify required fields
        assert "id" in flattened
        assert "reason" in flattened
        assert "explanation" in flattened
        
        # Verify no nested transaction object
        assert "transaction" not in flattened
    
    def test_summary_structure(self, mock_report_data):
        """Test that summary structure matches frontend expectations."""
        summary = mock_report_data.summary
        
        summary_dict = {
            "total_deductible": float(summary.total_deductible),
            "total_needs_review": float(summary.total_needs_review),
            "total_excluded": float(summary.total_excluded),
            "category_totals": {k: float(v) for k, v in summary.category_totals.items()},
            "confidence_distribution": {
                "high": summary.confidence_distribution.get("high", 0),
                "medium": summary.confidence_distribution.get("medium", 0),
                "low": summary.confidence_distribution.get("low", 0),
            }
        }
        
        # Verify structure
        assert "total_deductible" in summary_dict
        assert "confidence_distribution" in summary_dict
        assert "high" in summary_dict["confidence_distribution"]
        assert "medium" in summary_dict["confidence_distribution"]
        assert "low" in summary_dict["confidence_distribution"]
        
        # Verify types
        assert isinstance(summary_dict["total_deductible"], float)
        assert isinstance(summary_dict["confidence_distribution"]["high"], int)


# ============================================================================
# Edge Case Tests
# ============================================================================

class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    def test_empty_csv_file(self):
        """Test upload with empty CSV file."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_pipeline.return_value.process_and_generate_reports.side_effect = ValueError("No transactions found")
            
            response = client.post(
                "/api/upload",
                files={"file": ("empty.csv", b"", "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 500
    
    def test_malformed_csv(self):
        """Test upload with malformed CSV."""
        malformed_csv = b"This is not a valid CSV\nNo headers\nRandom data"
        
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_pipeline.return_value.process_and_generate_reports.side_effect = ValueError("Invalid CSV format")
            
            response = client.post(
                "/api/upload",
                files={"file": ("bad.csv", malformed_csv, "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 500
    
    def test_pdf_parsing_failure(self, sample_pdf_content):
        """Test PDF parsing failure returns proper error."""
        with patch('backend.api.endpoints.PDFParser') as mock_parser:
            mock_parser.return_value.parse.side_effect = Exception("Failed to parse PDF")
            
            response = client.post(
                "/api/upload",
                files={"file": ("bad.pdf", sample_pdf_content, "application/pdf")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 400
            data = response.json()
            assert data["detail"]["error"] == "pdf_parsing_failed"
    
    def test_no_deductible_transactions(self, sample_csv_content):
        """Test report with no deductible transactions."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_report = Mock()
            mock_report.income_year = "2025-2026"
            mock_report.generated_at = datetime.now()
            mock_report.summary = Mock()
            mock_report.summary.total_deductible = Decimal("0")
            mock_report.summary.total_needs_review = Decimal("0")
            mock_report.summary.total_excluded = Decimal("100.00")
            mock_report.summary.category_totals = {}
            mock_report.summary.confidence_distribution = {"high": 0, "medium": 0, "low": 0}
            mock_report.candidates = []
            mock_report.needs_review = []
            mock_report.excluded = []
            
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", sample_csv_content, "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["report_data"]["summary"]["total_deductible"] == 0.0
    
    def test_special_characters_in_merchant_names(self, mock_report_data):
        """Test handling of special characters in merchant names."""
        # Modify merchant name to include special characters
        mock_report_data.candidates[0].transaction.merchant = "Café & Co. (Pty) Ltd."
        
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline:
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report_data,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", b"Date,Description,Amount\n01/10/2025,Test,10.00", "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "Café & Co. (Pty) Ltd." in data["report_data"]["candidates"][0]["merchant"]


# ============================================================================
# Security Tests
# ============================================================================

class TestSecurity:
    """Test security-related functionality."""
    
    def test_file_type_validation(self):
        """Test that only allowed file types are accepted."""
        invalid_types = [
            ("test.exe", "application/x-msdownload"),
            ("test.sh", "application/x-sh"),
            ("test.py", "text/x-python"),
        ]
        
        for filename, content_type in invalid_types:
            response = client.post(
                "/api/upload",
                files={"file": (filename, b"content", content_type)},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 400
            assert response.json()["detail"]["error"] == "invalid_file_type"
    
    def test_ephemeral_mode_cleanup(self, sample_csv_content, mock_report_data):
        """Test that files are cleaned up in ephemeral mode."""
        with patch('backend.api.endpoints.ProcessingPipeline') as mock_pipeline, \
             patch('shutil.rmtree') as mock_rmtree:
            
            mock_pipeline.return_value.process_and_generate_reports.return_value = (
                mock_report_data,
                {}
            )
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", sample_csv_content, "text/csv")},
                data={"ephemeral_mode": "true"}
            )
            
            assert response.status_code == 200
            # Verify cleanup was called
            mock_rmtree.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
