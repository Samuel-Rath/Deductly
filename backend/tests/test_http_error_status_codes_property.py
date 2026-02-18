"""
Property-based test for HTTP error status codes.

Feature: tax-deduction-analyzer
Property 20: HTTP Error Status Codes

**Validates: Requirements 11.5**

For any API error condition (invalid file type, missing fields, processing failure),
the system should return an appropriate HTTP error status code (4xx for client errors,
5xx for server errors) and a descriptive error message.
"""

import pytest
import io
from hypothesis import given, strategies as st, settings
from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


@pytest.mark.property_test
def test_invalid_file_type_returns_400():
    """
    Property 20: Invalid file type should return 400 Bad Request.
    
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
    
    # Property: Should return 400 Bad Request
    assert response.status_code == 400, \
        f"Expected 400 for invalid file type, got {response.status_code}"
    
    # Property: Should contain error details
    error_data = response.json()
    assert "detail" in error_data, \
        "Error response must contain 'detail' field"
    
    detail = error_data["detail"]
    assert "error" in detail, \
        "Error detail must contain 'error' code"
    assert "message" in detail, \
        "Error detail must contain 'message'"
    
    # Property: Error code should be descriptive
    assert detail["error"] == "invalid_file_type", \
        f"Expected error code 'invalid_file_type', got '{detail['error']}'"


@pytest.mark.property_test
def test_file_too_large_returns_400():
    """
    Property 20: File exceeding size limit should return 400 Bad Request.
    
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
    
    # Property: Should return 400 Bad Request
    assert response.status_code == 400, \
        f"Expected 400 for file too large, got {response.status_code}"
    
    # Property: Should contain error details
    error_data = response.json()
    assert "detail" in error_data
    detail = error_data["detail"]
    assert "error" in detail
    assert detail["error"] == "file_too_large", \
        f"Expected error code 'file_too_large', got '{detail['error']}'"


@given(
    income_year=st.one_of(
        st.just("invalid"),
        st.just("2023"),
        st.just("20232024"),
    )
)
@settings(max_examples=3)
@pytest.mark.property_test
def test_invalid_income_year_returns_400(income_year):
    """
    Property 20: Invalid income year format should return 400 Bad Request.
    
    **Validates: Requirements 11.5**
    """
    csv_content = "Date,Description,Amount\n2023-07-01,Test,100.00"
    csv_file = io.BytesIO(csv_content.encode('utf-8'))
    
    response = client.post(
        "/api/upload",
        files={"file": ("test.csv", csv_file, "text/csv")},
        data={
            "income_year": income_year,
            "ephemeral_mode": "true",
            "confidence_threshold": "0.60"
        }
    )
    
    # Property: Should return 400 Bad Request for invalid format
    assert response.status_code == 400, \
        f"Expected 400 for invalid income year '{income_year}', got {response.status_code}"
    
    # Property: Should contain error details
    error_data = response.json()
    assert "detail" in error_data


@given(
    confidence=st.one_of(
        st.just(-0.5),
        st.just(1.5),
        st.just(2.0),
    )
)
@settings(max_examples=3)
@pytest.mark.property_test
def test_invalid_confidence_threshold_returns_400(confidence):
    """
    Property 20: Invalid confidence threshold should return 400 Bad Request.
    
    **Validates: Requirements 11.5**
    """
    csv_content = "Date,Description,Amount\n2023-07-01,Test,100.00"
    csv_file = io.BytesIO(csv_content.encode('utf-8'))
    
    response = client.post(
        "/api/upload",
        files={"file": ("test.csv", csv_file, "text/csv")},
        data={
            "income_year": "2023-2024",
            "ephemeral_mode": "true",
            "confidence_threshold": str(confidence)
        }
    )
    
    # Property: Should return 400 Bad Request for out-of-range confidence
    assert response.status_code == 400, \
        f"Expected 400 for invalid confidence {confidence}, got {response.status_code}"


@pytest.mark.property_test
def test_job_not_found_returns_404():
    """
    Property 20: Non-existent job ID should return 404 Not Found.
    
    **Validates: Requirements 11.5**
    """
    fake_job_id = "00000000-0000-0000-0000-000000000000"
    
    response = client.get(f"/api/jobs/{fake_job_id}")
    
    # Property: Should return 404 Not Found
    assert response.status_code == 404, \
        f"Expected 404 for non-existent job, got {response.status_code}"
    
    # Property: Should contain error details
    error_data = response.json()
    assert "detail" in error_data
    detail = error_data["detail"]
    assert "error" in detail
    assert detail["error"] == "job_not_found", \
        f"Expected error code 'job_not_found', got '{detail['error']}'"


@pytest.mark.property_test
def test_report_not_found_returns_404():
    """
    Property 20: Non-existent report should return 404 Not Found.
    
    **Validates: Requirements 11.5**
    """
    fake_job_id = "00000000-0000-0000-0000-000000000000"
    
    response = client.get(f"/api/jobs/{fake_job_id}/download/pdf")
    
    # Property: Should return 404 Not Found
    assert response.status_code == 404, \
        f"Expected 404 for non-existent report, got {response.status_code}"
    
    # Property: Should contain error details
    error_data = response.json()
    assert "detail" in error_data
    detail = error_data["detail"]
    assert "error" in detail
    assert detail["error"] == "report_not_found", \
        f"Expected error code 'report_not_found', got '{detail['error']}'"


@pytest.mark.property_test
def test_all_error_responses_have_consistent_structure():
    """
    Property 20: All error responses should have consistent structure.
    
    **Validates: Requirements 11.5**
    """
    # Test various error conditions
    error_responses = []
    
    # Invalid file type
    text_file = io.BytesIO(b"Not CSV")
    resp1 = client.post(
        "/api/upload",
        files={"file": ("test.txt", text_file, "text/plain")},
        data={"income_year": "2023-2024"}
    )
    error_responses.append(resp1)
    
    # Non-existent job
    resp2 = client.get("/api/jobs/fake-id")
    error_responses.append(resp2)
    
    # Non-existent report
    resp3 = client.get("/api/jobs/fake-id/download/pdf")
    error_responses.append(resp3)
    
    # Property: All error responses should have consistent structure
    for response in error_responses:
        assert response.status_code >= 400, \
            f"Expected error status code (>=400), got {response.status_code}"
        
        error_data = response.json()
        assert "detail" in error_data, \
            "All error responses must have 'detail' field"
        
        detail = error_data["detail"]
        assert isinstance(detail, dict), \
            "Error detail must be a dictionary"
        assert "error" in detail, \
            "Error detail must contain 'error' code"
        assert "message" in detail, \
            "Error detail must contain 'message'"
        
        # Property: Error code should be a non-empty string
        assert isinstance(detail["error"], str), \
            "Error code must be a string"
        assert len(detail["error"]) > 0, \
            "Error code must not be empty"
        
        # Property: Message should be a non-empty string
        assert isinstance(detail["message"], str), \
            "Error message must be a string"
        assert len(detail["message"]) > 0, \
            "Error message must not be empty"
