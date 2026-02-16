"""
Unit tests for CSV Parser.

Tests CSV format detection, parsing, merchant extraction, payment rail detection,
and recurring transaction detection.

Validates: Requirements 1.1, 1.2, 1.4, 2.2, 2.3, 2.4, 2.5
"""

import pytest
from decimal import Decimal
from datetime import date
from io import BytesIO
from processing.csv_parser import CSVParser, CSVFormat, CSVParseError
from models.schemas import TransactionDirection


class TestCSVFormatDetection:
    """Test CSV format detection and column mapping."""
    
    def test_detect_format_single_amount_column(self):
        """Test detection of CSV with single amount column."""
        csv_content = b"""Date,Description,Amount
15/01/2024,PAYPAL *ADOBE,-29.99
16/01/2024,SALARY DEPOSIT,2500.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        csv_format = parser.detect_format(csv_file)
        
        assert csv_format.date_col == "Date"
        assert csv_format.description_col == "Description"
        assert csv_format.amount_col == "Amount"
        assert csv_format.debit_col is None
        assert csv_format.credit_col is None
    
    def test_detect_format_debit_credit_columns(self):
        """Test detection of CSV with separate debit/credit columns."""
        csv_content = b"""Transaction Date,Details,Debit,Credit
15/01/2024,PAYPAL *ADOBE,29.99,
16/01/2024,SALARY DEPOSIT,,2500.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        csv_format = parser.detect_format(csv_file)
        
        assert csv_format.date_col == "Transaction Date"
        assert csv_format.description_col == "Details"
        assert csv_format.amount_col is None
        assert csv_format.debit_col == "Debit"
        assert csv_format.credit_col == "Credit"
    
    def test_detect_format_case_insensitive(self):
        """Test that column detection is case-insensitive."""
        csv_content = b"""DATE,DESCRIPTION,AMOUNT
15/01/2024,Test transaction,-10.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        csv_format = parser.detect_format(csv_file)
        
        assert csv_format.date_col == "DATE"
        assert csv_format.description_col == "DESCRIPTION"
        assert csv_format.amount_col == "AMOUNT"
    
    def test_detect_format_with_spaces(self):
        """Test detection with column names containing spaces."""
        csv_content = b"""Transaction Date,Transaction Details,Transaction Amount
15/01/2024,Test,-10.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        csv_format = parser.detect_format(csv_file)
        
        assert csv_format.date_col == "Transaction Date"
        assert csv_format.description_col == "Transaction Details"
        assert csv_format.amount_col == "Transaction Amount"
    
    def test_detect_format_missing_date_column(self):
        """Test error when date column is missing."""
        csv_content = b"""Description,Amount
Test transaction,-10.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        with pytest.raises(CSVParseError) as exc_info:
            parser.detect_format(csv_file)
        
        assert "date column" in str(exc_info.value).lower()
    
    def test_detect_format_missing_description_column(self):
        """Test error when description column is missing."""
        csv_content = b"""Date,Amount
15/01/2024,-10.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        with pytest.raises(CSVParseError) as exc_info:
            parser.detect_format(csv_file)
        
        assert "description column" in str(exc_info.value).lower()
    
    def test_detect_format_missing_amount_columns(self):
        """Test error when amount columns are missing."""
        csv_content = b"""Date,Description
15/01/2024,Test transaction
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        with pytest.raises(CSVParseError) as exc_info:
            parser.detect_format(csv_file)
        
        assert "amount columns" in str(exc_info.value).lower()
    
    def test_detect_format_empty_file(self):
        """Test error when CSV file is empty."""
        csv_content = b""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        with pytest.raises(CSVParseError) as exc_info:
            parser.detect_format(csv_file)
        
        assert "empty" in str(exc_info.value).lower()


class TestCSVParsing:
    """Test CSV parsing with various formats."""
    
    def test_parse_single_amount_column_negative(self):
        """Test parsing with single amount column (negative = debit)."""
        csv_content = b"""Date,Description,Amount
15/01/2024,PAYPAL *ADOBE,-29.99
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 1
        txn = transactions[0]
        assert txn.date == date(2024, 1, 15)
        assert txn.description == "PAYPAL *ADOBE"
        assert txn.direction == TransactionDirection.DEBIT
        assert txn.absolute_amount == Decimal("29.99")
        assert txn.signed_amount == Decimal("-29.99")
    
    def test_parse_single_amount_column_positive(self):
        """Test parsing with single amount column (positive = credit)."""
        csv_content = b"""Date,Description,Amount
16/01/2024,SALARY DEPOSIT,2500.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 1
        txn = transactions[0]
        assert txn.date == date(2024, 1, 16)
        assert txn.direction == TransactionDirection.CREDIT
        assert txn.absolute_amount == Decimal("2500.00")
        assert txn.signed_amount == Decimal("2500.00")
    
    def test_parse_debit_credit_columns(self):
        """Test parsing with separate debit/credit columns."""
        csv_content = b"""Date,Description,Debit,Credit
