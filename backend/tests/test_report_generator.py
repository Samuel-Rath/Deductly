"""
Unit Tests for Report Generator

Tests PDF generation, CSV formatting, JSON audit trail structure,
and verifies all required sections are present in outputs.

Validates: Requirements 8.1-8.8, 9.1-9.3
"""

import pytest
from decimal import Decimal
from datetime import date, datetime
import csv
import json
import tempfile
from pathlib import Path

from backend.models.schemas import (
    NormalisedTransaction,
    ClassifiedTransaction,
    ExcludedTransaction,
    ReportData,
    ReportSummary,
    AuditEntry,
    DeductionCategory,
    EvidenceType,
    TransactionDirection,
    ExclusionReason,
)
from backend.processing.report_generator import ReportGenerator


@pytest.fixture
def sample_transactions():
    """Create sample transactions for testing."""
    return [
        NormalisedTransaction(
            date=date(2023, 8, 15),
            description="ADOBE CREATIVE CLOUD",
            merchant="Adobe",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("79.99"),
            signed_amount=Decimal("-79.99"),
            payment_rail="card",
            recurring_flag=True,
        ),
        NormalisedTransaction(
            date=date(2023, 9, 20),
            description="OFFICEWORKS SYDNEY",
            merchant="Officeworks",
            direction=TransactionDirection.DEBIT,
            absolute_amount=Decimal("145.50"),
            signed_amount=Decimal("-145.50"),
            payment_rail="card",
            recurring_flag=False,
        ),
    ]


