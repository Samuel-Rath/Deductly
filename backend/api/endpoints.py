"""
FastAPI endpoints for Tax Deduction Analyzer.

This module implements all API endpoints including upload, job status,
and report download functionality.

Validates: Requirements 11.1-11.5
"""

import os
import re
import io
import shutil
import time
import tempfile
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse

from backend.models.schemas import (
    UploadResponse,
    JobStatusResponse,
    ErrorResponse,
)
from backend.security_config import SecurityConfig
from backend.storage.storage_service import StorageService
from backend.storage.database import Database
from backend.processing.pipeline import ProcessingPipeline
from backend.processing.pdf_parser import PDFParser
from backend.logging_config import log_event, log_error, log_security_event, log_audit
from backend.monitoring import metrics_collector

REPORTS_DIR = Path("backend/reports")
REPORTS_DIR.mkdir(exist_ok=True)

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
_INCOME_YEAR_RE = re.compile(r'^\d{4}-\d{4}$')


def _validate_job_id(job_id: str) -> None:
    """Raise HTTPException if job_id is not a valid UUID (prevents path traversal)."""
    if not _UUID_RE.match(job_id):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_job_id", "message": "Invalid job ID format"}
        )

router = APIRouter(prefix="/api")


# ============================================================================
# Upload Endpoint
# ============================================================================

