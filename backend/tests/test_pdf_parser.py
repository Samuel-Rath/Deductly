"""
Tests for PDF Parser.

Exercises the state-machine parser, transaction normalisation, date/amount
extraction, description cleaning, disclaimer filtering, and the full parse
pipeline against reportlab-generated PDFs.
"""

import io
from datetime import date
from decimal import Decimal

import pytest
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from backend.processing.pdf_parser import PDFParser
from backend.models.schemas import NormalisedTransaction, TransactionDirection


# ---------------------------------------------------------------------------
# Helpers for building PDFs on the fly
# ---------------------------------------------------------------------------

def _pdf_from_text_lines(lines):
    """Build a minimal PDF with one paragraph per line."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = [Paragraph("Bank Statement", styles["Title"]), Spacer(1, 12)]
    for line in lines:
        elements.append(Paragraph(line, styles["Normal"]))
        elements.append(Spacer(1, 4))
    doc.build(elements)
    buffer.seek(0)
    return buffer


def _pdf_from_table(rows):
    """Build a minimal PDF containing a single table."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = [Table(rows)]
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ---------------------------------------------------------------------------
# Unit tests — parser internals
# ---------------------------------------------------------------------------

class TestPDFParserInternals:
    @pytest.fixture
    def parser(self):
        return PDFParser()

    @pytest.mark.parametrize("date_str,expected", [
        ("15/01/2024", date(2024, 1, 15)),
        ("01-12-2023", date(2023, 12, 1)),
        ("15 Jan 2024", date(2024, 1, 15)),
        ("1 Dec 2023", date(2023, 12, 1)),
        ("15/01/24", date(2024, 1, 15)),
    ])
    def test_parse_date_valid(self, parser, date_str, expected):
        assert parser._parse_date(date_str) == expected

    @pytest.mark.parametrize("date_str", [
        "not a date",
        "2024-01-15",      # ISO isn't in the supported list
        "15/13/2024",      # invalid month
        "WOOLWORTHS",
    ])
    def test_parse_date_invalid(self, parser, date_str):
        with pytest.raises(ValueError):
            parser._parse_date(date_str)

    def test_extract_amount_single_debit(self, parser):
        txn = {"description": "WOOLWORTHS SYDNEY $123.45"}
        parser._extract_amount_from_description(txn)
        assert txn["amount"] == -123.45
        assert "WOOLWORTHS" in txn["description"]
        assert "$" not in txn["description"]

    def test_extract_amount_credit_keyword(self, parser):
        txn = {"description": "SALARY DEPOSIT $2,500.00"}
        parser._extract_amount_from_description(txn)
        assert txn["amount"] == 2500.00
        assert "SALARY" in txn["description"]

    def test_extract_amount_uses_second_last_for_running_balance(self, parser):
        # Bank PDFs typically print "txn_amount  running_balance" — the last
        # monetary value is the balance and must be discarded.
        txn = {"description": "COLES $87.50 4,912.50"}
        parser._extract_amount_from_description(txn)
        assert txn["amount"] == -87.50

    def test_extract_amount_none_found(self, parser):
        txn = {"description": "NO MONEY HERE"}
        parser._extract_amount_from_description(txn)
        assert txn["amount"] == 0

    def test_extract_amount_handles_comma_thousands(self, parser):
        txn = {"description": "BIG PURCHASE $1,234.56"}
        parser._extract_amount_from_description(txn)
        assert txn["amount"] == -1234.56

    def test_clean_description_strips_nab_card_prefix(self, parser):
        assert parser._clean_pdf_description("V3737 APPLE.COM SYDNEY") == "APPLE.COM SYDNEY"

    def test_clean_description_strips_embedded_date(self, parser):
        assert parser._clean_pdf_description("13/11 APPLE.COM SYDNEY") == "APPLE.COM SYDNEY"

    def test_clean_description_strips_trailing_card_suffix(self, parser):
        assert parser._clean_pdf_description("APPLE.COM SYDNEY V3737") == "APPLE.COM SYDNEY"

    def test_is_disclaimer_line_detects_multi_phrase(self, parser):
        line = "NATIONAL AUSTRALIA BANK — Australian Credit Licence 123"
        assert parser._is_disclaimer_line(line) is True

    def test_is_disclaimer_line_single_phrase_is_not_disclaimer(self, parser):
        # Requires >= 2 matches
        assert parser._is_disclaimer_line("Provisional list of transactions") is False

    def test_is_disclaimer_line_ignores_normal_text(self, parser):
        assert parser._is_disclaimer_line("WOOLWORTHS SYDNEY $45.00") is False

    def test_supported_banks_contains_major_banks(self, parser):
        assert set(parser.supported_banks) >= {
            "commbank", "nab", "westpac", "anz", "ing"
        }


# ---------------------------------------------------------------------------
# State machine tests
# ---------------------------------------------------------------------------

