"""
FastAPI endpoints for Tax Deduction Analyzer.

This module implements all API endpoints including upload, job status,
and report download functionality.

Validates: Requirements 11.1-11.5
"""

import os
import uuid
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse

from backend.models.schemas import (
    UploadResponse,
    JobStatusResponse,
    ErrorResponse
)
from backend.storage.storage_service import StorageService
from backend.storage.database import Database
from backend.processing.pipeline import ProcessingPipeline

# Configuration
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = ["text/csv", "application/vnd.ms-excel"]
REPORTS_DIR = Path("backend/reports")
REPORTS_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/api")


# ============================================================================
# Upload Endpoint
# ============================================================================

@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    income_year: str = Form("2023-2024"),
    ephemeral_mode: bool = Form(True),
    confidence_threshold: float = Form(0.60)
) -> UploadResponse:
    """
    Upload a CSV file for processing.
    
    Validates: Requirements 11.1, 11.2
    
    Args:
        file: CSV file to process
        income_year: Australian income year (format: "YYYY-YYYY")
        ephemeral_mode: If True, no data is persisted after report generation
        confidence_threshold: Minimum confidence for classification (0.0-1.0)
    
    Returns:
        UploadResponse with job_id and status
    
    Raises:
        HTTPException: 400 if file validation fails
    """
    # Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file_type",
                "message": f"Only CSV files are allowed. Received: {file.content_type}",
                "details": {"allowed_types": ALLOWED_CONTENT_TYPES}
            }
        )
    
    # Validate file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "file_too_large",
                "message": f"File size exceeds maximum of {MAX_FILE_SIZE / (1024*1024)}MB",
                "details": {"max_size_bytes": MAX_FILE_SIZE, "file_size_bytes": len(file_content)}
            }
        )
    
    # Validate income year format
    if not income_year or not income_year.strip():
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_income_year",
                "message": "Income year is required and cannot be empty",
                "details": {"provided": income_year}
            }
        )
    
    parts = income_year.split("-")
    if len(parts) != 2:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_income_year",
                "message": "Income year must be in format YYYY-YYYY (e.g., 2023-2024)",
                "details": {"provided": income_year}
            }
        )
    
    # Validate confidence threshold
    if not 0.0 <= confidence_threshold <= 1.0:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_confidence_threshold",
                "message": "Confidence threshold must be between 0.0 and 1.0",
                "details": {"provided": confidence_threshold}
            }
        )
    
    # Generate unique job ID
    job_id = str(uuid.uuid4())
    
    # Initialize storage service
    db = Database()
    storage = StorageService(database=db, ephemeral_mode=ephemeral_mode)
    
    # Create job record
    storage.create_job(
        job_id=job_id,
        income_year=income_year,
        ephemeral_mode=ephemeral_mode,
        confidence_threshold=confidence_threshold
    )
    
    try:
        # Update status to processing
        storage.update_job_status(job_id, "processing")
        
        # Save uploaded file temporarily
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
        temp_file.write(file_content)
        temp_file.close()
        
        # Initialize processing pipeline
        pipeline = ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=confidence_threshold,
            storage_service=storage
        )
        
        # Process CSV and generate reports
        job_dir = REPORTS_DIR / job_id
        job_dir.mkdir(exist_ok=True)
        
        with open(temp_file.name, 'rb') as csv_file:
            report_data, generated_files = pipeline.process_and_generate_reports(
                csv_file=csv_file,
                income_year=income_year,
                output_dir=job_dir,
                job_id=job_id,
                generate_pdf=True,
                generate_csv=True,
                generate_json=True
            )
        
        # Clean up temp file
        os.unlink(temp_file.name)
        
        # Update job status to completed
        storage.update_job_status(job_id, "completed")
        
        return UploadResponse(
            job_id=job_id,
            status="completed",
            message="CSV processed successfully. Reports are ready for download."
        )
        
    except Exception as e:
        # Update job status to failed
        storage.update_job_status(job_id, "failed", error=str(e))
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": "processing_failed",
                "message": f"Failed to process CSV: {str(e)}",
                "details": {"job_id": job_id}
            }
        )


# ============================================================================
# Job Status Endpoint
# ============================================================================

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    """
    Get the status of a processing job.
    
    Validates: Requirements 11.3, 11.4
    
    Args:
        job_id: Unique job identifier
    
    Returns:
        JobStatusResponse with status and download URLs if completed
    
    Raises:
        HTTPException: 404 if job not found
    """
    # Check if reports exist (works for both ephemeral and persistent modes)
    job_dir = REPORTS_DIR / job_id
    
    if not job_dir.exists():
        raise HTTPException(
            status_code=404,
            detail={
                "error": "job_not_found",
                "message": f"No job found with ID: {job_id}",
                "details": {"job_id": job_id}
            }
        )
    
    # Determine status based on report files
    pdf_exists = (job_dir / "deduction_report.pdf").exists()
    csv_exists = (job_dir / "deductions.csv").exists()
    json_exists = (job_dir / "audit_trail.json").exists()
    
    if pdf_exists and csv_exists and json_exists:
        status = "completed"
    else:
        status = "processing"
    
    response = JobStatusResponse(
        job_id=job_id,
        status=status
    )
    
    # Add download URLs if job is completed
    if status == "completed":
        response.report_urls = {
            "pdf": f"/api/jobs/{job_id}/download/pdf",
            "csv": f"/api/jobs/{job_id}/download/csv",
            "json": f"/api/jobs/{job_id}/download/json"
        }
    
    return response


# ============================================================================
# Report Download Endpoints
# ============================================================================

@router.get("/jobs/{job_id}/download/pdf")
async def download_pdf(job_id: str) -> FileResponse:
    """
    Download PDF report for a completed job.
    
    Validates: Requirements 11.4
    
    Args:
        job_id: Unique job identifier
    
    Returns:
        FileResponse with PDF content
    
    Raises:
        HTTPException: 404 if job or report not found
    """
    return _download_report(job_id, "pdf", "deduction_report.pdf", "application/pdf")


@router.get("/jobs/{job_id}/download/csv")
async def download_csv(job_id: str) -> FileResponse:
    """
    Download CSV report for a completed job.
    
    Validates: Requirements 11.4
    
    Args:
        job_id: Unique job identifier
    
    Returns:
        FileResponse with CSV content
    
    Raises:
        HTTPException: 404 if job or report not found
    """
    return _download_report(job_id, "csv", "deductions.csv", "text/csv")


@router.get("/jobs/{job_id}/download/json")
async def download_json(job_id: str) -> FileResponse:
    """
    Download JSON audit trail for a completed job.
    
    Validates: Requirements 11.4
    
    Args:
        job_id: Unique job identifier
    
    Returns:
        FileResponse with JSON content
    
    Raises:
        HTTPException: 404 if job or report not found
    """
    return _download_report(job_id, "json", "audit_trail.json", "application/json")


def _download_report(
    job_id: str,
    format: str,
    filename: str,
    media_type: str
) -> FileResponse:
    """
    Internal helper to download a report file.
    
    Args:
        job_id: Job identifier
        format: Report format (pdf, csv, json)
        filename: Expected filename
        media_type: MIME type for response
    
    Returns:
        FileResponse with file content
    
    Raises:
        HTTPException: 404 if job or file not found
    """
    # Check file exists
    file_path = REPORTS_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail={
                "error": "report_not_found",
                "message": f"Report file not found: {filename}",
                "details": {"job_id": job_id, "format": format}
            }
        )
    
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )
