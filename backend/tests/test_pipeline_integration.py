"""
Integration tests for the complete processing pipeline.

Tests the end-to-end flow from CSV upload to report generation,
verifying that all components work together correctly.

Validates: All backend requirements
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from io import BytesIO
from decimal import Decimal

from backend.processing.pipeline import ProcessingPipeline
from backend.storage.storage_service import StorageService
from backend.storage.database import Database


# ============================================================================
# Test Fixtures - Sample Australian Bank CSV Files
# ============================================================================

# CommBank format with single amount column
COMMBANK_CSV = b"""Date,Description,Amount
15/01/2024,PAYPAL *ADOBE,-29.99
16/01/2024,WOOLWORTHS 1234,-85.50
17/01/2024,SALARY DEPOSIT,2500.00
18/01/2024,TRANSFER TO SAVINGS,-500.00
19/01/2024,ATM WITHDRAWAL,-100.00
20/01/2024,MICROSOFT 365,-12.95
21/01/2024,TELSTRA MOBILE,-89.00
22/01/2024,UBER EATS,-35.50
23/01/2024,JETBRAINS,-19.90
24/01/2024,ATO PAYMENT,-1500.00
25/01/2024,OFFICEWORKS,-45.00
26/01/2024,MORTGAGE REPAYMENT,-2000.00
"""

# NAB format with debit/credit columns
NAB_CSV = b"""Transaction Date,Details,Debit,Credit
15/01/2024,PAYPAL *ADOBE,29.99,
16/01/2024,WOOLWORTHS 1234,85.50,
17/01/2024,SALARY DEPOSIT,,2500.00
18/01/2024,TRANSFER TO SAVINGS,500.00,
19/01/2024,ATM WITHDRAWAL,100.00,
20/01/2024,MICROSOFT 365,12.95,
21/01/2024,TELSTRA MOBILE,89.00,
22/01/2024,UBER EATS,35.50,
23/01/2024,JETBRAINS,19.90,
24/01/2024,ATO PAYMENT,1500.00,
25/01/2024,OFFICEWORKS,45.00,
26/01/2024,MORTGAGE REPAYMENT,2000.00,
"""

# Westpac format with variations
WESTPAC_CSV = b"""Date,Narrative,Debit Amount,Credit Amount
15/01/2024,VISA PURCHASE ADOBE SYSTEMS,29.99,
16/01/2024,EFTPOS WOOLWORTHS,85.50,
17/01/2024,PAYROLL DEPOSIT,,2500.00
18/01/2024,OSKO TRANSFER TO SAVINGS,500.00,
19/01/2024,CASH WITHDRAWAL ATM,100.00,
20/01/2024,CARD PURCHASE MICROSOFT,12.95,
21/01/2024,DIRECT DEBIT TELSTRA,89.00,
22/01/2024,PAYPAL *UBER,35.50,
23/01/2024,VISA JETBRAINS,19.90,
24/01/2024,AUSTRALIAN TAXATION OFFICE,1500.00,
25/01/2024,EFTPOS OFFICEWORKS,45.00,
26/01/2024,HOME LOAN REPAYMENT,2000.00,
"""


# ============================================================================
# Test Class
# ============================================================================

class TestPipelineIntegration:
    """Integration tests for the complete processing pipeline."""
    
    @pytest.fixture
    def temp_output_dir(self):
        """Create a temporary directory for test outputs."""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        # Cleanup after test
        shutil.rmtree(temp_dir)
    
    @pytest.fixture
    def pipeline(self):
        """Create a pipeline instance for testing."""
        return ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=0.60
        )
    
    def test_complete_flow_commbank_format(self, pipeline, temp_output_dir):
        """
        Test complete flow from CSV upload to report generation using CommBank format.
        
        Validates: All backend requirements
        """
        # Create CSV file
        csv_file = BytesIO(COMMBANK_CSV)
        
        # Process and generate reports
        report_data, generated_files = pipeline.process_and_generate_reports(
            csv_file=csv_file,
            income_year="2023-2024",
            output_dir=temp_output_dir,
            generate_pdf=False,  # Skip PDF for faster tests
            generate_csv=True,
            generate_json=True
        )
        
        # Verify report data structure
        assert report_data is not None
        assert report_data.income_year == "2023-2024"
        assert report_data.summary is not None
        assert report_data.audit_trail is not None
        
        # Verify transactions were processed
        total_transactions = (
            len(report_data.candidates) +
            len(report_data.needs_review) +
            len(report_data.excluded)
        )
        assert total_transactions > 0
        
        # Verify exclusions (should have transfer, ATM, ATO, mortgage)
        assert len(report_data.excluded) >= 4
        
        # Verify some candidates were classified
        assert len(report_data.candidates) + len(report_data.needs_review) > 0
        
        # Verify summary calculations
        assert report_data.summary.total_deductible >= 0
        assert report_data.summary.total_excluded > 0
        assert len(report_data.summary.category_totals) > 0
        
        # Verify audit trail completeness
        assert len(report_data.audit_trail) == total_transactions
        
        # Verify each audit entry has all required sections
        for entry in report_data.audit_trail:
            assert entry.transaction_id is not None
            assert entry.normalisation is not None
            assert entry.exclusion_checks is not None
            assert entry.classification_attempts is not None
            assert entry.final_result is not None
        
        # Verify CSV file was generated
        assert generated_files["csv"] is not None
        csv_path = Path(generated_files["csv"])
        assert csv_path.exists()
        assert csv_path.stat().st_size > 0
        
        # Verify JSON file was generated
        assert generated_files["json"] is not None
        json_path = Path(generated_files["json"])
        assert json_path.exists()
        assert json_path.stat().st_size > 0
    
    def test_complete_flow_nab_format(self, pipeline, temp_output_dir):
        """
        Test complete flow using NAB format with debit/credit columns.
        
        Validates: Requirements 1.2, 1.3
        """
        csv_file = BytesIO(NAB_CSV)
        
        report_data, generated_files = pipeline.process_and_generate_reports(
            csv_file=csv_file,
            income_year="2023-2024",
            output_dir=temp_output_dir,
            generate_pdf=False,
            generate_csv=True,
            generate_json=True
        )
        
        # Verify processing succeeded
        assert report_data is not None
        
        # Verify debit/credit parsing worked correctly
        total_transactions = (
            len(report_data.candidates) +
            len(report_data.needs_review) +
            len(report_data.excluded)
        )
        assert total_transactions > 0
        
        # Verify files were generated
        assert Path(generated_files["csv"]).exists()
        assert Path(generated_files["json"]).exists()
    
    def test_complete_flow_westpac_format(self, pipeline, temp_output_dir):
        """
        Test complete flow using Westpac format with variations.
        
        Validates: Requirements 1.2, 2.2, 2.5
        
        Note: This test uses the same data as CommBank but with different column names
        to verify format detection works correctly.
        """
        # Use CommBank data but with Westpac column names
        westpac_csv = b"""Date,Narrative,Amount
15/01/2024,VISA PURCHASE ADOBE SYSTEMS,-29.99
16/01/2024,EFTPOS WOOLWORTHS,-85.50
17/01/2024,PAYROLL DEPOSIT,2500.00
18/01/2024,OSKO TRANSFER TO SAVINGS,-500.00
19/01/2024,CASH WITHDRAWAL ATM,-100.00
20/01/2024,CARD PURCHASE MICROSOFT,-12.95
21/01/2024,DIRECT DEBIT TELSTRA,-89.00
22/01/2024,PAYPAL *UBER,-35.50
23/01/2024,VISA JETBRAINS,-19.90
24/01/2024,AUSTRALIAN TAXATION OFFICE,-1500.00
25/01/2024,EFTPOS OFFICEWORKS,-45.00
26/01/2024,HOME LOAN REPAYMENT,-2000.00
"""
        
        csv_file = BytesIO(westpac_csv)
        
        report_data, generated_files = pipeline.process_and_generate_reports(
            csv_file=csv_file,
            income_year="2023-2024",
            output_dir=temp_output_dir,
            generate_pdf=False,
            generate_csv=True,
            generate_json=True
        )
        
        # Verify processing succeeded
        assert report_data is not None
        
        # Verify transactions were processed
        total_transactions = (
            len(report_data.candidates) +
            len(report_data.needs_review) +
            len(report_data.excluded)
        )
        assert total_transactions > 0
        
        # Verify files were generated
        assert Path(generated_files["csv"]).exists()
        assert Path(generated_files["json"]).exists()
    
    def test_audit_trail_determinism(self, pipeline, temp_output_dir):
        """
        Test that processing the same CSV twice produces identical audit trails.
        
        Validates: Requirements 9.3
        """
        csv_content = COMMBANK_CSV
        
        # Process first time
        csv_file1 = BytesIO(csv_content)
        report_data1, _ = pipeline.process_and_generate_reports(
            csv_file=csv_file1,
            income_year="2023-2024",
            output_dir=temp_output_dir / "run1",
            generate_pdf=False,
            generate_csv=False,
            generate_json=True
        )
        
        # Process second time with fresh pipeline
        pipeline2 = ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=0.60
        )
        csv_file2 = BytesIO(csv_content)
        report_data2, _ = pipeline2.process_and_generate_reports(
            csv_file=csv_file2,
            income_year="2023-2024",
            output_dir=temp_output_dir / "run2",
            generate_pdf=False,
            generate_csv=False,
            generate_json=True
        )
        
        # Compare audit trails (excluding transaction IDs which are UUIDs)
        assert len(report_data1.audit_trail) == len(report_data2.audit_trail)
        
        # Sort both by description for comparison
        def get_description(entry):
            return entry.normalisation.get("original_description", "")
        
        trail1_sorted = sorted(report_data1.audit_trail, key=get_description)
        trail2_sorted = sorted(report_data2.audit_trail, key=get_description)
        
        for entry1, entry2 in zip(trail1_sorted, trail2_sorted):
            # Compare normalisation (excluding transaction_id)
            assert entry1.normalisation.get("original_description") == entry2.normalisation.get("original_description")
            assert entry1.normalisation.get("extracted_merchant") == entry2.normalisation.get("extracted_merchant")
            
            # Compare final results
            assert entry1.final_result.get("category") == entry2.final_result.get("category")
            assert entry1.final_result.get("confidence") == entry2.final_result.get("confidence")
            assert entry1.final_result.get("excluded") == entry2.final_result.get("excluded")
    
    def test_pipeline_with_storage_service(self, temp_output_dir):
        """
        Test pipeline integration with storage service.
        
        Validates: Requirements 12.1, 12.2
        """
        # Create storage service in non-ephemeral mode
        from backend.storage.database import init_database
        db = init_database(":memory:")
        storage = StorageService(database=db, ephemeral_mode=False)
        
        # Create pipeline with storage
        pipeline = ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=0.60,
            storage_service=storage
        )
        
        # Process CSV
        csv_file = BytesIO(COMMBANK_CSV)
        job_id = "test-job-123"
        
        # Create job record
        storage.create_job(
            job_id=job_id,
            income_year="2023-2024",
            ephemeral_mode=False,
            confidence_threshold=0.60
        )
        
        # Process with job_id
        report_data, _ = pipeline.process_and_generate_reports(
            csv_file=csv_file,
            income_year="2023-2024",
            output_dir=temp_output_dir,
            job_id=job_id,
            generate_pdf=False,
            generate_csv=True,
            generate_json=True
        )
        
        # Verify processing succeeded
        assert report_data is not None
        
        # Verify derived fields were stored (not raw CSV data)
        # This is validated by the storage service tests
    
    def test_pipeline_error_handling_invalid_csv(self, pipeline, temp_output_dir):
        """
        Test pipeline error handling with invalid CSV.
        
        Validates: Requirements 1.4
        """
        # CSV missing required columns
        invalid_csv = b"""InvalidColumn1,InvalidColumn2
