"""
Fuzzy Matcher for Tax Deduction Analyzer.

This module implements fuzzy string matching for merchant name canonicalisation.
Handles merchant name variations (PayPal prefixes, reference numbers, etc.)
and matches against a canonical merchant list.

Validates: Requirements 4.2, 11.1-11.5
"""

import re
from typing import List, Optional, Tuple
from rapidfuzz import fuzz


class FuzzyMatcher:
    """
    Fuzzy string matcher for merchant name canonicalisation.
    
    Uses rapidfuzz library to handle merchant name variations and match
    against a canonical merchant list with configurable similarity threshold.
    """
    
    def __init__(self, canonical_merchants: List[str], threshold: float = 0.85):
        """
        Initialize the fuzzy matcher.
        
        Args:
            canonical_merchants: List of canonical merchant names to match against
            threshold: Minimum similarity score (0.0 to 1.0) for a match (default 0.85)
        """
        self.canonical_merchants = canonical_merchants
        self.threshold = threshold
    
    def normalise_merchant(self, merchant: str) -> str:
        """
        Normalise a merchant name by removing common prefixes, suffixes, and reference numbers.
        
        Normalisation steps:
        1. Remove common payment prefixes (PAYPAL *, VISA, MASTERCARD, EFTPOS, etc.)
        2. Remove reference numbers (*1234, #5678, long digit sequences)
        3. Remove trailing location codes (NSW, VIC, etc.)
        4. Strip whitespace and convert to uppercase
        
        Args:
            merchant: Raw merchant name from transaction description
            
        Returns:
            Normalised merchant name
            
        Validates: Requirements 4.2
        """
        # Start with the original merchant name
        normalised = merchant
        
        # Remove common payment prefixes
        prefixes = [
            r'^PAYPAL\s*\*\s*',
            r'^VISA\s+',
            r'^MASTERCARD\s+',
            r'^EFTPOS\s+',
            r'^DIRECT\s+DEBIT\s+',
            r'^DD\s+',
            r'^BPAY\s+',
        ]
        
        for prefix_pattern in prefixes:
            normalised = re.sub(prefix_pattern, '', normalised, flags=re.IGNORECASE)
        
        # Remove reference numbers and transaction IDs
        # Pattern 1: *1234 or *ABCD
        normalised = re.sub(r'\*\w+', '', normalised)
        
        # Pattern 2: #1234 or #ABCD
        normalised = re.sub(r'#\w+', '', normalised)
        
        # Pattern 3: Long digit sequences (4 or more digits)
        normalised = re.sub(r'\b\d{4,}\b', '', normalised)
        
        # Pattern 4: REF: followed by alphanumeric
        normalised = re.sub(r'REF:\s*\w+', '', normalised, flags=re.IGNORECASE)
        
        # Pattern 5: Transaction IDs like TXN123456
        normalised = re.sub(r'TXN\w+', '', normalised, flags=re.IGNORECASE)
        
        # Remove trailing location codes (2-3 letter state codes)
        normalised = re.sub(r'\s+[A-Z]{2,3}$', '', normalised)
        
        # Clean up whitespace and convert to uppercase
        normalised = ' '.join(normalised.split()).upper()
        
        return normalised
    
    def match(self, merchant: str) -> Optional[Tuple[str, float]]:
        """
        Match a merchant name against the canonical merchant list using fuzzy matching.
        
        Uses token_sort_ratio for matching to handle word order variations.
        Returns the best match if similarity exceeds the threshold.
        
        Args:
            merchant: Merchant name to match (will be normalised first)
            
        Returns:
            Tuple of (canonical_merchant_name, similarity_score) if match found,
            None if no match exceeds threshold
            
        Validates: Requirements 4.2, 11.1-11.5
        """
        # Normalise the input merchant name
        normalised_merchant = self.normalise_merchant(merchant)
        
        if not normalised_merchant:
            return None
        
        best_match = None
        best_score = 0.0
        
        # Compare against all canonical merchants
        for canonical in self.canonical_merchants:
            # Use token_sort_ratio for better handling of word order variations
            # This handles cases like "ADOBE SYSTEMS" vs "SYSTEMS ADOBE"
            score = fuzz.token_sort_ratio(normalised_merchant, canonical.upper()) / 100.0
            
            if score > best_score:
                best_score = score
                best_match = canonical
        
        # Return match only if it exceeds the threshold
        if best_score >= self.threshold:
            return (best_match, best_score)
        
        return None
    
    def add_canonical_merchant(self, merchant: str) -> None:
        """
        Add a new canonical merchant to the list.
        
        Args:
            merchant: Canonical merchant name to add
        """
        if merchant not in self.canonical_merchants:
            self.canonical_merchants.append(merchant)
    
    def set_threshold(self, threshold: float) -> None:
        """
        Update the similarity threshold.
        
        Args:
            threshold: New threshold value (0.0 to 1.0)
            
        Raises:
            ValueError: If threshold is not between 0.0 and 1.0
        """
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("Threshold must be between 0.0 and 1.0")
        self.threshold = threshold