15/01/2024,PAYPAL *ADOBE,29.99,
16/01/2024,SALARY DEPOSIT,,2500.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 2
        
        # Check debit transaction
        debit_txn = transactions[0]
        assert debit_txn.direction == TransactionDirection.DEBIT
        assert debit_txn.absolute_amount == Decimal("29.99")
        assert debit_txn.signed_amount == Decimal("-29.99")
        
        # Check credit transaction
        credit_txn = transactions[1]
        assert credit_txn.direction == TransactionDirection.CREDIT
        assert credit_txn.absolute_amount == Decimal("2500.00")
        assert credit_txn.signed_amount == Decimal("2500.00")
    
    def test_parse_amount_with_currency_symbol(self):
        """Test parsing amounts with currency symbols."""
        csv_content = b"""Date,Description,Amount
15/01/2024,Test transaction,-$29.99
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 1
        assert transactions[0].absolute_amount == Decimal("29.99")
    
    def test_parse_amount_with_thousands_separator(self):
        """Test parsing amounts with thousands separators."""
        csv_content = b"""Date,Description,Amount
15/01/2024,Large payment,"-1,234.56"
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 1
        assert transactions[0].absolute_amount == Decimal("1234.56")
    
    def test_parse_amount_with_parentheses(self):
        """Test parsing amounts with parentheses (accounting format)."""
        csv_content = b"""Date,Description,Amount
15/01/2024,Test transaction,(29.99)
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 1
        assert transactions[0].direction == TransactionDirection.DEBIT
        assert transactions[0].absolute_amount == Decimal("29.99")
        assert transactions[0].signed_amount == Decimal("-29.99")
    
    def test_parse_skip_empty_rows(self):
        """Test that empty rows are skipped."""
        csv_content = b"""Date,Description,Amount
15/01/2024,Test transaction,-10.00
,,
16/01/2024,Another transaction,-20.00
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        csv_format = parser.detect_format(csv_file)
        
        transactions = parser.parse(csv_file, csv_format)
        
        assert len(transactions) == 2
    
    def test_parse_various_date_formats(self):
        """Test parsing various Australian date formats."""
        date_formats = [
            (b"15/01/2024", date(2024, 1, 15)),
            (b"15-01-2024", date(2024, 1, 15)),
            (b"2024-01-15", date(2024, 1, 15)),
        ]
        
        for date_str, expected_date in date_formats:
            csv_content = b"Date,Description,Amount\n" + date_str + b",Test,-10.00\n"
            csv_file = BytesIO(csv_content)
            parser = CSVParser()
            csv_format = parser.detect_format(csv_file)
            
            transactions = parser.parse(csv_file, csv_format)
            
            assert len(transactions) == 1
            assert transactions[0].date == expected_date


