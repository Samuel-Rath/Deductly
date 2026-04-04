"""
PDF Parser for extracting transaction data from bank statement PDFs.

This module provides functionality to parse PDF bank statements and extract
transaction data directly into NormalisedTransaction objects, matching the
CSV parser's output format.
"""

import re
import io
import uuid
from typing import List, Optional
from datetime import datetime
import PyPDF2
import pdfplumber

from backend.models.schemas import NormalisedTransaction, TransactionDirection
from backend.processing.csv_parser import CSVParser
from backend.logging_config import logger


class PDFParser:
    """
    Parser for extracting transaction data from PDF bank statements.

    Supports major Australian banks: CommBank, NAB, Westpac, ANZ, ING.
    Uses a state machine approach for robust multi-line transaction parsing.
    Returns NormalisedTransaction objects directly, just like CSVParser.
    """

    def __init__(self):
        self.supported_banks = ['commbank', 'nab', 'westpac', 'anz', 'ing']
        self.csv_parser = CSVParser()

    def parse(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        """
        Parse a PDF bank statement and extract transactions.

        Args:
            pdf_file: BytesIO object containing PDF data

        Returns:
            List of NormalisedTransaction objects

        Raises:
            ValueError: If PDF cannot be parsed or no transactions found
        """
        try:
            transactions = self._parse_with_pdfplumber(pdf_file)

            if not transactions:
                pdf_file.seek(0)
                transactions = self._parse_with_pypdf2(pdf_file)

            if not transactions:
                raise ValueError("No transactions found in PDF")

            transactions = self.csv_parser.detect_recurring(transactions)
            return transactions

        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")

    def _parse_with_pdfplumber(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        transactions = []
        try:
            with pdfplumber.open(pdf_file) as pdf:
                all_text = [
                    page.extract_text()
                    for page in pdf.pages
                    if page.extract_text()
                ]
                full_text = '\n'.join(all_text)
                transactions = self._parse_with_state_machine(full_text)
        except Exception as e:
            logger.debug("pdfplumber parsing failed, will try fallback", extra={"error": str(e)})
        return transactions

    def _parse_with_pypdf2(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        transactions = []
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            all_text = [
                page.extract_text()
                for page in pdf_reader.pages
                if page.extract_text()
            ]
            full_text = '\n'.join(all_text)
            transactions = self._parse_with_state_machine(full_text)
        except Exception as e:
            logger.debug("PyPDF2 parsing failed", extra={"error": str(e)})
        return transactions

    # Phrases that identify bank footer/disclaimer lines — two or more triggers the guard
    _DISCLAIMER_PHRASES = [
        'provisional list', 'statement of account', 'national australia bank',
        'may include transactions', 'payment by the bank', 'australian credit licence',
        'afsl', 'abn 12',
    ]

    def _is_disclaimer_line(self, line: str) -> bool:
        low = line.lower()
        return sum(1 for p in self._DISCLAIMER_PHRASES if p in low) >= 2

    def _parse_with_state_machine(self, text: str) -> List[NormalisedTransaction]:
        """
        Parse transactions from raw PDF text using a state machine.

        Handles multi-line transactions where the date starts each entry and
        the description/amount can span several lines.
        """
        transactions = []
        lines = text.split('\n')

        logger.debug("PDF state machine starting", extra={"line_count": len(lines)})

        current_transaction = None

        date_pattern = r'^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue

            if 'TRANSACTION' in line_stripped.upper() and 'DETAILS' in line_stripped.upper():
                logger.debug("Found transaction section header")
                continue

            if any(header in line_stripped.upper() for header in [
                'DATE', 'PARTICULARS', 'DEBITS', 'CREDITS', 'BALANCE',
                'ACCOUNT BALANCE', 'OPENING BALANCE', 'CLOSING BALANCE',
                'TOTAL CREDITS', 'TOTAL DEBITS', 'BANK STATEMENT'
            ]):
                continue

            date_match = re.match(date_pattern, line_stripped)

            if date_match:
                if current_transaction and current_transaction.get('date') and current_transaction.get('description'):
                    norm_txn = self._create_normalised_transaction(current_transaction)
                    if norm_txn:
                        transactions.append(norm_txn)

                date_str = date_match.group(1).strip()
                rest_of_line = line_stripped[date_match.end():].strip()
                current_transaction = {
                    'date': date_str,
                    'description': rest_of_line,
                    'amount': None,
                }

            elif current_transaction is not None:
                if not self._is_disclaimer_line(line_stripped):
                    current_transaction['description'] += ' ' + line_stripped

        # Flush last transaction
        if current_transaction and current_transaction.get('date') and current_transaction.get('description'):
            norm_txn = self._create_normalised_transaction(current_transaction)
            if norm_txn:
                transactions.append(norm_txn)

        logger.debug("PDF parsing complete", extra={"transaction_count": len(transactions)})
        return transactions

    def _create_normalised_transaction(self, raw_txn: dict) -> Optional[NormalisedTransaction]:
        """Convert raw transaction dict to NormalisedTransaction."""
        self._extract_amount_from_description(raw_txn)

        if not raw_txn.get('amount') or raw_txn['amount'] == 0:
            return None

        try:
            date_obj = self._parse_date(raw_txn['date'])
        except ValueError:
            return None

        signed_amount = raw_txn['amount']
        if signed_amount < 0:
            direction = TransactionDirection.DEBIT
            absolute_amount = abs(signed_amount)
        else:
            direction = TransactionDirection.CREDIT
            absolute_amount = signed_amount

        description = self._clean_pdf_description(raw_txn['description'])
        raw_txn['description'] = description
        merchant = self.csv_parser.extract_merchant(description)
        payment_rail = self.csv_parser.detect_payment_rail(description)

        return NormalisedTransaction(
            transaction_id=str(uuid.uuid4()),
            date=date_obj,
            description=description,
            merchant=merchant,
            direction=direction,
            absolute_amount=absolute_amount,
            signed_amount=signed_amount,
            payment_rail=payment_rail,
            recurring_flag=False,
            raw_data={'source': 'pdf', 'original_description': description},
        )

    def _clean_pdf_description(self, description: str) -> str:
        """Strip NAB-style card prefix (V3737) and embedded internal date (13/11) from the start."""
        cleaned = re.sub(r'^V\d{3,6}\s+', '', description, flags=re.IGNORECASE)
        cleaned = re.sub(r'^\d{1,2}/\d{2}(?:/\d{2,4})?\s+', '', cleaned)
        return cleaned.strip()

    def _extract_amount_from_description(self, transaction: dict) -> None:
        """
        Extract the transaction amount from the accumulated description text.
        Modifies the dict in place: sets 'amount' and cleans 'description'.
        """
        description = transaction['description']

        # Require $ prefix OR a .XX decimal to avoid matching bare integers (e.g. page numbers)
        amount_pattern = r'(?:\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)|\b(\d{1,3}(?:,\d{3})*\.\d{2})\b)'
        amounts = []
        for match in re.finditer(amount_pattern, description):
            amount_str = (match.group(1) or match.group(2)).replace(',', '')
            try:
                amount_val = float(amount_str)
                if amount_val >= 0.01:
                    amounts.append((amount_val, match.start(), match.end()))
            except ValueError:
                continue

        if not amounts:
            transaction['amount'] = 0
            return

        CREDIT_KEYWORDS = [
            'JOBSEEKER', 'WAGES', 'SALARY', 'PAYOUT', 'DEPOSIT',
            'TRANSFER IN', 'REFUND', 'PAYMENT RECEIVED', 'CREDIT', 'INTEREST',
        ]
        desc_upper = description.upper()
        is_credit = any(kw in desc_upper for kw in CREDIT_KEYWORDS)

        if len(amounts) >= 2:
            transaction_amount = amounts[-2][0]
            clean_desc = description[:amounts[-2][1]].strip()
        else:
            transaction_amount = amounts[0][0]
            clean_desc = description[:amounts[0][1]].strip()

        transaction['amount'] = transaction_amount if is_credit else -transaction_amount
        transaction['description'] = re.sub(r'\s+', ' ', clean_desc).strip() or 'Transaction'

    def _parse_date(self, date_str: str):
        """Parse date string to date object."""
        date_formats = [
            '%d/%m/%Y', '%d-%m-%Y', '%d %b %Y',
            '%d %b %y', '%d/%m/%y', '%d-%m-%y',
        ]
        date_str = date_str.strip()
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Could not parse date: {date_str}")
