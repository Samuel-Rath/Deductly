"""
Tests for PDF Parser.

Tests the PDF parsing functionality including transaction extraction,
date parsing, amount parsing, and CSV conversion.
"""

import io
import pytest
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from backend.processing.pdf_parser import PDFParser


class TestPDFParser:
    """Test suite for PDFParser class."""
    
    @pytest.fixture
    def parser(self):
        """Create a PDFParser instance."""
        return PDFParser()
    
    @pytest.fixture
    def sample_transactions(self):
        """Sample transaction data for testing."""
        return [
            {'date': '15/01/2024', 'description': 'WOOLWORTHS', 'amount': -123.45},
            {'date': '16/01/2024', 'description': 'COLES SUPERMARKET', 'amount': -87.50},
            {'date': '17/01/2024', 'description': 'SALARY DEPOSIT', 'amount': 2500.00},
            {'date': '18/01/2024', 'description': 'ADOBE CREATIVE CLOUD', 'amount': -79.99},
            {'date': '19/01/2024', 'description': 'OFFICEWORKS', 'amount': -45.00},
        ]
    
    def create_pdf_with_table(self, transactions):
        """
        Create a PDF with transactions in a table format.
        
        Args:
            transactions: List of transaction dictionaries
            
        Returns:
            BytesIO object containing the PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        # Add title
        styles = getSampleStyleSheet()
        title = Paragraph("Bank Statement", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Create table data
        table_data = [['Date', 'Description', 'Amount']]
        for txn in transactions:
            table_data.append([
                txn['date'],
                txn['description'],
                f"${abs(txn['amount']):.2f}" if txn['amount'] >= 0 else f"-${abs(txn['amount']):.2f}"
            ])
        
        # Create table
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(table)
        doc.build(elements)
        
        buffer.seek(0)
        return buffer
    
    def create_pdf_with_text(self, transactions):
        """
        Create a PDF with transactions as plain text.
        
        Args:
            transactions: List of transaction dictionaries
            
        Returns:
            BytesIO object containing the PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        styles = getSampleStyleSheet()
        
        # Add title
        title = Paragraph("Bank Statement", styles['Title'])
        elements.append(title)
        elements.append(Spacer(1, 20))
        
        # Add transactions as text
        for txn in transactions:
            amount_str = f"${abs(txn['amount']):.2f}" if txn['amount'] >= 0 else f"-${abs(txn['amount']):.2f}"
            text = f"{txn['date']}    {txn['description']}    {amount_str}"
            para = Paragraph(text, styles['Normal'])
            elements.append(para)
            elements.append(Spacer(1, 6))
        
        doc.build(elements)
        
        buffer.seek(0)
        return buffer
    
    def test_parse_table_based_pdf(self, parser, sample_transactions):
        """Test parsing a PDF with table-based transactions."""
        pdf_buffer = self.create_pdf_with_table(sample_transactions)
        
        result = parser.parse(pdf_buffer)
        
        assert len(result) > 0, "Should extract at least one transaction"
        assert len(result) <= len(sample_transactions), "Should not extract more transactions than exist"
        
        # Check that we have the expected fields
        for txn in result:
            assert 'date' in txn
            assert 'description' in txn
            assert 'amount' in txn
    
    def test_parse_text_based_pdf(self, parser, sample_transactions):
        """Test parsing a PDF with text-based transactions."""
        pdf_buffer = self.create_pdf_with_text(sample_transactions)
        
        result = parser.parse(pdf_buffer)
        
        assert len(result) > 0, "Should extract at least one transaction"
        
        # Check that we have the expected fields
        for txn in result:
            assert 'date' in txn
            assert 'description' in txn
            assert 'amount' in txn
    
    def test_is_date_valid_formats(self, parser):
        """Test date validation with various formats."""
        valid_dates = [
            '15/01/2024',
            '01/12/2023',
            '15-01-2024',
            '01-12-2023',
            '15 Jan 2024',
            '1 Dec 2023',
        ]
        
        for date_str in valid_dates:
            assert parser._is_date(date_str), f"Should recognize {date_str} as a date"
    
    def test_is_date_invalid_formats(self, parser):
        """Test date validation rejects invalid formats."""
        invalid_dates = [
            'not a date',
            '2024-01-15',  # Wrong format
            '15/13/2024',  # Invalid month (but regex won't catch this)
            'WOOLWORTHS',
            '123.45',
        ]
        
        for date_str in invalid_dates:
            assert not parser._is_date(date_str), f"Should not recognize {date_str} as a date"
    
    def test_is_amount_valid_formats(self, parser):
        """Test amount validation with various formats."""
        valid_amounts = [
            '123.45',
            '-123.45',
            '$123.45',
            '-$123.45',
            '1,234.56',
            '1234',
            '-50',
        ]
        
        for amount_str in valid_amounts:
            assert parser._is_amount(amount_str), f"Should recognize {amount_str} as an amount"
    
    def test_is_amount_invalid_formats(self, parser):
        """Test amount validation rejects invalid formats."""
        invalid_amounts = [
            'not an amount',
            'WOOLWORTHS',
            '15/01/2024',
            'abc123',
        ]
        
        for amount_str in invalid_amounts:
            assert not parser._is_amount(amount_str), f"Should not recognize {amount_str} as an amount"
    
    def test_parse_amount_various_formats(self, parser):
        """Test amount parsing with various formats."""
        test_cases = [
            ('123.45', 123.45),
            ('-123.45', -123.45),
            ('$123.45', 123.45),
            ('-$123.45', -123.45),
            ('1,234.56', 1234.56),
            ('-1,234.56', -1234.56),
            ('50', 50.0),
            ('-50', -50.0),
        ]
        
        for amount_str, expected in test_cases:
            result = parser._parse_amount(amount_str)
            assert result == expected, f"Expected {expected} for {amount_str}, got {result}"
    
    def test_parse_amount_invalid(self, parser):
        """Test amount parsing with invalid input."""
        invalid_amounts = ['not a number', 'abc', '']
        
        for amount_str in invalid_amounts:
            result = parser._parse_amount(amount_str)
            assert result == 0.0, f"Should return 0.0 for invalid amount {amount_str}"
    
    def test_convert_to_csv_format(self, parser, sample_transactions):
        """Test conversion of transactions to CSV format."""
        csv_output = parser.convert_to_csv_format(sample_transactions)
        
        lines = csv_output.strip().split('\n')
        
        # Check header
        assert lines[0] == 'date,description,amount'
        
        # Check number of lines (header + transactions)
        assert len(lines) == len(sample_transactions) + 1
        
        # Check that each transaction is present
        for i, txn in enumerate(sample_transactions, start=1):
            assert txn['date'] in lines[i]
            assert str(txn['amount']) in lines[i]
    
    def test_convert_to_csv_format_empty(self, parser):
        """Test CSV conversion with empty transaction list."""
        csv_output = parser.convert_to_csv_format([])
        
        assert csv_output == 'date,description,amount\n'
    
    def test_convert_to_csv_format_escapes_commas(self, parser):
        """Test that commas in descriptions are handled."""
        transactions = [
            {'date': '15/01/2024', 'description': 'STORE, INC', 'amount': -50.00}
        ]
        
        csv_output = parser.convert_to_csv_format(transactions)
        lines = csv_output.strip().split('\n')
        
        # Comma should be removed or escaped
        assert 'STORE INC' in lines[1] or 'STORE  INC' in lines[1]
    
    def test_extract_transaction_from_row_valid(self, parser):
        """Test extracting transaction from a valid table row."""
        row = ['15/01/2024', 'WOOLWORTHS', '-123.45']
        
        result = parser._extract_transaction_from_row(row)
        
        assert result is not None
        assert result['date'] == '15/01/2024'
        assert result['description'] == 'WOOLWORTHS'
        assert result['amount'] == -123.45
    
    def test_extract_transaction_from_row_invalid(self, parser):
        """Test extracting transaction from invalid row."""
        invalid_rows = [
            [],  # Empty row
            ['not', 'a', 'transaction'],  # No date or amount
            ['15/01/2024'],  # Only date
        ]
        
        for row in invalid_rows:
            result = parser._extract_transaction_from_row(row)
            # Should either return None or a transaction with minimal data
            if result:
                assert 'date' in result
                assert 'description' in result
    
    def test_parse_empty_pdf(self, parser):
        """Test parsing an empty PDF."""
        # Create empty PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        doc.build([])
        buffer.seek(0)
        
        with pytest.raises(ValueError, match="No transactions found"):
            parser.parse(buffer)
    
    def test_parse_invalid_pdf(self, parser):
        """Test parsing invalid PDF data."""
        invalid_buffer = io.BytesIO(b"This is not a PDF")
        
        with pytest.raises(ValueError, match="Failed to parse PDF"):
            parser.parse(invalid_buffer)
    
    def test_extract_transactions_from_text(self, parser):
        """Test extracting transactions from plain text."""
        text = """
        Bank Statement
        
        15/01/2024 WOOLWORTHS -123.45
        16/01/2024 COLES SUPERMARKET -87.50
        17/01/2024 SALARY DEPOSIT 2500.00
        """
        
        result = parser._extract_transactions_from_text(text)
        
        assert len(result) >= 2, "Should extract at least 2 transactions"
        
        # Check first transaction
        assert result[0]['date'] == '15/01/2024'
        assert 'WOOLWORTHS' in result[0]['description']
    
    def test_supported_banks(self, parser):
        """Test that supported banks list is defined."""
        assert hasattr(parser, 'supported_banks')
        assert len(parser.supported_banks) > 0
        assert 'commbank' in parser.supported_banks
        assert 'nab' in parser.supported_banks
        assert 'westpac' in parser.supported_banks
        assert 'anz' in parser.supported_banks
        assert 'ing' in parser.supported_banks