class TestMerchantExtraction:
    """Test merchant name extraction logic."""
    
    def test_extract_merchant_paypal_prefix(self):
        """Test extraction of merchant from PayPal transaction."""
        parser = CSVParser()
        
        result = parser.extract_merchant("PAYPAL *ADOBE")
        assert result == "ADOBE"
        
        result = parser.extract_merchant("PAYPAL * SPOTIFY")
        assert result == "SPOTIFY"
    
    def test_extract_merchant_visa_prefix(self):
        """Test extraction of merchant from VISA transaction."""
        parser = CSVParser()
        
        result = parser.extract_merchant("VISA WOOLWORTHS")
        assert result == "WOOLWORTHS"
    
    def test_extract_merchant_mastercard_prefix(self):
        """Test extraction of merchant from Mastercard transaction."""
        parser = CSVParser()
        
        result = parser.extract_merchant("MASTERCARD COLES")
        assert result == "COLES"
    
    def test_extract_merchant_eftpos_prefix(self):
        """Test extraction of merchant from EFTPOS transaction."""
        parser = CSVParser()
        
        result = parser.extract_merchant("EFTPOS BUNNINGS")
        assert result == "BUNNINGS"
    
    def test_extract_merchant_remove_reference_numbers(self):
        """Test removal of reference numbers."""
        parser = CSVParser()
        
        result = parser.extract_merchant("ADOBE *1234")
        assert result == "ADOBE"
        
        result = parser.extract_merchant("SPOTIFY #5678")
        assert result == "SPOTIFY"
        
        result = parser.extract_merchant("NETFLIX REF:9999")
        assert result == "NETFLIX"
    
    def test_extract_merchant_remove_trailing_digits(self):
        """Test removal of trailing transaction IDs."""
        parser = CSVParser()
        
        result = parser.extract_merchant("WOOLWORTHS 12345")
        assert result == "WOOLWORTHS"
    
    def test_extract_merchant_fallback_to_original(self):
        """Test fallback to original description when extraction fails."""
        parser = CSVParser()
        
        # Empty result should return original
        result = parser.extract_merchant("***")
        assert result == "***"
        
        # Very short result should return original
        result = parser.extract_merchant("PAYPAL *A")
        assert result == "PAYPAL *A"
    
    def test_extract_merchant_empty_description(self):
        """Test handling of empty description."""
        parser = CSVParser()
        
        result = parser.extract_merchant("")
        assert result == ""
        
        result = parser.extract_merchant("   ")
        assert result == "   "
    
    def test_extract_merchant_case_insensitive(self):
        """Test that extraction is case-insensitive."""
        parser = CSVParser()
        
        result = parser.extract_merchant("paypal *adobe")
        assert result == "adobe"
        
        result = parser.extract_merchant("VISA woolworths")
        assert result == "woolworths"