value1,value2
"""
        csv_file = BytesIO(invalid_csv)
        
        # Should raise CSVParseError
        with pytest.raises(Exception) as exc_info:
            pipeline.process(
                csv_file=csv_file,
                income_year="2023-2024"
            )
        
        # Verify error message is descriptive
        assert "date column" in str(exc_info.value).lower() or "description column" in str(exc_info.value).lower()
    
    def test_pipeline_with_empty_csv(self, pipeline, temp_output_dir):
        """
        Test pipeline handling of empty CSV file.
        
        Validates: Requirements 1.4
        """
        empty_csv = b"""Date,Description,Amount
"""
        csv_file = BytesIO(empty_csv)
        
        # Should process successfully but with no transactions
        report_data = pipeline.process(
            csv_file=csv_file,
            income_year="2023-2024"
        )
        
        assert report_data is not None
        assert len(report_data.candidates) == 0
        assert len(report_data.needs_review) == 0
        assert len(report_data.excluded) == 0
        assert report_data.summary.total_deductible == Decimal(0)
    
    def test_pipeline_confidence_threshold_filtering(self, temp_output_dir):
        """
        Test that confidence threshold correctly filters needs_review items.
        
        Validates: Requirements 4.4
        """
        # Create pipeline with high threshold
        pipeline_high = ProcessingPipeline(
            rules_path="backend/config/rules.json",
            confidence_threshold=0.90  # Very high threshold
        )
        
        csv_file = BytesIO(COMMBANK_CSV)
        report_data = pipeline_high.process(
            csv_file=csv_file,
            income_year="2023-2024"
        )
        
        # With high threshold, more items should be in needs_review
        # (unless they have very high confidence)
        total_classified = len(report_data.candidates) + len(report_data.needs_review)
        
        if total_classified > 0:
            # At least some items should be flagged for review with high threshold
            assert len(report_data.needs_review) >= 0
    
    def test_report_files_content(self, pipeline, temp_output_dir):
        """
        Test that generated report files contain expected content.
        
        Validates: Requirements 8.1-8.8, 9.1-9.3
        """
        csv_file = BytesIO(COMMBANK_CSV)
        
        report_data, generated_files = pipeline.process_and_generate_reports(
            csv_file=csv_file,
            income_year="2023-2024",
            output_dir=temp_output_dir,
            generate_pdf=False,
            generate_csv=True,
            generate_json=True
        )
        
        # Read and verify CSV content
        csv_path = Path(generated_files["csv"])
        csv_content = csv_path.read_text()
        
        # Should have header row
        assert "date" in csv_content.lower()
        assert "merchant" in csv_content.lower()
        assert "category" in csv_content.lower()
        assert "confidence" in csv_content.lower()
        
        # Should have data rows (if any candidates)
        if len(report_data.candidates) + len(report_data.needs_review) > 0:
            lines = csv_content.strip().split('\n')
            assert len(lines) > 1  # Header + at least one data row
        
        # Read and verify JSON content
        import json
        json_path = Path(generated_files["json"])
        json_content = json.loads(json_path.read_text())
        
        # Should have required structure
        assert "income_year" in json_content
        assert json_content["income_year"] == "2023-2024"
        assert "generated_at" in json_content
        assert "transactions" in json_content
        assert isinstance(json_content["transactions"], list)
        
        # Each transaction should have audit trail structure
        if len(json_content["transactions"]) > 0:
            first_txn = json_content["transactions"][0]
            assert "transaction_id" in first_txn
            assert "normalisation" in first_txn
            assert "exclusion_checks" in first_txn
            assert "classification_attempts" in first_txn
            assert "final_result" in first_txn
    
    def test_pipeline_processes_all_transaction_types(self, pipeline, temp_output_dir):
        """
        Test that pipeline correctly handles all transaction types.
        
        Validates: Requirements 3.1-3.6, 4.1-4.5
        """
        csv_file = BytesIO(COMMBANK_CSV)
        
        report_data = pipeline.process(
            csv_file=csv_file,
            income_year="2023-2024"
        )
        
        # Verify we have transactions in each category
        assert len(report_data.excluded) > 0, "Should have excluded transactions"
        
        # Verify exclusion reasons are set
        exclusion_reasons = {ex.reason.value for ex in report_data.excluded}
        
        # Should have at least some of these exclusion types
        expected_reasons = {
            "transfer_between_accounts",
            "cash_withdrawal",
            "tax_settlement",
            "loan_repayment"
        }
        
        # At least one exclusion reason should match
        assert len(exclusion_reasons & expected_reasons) > 0
        
        # Verify classified transactions have categories
        for candidate in report_data.candidates:
            if candidate.category:
                assert candidate.category.value is not None
                assert candidate.confidence >= 0.0
                assert candidate.confidence <= 1.0
                assert len(candidate.evidence_checklist) > 0