@router.post("/upload", response_model=UploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    income_year: Optional[str] = Form(None),
    ephemeral_mode: bool = Form(True),
    confidence_threshold: float = Form(0.60),
) -> UploadResponse:
    """
    Upload a CSV or PDF file for processing.

    Validates: Requirements 11.1, 11.2

    Args:
        file: CSV or PDF file to process
        income_year: Australian income year (format: "YYYY-YYYY"). Auto-detected if omitted.
        ephemeral_mode: If True, no data is persisted after report generation
        confidence_threshold: Minimum confidence for classification (0.0-1.0)

    Returns:
        UploadResponse with job_id and status
    
    Raises:
        HTTPException: 400 if file validation fails
    """
    # Validate file type — check both MIME type and extension (MIME is client-controlled)
    file_ext = Path(file.filename or "").suffix.lower() if file.filename else ""
    # Sanitise the client-supplied filename before any logging (VULN-004: log injection)
    _safe_filename = re.sub(r'[^\w.\-]', '_', Path(file.filename or "unknown").name)[:128]
    mime_ok = file.content_type in SecurityConfig.ALLOWED_FILE_TYPES
    ext_ok = file_ext in SecurityConfig.ALLOWED_FILE_EXTENSIONS
    if not mime_ok or not ext_ok:
        log_security_event(
            'invalid_file_type',
            'low',
            content_type=file.content_type,
            upload_filename=_safe_filename,
        )
        metrics_collector.record_security_event('invalid_file')
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_file_type",
                "message": "Only CSV and PDF files are allowed.",
                "details": {"allowed_extensions": SecurityConfig.ALLOWED_FILE_EXTENSIONS},
            },
        )

    # Validate file size
    file_content = await file.read()
    if len(file_content) > SecurityConfig.MAX_UPLOAD_SIZE_BYTES:
        log_security_event(
            'file_too_large',
            'medium',
            file_size=len(file_content),
            max_size=SecurityConfig.MAX_UPLOAD_SIZE_BYTES,
            upload_filename=_safe_filename,
        )
        metrics_collector.record_security_event('invalid_file')
        raise HTTPException(
            status_code=400,
            detail={
                "error": "file_too_large",
                "message": f"File size exceeds maximum of {SecurityConfig.MAX_UPLOAD_SIZE_MB}MB",
                "details": {
                    "max_size_bytes": SecurityConfig.MAX_UPLOAD_SIZE_BYTES,
                    "file_size_bytes": len(file_content),
                },
            },
        )

    # Validate income year format (if provided) — must be YYYY-YYYY with consecutive years
    if income_year:
        if not _INCOME_YEAR_RE.match(income_year):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_income_year",
                    "message": "Income year must be in format YYYY-YYYY (e.g., 2023-2024)",
                    "details": {"provided": income_year}
                }
            )
        year_start, year_end = int(income_year[:4]), int(income_year[5:])
        if year_end != year_start + 1 or year_start < 2000 or year_end > 2100:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_income_year",
                    "message": "Income year must be consecutive years (e.g., 2023-2024)",
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
    
    # Log upload started
    log_event(
        'upload_started',
        job_id=job_id,
        file_size=len(file_content),
        income_year=income_year,
        ephemeral_mode=ephemeral_mode,
        confidence_threshold=confidence_threshold,
    )
    
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

    _temp_path: Optional[str] = None  # track temp file for guaranteed cleanup

    try:
        # Update status to processing
        storage.update_job_status(job_id, "processing")
        
        # Record upload metrics
        metrics_collector.record_upload(success=True, file_size=len(file_content))
        
        # Determine file type and save appropriately
        is_pdf = file.content_type == "application/pdf"
        file_extension = ".pdf" if is_pdf else ".csv"
        
        # Save uploaded file temporarily
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        temp_file.write(file_content)
        temp_file.close()
        _temp_path = temp_file.name
        
        # If PDF, parse directly to transactions
        pdf_transactions = None
        if is_pdf:
            log_event('pdf_conversion_started', job_id=job_id, file_size=len(file_content))
            try:
                pdf_parser = PDFParser()
                with open(temp_file.name, 'rb') as pdf_file:
                    pdf_transactions = pdf_parser.parse(io.BytesIO(pdf_file.read()))
                
                log_event(
                    'pdf_conversion_completed',
                    job_id=job_id,
                    transaction_count=len(pdf_transactions)
                )
            except Exception as e:
                storage.update_job_status(job_id, "failed", error=str(e))
                log_error('pdf_conversion_failed', e, job_id=job_id)
                metrics_collector.record_upload(success=False, file_size=len(file_content))
                # VULN-001: never expose raw exception text in production
                user_msg = (
                    f"Failed to parse PDF: {str(e)}"
                    if not SecurityConfig.is_production()
                    else "Could not parse the uploaded PDF. Please check the file and try again."
                )
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "pdf_parsing_failed",
                        "message": user_msg,
                        "details": {"job_id": job_id}
                    }
                )
        
        # Track processing time
        processing_start = time.time()
        
        # Auto-detect income year if not provided
        if not income_year:
            log_event('income_year_auto_detection_started', job_id=job_id)
            try:
                if pdf_transactions:
                    # Detect from parsed PDF transactions
                    income_year = _detect_income_year_from_transactions(pdf_transactions)
                else:
                    # Detect from CSV file
                    income_year = _detect_income_year_from_csv(temp_file.name)
                log_event(
                    'income_year_auto_detected',
                    job_id=job_id,
                    detected_income_year=income_year
                )
            except Exception as e:
                log_error('income_year_detection_failed', e, job_id=job_id)
                # Default to current income year if detection fails
                now = datetime.now()
                current_year = now.year
                current_month = now.month
                income_year = f"{current_year - 1}-{current_year}" if current_month < 7 else f"{current_year}-{current_year + 1}"
                log_event(
                    'income_year_defaulted',
                    job_id=job_id,
                    default_income_year=income_year
                )
        
        # Initialize processing pipeline
        pipeline = ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=confidence_threshold,
            storage_service=storage,
        )
        
        # Process and generate reports
        job_dir = REPORTS_DIR / job_id
        job_dir.mkdir(exist_ok=True)
        
        if pdf_transactions:
            # Process PDF transactions directly
            report_data, generated_files = pipeline.process_and_generate_reports(
                transactions=pdf_transactions,
                income_year=income_year,
                output_dir=job_dir,
                job_id=job_id,
                generate_pdf=True,
                generate_csv=True,
                generate_json=True
            )
        else:
            # Process CSV file
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
        
        # Calculate processing time
        processing_time = time.time() - processing_start
        
        # Update job status to completed
        storage.update_job_status(job_id, "completed")
        
        # Record job metrics
        metrics_collector.record_job(success=True, processing_time=processing_time)
        
        # Log completion
        log_event(
            'upload_completed',
            job_id=job_id,
            processing_time=processing_time,
            transaction_count=len(report_data.candidates) + len(report_data.needs_review) + len(report_data.excluded)
        )
        
        # Audit log
        log_audit('upload_complete', job_id=job_id, income_year=income_year)
        
        # Helper function to flatten classified transaction for frontend
        def flatten_classified_transaction(ct):
            """Flatten ClassifiedTransaction to match frontend expectations."""
            txn = ct.transaction
            flags = ct.flags or []
            return {
                "id": txn.transaction_id,
                "date": txn.date.isoformat(),
                "description": txn.description,
                "merchant": txn.merchant,
                "amount": float(txn.absolute_amount),
                "category": ct.category.value if ct.category else None,
                "confidence": ct.confidence,
                "confidence_pct": round(ct.confidence * 100),
                "reason": ct.reason,
                "evidence": [e.value for e in ct.evidence_checklist],
                "flags": flags,
                "matched_rule_id": ct.matched_rule_id,
            }
        
        # Helper function to flatten excluded transaction for frontend
        def flatten_excluded_transaction(et):
            """Flatten ExcludedTransaction to match frontend expectations."""
            txn = et.transaction
            return {
                "id": txn.transaction_id,
                "date": txn.date.isoformat(),
                "description": txn.description,
                "merchant": txn.merchant,
                "amount": float(txn.absolute_amount),
                "reason": et.reason.value,
                "explanation": et.explanation,
            }
        
        # Convert report_data to dict for response
        report_dict = {
            "income_year": report_data.income_year,
            "generated_at": report_data.generated_at.isoformat(),
            "disclaimer": "NOT TAX ADVICE — This report is for informational purposes only. Always consult a registered tax agent (BAS agent) or contact the ATO before claiming any deductions.",
            "summary": {
                "total_deductible": float(report_data.summary.total_deductible),
                "total_needs_review": float(report_data.summary.total_needs_review),
                "total_excluded": float(report_data.summary.total_excluded),
                "category_totals": {k: float(v) for k, v in report_data.summary.category_totals.items()},
                "confidence_distribution": {
                    "high": report_data.summary.confidence_distribution.get("high", 0),
                    "medium": report_data.summary.confidence_distribution.get("medium", 0),
                    "low": report_data.summary.confidence_distribution.get("low", 0),
                }
            },
            "candidates": [flatten_classified_transaction(t) for t in report_data.candidates],
            "needs_review": [flatten_classified_transaction(t) for t in report_data.needs_review],
            "excluded": [flatten_excluded_transaction(t) for t in report_data.excluded],
        }
        
        return UploadResponse(
            job_id=job_id,
            status="completed",
            message="File processed successfully.",
            report_data=report_dict
        )

    except HTTPException:
        # Re-raise HTTP exceptions (they're already properly formatted)
        raise
    except Exception as e:
        # Update job status to failed
        storage.update_job_status(job_id, "failed", error=str(e))

        # Record failed upload
        metrics_collector.record_upload(success=False, file_size=len(file_content))
        metrics_collector.record_job(success=False, processing_time=0)

        # Log error
        log_error('processing_failed', e, job_id=job_id)

        detail: dict = {"error": "processing_failed", "message": "An unexpected error occurred during processing.", "details": {"job_id": job_id}}
        if not SecurityConfig.is_production():
            detail["message"] = f"Failed to process file: {str(e)}"
        raise HTTPException(status_code=500, detail=detail)
    finally:
        # Always delete the temp upload regardless of success or failure
        if _temp_path is not None:
            try:
                os.unlink(_temp_path)
            except OSError:
                pass

        # Ephemeral-mode guarantee (SEC-1): generated report files must not
        # persist on disk on ANY exit path — success, HTTPException, or
        # unexpected error. Moving this into `finally` closes the privacy leak
        # where reports were left behind when an exception fired after the
        # files had already been written to disk.
        if ephemeral_mode:
            try:
                job_dir = REPORTS_DIR / job_id
                if job_dir.exists():
                    shutil.rmtree(job_dir)
            except Exception as cleanup_error:
                log_event('cleanup_warning', job_id=job_id, error=str(cleanup_error))


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
    _validate_job_id(job_id)

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
# Helper Functions
# ============================================================================