class TestStateMachine:
    @pytest.fixture
    def parser(self):
        return PDFParser()

    def test_parses_multiple_transactions(self, parser):
        text = (
            "Bank Statement\n"
            "15/01/2024 WOOLWORTHS SYDNEY $123.45 5,000.00\n"
            "16/01/2024 COLES SUPERMARKET $87.50 4,912.50\n"
            "17/01/2024 SALARY DEPOSIT $2,500.00 7,412.50\n"
        )
        txns = parser._parse_with_state_machine(text)
        assert len(txns) == 3
        assert all(isinstance(t, NormalisedTransaction) for t in txns)

    def test_debit_credit_classification(self, parser):
        text = (
            "15/01/2024 WOOLWORTHS SYDNEY $123.45 5,000.00\n"
            "17/01/2024 SALARY DEPOSIT $2,500.00 7,412.50\n"
        )
        txns = parser._parse_with_state_machine(text)
        by_desc = {t.description: t for t in txns}
        assert by_desc["WOOLWORTHS SYDNEY"].direction == TransactionDirection.DEBIT
        assert by_desc["WOOLWORTHS SYDNEY"].signed_amount < 0
        assert by_desc["SALARY DEPOSIT"].direction == TransactionDirection.CREDIT
        assert by_desc["SALARY DEPOSIT"].signed_amount > 0

    def test_multi_line_description_is_accumulated(self, parser):
        text = (
            "15/01/2024 APPLE.COM\n"
            "SYDNEY NSW $79.99 1,200.00\n"
        )
        txns = parser._parse_with_state_machine(text)
        assert len(txns) == 1
        assert "APPLE.COM" in txns[0].description
        assert "SYDNEY" in txns[0].description
        assert txns[0].absolute_amount == Decimal("79.99")

    def test_skips_header_lines(self, parser):
        text = (
            "DATE PARTICULARS DEBITS CREDITS BALANCE\n"
            "OPENING BALANCE 0.00\n"
            "15/01/2024 WOOLWORTHS $50.00 4,950.00\n"
            "CLOSING BALANCE 4,950.00\n"
        )
        txns = parser._parse_with_state_machine(text)
        assert len(txns) == 1
        assert txns[0].absolute_amount == Decimal("50.00")

    def test_skips_disclaimer_lines_in_description(self, parser):
        text = (
            "15/01/2024 WOOLWORTHS\n"
            "National Australia Bank — Australian Credit Licence 123\n"
            "$50.00 4,950.00\n"
        )
        txns = parser._parse_with_state_machine(text)
        assert len(txns) == 1
        assert "australian credit licence" not in txns[0].description.lower()

    def test_empty_text_returns_empty(self, parser):
        assert parser._parse_with_state_machine("") == []

    def test_date_only_no_amount_is_dropped(self, parser):
        text = "15/01/2024 SOME LINE WITH NO MONEY\n"
        txns = parser._parse_with_state_machine(text)
        assert txns == []

    def test_recurring_detection_does_not_error(self, parser):
        text = (
            "15/01/2024 NETFLIX AUSTRALIA $19.99 1,000.00\n"
            "15/02/2024 NETFLIX AUSTRALIA $19.99 980.01\n"
            "15/03/2024 NETFLIX AUSTRALIA $19.99 960.02\n"
        )
        txns = parser._parse_with_state_machine(text)
        assert len(txns) == 3


# ---------------------------------------------------------------------------
# Integration tests — parse() against real PDFs
# ---------------------------------------------------------------------------

class TestPDFParserIntegration:
    @pytest.fixture
    def parser(self):
        return PDFParser()

    def test_parse_text_based_pdf(self, parser):
        pdf = _pdf_from_text_lines([
            "15/01/2024 ADOBE CREATIVE CLOUD $79.99 5,000.00",
            "16/01/2024 OFFICEWORKS $45.00 4,955.00",
            "17/01/2024 TELSTRA $89.00 4,866.00",
        ])
        txns = parser.parse(pdf)
        assert len(txns) >= 1
        assert all(isinstance(t, NormalisedTransaction) for t in txns)
        descs = " ".join(t.description for t in txns).upper()
        assert "ADOBE" in descs or "OFFICEWORKS" in descs or "TELSTRA" in descs

    def test_parse_table_based_pdf(self, parser):
        rows = [["Date", "Description", "Amount"]]
        rows.append(["15/01/2024", "WOOLWORTHS SYDNEY", "$123.45"])
        rows.append(["16/01/2024", "COLES SUPERMARKET", "$87.50"])
        pdf = _pdf_from_table(rows)
        txns = parser.parse(pdf)
        # Table layout is lossy through reportlab → pdfplumber; assert only shape when present.
        for t in txns:
            assert isinstance(t, NormalisedTransaction)
            assert t.absolute_amount > 0

    def test_parse_empty_pdf_raises(self, parser):
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        doc.build([Spacer(1, 1)])
        buffer.seek(0)
        with pytest.raises(ValueError, match="No transactions found|Failed to parse"):
            parser.parse(buffer)

    def test_parse_invalid_pdf_raises(self, parser):
        with pytest.raises(ValueError, match="Failed to parse PDF"):
            parser.parse(io.BytesIO(b"This is not a PDF"))

    def test_mixed_debit_and_credit_pdf(self, parser):
        pdf = _pdf_from_text_lines([
            "15/01/2024 WOOLWORTHS $100.00 5,000.00",
            "16/01/2024 SALARY DEPOSIT $2,500.00 7,500.00",
            "17/01/2024 COLES $50.00 7,450.00",
        ])
        txns = parser.parse(pdf)
        directions = {t.direction for t in txns}
        assert TransactionDirection.DEBIT in directions
        assert TransactionDirection.CREDIT in directions
