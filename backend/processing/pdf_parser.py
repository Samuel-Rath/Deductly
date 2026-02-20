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
        Parse PDF using pdfplumber (better for structured tables).
        
        Args:
            pdf_file: BytesIO object containing PDF data
            
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        
        try:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    # Extract tables
                    tables = page.extract_tables()
                    
                    for table in tables:
                        if not table:
                            continue
                        
                        # Try to identify transaction rows
                        for row in table:
                            if not row or len(row) < 3:
                                continue
                            
                            transaction = self._extract_transaction_from_row(row)
                            if transaction:
                                transactions.append(transaction)
                    
                    # Also try text extraction for non-table formats
                    if not transactions:
                        text = page.extract_text()
                        if text:
                            text_transactions = self._extract_transactions_from_text(text)
                            transactions.extend(text_transactions)
        
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
            
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    page_transactions = self._extract_transactions_from_text(text)
                    transactions.extend(page_transactions)
        
        except Exception as e:
            print(f"PyPDF2 parsing error: {e}")
            return []
        
        return transactions
    
    def _extract_transaction_from_row(self, row: List[str]) -> Optional[Dict[str, Any]]:
        """
        Extract transaction data from a table row.
        
        Args:
            row: List of cell values from a table row
            
        Returns:
            Transaction dictionary or None if not a valid transaction
        """
        # Skip header rows
        if any(str(cell).upper() in ['DATE', 'DESCRIPTION', 'AMOUNT', 'BALANCE', 'DEBIT', 'CREDIT'] 
               for cell in row if cell):
            return None
        
        # Try to find date, description, and amount in the row
        date_str = None
        description = None
        amount = None
        
        for i, cell in enumerate(row):
            if not cell:
                continue
            
            cell = str(cell).strip()
            
            if not cell or len(cell) < 2:
                continue
            
            # Try to parse as date (usually first column)
            if not date_str and self._is_date(cell):
                date_str = cell
            
            # Try to parse as amount (usually last column, or second-to-last)
            elif self._is_amount(cell):
                # Only set amount if we haven't found one yet, or this is closer to the end
                if amount is None or i > row.index(str(amount)):
                    amount = self._parse_amount(cell)
            
            # Otherwise, it's likely a description (usually middle column)
            elif not description and len(cell) > 2 and not cell.replace('.', '').replace(',', '').replace('-', '').replace('$', '').strip().isdigit():
                description = cell
        
        # Valid transaction needs at least date and description
        if date_str and description:
            return {
                'date': date_str,
                'description': description,
                'amount': amount if amount is not None else 0.0
            }
        
        return None
    
    def _extract_transactions_from_text(self, text: str) -> List[Dict[str, Any]]:
        """
        Extract transactions from plain text using regex patterns.
        
        Args:
            text: Extracted text from PDF
            
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        lines = text.split('\n')
        
        # Pattern to match transaction lines
        # Looks for: date, description, amount
        # Example: "15/01/2024 WOOLWORTHS -123.45" or "15 Jan 2024 COLES -50.00"
        date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{4}',  # DD/MM/YYYY
            r'\d{1,2}-\d{1,2}-\d{4}',  # DD-MM-YYYY
            r'\d{1,2}\s+[A-Za-z]{3}\s+\d{4}',  # DD Mon YYYY
        ]
        
        # Amount pattern - matches currency amounts with optional minus sign
        amount_pattern = r'-?\$?\s*\d+[,\d]*\.?\d*$'
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 10:  # Skip very short lines
                continue
            
            # Skip header lines
            if any(header in line.upper() for header in ['DATE', 'DESCRIPTION', 'AMOUNT', 'BALANCE', 'BANK STATEMENT']):
                continue
            
            # Try each date pattern
            date_str = None
            for pattern in date_patterns:
                match = re.search(pattern, line)
                if match:
                    date_str = match.group()
                    # Validate it's actually a valid date
                    if not self._is_date(date_str):
                        date_str = None
                        continue
                    break
            
            if not date_str:
                continue
            
            # Extract amount from the end of the line
            amount_match = re.search(amount_pattern, line)
            amount = 0.0
            amount_end_pos = len(line)
            
            if amount_match:
                amount_str = amount_match.group()
                amount = self._parse_amount(amount_str)
                amount_end_pos = amount_match.start()
            
            # Description is everything between date and amount
            date_match = re.search(r'\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}', line)
            if date_match:
                desc_start = date_match.end()
                description = line[desc_start:amount_end_pos].strip()
                
                # Clean up description - remove extra whitespace
                description = re.sub(r'\s+', ' ', description)
                
                if description and len(description) > 1:
                    transactions.append({
                        'date': date_str,
                        'description': description,
                        'amount': amount
                    })
        
        return transactions
    
    def _is_date(self, text: str) -> bool:
        """Check if text looks like a date and is a valid date."""
        from datetime import datetime
        
        date_patterns = [
            (r'^\d{1,2}/\d{1,2}/\d{4}$', '%d/%m/%Y'),
            (r'^\d{1,2}-\d{1,2}-\d{4}$', '%d-%m-%Y'),
            (r'^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$', '%d %b %Y'),
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
        
        Args:
            transactions: List of transaction dictionaries
            
        Returns:
            CSV formatted string with header
        """
        if not transactions:
            return "date,description,amount\n"
        
        csv_lines = ["date,description,amount"]
        
        for txn in transactions:
            date = txn.get('date', '')
            description = txn.get('description', '').replace(',', ' ')  # Remove commas from description
            amount = txn.get('amount', 0.0)
            
            csv_lines.append(f"{date},{description},{amount}")
        
        return '\n'.join(csv_lines)