def _detect_income_year_from_csv(csv_path: str) -> str:
    """
    Detect the Australian income year from transaction dates in a CSV file.
    
    Australian income year runs from July 1 to June 30.
    
    Args:
        csv_path: Path to the CSV file
        
    Returns:
        Income year string in format "YYYY-YYYY"
        
    Raises:
        ValueError: If no valid dates found or unable to detect
    """
    import csv
    from datetime import datetime
    
    dates = []
    
    # Read CSV and extract dates
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        # Try to find date column
        if not reader.fieldnames:
            raise ValueError("CSV has no headers")
        
        date_col = None
        for col in reader.fieldnames:
            col_lower = col.lower().strip()
            if any(pattern in col_lower for pattern in ['date', 'trans date', 'transaction date']):
                date_col = col
                break
        
        if not date_col:
            raise ValueError("No date column found in CSV")
        
        # Parse dates
        date_formats = [
            "%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d",
            "%d/%m/%y", "%d-%m-%y",
            "%d %b %Y", "%d %b %y", "%d %B %Y"
        ]
        
        for row in reader:
            date_str = row.get(date_col, '').strip()
            if not date_str:
                continue
            
            # Try each date format
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    dates.append(parsed_date)
                    break
                except ValueError:
                    continue
    
    if not dates:
        raise ValueError("No valid dates found in CSV")
    
    # Find the range of dates
    min_date = min(dates)
    max_date = max(dates)
    
    # Determine income year based on the date range
    # If transactions span multiple income years, use the one with most transactions
    income_years = {}
    
    for d in dates:
        # Australian income year: July 1 to June 30
        if d.month >= 7:
            year_key = f"{d.year}-{d.year + 1}"
        else:
            year_key = f"{d.year - 1}-{d.year}"
        
        income_years[year_key] = income_years.get(year_key, 0) + 1
    
    # Return the income year with the most transactions
    detected_year = max(income_years.items(), key=lambda x: x[1])[0]
    
    return detected_year