class TestPaymentRailDetection:
    """Test payment rail detection logic."""
    
    def test_detect_payment_rail_paypal(self):
        """Test detection of PayPal transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("PAYPAL *ADOBE") == "paypal"
        assert parser.detect_payment_rail("paypal *spotify") == "paypal"
    
    def test_detect_payment_rail_card(self):
        """Test detection of card transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("VISA WOOLWORTHS") == "card"
        assert parser.detect_payment_rail("MASTERCARD COLES") == "card"
        assert parser.detect_payment_rail("EFTPOS BUNNINGS") == "card"
        assert parser.detect_payment_rail("DEBIT CARD PURCHASE") == "card"
    
    def test_detect_payment_rail_bpay(self):
        """Test detection of BPAY transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("BPAY PAYMENT") == "bpay"
        assert parser.detect_payment_rail("bpay telstra") == "bpay"
    
    def test_detect_payment_rail_osko(self):
        """Test detection of Osko transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("OSKO PAYMENT TO JOHN") == "osko"
        assert parser.detect_payment_rail("osko transfer") == "osko"
    
    def test_detect_payment_rail_payid(self):
        """Test detection of PayID transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("PAYID TRANSFER") == "payid"
        assert parser.detect_payment_rail("PAY ID PAYMENT") == "payid"
    
    def test_detect_payment_rail_direct_debit(self):
        """Test detection of direct debit transactions."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("DIRECT DEBIT INSURANCE") == "direct_debit"
        assert parser.detect_payment_rail("DIRECT CREDIT SALARY") == "direct_debit"
    
    def test_detect_payment_rail_none(self):
        """Test that None is returned when no rail is detected."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("TRANSFER TO SAVINGS") is None
        assert parser.detect_payment_rail("ATM WITHDRAWAL") is None
    
    def test_detect_payment_rail_empty_description(self):
        """Test handling of empty description."""
        parser = CSVParser()
        
        assert parser.detect_payment_rail("") is None
        assert parser.detect_payment_rail(None) is None


class TestRecurringDetection:
    """Test recurring transaction detection logic."""
    
    def test_detect_recurring_monthly_pattern(self):
        """Test detection of monthly recurring transactions."""
        from models.schemas import NormalisedTransaction, TransactionDirection
        
        # Create monthly transactions (Netflix subscription)
        transactions = [
            NormalisedTransaction(
                date=date(2024, 1, 15),
                description="NETFLIX",
                merchant="NETFLIX",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("15.99"),
                signed_amount=Decimal("-15.99")
            ),
            NormalisedTransaction(
                date=date(2024, 2, 15),
                description="NETFLIX",
                merchant="NETFLIX",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("15.99"),
                signed_amount=Decimal("-15.99")
            ),
            NormalisedTransaction(
                date=date(2024, 3, 15),
                description="NETFLIX",
                merchant="NETFLIX",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("15.99"),
                signed_amount=Decimal("-15.99")
            ),
        ]
        
        parser = CSVParser()
        result = parser.detect_recurring(transactions)
        
        # All Netflix transactions should be marked as recurring
        for txn in result:
            if txn.merchant == "NETFLIX":
                assert txn.recurring_flag is True
    
    def test_detect_recurring_weekly_pattern(self):
        """Test detection of weekly recurring transactions."""
        from models.schemas import NormalisedTransaction, TransactionDirection
        
        # Create weekly transactions
        transactions = [
            NormalisedTransaction(
                date=date(2024, 1, 1),
                description="COFFEE SHOP",
                merchant="COFFEE SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("5.50"),
                signed_amount=Decimal("-5.50")
            ),
            NormalisedTransaction(
                date=date(2024, 1, 8),
                description="COFFEE SHOP",
                merchant="COFFEE SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("5.50"),
                signed_amount=Decimal("-5.50")
            ),
            NormalisedTransaction(
                date=date(2024, 1, 15),
                description="COFFEE SHOP",
                merchant="COFFEE SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("5.50"),
                signed_amount=Decimal("-5.50")
            ),
        ]
        
        parser = CSVParser()
        result = parser.detect_recurring(transactions)
        
        for txn in result:
            if txn.merchant == "COFFEE SHOP":
                assert txn.recurring_flag is True
    
    def test_detect_recurring_not_enough_transactions(self):
        """Test that single transactions are not marked as recurring."""
        from models.schemas import NormalisedTransaction, TransactionDirection
        
        transactions = [
            NormalisedTransaction(
                date=date(2024, 1, 15),
                description="ONE TIME PURCHASE",
                merchant="ONE TIME PURCHASE",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("100.00"),
                signed_amount=Decimal("-100.00")
            ),
        ]
        
        parser = CSVParser()
        result = parser.detect_recurring(transactions)
        
        assert result[0].recurring_flag is False
    
    def test_detect_recurring_irregular_pattern(self):
        """Test that irregular transactions are not marked as recurring."""
        from models.schemas import NormalisedTransaction, TransactionDirection
        
        # Create irregular transactions (random dates)
        transactions = [
            NormalisedTransaction(
                date=date(2024, 1, 5),
                description="RANDOM SHOP",
                merchant="RANDOM SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("20.00"),
                signed_amount=Decimal("-20.00")
            ),
            NormalisedTransaction(
                date=date(2024, 1, 23),
                description="RANDOM SHOP",
                merchant="RANDOM SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("20.00"),
                signed_amount=Decimal("-20.00")
            ),
            NormalisedTransaction(
                date=date(2024, 3, 10),
                description="RANDOM SHOP",
                merchant="RANDOM SHOP",
                direction=TransactionDirection.DEBIT,
                absolute_amount=Decimal("20.00"),
                signed_amount=Decimal("-20.00")
            ),
        ]
        
        parser = CSVParser()
        result = parser.detect_recurring(transactions)
        
        for txn in result:
            if txn.merchant == "RANDOM SHOP":
                assert txn.recurring_flag is False


class TestFullParsingPipeline:
    """Test the complete parsing pipeline."""
    
    def test_parse_and_normalise_complete(self):
        """Test complete parsing pipeline with all features."""
        csv_content = b"""Date,Description,Amount
15/01/2024,PAYPAL *ADOBE,-29.99
16/01/2024,VISA WOOLWORTHS,-45.50
17/01/2024,SALARY DEPOSIT,2500.00
15/02/2024,PAYPAL *ADOBE,-29.99
15/03/2024,PAYPAL *ADOBE,-29.99
"""
        csv_file = BytesIO(csv_content)
        parser = CSVParser()
        
        transactions = parser.parse_and_normalise(csv_file)
        
        assert len(transactions) == 5
        
        # Check merchant extraction
        adobe_txns = [t for t in transactions if "ADOBE" in t.merchant]
        assert len(adobe_txns) == 3
        assert all(t.merchant == "ADOBE" for t in adobe_txns)
        
        # Check payment rail detection
        paypal_txns = [t for t in transactions if t.payment_rail == "paypal"]
        assert len(paypal_txns) == 3
        
        card_txns = [t for t in transactions if t.payment_rail == "card"]
        assert len(card_txns) == 1
        
        # Check recurring detection (Adobe monthly subscription)
        assert all(t.recurring_flag for t in adobe_txns)
        
        # Check non-recurring transactions
        woolworths_txn = [t for t in transactions if "WOOLWORTHS" in t.merchant][0]
        assert woolworths_txn.recurring_flag is False
