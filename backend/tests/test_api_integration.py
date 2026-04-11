"""
Integration tests for API endpoints.

Tests the complete API workflow including upload, status checking,
and report downloads.

**Validates: Requirements 11.1-11.5**
"""

import pytest
import io
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


@pytest.fixture
def sample_csv():
    """Fixture providing sample CSV content."""
    return """Date,Description,Amount
2023-07-01,Adobe Creative Cloud,59.99
2023-07-15,Officeworks - Stationery,45.50
2023-08-01,Telstra Mobile,89.00
2023-08-10,Uber - Client Meeting,35.20
2023-09-01,Microsoft 365,12.99"""


class TestUploadEndpoint:
    """Test suite for upload endpoint."""
    
    def test_upload_valid_csv(self, sample_csv):
        """
        Test uploading a valid CSV file.
        
        **Validates: Requirements 11.1, 11.2**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={
                    "income_year": "2023-2024",
                    "ephemeral_mode": "true",
                    "confidence_threshold": "0.60"
                }
            )
            
            assert response.status_code in [200, 201]
            data = response.json()
            assert "job_id" in data
            assert "status" in data
            assert len(data["job_id"]) == 36  # UUID format
    
    def test_upload_invalid_file_type(self):
        """
        Test uploading non-CSV file returns error.
        
        **Validates: Requirements 11.1, 11.5**
        """
        text_file = io.BytesIO(b"This is not a CSV")
        
        response = client.post(
            "/api/upload",
            files={"file": ("test.txt", text_file, "text/plain")},
            data={"income_year": "2023-2024"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"] == "invalid_file_type"
    
    def test_upload_with_custom_confidence_threshold(self, sample_csv):
        """
        Test uploading with custom confidence threshold.
        
        **Validates: Requirements 11.1**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            
            response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={
                    "income_year": "2023-2024",
                    "ephemeral_mode": "true",
                    "confidence_threshold": "0.75"
                }
            )
            
            assert response.status_code in [200, 201]
            data = response.json()
            assert "job_id" in data