def _detect_income_year_from_transactions(transactions: list) -> str:
    """
    Detect Australian income year from a list of NormalisedTransaction objects.
    
    Args:
        transactions: List of NormalisedTransaction objects
        
    Returns:
        Income year string in format "YYYY-YYYY" (e.g., "2023-2024")
        
    Raises:
        ValueError: If no valid dates found
    """
    if not transactions:
        raise ValueError("No transactions provided")
    
    # Extract dates from transactions
    dates = [txn.date for txn in transactions if txn.date]
    
    if not dates:
        raise ValueError("No valid dates found in transactions")
    
    # Determine income year based on the date range
    # If transactions span multiple income years, use the one with most transactions
    income_years = {}
    
    for d in dates:
        # Australian income year: July 1 to June 30
        if d.month >= 7:
            year_key = f"{d.year}-{d.year + 1}"
        else:
            year_key = f"{d.year - 1}-{d.year}"
        
        income_years[year_key] = income_years.get(year_key, 0) + 1
    
    # Return the income year with the most transactions
    detected_year = max(income_years.items(), key=lambda x: x[1])[0]
    
    return detected_year


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
    _validate_job_id(job_id)

    # Check file exists
    file_path = REPORTS_DIR / job_id / filename
    if not file_path.exists():
        log_security_event(
            'report_not_found',
            'low',
            job_id=job_id,
            format=format,
            report_filename=filename
        )
        raise HTTPException(
            status_code=404,
            detail={
                "error": "report_not_found",
                "message": f"Report file not found: {filename}",
                "details": {"job_id": job_id, "format": format}
            }
        )
    
    # Log download
    log_audit('report_downloaded', job_id=job_id, format=format)
    
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=filename
    )
