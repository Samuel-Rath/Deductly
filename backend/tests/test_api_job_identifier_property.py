"""
Property-based test for API job identifier response.

Feature: tax-deduction-analyzer
Property 18: API Job Identifier Response

**Validates: Requirements 11.2**

For any successful CSV upload via the POST endpoint, the response should contain
a unique job_id string.

NOTE: This test is simplified to avoid WeasyPrint dependency issues on Windows.
Full integration tests with PDF generation should be run in a properly configured environment.
"""

import pytest
import io
from datetime import date
from hypothesis import given, strategies as st, settings
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.main import app


client = TestClient(app)


# Strategy for generating valid CSV content
@st.composite
def csv_content_strategy(draw):
    """Generate valid CSV content with varying number of rows."""
    num_rows = draw(st.integers(min_value=1, max_value=5))  # Reduced for faster tests
    
    # CSV header
    csv_lines = ["Date,Description,Amount"]
    
    # Generate rows
    for _ in range(num_rows):
        date_val = draw(st.dates(min_value=date(2023, 7, 1), 
                                 max_value=date(2024, 6, 30)))
        # Simple alphanumeric description
        description = draw(st.text(min_size=5, max_size=30, 
                                   alphabet=st.characters(min_codepoint=65, max_codepoint=122)))
        amount = draw(st.decimals(min_value=1, max_value=1000, places=2))
        
        csv_lines.append(f"{date_val.isoformat()},{description},{amount}")
    
    return "\n".join(csv_lines)


@given(csv_content=csv_content_strategy())
@settings(max_examples=10)  # Reduced for faster execution
@pytest.mark.property_test
def test_api_job_identifier_response(csv_content):
    """
    Property 18: API Job Identifier Response
    
    For any successful CSV upload, the response should contain a unique job_id.
    
    **Validates: Requirements 11.2**
    """
    # Mock PDF generation to avoid WeasyPrint dependency
    with patch('backend.processing.report_generator.ReportGenerator.generate_pdf') as mock_pdf:
        mock_pdf.return_value = None  # PDF generation succeeds without actually generating
        
        # Create file-like object from CSV content
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        
        # Upload CSV
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", csv_file, "text/csv")},
            data={
                "income_year": "2023-2024",
                "ephemeral_mode": "true",
                "confidence_threshold": "0.60"
            }
        )
        
        # Property: Response should be successful (200 or 201)
        assert response.status_code in [200, 201], \
            f"Expected successful response, got {response.status_code}: {response.text}"
        
        # Property: Response should contain job_id
        response_data = response.json()
        assert "job_id" in response_data, \
            "Response must contain 'job_id' field"
        
        # Property: job_id should be a non-empty string
        job_id = response_data["job_id"]
        assert isinstance(job_id, str), \
            f"job_id must be a string, got {type(job_id)}"
        assert len(job_id) > 0, \
            "job_id must not be empty"
        
        # Property: job_id should be unique (UUID format)
        # UUIDs are 36 characters with hyphens
        assert len(job_id) == 36, \
            f"job_id should be UUID format (36 chars), got {len(job_id)} chars"
        assert job_id.count('-') == 4, \
            f"job_id should have 4 hyphens (UUID format), got {job_id.count('-')}"
        
        # Property: Response should contain status field
        assert "status" in response_data, \
            "Response must contain 'status' field"
        
        # Property: Status should be a valid value
        assert response_data["status"] in ["queued", "processing", "completed", "failed"], \
            f"Invalid status value: {response_data['status']}"


def test_api_job_identifier_uniqueness():
    """
    Test that multiple uploads generate unique job IDs.
    
    **Validates: Requirements 11.2**
    """
    csv_content = "Date,Description,Amount\n2024-01-01,Test,100.00"
    
    job_ids = set()
    
    # Upload same CSV multiple times
    for _ in range(5):
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
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
        job_id = response.json()["job_id"]
        job_ids.add(job_id)
    
    # All job IDs should be unique
    assert len(job_ids) == 5, \
        f"Expected 5 unique job IDs, got {len(job_ids)}"


def test_api_invalid_file_type_error():
    """
    Test that invalid file types return appropriate error.
    
    **Validates: Requirements 11.5**
    """
    # Try to upload a non-CSV file
    text_file = io.BytesIO(b"This is not a CSV file")
    
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", text_file, "text/plain")},
        data={
            "income_year": "2023-2024",
            "ephemeral_mode": "true",
            "confidence_threshold": "0.60"
        }
    )
    
    # Should return 400 Bad Request
    assert response.status_code == 400
    
    # Should contain error details
    error_data = response.json()
    assert "detail" in error_data
    assert "error" in error_data["detail"]
    assert error_data["detail"]["error"] == "invalid_file_type"


def test_api_file_too_large_error():
    """
    Test that files exceeding size limit return appropriate error.
    
    **Validates: Requirements 11.5**
    """
    # Create a CSV that exceeds 10MB
    large_csv = "Date,Description,Amount\n" + ("2024-01-01,Test,100.00\n" * 500000)
    csv_file = io.BytesIO(large_csv.encode('utf-8'))
    
    response = client.post(
        "/api/upload",
        files={"file": ("test.csv", csv_file, "text/csv")},
        data={
            "income_year": "2023-2024",
            "ephemeral_mode": "true",
            "confidence_threshold": "0.60"
        }
    )
    
    # Should return 400 Bad Request
    assert response.status_code == 400
    
    # Should contain error details
    error_data = response.json()
    assert "detail" in error_data
    assert "error" in error_data["detail"]
    assert error_data["detail"]["error"] == "file_too_large"
