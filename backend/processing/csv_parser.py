"""
CSV Parser and Normaliser for Tax Deduction Analyzer.

This module handles parsing of Australian bank CSV files and normalisation
of transaction data into a standardised format.

Validates: Requirements 1.2, 1.3, 2.2, 2.3, 2.4, 2.5
"""

import csv
import re
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple, BinaryIO, TextIO
from io import StringIO, TextIOWrapper
import uuid

from backend.models.schemas import NormalisedTransaction, TransactionDirection


class CSVFormat:
    """
    Detected CSV format configuration.
    
    Stores column mappings for date, description, amount, and debit/credit columns.
    """
    def __init__(
        self,
        date_col: str,
        description_col: str,
        amount_col: Optional[str] = None,
        debit_col: Optional[str] = None,
        credit_col: Optional[str] = None,
        date_format: str = "%Y-%m-%d"
    ):
        self.date_col = date_col
        self.description_col = description_col
        self.amount_col = amount_col
        self.debit_col = debit_col
        self.credit_col = credit_col
        self.date_format = date_format
        
        # Validate that we have either amount_col OR both debit_col and credit_col
        if not amount_col and not (debit_col and credit_col):
            raise ValueError("Must have either amount_col or both debit_col and credit_col")


class CSVParseError(Exception):
    """Exception raised when CSV parsing fails."""
    pass


