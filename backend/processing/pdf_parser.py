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


class PDFParser:
    """
    Parser for extracting transaction data from PDF bank statements.
    
    Supports major Australian banks: CommBank, NAB, Westpac, ANZ, ING.
    Uses a state machine approach for robust multi-line transaction parsing.
    Returns NormalisedTransaction objects directly, just like CSVParser.
    """
    
    def __init__(self):
        """Initialize the PDF parser."""
        self.supported_banks = ['commbank', 'nab', 'westpac', 'anz', 'ing']
        self.csv_parser = CSVParser()  # Reuse CSV parser logic for merchant extraction
    
    def parse(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        """
        Parse a PDF bank statement and extract transactions as NormalisedTransaction objects.
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of NormalisedTransaction objects (same as CSV parser output)
            
        Raises:
            ValueError: If PDF cannot be parsed or no transactions found
        """
        try:
            # Try pdfplumber first (better for tables)
            transactions = self._parse_with_pdfplumber(pdf_file)
            
            if not transactions:
                # Fallback to PyPDF2
                pdf_file.seek(0)
                transactions = self._parse_with_pypdf2(pdf_file)
            
            if not transactions:
                raise ValueError("No transactions found in PDF")
            
            # Detect recurring patterns (same as CSV parser)
            transactions = self.csv_parser.detect_recurring(transactions)
            
            return transactions
            
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    def _parse_with_pdfplumber(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        """
        Parse PDF using pdfplumber with state machine for multi-line transactions.
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of NormalisedTransaction objects
        """
        transactions = []
        
        try:
            with pdfplumber.open(pdf_file) as pdf:
                all_text = []
                
                # Extract all text from all pages
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        all_text.append(text)
                
                # Join all pages and parse with state machine
                full_text = '\n'.join(all_text)
                transactions = self._parse_with_state_machine(full_text)
        
        except Exception as e:
            print(f"pdfplumber parsing error: {e}")
            return []
        
        return transactions
    
    def _parse_with_pypdf2(self, pdf_file: io.BytesIO) -> List[NormalisedTransaction]:
        """
        Parse PDF using PyPDF2 (fallback method).
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of NormalisedTransaction objects
        """
        transactions = []
        
        try:
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            all_text = []
            
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    all_text.append(text)
            
            # Join all pages and parse with state machine
            full_text = '\n'.join(all_text)
            transactions = self._parse_with_state_machine(full_text)
        
        except Exception as e:
            print(f"PyPDF2 parsing error: {e}")
            return []
        
        return transactions
    
    def _parse_with_state_machine(self, text: str) -> List[NormalisedTransaction]:
        """
        Parse transactions using a state machine approach.
        
        Handles multi-line transactions where:
        - Each transaction starts with a date
        - Particulars (description) can wrap across multiple lines
        - Amounts appear after the description
        
        Args:
            text: Full text extracted from PDF
            
        Returns:
            List of NormalisedTransaction objects
        """
        transactions = []
        lines = text.split('\n')
        
        # Debug: Print first 20 lines to see structure
        print("=== PDF PARSER DEBUG: First 20 lines ===")
        for i, line in enumerate(lines[:20]):
            print(f"{i}: {line}")
        print("=== END DEBUG ===")
        
        # State machine variables
        current_transaction = None
        in_transaction_section = False
        
        # Date pattern for NAB and other banks
        date_pattern = r'^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
        
        for line in lines:
            line_stripped = line.strip()
            
            # Skip empty lines
            if not line_stripped:
                continue
            
            # Detect start of transaction section
            if 'TRANSACTION' in line_stripped.upper() and 'DETAILS' in line_stripped.upper():
                in_transaction_section = True
                print(f"Found transaction section: {line_stripped}")
                continue
            
            # Skip header lines
            if any(header in line_stripped.upper() for header in [
                'DATE', 'PARTICULARS', 'DEBITS', 'CREDITS', 'BALANCE',
                'ACCOUNT BALANCE', 'OPENING BALANCE', 'CLOSING BALANCE',
                'TOTAL CREDITS', 'TOTAL DEBITS', 'BANK STATEMENT'
            ]):
                continue
            
            # Check if line starts with a date
            date_match = re.match(date_pattern, line_stripped)
            
            if date_match:
                # Save previous transaction if exists
                if current_transaction and current_transaction.get('date') and current_transaction.get('description'):
                    # Extract amount and create NormalisedTransaction
                    print(f"Processing transaction: {current_transaction}")
                    norm_txn = self._create_normalised_transaction(current_transaction)
                    if norm_txn:
                        print(f"Created transaction: {norm_txn.description} - ${norm_txn.absolute_amount}")
                        transactions.append(norm_txn)
                    else:
                        print(f"Failed to create transaction from: {current_transaction}")
                
                # Start new transaction
                date_str = date_match.group(1).strip()
                # Remove the date from the line to get the rest
                rest_of_line = line_stripped[date_match.end():].strip()
                
                current_transaction = {
                    'date': date_str,
                    'description': rest_of_line,
                    'amount': None
                }
                print(f"Started new transaction: date={date_str}, desc_start={rest_of_line[:50]}")
            
            elif current_transaction is not None:
                # Continue building current transaction (multi-line description)
                current_transaction['description'] += ' ' + line_stripped
        
        # Don't forget the last transaction
        if current_transaction and current_transaction.get('date') and current_transaction.get('description'):
            print(f"Processing final transaction: {current_transaction}")
            norm_txn = self._create_normalised_transaction(current_transaction)
            if norm_txn:
                print(f"Created final transaction: {norm_txn.description} - ${norm_txn.absolute_amount}")
                transactions.append(norm_txn)
        
        print(f"=== TOTAL TRANSACTIONS PARSED: {len(transactions)} ===")
        return transactions
    
    def _create_normalised_transaction(self, raw_txn: dict) -> Optional[NormalisedTransaction]:
        """
        Convert raw transaction dict to NormalisedTransaction object.
        
        Extracts amount from description, determines direction, and creates
        a properly formatted NormalisedTransaction.
        
        Args:
            raw_txn: Dict with 'date', 'description' fields
            
        Returns:
            NormalisedTransaction object or None if invalid
        """
        # Extract amount from description
        self._extract_amount_from_description(raw_txn)
        
        if not raw_txn.get('amount') or raw_txn['amount'] == 0:
            return None
        
        # Parse date
        try:
            date_obj = self._parse_date(raw_txn['date'])
        except ValueError:
            return None
        
        # Determine direction and amounts
        signed_amount = raw_txn['amount']
        if signed_amount < 0:
            direction = TransactionDirection.DEBIT
            absolute_amount = abs(signed_amount)
        else:
            direction = TransactionDirection.CREDIT
            absolute_amount = signed_amount
        
        # Extract merchant using CSV parser logic
        description = raw_txn['description']
        merchant = self.csv_parser.extract_merchant(description)
        payment_rail = self.csv_parser.detect_payment_rail(description)
        
        # Create NormalisedTransaction
        return NormalisedTransaction(
            transaction_id=str(uuid.uuid4()),
            date=date_obj,
            description=description,
            merchant=merchant,
            direction=direction,
            absolute_amount=absolute_amount,
            signed_amount=signed_amount,
            payment_rail=payment_rail,
            recurring_flag=False,  # Will be detected later
            raw_data={'source': 'pdf', 'original_description': description}
        )
    
    def _extract_amount_from_description(self, transaction: dict) -> None:
        """
        Extract amount from the accumulated description and clean it up.
        
        Modifies the transaction dict in place to:
        - Set the 'amount' field (negative for debits, positive for credits)
        - Clean up the 'description' field to remove amounts and balance
        
        Args:
            transaction: Transaction dictionary with 'description' field
        """
        description = transaction['description']
        print(f"Extracting amount from: {description[:100]}")
        
        # Pattern to match amounts: $13.90 or 13.90 or $1,234.56
        # Also match amounts with spaces: $ 13.90
        amount_pattern = r'\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
        
        # Find all amounts in the description
        amounts = []
        for match in re.finditer(amount_pattern, description):
            amount_str = match.group(1).replace(',', '')
            try:
                amount_val = float(amount_str)
                # Skip very small amounts (likely not transaction amounts)
                if amount_val >= 0.01:
                    amounts.append((amount_val, match.start(), match.end()))
                    print(f"  Found amount: ${amount_val} at position {match.start()}")
            except ValueError:
                continue
        
        if not amounts:
            print(f"  No amounts found!")
            transaction['amount'] = 0
            return
        
        print(f"  Total amounts found: {len(amounts)}")
        
        # Heuristic: 
        # - If there are 2+ amounts, the last one is usually the balance
        # - The first/second-to-last is the transaction amount
        # - Check for "CR" suffix to determine if balance is credit
        
        if len(amounts) >= 2:
            # Second-to-last is likely the transaction amount
            transaction_amount = amounts[-2][0]
            print(f"  Using second-to-last amount as transaction: ${transaction_amount}")
            
            # Remove amounts from description (keep only the particulars)
            # Remove from the position of the transaction amount onwards
            clean_desc = description[:amounts[-2][1]].strip()
            
            # Determine if debit or credit
            # Check if description contains credit keywords
            desc_upper = description.upper()
            is_credit = any(keyword in desc_upper for keyword in [
                'JOBSEEKER', 'WAGES', 'SALARY', 'PAYOUT', 'DEPOSIT', 
                'TRANSFER IN', 'REFUND', 'PAYMENT RECEIVED', 'CREDIT', 'INTEREST'
            ])
            
            print(f"  Is credit: {is_credit}")
            
            if is_credit:
                transaction['amount'] = transaction_amount
            else:
                transaction['amount'] = -transaction_amount
            
            transaction['description'] = clean_desc
        
        elif len(amounts) == 1:
            # Only one amount - assume it's the transaction amount
            transaction_amount = amounts[0][0]
            print(f"  Using single amount as transaction: ${transaction_amount}")
            clean_desc = description[:amounts[0][1]].strip()
            
            # Check if it's a credit based on keywords
            desc_upper = description.upper()
            is_credit = any(keyword in desc_upper for keyword in [
                'JOBSEEKER', 'WAGES', 'SALARY', 'PAYOUT', 'DEPOSIT',
                'TRANSFER IN', 'REFUND', 'PAYMENT RECEIVED', 'CREDIT', 'INTEREST'
            ])
            
            print(f"  Is credit: {is_credit}")
            
            if is_credit:
                transaction['amount'] = transaction_amount
            else:
                transaction['amount'] = -transaction_amount
            
            transaction['description'] = clean_desc
        
        # Final cleanup of description
        transaction['description'] = re.sub(r'\s+', ' ', transaction['description']).strip()
        
        # If description is empty or too short, use a placeholder
        if not transaction['description'] or len(transaction['description']) < 2:
            transaction['description'] = 'Transaction'
        
        print(f"  Final: amount=${transaction['amount']}, desc={transaction['description'][:50]}")
    
    def _parse_date(self, date_str: str):
        """
        Parse date string to date object.
        
        Args:
            date_str: Date string in various formats
            
        Returns:
            date object
            
        Raises:
            ValueError: If date cannot be parsed
        """
        date_formats = [
            '%d/%m/%Y',
            '%d-%m-%Y',
            '%d %b %Y',
            '%d %b %y',  # NAB format
            '%d/%m/%y',
            '%d-%m-%y',
        ]
        
        date_str = date_str.strip()
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f"Could not parse date: {date_str}")