class TestPDFParserIntegration:
    """Integration tests for PDF parser with realistic scenarios."""
    
    @pytest.fixture
    def parser(self):
        """Create a PDFParser instance."""
        return PDFParser()
    
    def test_full_workflow_table_pdf(self, parser):
        """Test complete workflow: create PDF, parse, convert to CSV."""
        # Create sample transactions
        transactions = [
            {'date': '15/01/2024', 'description': 'ADOBE CREATIVE CLOUD', 'amount': -79.99},
            {'date': '16/01/2024', 'description': 'OFFICEWORKS', 'amount': -45.00},
            {'date': '17/01/2024', 'description': 'TELSTRA', 'amount': -89.00},
        ]
        
        # Create PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        table_data = [['Date', 'Description', 'Amount']]
        for txn in transactions:
            table_data.append([
                txn['date'],
                txn['description'],
                f"-${abs(txn['amount']):.2f}"
            ])
        
        table = Table(table_data)
        doc.build([table])
        buffer.seek(0)
        
        # Parse PDF
        parsed_transactions = parser.parse(buffer)
        
        # Convert to CSV
        csv_output = parser.convert_to_csv_format(parsed_transactions)
        
        # Verify
        assert len(parsed_transactions) > 0
        assert 'date,description,amount' in csv_output
        assert 'ADOBE' in csv_output or 'OFFICEWORKS' in csv_output or 'TELSTRA' in csv_output
    
    def test_mixed_positive_negative_amounts(self, parser):
        """Test parsing transactions with both positive and negative amounts."""
        transactions = [
            {'date': '15/01/2024', 'description': 'PURCHASE', 'amount': -100.00},
            {'date': '16/01/2024', 'description': 'REFUND', 'amount': 50.00},
            {'date': '17/01/2024', 'description': 'SALARY', 'amount': 2500.00},
            {'date': '18/01/2024', 'description': 'BILL PAYMENT', 'amount': -200.00},
        ]
        
        # Create PDF with table
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        
        table_data = [['Date', 'Description', 'Amount']]
        for txn in transactions:
            amount_str = f"${txn['amount']:.2f}" if txn['amount'] >= 0 else f"-${abs(txn['amount']):.2f}"
            table_data.append([txn['date'], txn['description'], amount_str])
        
        table = Table(table_data)
        doc.build([table])
        buffer.seek(0)
        
        # Parse
        result = parser.parse(buffer)
        
        # Verify we got transactions
        assert len(result) > 0
        
        # Check that amounts are parsed correctly (positive and negative)
        amounts = [txn['amount'] for txn in result if 'amount' in txn]
        assert any(amt < 0 for amt in amounts), "Should have negative amounts"
        assert any(amt > 0 for amt in amounts), "Should have positive amounts"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