class CSVParser:
    """
    Parser for Australian bank CSV files.
    
    Supports flexible column mapping and multiple date formats.
    Handles both single amount column and separate debit/credit columns.
    """
    
    # Common column name patterns for Australian banks
    DATE_PATTERNS = [
        "date", "transaction date", "trans date", "posting date", "value date"
    ]
    
    DESCRIPTION_PATTERNS = [
        "description", "details", "narrative", "transaction details", 
        "merchant", "payee", "memo"
    ]
    
    AMOUNT_PATTERNS = [
        "amount", "value", "transaction amount"
    ]
    
    DEBIT_PATTERNS = [
        "debit", "debit amount", "withdrawal", "withdrawals", "money out"
    ]
    
    CREDIT_PATTERNS = [
        "credit", "credit amount", "deposit", "deposits", "money in"
    ]
    
    # Common date formats used by Australian banks
    DATE_FORMATS = [
        "%d/%m/%Y",      # 15/01/2024 (most common in Australia)
        "%d-%m-%Y",      # 15-01-2024
        "%Y-%m-%d",      # 2024-01-15 (ISO format)
        "%d/%m/%y",      # 15/01/24
        "%d-%m-%y",      # 15-01-24
        "%d %b %Y",      # 15 Jan 2024
        "%d %b %y",      # 23 Oct 25 (NAB format)
        "%d %B %Y",      # 15 January 2024
    ]
    
    def __init__(self):
        """Initialize the CSV parser."""
        pass
    
    @staticmethod
    def _normalise_header(header: str) -> str:
        """
        Normalise column header for matching.
        
        Converts to lowercase and removes extra spaces.
        
        Args:
            header: Raw column header string
            
        Returns:
            Normalised header string
        """
        return header.strip().lower().replace("  ", " ")
    
    @staticmethod
    def _match_column(headers: List[str], patterns: List[str]) -> Optional[str]:
        """
        Match a column header against a list of patterns.
        
        Args:
            headers: List of normalised column headers
            patterns: List of patterns to match against
            
        Returns:
            Matched column name (original case) or None
        """
        normalised_headers = {CSVParser._normalise_header(h): h for h in headers}
        
        for pattern in patterns:
            for norm_header, orig_header in normalised_headers.items():
                if pattern in norm_header:
                    return orig_header
        
        return None
    
    def detect_format(self, csv_file: BinaryIO) -> CSVFormat:
        """
        Detect CSV format by analyzing headers.
        
        Identifies column mappings for date, description, and amount fields.
        Supports both single amount column and separate debit/credit columns.
        
        Args:
            csv_file: Binary file object containing CSV data
            
        Returns:
            CSVFormat object with detected column mappings
            
        Raises:
            CSVParseError: If required columns cannot be detected
        """
        # Wrap binary file in text wrapper (don't close it)
        text_file = TextIOWrapper(csv_file, encoding='utf-8-sig', newline='')
        
        # Read first line to get headers
        reader = csv.DictReader(text_file)
        headers = reader.fieldnames
        
        if not headers:
            csv_file.seek(0)
            raise CSVParseError("CSV file is empty or has no headers")
        
        # Detect date column
        date_col = self._match_column(headers, self.DATE_PATTERNS)
        if not date_col:
            csv_file.seek(0)
            raise CSVParseError(
                f"Could not detect date column. Expected one of: {', '.join(self.DATE_PATTERNS)}"
            )
        
        # Detect description column
        description_col = self._match_column(headers, self.DESCRIPTION_PATTERNS)
        if not description_col:
            csv_file.seek(0)
            raise CSVParseError(
                f"Could not detect description column. Expected one of: {', '.join(self.DESCRIPTION_PATTERNS)}"
            )
        
        # Detect amount columns (either single amount or debit/credit pair)
        amount_col = self._match_column(headers, self.AMOUNT_PATTERNS)
        debit_col = self._match_column(headers, self.DEBIT_PATTERNS)
        credit_col = self._match_column(headers, self.CREDIT_PATTERNS)
        
        if not amount_col and not (debit_col and credit_col):
            missing_fields = []
            if not amount_col:
                missing_fields.append(f"amount ({', '.join(self.AMOUNT_PATTERNS)})")
            if not debit_col:
                missing_fields.append(f"debit ({', '.join(self.DEBIT_PATTERNS)})")
            if not credit_col:
                missing_fields.append(f"credit ({', '.join(self.CREDIT_PATTERNS)})")
            
            csv_file.seek(0)
            raise CSVParseError(
                f"Could not detect amount columns. Missing required fields: {', '.join(missing_fields)}"
            )
        
        # Detect date format by sampling first row
        first_row = next(reader, None)
        
        date_format = "%d/%m/%Y"  # Default Australian format
        if first_row and date_col in first_row:
            date_str = first_row[date_col].strip()
            date_format = self._detect_date_format(date_str)
        
        # Reset file pointer for subsequent reads
        csv_file.seek(0)
        # Detach text wrapper to prevent closing the underlying binary file
        text_file.detach()
        
        return CSVFormat(
            date_col=date_col,
            description_col=description_col,
            amount_col=amount_col,
            debit_col=debit_col,
            credit_col=credit_col,
            date_format=date_format
        )
    
    @staticmethod
    def _detect_date_format(date_str: str) -> str:
        """
        Detect date format by trying common Australian formats.
        
        Args:
            date_str: Date string to parse
            
        Returns:
            Detected date format string
        """
        for fmt in CSVParser.DATE_FORMATS:
            try:
                datetime.strptime(date_str, fmt)
                return fmt
            except ValueError:
                continue
        
        # Default to most common Australian format
        return "%d/%m/%Y"
    
    @staticmethod
    def _parse_date(date_str: str, date_format: str) -> date:
        """
        Parse date string using specified format.
        
        Args:
            date_str: Date string to parse
            date_format: Format string for parsing
            
        Returns:
            Parsed date object
            
        Raises:
            CSVParseError: If date cannot be parsed
        """
        try:
            return datetime.strptime(date_str.strip(), date_format).date()
        except ValueError as e:
            raise CSVParseError(f"Invalid date format: {date_str}. Expected format: {date_format}")
    
    @staticmethod
    def _parse_amount(amount_str: str) -> Decimal:
        """
        Parse amount string to Decimal.
        
        Handles various formats including:
        - Negative signs: -100.00 or (100.00)
        - Currency symbols: $100.00
        - Thousands separators: 1,000.00
        
        Args:
            amount_str: Amount string to parse
            
        Returns:
            Parsed Decimal amount
            
        Raises:
            CSVParseError: If amount cannot be parsed
        """
        if not amount_str or amount_str.strip() == "":
            return Decimal("0.00")
        
        # Remove whitespace
        amount_str = amount_str.strip()
        
        # Handle parentheses as negative (accounting format)
        is_negative = False
        if amount_str.startswith("(") and amount_str.endswith(")"):
            is_negative = True
            amount_str = amount_str[1:-1]
        
        # Remove currency symbols and thousands separators
        amount_str = amount_str.replace("$", "").replace(",", "").replace(" ", "")
        
        # Check for negative sign
        if amount_str.startswith("-"):
            is_negative = True
            amount_str = amount_str[1:]
        
        try:
            amount = Decimal(amount_str)
            return -amount if is_negative else amount
        except (InvalidOperation, ValueError) as e:
            raise CSVParseError(f"Invalid amount format: {amount_str}")
    
    def parse(self, csv_file: BinaryIO, csv_format: CSVFormat) -> List[NormalisedTransaction]:
        """
        Parse CSV file into normalised transactions.
        
        Args:
            csv_file: Binary file object containing CSV data
            csv_format: Detected CSV format configuration
            
        Returns:
            List of NormalisedTransaction objects
            
        Raises:
            CSVParseError: If parsing fails
        """
        transactions = []
        
        # Wrap binary file in text wrapper (don't close it)
        text_file = TextIOWrapper(csv_file, encoding='utf-8-sig', newline='')
        
        reader = csv.DictReader(text_file)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Parse date
                date_str = row.get(csv_format.date_col, "").strip()
                if not date_str:
                    continue  # Skip empty rows
                
                transaction_date = self._parse_date(date_str, csv_format.date_format)
                
                # Get description
                description = row.get(csv_format.description_col, "").strip()
                if not description:
                    continue  # Skip rows without description
                
                # Parse amount and determine direction
                if csv_format.amount_col:
                    # Single amount column
                    amount_str = row.get(csv_format.amount_col, "0")
                    signed_amount = self._parse_amount(amount_str)
                    
                    if signed_amount < 0:
                        direction = TransactionDirection.DEBIT
                        absolute_amount = abs(signed_amount)
                    else:
                        direction = TransactionDirection.CREDIT
                        absolute_amount = signed_amount
                
                else:
                    # Separate debit/credit columns
                    debit_str = row.get(csv_format.debit_col, "").strip()
                    credit_str = row.get(csv_format.credit_col, "").strip()
                    
                    if debit_str and debit_str != "":
                        # Debit transaction
                        absolute_amount = abs(self._parse_amount(debit_str))
                        signed_amount = -absolute_amount
                        direction = TransactionDirection.DEBIT
                    elif credit_str and credit_str != "":
                        # Credit transaction
                        absolute_amount = abs(self._parse_amount(credit_str))
                        signed_amount = absolute_amount
                        direction = TransactionDirection.CREDIT
                    else:
                        # Skip rows with no amount
                        continue
                
                # Extract merchant and detect payment rail
                merchant = self.extract_merchant(description)
                payment_rail = self.detect_payment_rail(description)
                
                # Create normalised transaction
                transaction = NormalisedTransaction(
                    transaction_id=str(uuid.uuid4()),
                    date=transaction_date,
                    description=description,
                    merchant=merchant,
                    direction=direction,
                    absolute_amount=absolute_amount,
                    signed_amount=signed_amount,
                    payment_rail=payment_rail,
                    recurring_flag=False,  # Will be detected after all transactions are parsed
                    raw_data=dict(row)
                )
                
                transactions.append(transaction)
            
            except CSVParseError as e:
                # Re-raise with row number context
                csv_file.seek(0)
                text_file.detach()
                raise CSVParseError(f"Error parsing row {row_num}: {str(e)}")
            except Exception as e:
                csv_file.seek(0)
                text_file.detach()
                raise CSVParseError(f"Unexpected error parsing row {row_num}: {str(e)}")
        
        # Reset file pointer and detach text wrapper
        csv_file.seek(0)
        text_file.detach()
        
        return transactions

    @staticmethod
    def extract_merchant(description: str) -> str:
        """
        Extract merchant name from transaction description.
        
        Removes common prefixes (PAYPAL *, VISA, MASTERCARD, EFTPOS) and
        reference numbers/transaction IDs.
        
        Falls back to original description if extraction fails or produces empty result.
        
        Validates: Requirements 2.2, 2.3
        
        Args:
            description: Raw transaction description
            
        Returns:
            Extracted merchant name or original description
        """
        if not description or description.strip() == "":
            return description
        
        original = description.strip()
        cleaned = original
        
        # Remove common payment prefixes (case-insensitive)
        prefixes = [
            r"V\d{3,6}\s+",        # NAB card suffix prefix: V3737, V12345
            r"\d{1,2}/\d{2}\s+",   # Embedded internal merchant date: 13/11
            r"PAYPAL\s*\*\s*",
            r"VISA\s+",
            r"MASTERCARD\s+",
            r"EFTPOS\s+",
            r"CARD\s+",
            r"DEBIT\s+CARD\s+",
            r"CREDIT\s+CARD\s+",
        ]
        
        for prefix in prefixes:
            cleaned = re.sub(prefix, "", cleaned, flags=re.IGNORECASE)
        
        # Remove reference numbers and transaction IDs
        # Patterns: *1234, #1234, REF:1234, 4+ consecutive digits at end
        patterns = [
            r"\*\d+",           # *1234
            r"#\d+",            # #1234
            r"REF:\s*\d+",      # REF:1234 or REF: 1234
            r"REFERENCE:\s*\d+", # REFERENCE:1234
            r"\s+\d{4,}$",      # 4+ digits at end
            r"\s+\d{2}/\d{2}$", # Date at end like 15/01
        ]
        
        for pattern in patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
        
        # Clean up extra whitespace
        cleaned = " ".join(cleaned.split())
        
        # If cleaning resulted in empty string or very short string, return original
        if not cleaned or len(cleaned) < 2:
            return original
        
        return cleaned

    @staticmethod
    def detect_payment_rail(description: str) -> Optional[str]:
        """
        Detect payment rail from transaction description.
        
        Identifies payment methods including card, PayPal, BPAY, Osko, and PayID.
        
        Validates: Requirements 2.5
        
        Args:
            description: Transaction description
            
        Returns:
            Payment rail identifier or None if not detected
        """
        if not description:
            return None
        
        desc_upper = description.upper()
        
        # Check for payment rail keywords (order matters - check specific before general)
        if "PAYPAL" in desc_upper:
            return "paypal"
        elif "OSKO" in desc_upper:
            return "osko"
        elif "PAYID" in desc_upper or "PAY ID" in desc_upper:
            return "payid"
        elif "BPAY" in desc_upper:
            return "bpay"
        elif any(keyword in desc_upper for keyword in ["VISA", "MASTERCARD", "AMEX", "AMERICAN EXPRESS"]):
            return "card"
        elif "EFTPOS" in desc_upper or "DEBIT CARD" in desc_upper or "CREDIT CARD" in desc_upper:
            return "card"
        elif "DIRECT DEBIT" in desc_upper or "DIRECT CREDIT" in desc_upper:
            return "direct_debit"
        
        return None

    @staticmethod
    def detect_recurring(transactions: List[NormalisedTransaction]) -> List[NormalisedTransaction]:
        """
        Detect recurring transactions by grouping similar merchants and checking periodicity.
        
        Groups transactions by similar merchant names and detects regular patterns
        (weekly, monthly, yearly).
        
        Validates: Requirements 2.4
        
        Args:
            transactions: List of normalised transactions
            
        Returns:
            Updated list with recurring_flag set on matching transactions
        """
        from collections import defaultdict
        
        # Group transactions by merchant (case-insensitive)
        merchant_groups = defaultdict(list)
        for txn in transactions:
            merchant_key = txn.merchant.upper().strip()
            merchant_groups[merchant_key].append(txn)
        
        # Check each group for recurring patterns
        for merchant, txns in merchant_groups.items():
            if len(txns) < 2:
                continue  # Need at least 2 transactions to detect pattern
            
            # Sort by date
            sorted_txns = sorted(txns, key=lambda t: t.date)
            
            # Calculate intervals between consecutive transactions (in days)
            intervals = []
            for i in range(1, len(sorted_txns)):
                delta = (sorted_txns[i].date - sorted_txns[i-1].date).days
                intervals.append(delta)
            
            if not intervals:
                continue
            
            # Check for regular periodicity
            # Weekly: ~7 days (±3 days tolerance)
            # Monthly: ~30 days (±7 days tolerance)
            # Yearly: ~365 days (±30 days tolerance)
            
            avg_interval = sum(intervals) / len(intervals)
            
            is_recurring = False
            
            # Check weekly pattern (7 days ±3)
            if 4 <= avg_interval <= 10:
                # Check if most intervals are within tolerance
                weekly_matches = sum(1 for i in intervals if 4 <= i <= 10)
                if weekly_matches / len(intervals) >= 0.7:  # 70% threshold
                    is_recurring = True
            
            # Check monthly pattern (30 days ±7)
            elif 23 <= avg_interval <= 37:
                monthly_matches = sum(1 for i in intervals if 23 <= i <= 37)
                if monthly_matches / len(intervals) >= 0.7:
                    is_recurring = True
            
            # Check yearly pattern (365 days ±30)
            elif 335 <= avg_interval <= 395:
                yearly_matches = sum(1 for i in intervals if 335 <= i <= 395)
                if yearly_matches / len(intervals) >= 0.7:
                    is_recurring = True
            
            # Mark all transactions in this group as recurring if pattern detected
            if is_recurring:
                for txn in txns:
                    txn.recurring_flag = True
        
        return transactions

    def parse_and_normalise(self, csv_file: BinaryIO) -> List[NormalisedTransaction]:
        """
        Complete parsing pipeline: detect format, parse, extract merchants, detect rails, find recurring.
        
        This is the main entry point for CSV parsing.
        
        Args:
            csv_file: Binary file object containing CSV data
            
        Returns:
            List of fully normalised transactions
            
        Raises:
            CSVParseError: If parsing fails
        """
        # Step 1: Detect CSV format
        csv_format = self.detect_format(csv_file)
        
        # Step 2: Parse transactions
        transactions = self.parse(csv_file, csv_format)
        
        # Step 3: Detect recurring patterns
        transactions = self.detect_recurring(transactions)
        
        return transactions