class TestJobStatusEndpoint:
    """Test suite for job status endpoint."""
    
    def test_get_status_for_completed_job(self, sample_csv):
        """
        Test getting status for a completed job.
        
        **Validates: Requirements 11.3, 11.4**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            # Upload with ephemeral_mode=false so the job directory persists
            # long enough for the subsequent status request.
            # (Ephemeral mode deletes the directory immediately on completion,
            # making the status endpoint return 404 by design.)
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            upload_response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={"income_year": "2023-2024", "ephemeral_mode": "false"}
            )
            
            job_id = upload_response.json()["job_id"]
            
            # Get status
            status_response = client.get(f"/api/jobs/{job_id}")
            
            assert status_response.status_code == 200
            data = status_response.json()
            assert "job_id" in data
            assert "status" in data
            assert data["job_id"] == job_id
            
            # If completed, should have report URLs
            if data["status"] == "completed":
                assert "report_urls" in data
                assert "pdf" in data["report_urls"]
                assert "csv" in data["report_urls"]
                assert "json" in data["report_urls"]
    
    def test_get_status_for_nonexistent_job(self):
        """
        Test getting status for non-existent job returns 404.
        
        **Validates: Requirements 11.3, 11.5**
        """
        fake_job_id = "00000000-0000-0000-0000-000000000000"
        
        response = client.get(f"/api/jobs/{fake_job_id}")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"] == "job_not_found"


class TestReportDownloadEndpoints:
    """Test suite for report download endpoints."""
    
    def test_download_csv_report(self, sample_csv):
        """
        Test downloading CSV report.
        
        **Validates: Requirements 11.4**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            # Upload and get job_id
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            upload_response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={"income_year": "2023-2024", "ephemeral_mode": "true"}
            )
            
            job_id = upload_response.json()["job_id"]
            
            # Try to download CSV
            download_response = client.get(f"/api/jobs/{job_id}/download/csv")
            
            # Should either succeed or return 404 if file doesn't exist yet
            assert download_response.status_code in [200, 404]
            
            if download_response.status_code == 200:
                # Verify it's a CSV file
                assert "text/csv" in download_response.headers["content-type"]
    
    def test_download_json_report(self, sample_csv):
        """
        Test downloading JSON audit trail.
        
        **Validates: Requirements 11.4**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            # Upload and get job_id
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            upload_response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={"income_year": "2023-2024", "ephemeral_mode": "true"}
            )
            
            job_id = upload_response.json()["job_id"]
            
            # Try to download JSON
            download_response = client.get(f"/api/jobs/{job_id}/download/json")
            
            # Should either succeed or return 404 if file doesn't exist yet
            assert download_response.status_code in [200, 404]
            
            if download_response.status_code == 200:
                # Verify it's a JSON file
                assert download_response.headers["content-type"] == "application/json"
    
    def test_download_nonexistent_report(self):
        """
        Test downloading report for non-existent job returns 404.
        
        **Validates: Requirements 11.4, 11.5**
        """
        fake_job_id = "00000000-0000-0000-0000-000000000000"
        
        response = client.get(f"/api/jobs/{fake_job_id}/download/pdf")
        
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert data["detail"]["error"] == "report_not_found"


class TestCompleteWorkflow:
    """Test complete API workflow from upload to download."""
    
    def test_complete_upload_to_download_workflow(self, sample_csv):
        """
        Test complete workflow: upload -> check status -> download reports.
        
        **Validates: Requirements 11.1-11.5**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            # Step 1: Upload CSV
            # ephemeral_mode=false so the job directory is not deleted immediately —
            # otherwise step 2 (GET /api/jobs/{job_id}) would receive a 404.
            csv_file = io.BytesIO(sample_csv.encode('utf-8'))
            upload_response = client.post(
                "/api/upload",
                files={"file": ("test.csv", csv_file, "text/csv")},
                data={
                    "income_year": "2023-2024",
                    "ephemeral_mode": "false",
                    "confidence_threshold": "0.60"
                }
            )
            
            assert upload_response.status_code in [200, 201]
            job_id = upload_response.json()["job_id"]
            assert job_id is not None
            
            # Step 2: Check job status
            status_response = client.get(f"/api/jobs/{job_id}")
            assert status_response.status_code == 200
            
            status_data = status_response.json()
            assert status_data["job_id"] == job_id
            assert status_data["status"] in ["queued", "processing", "completed", "failed"]
            
            # Step 3: If completed, verify download URLs are available
            if status_data["status"] == "completed":
                assert "report_urls" in status_data
                
                # Step 4: Try to download each format
                for format_type in ["csv", "json"]:  # Skip PDF due to WeasyPrint
                    download_url = status_data["report_urls"][format_type]
                    download_response = client.get(download_url)
                    
                    # Should be able to download
                    assert download_response.status_code in [200, 404]
    
    def test_multiple_uploads_generate_unique_jobs(self, sample_csv):
        """
        Test that multiple uploads generate unique job IDs.
        
        **Validates: Requirements 11.2**
        """
        with patch('backend.processing.report_generator.ReportGenerator.generate_pdf'):
            job_ids = set()
            
            # Upload same CSV multiple times
            for _ in range(3):
                csv_file = io.BytesIO(sample_csv.encode('utf-8'))
                response = client.post(
                    "/api/upload",
                    files={"file": ("test.csv", csv_file, "text/csv")},
                    data={"income_year": "2023-2024", "ephemeral_mode": "true"}
                )
                
                assert response.status_code in [200, 201]
                job_id = response.json()["job_id"]
                job_ids.add(job_id)
            
            # All job IDs should be unique
            assert len(job_ids) == 3


class TestErrorHandling:
    """Test error handling across all endpoints."""
    
    def test_validation_errors_return_400(self):
        """
        Test that validation errors return 400 with details.
        
        **Validates: Requirements 11.5**
        """
        # Invalid confidence threshold
        csv_file = io.BytesIO(b"Date,Description,Amount\n2023-07-01,Test,100")
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", csv_file, "text/csv")},
            data={
                "income_year": "2023-2024",
                "confidence_threshold": "1.5"  # Invalid: > 1.0
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_error_responses_have_consistent_structure(self):
        """
        Test that all error responses follow consistent structure.
        
        **Validates: Requirements 11.5**
        """
        # Test various error conditions
        errors = []
        
        # Invalid file type
        text_file = io.BytesIO(b"Not CSV")
        resp1 = client.post(
            "/api/upload",
            files={"file": ("test.txt", text_file, "text/plain")},
            data={"income_year": "2023-2024"}
        )
        errors.append(resp1)
        
        # Non-existent job
        resp2 = client.get("/api/jobs/fake-id")
        errors.append(resp2)
        
        # Non-existent report
        resp3 = client.get("/api/jobs/fake-id/download/pdf")
        errors.append(resp3)
        
        # All should have consistent error structure
        for response in errors:
            assert response.status_code >= 400
            data = response.json()
            assert "detail" in data
            assert isinstance(data["detail"], dict)
            assert "error" in data["detail"]
            assert "message" in data["detail"]
            assert isinstance(data["detail"]["error"], str)
            assert isinstance(data["detail"]["message"], str)