@pytest.fixture
def sample_classified_transactions(sample_transactions):
    """Create sample classified transactions."""
    return [
        ClassifiedTransaction(
            transaction=sample_transactions[0],
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match: adobe",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        ),
        ClassifiedTransaction(
            transaction=sample_transactions[1],
            category=DeductionCategory.WORK_EQUIPMENT,
            confidence=0.55,
            matched_rule_id="R004",
            matched_rule_version="1.0",
            reason="merchant_match: Officeworks",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=["needs_review"],
        ),
    ]


@pytest.fixture
def sample_excluded_transactions():
    """Create sample excluded transactions."""
    return [
        ExcludedTransaction(
            transaction=NormalisedTransaction(
                date=date(2023, 10, 1),
                description="TRANSFER TO SAVINGS",
                merchant="Transfer",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("500.00"),
                signed_amount=Decimal("-500.00"),
            ),
            reason=ExclusionReason.TRANSFER_BETWEEN_ACCOUNTS,
            explanation="Internal transfer between accounts",
        ),
    ]


@pytest.fixture
def sample_audit_trail():
    """Create sample audit trail."""
    return [
        AuditEntry(
            transaction_id="test-id-1",
            normalisation={"merchant": "Adobe", "payment_rail": "card"},
            exclusion_checks=[{"rule": "transfer_check", "matched": False}],
            classification_attempts=[{"rule_id": "R001", "confidence": 0.95, "matched": True}],
            final_result={"category": "work_software", "confidence": 0.95},
        ),
    ]


@pytest.fixture
def sample_report_data(sample_classified_transactions, sample_excluded_transactions, sample_audit_trail):
    """Create sample report data."""
    summary = ReportSummary(
        total_deductible=Decimal("79.99"),
        total_needs_review=Decimal("145.50"),
        total_excluded=Decimal("500.00"),
        category_totals={
            "work_software": Decimal("79.99"),
            "work_equipment": Decimal("145.50"),
        },
        confidence_distribution={"high": 1, "medium": 0, "low": 1},
    )
    
    return ReportData(
        income_year="2023-2024",
        generated_at=datetime(2024, 1, 15, 10, 30, 0),
        summary=summary,
        candidates=[sample_classified_transactions[0]],
        needs_review=[sample_classified_transactions[1]],
        excluded=sample_excluded_transactions,
        audit_trail=sample_audit_trail,
    )


class TestReportGenerator:
    """Test suite for ReportGenerator class."""
    
    def test_aggregate_report_data(self, sample_classified_transactions, sample_excluded_transactions, sample_audit_trail):
        """Test report data aggregation."""
        generator = ReportGenerator(confidence_threshold=0.60)
        
        report_data = generator.aggregate_report_data(
            candidates=sample_classified_transactions,
            excluded=sample_excluded_transactions,
            audit_trail=sample_audit_trail,
            income_year="2023-2024"
        )
        
        # Verify income year
        assert report_data.income_year == "2023-2024"
        
        # Verify candidates are separated correctly
        assert len(report_data.candidates) == 1  # High confidence (0.95)
        assert len(report_data.needs_review) == 1  # Low confidence (0.55)
        
        # Verify summary totals
        assert report_data.summary.total_deductible == Decimal("79.99")
        assert report_data.summary.total_needs_review == Decimal("145.50")
        assert report_data.summary.total_excluded == Decimal("500.00")
        
        # Verify category totals
        assert "work_software" in report_data.summary.category_totals
        assert "work_equipment" in report_data.summary.category_totals
    
    def test_confidence_distribution_calculation(self, sample_classified_transactions):
        """Test confidence distribution calculation."""
        generator = ReportGenerator()
        
        # Add more transactions with different confidence levels
        high_conf = ClassifiedTransaction(
            transaction=sample_classified_transactions[0].transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.85,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="test",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )
        
        medium_conf = ClassifiedTransaction(
            transaction=sample_classified_transactions[1].transaction,
            category=DeductionCategory.WORK_EQUIPMENT,
            confidence=0.70,
            matched_rule_id="R002",
            matched_rule_version="1.0",
            reason="test",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )
        
        low_conf = ClassifiedTransaction(
            transaction=sample_classified_transactions[0].transaction,
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.45,
            matched_rule_id="R003",
            matched_rule_version="1.0",
            reason="test",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )
        
        distribution = generator._calculate_confidence_distribution([high_conf, medium_conf, low_conf])
        
        assert distribution["high"] == 1  # >= 0.80
        assert distribution["medium"] == 1  # >= 0.60 and < 0.80
        assert distribution["low"] == 1  # < 0.60
    
    def test_generate_csv(self, sample_report_data):
        """Test CSV export generation."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "deductions.csv"
            generator.generate_csv(sample_report_data, str(csv_path))
            
            # Verify file was created
            assert csv_path.exists()
            
            # Read and verify CSV contents
            with open(csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)
            
            # Should have 2 rows (1 candidate + 1 needs_review)
            assert len(rows) == 2
            
            # Verify first row (high confidence candidate)
            row1 = rows[0]
            assert row1['date'] == '15/08/2023'
            assert row1['merchant'] == 'Adobe'
            assert row1['amount'] == '79.99'
            assert row1['category'] == 'work_software'
            assert row1['confidence'] == '0.95'
            assert 'receipt' in row1['evidence_needed'].lower()
            
            # Verify second row (needs review)
            row2 = rows[1]
            assert row2['date'] == '20/09/2023'
            assert row2['merchant'] == 'Officeworks'
            assert row2['amount'] == '145.50'
            assert 'needs_review' in row2['flags']
    
    def test_generate_audit_trail(self, sample_report_data):
        """Test JSON audit trail export."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "audit_trail.json"
            generator.generate_audit_trail(sample_report_data, str(json_path))
            
            # Verify file was created
            assert json_path.exists()
            
            # Read and verify JSON contents
            with open(json_path, 'r', encoding='utf-8') as jsonfile:
                audit_data = json.load(jsonfile)
            
            # Verify structure
            assert audit_data['income_year'] == '2023-2024'
            assert 'generated_at' in audit_data
            assert 'transactions' in audit_data
            
            # Verify transaction entries
            assert len(audit_data['transactions']) == 1
            entry = audit_data['transactions'][0]
            assert entry['transaction_id'] == 'test-id-1'
            assert 'normalisation' in entry
            assert 'exclusion_checks' in entry
            assert 'classification_attempts' in entry
            assert 'final_result' in entry
    
    def test_generate_html_report(self, sample_report_data):
        """Test HTML report generation for PDF."""
        generator = ReportGenerator()
        
        html_content = generator._generate_html_report(sample_report_data)
        
        # Verify HTML structure
        assert '<!DOCTYPE html>' in html_content
        assert '<html>' in html_content
        assert '</html>' in html_content
        
        # Verify header section
        assert 'Tax Deduction Report' in html_content
        assert '2023-2024' in html_content
        assert '1 July' in html_content and '30 June' in html_content

        # Verify disclaimer
        assert 'Important' in html_content
        assert 'likely deductible' in html_content.lower()

        # Verify summary section
        assert 'Summary' in html_content
        assert '79.99' in html_content  # Total deductible
        assert '145.50' in html_content  # Needs review

        # Verify candidates section
        assert 'Likely Deductible Items' in html_content
        assert 'Adobe' in html_content
        
        # Verify needs review section
        assert 'Needs Review' in html_content
        assert 'Officeworks' in html_content
        
        # Verify excluded section
        assert 'Excluded Items' in html_content
        assert 'Transfer' in html_content
        
        # Verify footer
        assert 'Record Retention' in html_content
        assert 'five years' in html_content.lower()
        assert 'Substantiation' in html_content
        assert '$300' in html_content
    
    def test_html_escaping(self):
        """Test HTML special character escaping."""
        generator = ReportGenerator()
        
        # Test various special characters
        assert generator._escape_html('Test & Co') == 'Test &amp; Co'
        assert generator._escape_html('Price < $100') == 'Price &lt; $100'
        assert generator._escape_html('Value > 50') == 'Value &gt; 50'
        assert generator._escape_html('Say "hello"') == 'Say &quot;hello&quot;'
        assert generator._escape_html("It's fine") == 'It&#39;s fine'
    
    def test_empty_report_sections(self):
        """Test report generation with empty sections."""
        generator = ReportGenerator()
        
        # Create report with no needs_review or excluded items
        summary = ReportSummary(
            total_deductible=Decimal("100.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={"work_software": Decimal("100.00")},
            confidence_distribution={"high": 1, "medium": 0, "low": 0},
        )
        
        report_data = ReportData(
            income_year="2023-2024",
            generated_at=datetime.now(),
            summary=summary,
            candidates=[],
            needs_review=[],
            excluded=[],
            audit_trail=[],
        )
        
        html_content = generator._generate_html_report(report_data)
        
        # Should still have all main sections
        assert 'Summary' in html_content
        assert 'Tax Deduction Report' in html_content
        
        # Should handle empty candidates gracefully
        assert 'No high-confidence deduction candidates found' in html_content or 'Likely Deductible Candidates' in html_content
    
    def test_csv_formatting_consistency(self, sample_report_data):
        """Test CSV date and amount formatting consistency."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "deductions.csv"
            generator.generate_csv(sample_report_data, str(csv_path))
            
            with open(csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)
            
            for row in rows:
                # Verify date format (DD/MM/YYYY)
                assert '/' in row['date']
                date_parts = row['date'].split('/')
                assert len(date_parts) == 3
                
                # Verify amount format (decimal with 2 places)
                amount = row['amount']
                assert '.' in amount
                decimal_places = len(amount.split('.')[1])
                assert decimal_places == 2
                
                # Verify confidence format (decimal with 2 places)
                confidence = row['confidence']
                assert '.' in confidence
                conf_decimal_places = len(confidence.split('.')[1])
                assert conf_decimal_places == 2
    
    def test_audit_trail_determinism(self, sample_report_data):
        """Test that audit trail export is deterministic."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path1 = Path(tmpdir) / "audit1.json"
            json_path2 = Path(tmpdir) / "audit2.json"
            
            # Generate twice
            generator.generate_audit_trail(sample_report_data, str(json_path1))
            generator.generate_audit_trail(sample_report_data, str(json_path2))
            
            # Read both files
            with open(json_path1, 'r', encoding='utf-8') as f1:
                content1 = f1.read()
            with open(json_path2, 'r', encoding='utf-8') as f2:
                content2 = f2.read()
            
            # Content should be identical (except for generated_at timestamp)
            # Parse JSON and compare structure
            data1 = json.loads(content1)
            data2 = json.loads(content2)
            
            assert data1['income_year'] == data2['income_year']
            assert data1['transactions'] == data2['transactions']
    
    def test_generate_pdf(self, sample_report_data):
        """Test PDF generation with sample data."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            pdf_path = Path(tmpdir) / "deduction_report.pdf"
            
            try:
                generator.generate_pdf(sample_report_data, str(pdf_path))
            except OSError as e:
                # WeasyPrint requires system libraries (GTK) that may not be installed
                if 'libgobject' in str(e) or 'libcairo' in str(e) or 'libpango' in str(e):
                    pytest.skip(f"WeasyPrint system dependencies not available: {e}")
                raise
            
            # Verify file was created
            assert pdf_path.exists()
            
            # Verify file is not empty
            assert pdf_path.stat().st_size > 0
            
            # Verify file starts with PDF header
            with open(pdf_path, 'rb') as pdffile:
                header = pdffile.read(4)
                assert header == b'%PDF'
    
    def test_pdf_required_sections(self, sample_report_data):
        """Verify all required sections are present in PDF HTML."""
        generator = ReportGenerator()
        
        html_content = generator._generate_html_report(sample_report_data)
        
        # Requirement 8.2: Income year period
        assert '2023-2024' in html_content
        assert '1 July' in html_content and '30 June' in html_content
        
        # Requirement 8.3: Summary totals by category and grand total
        assert 'Summary' in html_content
        assert '79.99' in html_content  # Total deductible
        assert 'work_software' in html_content or 'Work Software' in html_content
        
        # Requirement 8.4: Line item table with required columns
        assert 'Date' in html_content
        assert 'Merchant' in html_content
        assert 'Description' in html_content
        assert 'Amount' in html_content
        assert 'Category' in html_content
        assert 'Confidence' in html_content
        assert 'Evidence' in html_content or 'Evidence Needed' in html_content
        
        # Requirement 8.5: Needs Review section
        assert 'Needs Review' in html_content
        
        # Requirement 8.6: Excluded Items section
        assert 'Excluded' in html_content
        
        # Requirement 8.7: "Likely deductible" language
        assert 'likely deductible' in html_content.lower()
        
        # Requirement 8.8: Record retention guidance
        assert 'five years' in html_content.lower() or '5 years' in html_content.lower()
        assert 'record' in html_content.lower()
    
    def test_csv_all_required_columns(self, sample_report_data):
        """Test CSV contains all required columns."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "deductions.csv"
            generator.generate_csv(sample_report_data, str(csv_path))
            
            with open(csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                headers = reader.fieldnames
            
            # Verify all required columns are present
            required_columns = [
                'date', 'merchant', 'description', 'amount',
                'category', 'confidence', 'reason', 'evidence_needed', 'flags'
            ]
            
            for col in required_columns:
                assert col in headers, f"Missing required column: {col}"
    
    def test_json_audit_trail_structure(self, sample_report_data):
        """Test JSON audit trail has correct structure."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "audit_trail.json"
            generator.generate_audit_trail(sample_report_data, str(json_path))
            
            with open(json_path, 'r', encoding='utf-8') as jsonfile:
                audit_data = json.load(jsonfile)
            
            # Verify top-level structure
            assert 'income_year' in audit_data
            assert 'generated_at' in audit_data
            assert 'transactions' in audit_data
            
            # Verify transaction entry structure
            if len(audit_data['transactions']) > 0:
                entry = audit_data['transactions'][0]
                assert 'transaction_id' in entry
                assert 'normalisation' in entry
                assert 'exclusion_checks' in entry
                assert 'classification_attempts' in entry
                assert 'final_result' in entry
                
                # Verify normalisation contains expected fields
                assert isinstance(entry['normalisation'], dict)
                
                # Verify exclusion_checks is a list
                assert isinstance(entry['exclusion_checks'], list)
                
                # Verify classification_attempts is a list
                assert isinstance(entry['classification_attempts'], list)
                
                # Verify final_result contains expected fields
                assert isinstance(entry['final_result'], dict)
    
    def test_pdf_with_multiple_categories(self):
        """Test PDF generation with multiple deduction categories."""
        generator = ReportGenerator()
        
        # Create transactions across multiple categories
        transactions = [
            ClassifiedTransaction(
                transaction=NormalisedTransaction(
                    date=date(2023, 8, 15),
                    description="ADOBE CREATIVE CLOUD",
                    merchant="Adobe",
                    direction=TransactionDirection.DEBIT,
                    absolute_amount=Decimal("79.99"),
                    signed_amount=Decimal("-79.99"),
                ),
                category=DeductionCategory.WORK_SOFTWARE,
                confidence=0.95,
                matched_rule_id="R001",
                matched_rule_version="1.0",
                reason="keyword_match: adobe",
                evidence_checklist=[EvidenceType.RECEIPT],
                flags=[],
            ),
            ClassifiedTransaction(
                transaction=NormalisedTransaction(
                    date=date(2023, 9, 20),
                    description="TELSTRA MOBILE",
                    merchant="Telstra",
                    direction=TransactionDirection.DEBIT,
                    absolute_amount=Decimal("89.00"),
                    signed_amount=Decimal("-89.00"),
                ),
                category=DeductionCategory.PHONE_INTERNET,
                confidence=0.75,
                matched_rule_id="R015",
                matched_rule_version="1.0",
                reason="merchant_match: Telstra",
                evidence_checklist=[EvidenceType.RECEIPT, EvidenceType.PERCENTAGE_RECORD],
                flags=["percentage_required"],
            ),
            ClassifiedTransaction(
                transaction=NormalisedTransaction(
                    date=date(2023, 10, 5),
                    description="RED CROSS DONATION",
                    merchant="Red Cross",
                    direction=TransactionDirection.DEBIT,
                    absolute_amount=Decimal("100.00"),
                    signed_amount=Decimal("-100.00"),
                ),
                category=DeductionCategory.DONATIONS,
                confidence=0.90,
                matched_rule_id="R020",
                matched_rule_version="1.0",
                reason="keyword_match: donation",
                evidence_checklist=[EvidenceType.RECEIPT, EvidenceType.ELIGIBILITY_CHECK],
                flags=[],
            ),
        ]
        
        report_data = generator.aggregate_report_data(
            candidates=transactions,
            excluded=[],
            audit_trail=[],
            income_year="2023-2024"
        )
        
        html_content = generator._generate_html_report(report_data)
        
        # Verify all categories are present
        assert 'work_software' in html_content.lower() or 'software' in html_content.lower()
        assert 'phone' in html_content.lower() or 'internet' in html_content.lower()
        assert 'donation' in html_content.lower()
        
        # Verify category totals
        assert '79.99' in html_content
        assert '89.00' in html_content
        assert '100.00' in html_content
    
    def test_csv_evidence_formatting(self, sample_report_data):
        """Test CSV evidence checklist formatting."""
        generator = ReportGenerator()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            csv_path = Path(tmpdir) / "deductions.csv"
            generator.generate_csv(sample_report_data, str(csv_path))
            
            with open(csv_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                rows = list(reader)
            
            # Verify evidence is formatted as readable text
            for row in rows:
                evidence = row['evidence_needed']
                assert evidence  # Should not be empty
                # Should be comma-separated or similar readable format
                assert isinstance(evidence, str)


class TestPrivacyAndTermsSection:
    """Cover the privacy policy + terms of use section added to the PDF."""

    def test_privacy_terms_section_is_included_in_full_report(self, sample_report_data):
        generator = ReportGenerator()
        html = generator._generate_html_report(sample_report_data)

        assert "Privacy Policy" in html
        assert "Terms of Use" in html

    def test_privacy_section_mentions_ephemeral_processing(self):
        generator = ReportGenerator()
        html = generator._generate_privacy_terms_section()

        assert "ephemeral" in html.lower()
        assert "deleted" in html.lower()
        # Should explicitly say nothing is stored
        assert "not" in html.lower()

    def test_privacy_section_states_no_account_or_third_party_sharing(self):
        generator = ReportGenerator()
        html = generator._generate_privacy_terms_section()

        # No-account and no-third-party commitments are load-bearing promises
        assert "No account" in html or "no account" in html.lower()
        assert "third" in html.lower()  # no third-party sharing clause
        assert "redact" in html.lower()  # redaction mentioned

    def test_terms_section_includes_not_tax_advice_disclaimer(self):
        generator = ReportGenerator()
        html = generator._generate_privacy_terms_section()

        assert "Not tax advice" in html or "not tax advice" in html.lower()
        assert "registered tax agent" in html.lower()

    def test_terms_section_includes_liability_and_acceptable_use(self):
        generator = ReportGenerator()
        html = generator._generate_privacy_terms_section()

        assert "liability" in html.lower()
        assert "acceptable use" in html.lower() or "Acceptable use" in html

    def test_privacy_terms_section_is_on_its_own_page(self):
        # The section should be preceded by a page-break so it prints as an appendix
        generator = ReportGenerator()
        html = generator._generate_privacy_terms_section()
        assert 'page-break' in html


class TestSummaryHighlightCard:
    """Cover the highlighted 'Likely Deductible' summary card and item counts."""

    def test_summary_has_highlight_card_class(self, sample_report_data):
        generator = ReportGenerator()
        html = generator._generate_html_report(sample_report_data)
        assert 'highlight-card' in html

    def test_summary_cards_show_item_counts(self, sample_report_data):
        """Each summary card should show how many items it covers."""
        generator = ReportGenerator()
        html = generator._generate_html_report(sample_report_data)

        # sample_report_data has 1 candidate + 1 needs_review + 1 excluded
        assert '1 high-confidence item' in html
        # needs_review and excluded both show "1 item"
        assert html.count('1 item') >= 2

    def test_summary_cards_pluralise_correctly(self):
        """Multiple items should render as 'items' (plural)."""
        generator = ReportGenerator()

        summary = ReportSummary(
            total_deductible=Decimal("200.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={"work_software": Decimal("200.00")},
            confidence_distribution={"high": 2, "medium": 0, "low": 0},
        )

        t1 = ClassifiedTransaction(
            transaction=NormalisedTransaction(
                date=date(2023, 8, 15),
                description="ADOBE",
                merchant="Adobe",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("100.00"),
                signed_amount=Decimal("-100.00"),
            ),
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.95,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match: adobe",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )
        t2 = ClassifiedTransaction(
            transaction=NormalisedTransaction(
                date=date(2023, 8, 16),
                description="FIGMA",
                merchant="Figma",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("100.00"),
                signed_amount=Decimal("-100.00"),
            ),
            category=DeductionCategory.WORK_SOFTWARE,
            confidence=0.92,
            matched_rule_id="R001",
            matched_rule_version="1.0",
            reason="keyword_match: figma",
            evidence_checklist=[EvidenceType.RECEIPT],
            flags=[],
        )

        report = ReportData(
            income_year="2023-2024",
            generated_at=datetime(2024, 1, 15, 10, 30, 0),
            summary=summary,
            candidates=[t1, t2],
            needs_review=[],
            excluded=[],
            audit_trail=[],
        )

        html = generator._generate_html_report(report)
        assert '2 high-confidence items' in html

    def test_summary_cards_handle_zero_items(self):
        """Empty buckets should still render without errors and use singular form."""
        generator = ReportGenerator()

        summary = ReportSummary(
            total_deductible=Decimal("0.00"),
            total_needs_review=Decimal("0.00"),
            total_excluded=Decimal("0.00"),
            category_totals={},
            confidence_distribution={"high": 0, "medium": 0, "low": 0},
        )
        report = ReportData(
            income_year="2023-2024",
            generated_at=datetime(2024, 1, 15),
            summary=summary,
            candidates=[],
            needs_review=[],
            excluded=[],
            audit_trail=[],
        )
        html = generator._generate_html_report(report)
        assert '0 high-confidence item' in html
        assert '0 item' in html
