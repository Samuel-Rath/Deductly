"""
PDF Parser for extracting transaction data from bank statement PDFs.

This module provides functionality to parse PDF bank statements and extract
transaction data in a format compatible with the CSV parser output.
"""

import re
import io
from typing import List, Dict, Any, Optional
from datetime import datetime
import PyPDF2
import pdfplumber


class PDFParser:
    """
    Parser for extracting transaction data from PDF bank statements.
    
    Supports major Australian banks: CommBank, NAB, Westpac, ANZ, ING.
    Uses a state machine approach for robust multi-line transaction parsing.
    """
    
    def __init__(self):
        """Initialize the PDF parser."""
        self.supported_banks = ['commbank', 'nab', 'westpac', 'anz', 'ing']
    
    def parse(self, pdf_file: io.BytesIO) -> List[Dict[str, Any]]:
        """
        Parse a PDF bank statement and extract transactions.
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of transaction dictionaries with keys: date, description, amount
            
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
            
            return transactions
            
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    def _parse_with_pdfplumber(self, pdf_file: io.BytesIO) -> List[Dict[str, Any]]:
        """
        Parse PDF using pdfplumber with state machine for multi-line transactions.
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of transaction dictionaries
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
    
    def _parse_with_pypdf2(self, pdf_file: io.BytesIO) -> List[Dict[str, Any]]:
        """
        Parse PDF using PyPDF2 (fallback method).
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of transaction dictionaries
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
    
    def _parse_with_state_machine(self, text: str) -> List[Dict[str, Any]]:
        """
        Parse transactions using a state machine approach.
        
        Handles multi-line transactions where:
        - Each transaction starts with a date
        - Particulars (description) can wrap across multiple lines
        - Amounts appear after the description
        
        Args:
            text: Full text extracted from PDF
            
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        lines = text.split('\n')
        
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
                    # Extract amount from description
                    self._extract_amount_from_description(current_transaction)
                    if current_transaction.get('amount') and current_transaction['amount'] != 0:
                        transactions.append(current_transaction)
                
                # Start new transaction
                date_str = date_match.group(1).strip()
                # Remove the date from the line to get the rest
                rest_of_line = line_stripped[date_match.end():].strip()
                
                current_transaction = {
                    'date': date_str,
                    'description': rest_of_line,
                    'amount': None
                }
            
            elif current_transaction is not None:
                # Continue building current transaction (multi-line description)
                current_transaction['description'] += ' ' + line_stripped
        
        # Don't forget the last transaction
        if current_transaction and current_transaction.get('date') and current_transaction.get('description'):
            self._extract_amount_from_description(current_transaction)
            if current_transaction.get('amount') and current_transaction['amount'] != 0:
                transactions.append(current_transaction)
        
        return transactions
    
    def _extract_amount_from_description(self, transaction: Dict[str, Any]) -> None:
        """
        Extract amount from the accumulated description and clean it up.
        
        Modifies the transaction dict in place to:
        - Set the 'amount' field (negative for debits, positive for credits)
        - Clean up the 'description' field to remove amounts and balance
        
        Args:
            transaction: Transaction dictionary with 'description' field
        """
        description = transaction['description']
        
        # Pattern to match amounts: $13.90 or 13.90 or $1,234.56
        amount_pattern = r'\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
        
        # Find all amounts in the description
        amounts = []
        for match in re.finditer(amount_pattern, description):
            amount_str = match.group(1).replace(',', '')
            try:
                amounts.append((float(amount_str), match.start(), match.end()))
            except ValueError:
                continue
        
        if not amounts:
            transaction['amount'] = 0
            return
        
        # Heuristic: 
        # - If there are 2+ amounts, the last one is usually the balance
        # - The first/second-to-last is the transaction amount
        # - Check for "CR" suffix to determine if balance is credit
        
        if len(amounts) >= 2:
            # Second-to-last is likely the transaction amount
            transaction_amount = amounts[-2][0]
            balance_amount = amounts[-1][0]
            
            # Remove amounts from description (keep only the particulars)
            # Remove from the position of the transaction amount onwards
            clean_desc = description[:amounts[-2][1]].strip()
            
            # Determine if debit or credit
            # Check if "CR" appears after the balance (indicates credit balance)
            balance_pos = amounts[-1][2]
            text_after_balance = description[balance_pos:balance_pos+10].upper()
            
            # Infer transaction type:
            # If description contains credit keywords, it's a credit
            desc_upper = description.upper()
            is_credit = any(keyword in desc_upper for keyword in [
                'JOBSEEKER', 'WAGES', 'SALARY', 'PAYOUT', 'DEPOSIT', 
                'TRANSFER IN', 'REFUND', 'PAYMENT RECEIVED'
            ])
            
            if is_credit:
                transaction['amount'] = transaction_amount
            else:
                transaction['amount'] = -transaction_amount
            
            transaction['description'] = clean_desc
        
        elif len(amounts) == 1:
            # Only one amount - assume it's the transaction amount
            transaction_amount = amounts[0][0]
            clean_desc = description[:amounts[0][1]].strip()
            
            # Check if it's a credit based on keywords
            desc_upper = description.upper()
            is_credit = any(keyword in desc_upper for keyword in [
                'JOBSEEKER', 'WAGES', 'SALARY', 'PAYOUT', 'DEPOSIT',
                'TRANSFER IN', 'REFUND', 'PAYMENT RECEIVED'
            ])
            
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
    
    def _is_date(self, text: str) -> bool:
        """Check if text looks like a date and is a valid date."""
        date_patterns = [
            (r'^\d{1,2}/\d{1,2}/\d{4}$', '%d/%m/%Y'),
            (r'^\d{1,2}-\d{1,2}-\d{4}$', '%d-%m-%Y'),
            (r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$', '%d %b %Y'),
            (r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{2}$', '%d %b %y'),  # NAB format: "23 Oct 25"
        ]
        
        text = text.strip()
        for pattern, date_format in date_patterns:
            if re.match(pattern, text):
                # Check if it's actually a valid date
                try:
                    datetime.strptime(text, date_format)
                    return True
                except ValueError:
                    # Invalid date (e.g., 15/13/2024)
                    return False
        
        return False
    
    def _is_amount(self, text: str) -> bool:
        """Check if text looks like a monetary amount."""
        # Match patterns like: 123.45, -123.45, $123.45, 1,234.56
        pattern = r'^-?\$?\s*\d+[,\d]*\.?\d*$'
        return bool(re.match(pattern, text.strip()))
    
    def _parse_amount(self, text: str) -> float:
        """
        Parse amount string to float.
        
        Args:
            text: Amount string (e.g., "$123.45", "-50.00", "1,234.56")
            
        Returns:
            Float value of the amount
        """
        # Remove currency symbols, spaces, and commas
        cleaned = re.sub(r'[\$,\s]', '', text.strip())
        
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    def convert_to_csv_format(self, transactions: List[Dict[str, Any]]) -> str:
        """
        Convert parsed transactions to CSV format string.

        For transactions with separate debit/credit amounts, creates a CSV
        with Debit and Credit columns. Otherwise uses a single Amount column.

        Args:
            transactions: List of transaction dictionaries

        Returns:
            CSV formatted string with header
        """
        if not transactions:
            return "date,description,amount\n"

        # Check if we have separate debit/credit transactions
        # (indicated by negative and positive amounts)
        has_mixed_signs = any(txn.get('amount', 0) < 0 for txn in transactions) and \
                         any(txn.get('amount', 0) > 0 for txn in transactions)

        if has_mixed_signs:
            # Use separate Debit/Credit columns
            csv_lines = ["Date,Particulars,Debits,Credits"]

            for txn in transactions:
                date = txn.get('date', '')
                description = txn.get('description', '').replace(',', ' ')
                amount = txn.get('amount', 0.0)

                if amount < 0:
                    # Debit transaction
                    debit = abs(amount)
                    credit = ''
                else:
                    # Credit transaction
                    debit = ''
                    credit = amount

                csv_lines.append(f"{date},{description},{debit},{credit}")
        else:
            # Use single Amount column
            csv_lines = ["date,description,amount"]

            for txn in transactions:
                date = txn.get('date', '')
                description = txn.get('description', '').replace(',', ' ')
                amount = txn.get('amount', 0.0)

                csv_lines.append(f"{date},{description},{amount}")

        return '\n'.join(csv_lines)
