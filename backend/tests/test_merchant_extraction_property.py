"""
Property-based tests for merchant extraction.

Feature: tax-deduction-analyzer
Property 4: Merchant Extraction Fallback

Validates: Requirements 2.3
"""

import pytest
from hypothesis import given, strategies as st, assume
from backend.processing.csv_parser import CSVParser


# Feature: tax-deduction-analyzer, Property 4: Merchant Extraction Fallback
@given(description=st.text(min_size=1, max_size=200))
@pytest.mark.property_test
def test_merchant_extraction_fallback(description):
    """
    Property 4: Merchant Extraction Fallback
    
    For any transaction description, if merchant extraction produces no result
    or fails, the merchant field should equal the original description.
    
    This ensures that we never lose information - if we can't extract a clean
    merchant name, we preserve the original description.
    
    Validates: Requirements 2.3
    """
    # Skip empty or whitespace-only strings as they're not valid descriptions
    assume(description.strip() != "")
    
    parser = CSVParser()
    
    # Extract merchant
    merchant = parser.extract_merchant(description)
    
    # Property 1: Merchant extraction must never return None or empty string
    # when given a non-empty description
    assert merchant is not None, (
        f"Merchant extraction returned None for description: {description}"
    )
    assert merchant.strip() != "", (
        f"Merchant extraction returned empty string for description: {description}"
    )
    
    # Property 2: If extraction produces a very short result (< 2 chars),
    # it should fall back to the original description
    if len(merchant.strip()) < 2:
        assert merchant == description.strip(), (
            f"Short merchant result should fall back to original. "
            f"Got merchant='{merchant}', expected='{description.strip()}'"
        )
    
    # Property 3: The extracted merchant should be a substring of the original
    # description (after normalisation) OR equal to the original description
    # This validates that we're not inventing information
    # Note: Merchant extraction normalizes whitespace, so we need to compare
    # after normalizing both strings
    original_normalized = " ".join(description.split())
    merchant_normalized = " ".join(merchant.split())
    
    original_upper = original_normalized.upper()
    merchant_upper = merchant_normalized.upper()
    
    # Extraction may only *remove* text (prefixes, store numbers like "#123"
    # from the middle), so the merchant must be an in-order subsequence of the
    # original. A plain substring check wrongly failed on e.g. "0#1:" -> "0:".
    remaining = iter(original_upper)
    is_subsequence = all(ch in remaining for ch in merchant_upper)
    is_fallback = merchant_normalized == original_normalized

    assert is_subsequence or is_fallback, (
        f"Extracted merchant must only contain text from the original, in order (after normalization). "
        f"Original: '{description}' (normalized: '{original_normalized}'), "
        f"Merchant: '{merchant}' (normalized: '{merchant_normalized}')"
    )


@given(
    prefix=st.sampled_from(["PAYPAL *", "VISA ", "MASTERCARD ", "EFTPOS "]),
    merchant_name=st.text(
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd")),
        min_size=3,
        max_size=30
    )
)
@pytest.mark.property_test
def test_merchant_extraction_removes_prefixes(prefix, merchant_name):
    """
    Property test for prefix removal.
    
    For any description with a known payment prefix, the extracted merchant
    should not contain that prefix.
    
    Validates: Requirements 2.2, 2.3
    """
    # Skip if merchant name is too short after stripping
    assume(merchant_name.strip() != "")
    assume(len(merchant_name.strip()) >= 2)
    # A merchant whose own name starts with the prefix word ("EFTPOS EFTPOS",
    # "VISA VISAGE") legitimately keeps that word after the prefix is removed,
    # so it can't be checked with startswith below.
    assume(not merchant_name.upper().startswith(prefix.strip(" *").upper()))

    description = f"{prefix}{merchant_name}"
    
    parser = CSVParser()
    merchant = parser.extract_merchant(description)
    
    # The extracted merchant should not start with the prefix
    # (case-insensitive check)
    merchant_upper = merchant.upper()
    prefix_upper = prefix.strip().upper()
    
    assert not merchant_upper.startswith(prefix_upper), (
        f"Extracted merchant should not contain prefix. "
        f"Description: '{description}', Merchant: '{merchant}', Prefix: '{prefix}'"
    )
    
    # The merchant should be related to the original merchant name
    # (allowing for some cleaning)
    merchant_name_upper = merchant_name.strip().upper()
    assert merchant_name_upper in merchant_upper or merchant_upper in merchant_name_upper, (
        f"Extracted merchant should be related to original merchant name. "
        f"Expected: '{merchant_name}', Got: '{merchant}'"
    )


@given(
    merchant_name=st.text(
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
        min_size=3,
        max_size=30
    ),
    reference=st.integers(min_value=1000, max_value=9999)
)
@pytest.mark.property_test
def test_merchant_extraction_removes_reference_numbers(merchant_name, reference):
    """
    Property test for reference number removal.
    
    For any description with a reference number, the extracted merchant
    should not contain that reference number.
    
    Validates: Requirements 2.2, 2.3
    """
    # Skip if merchant name is too short
    assume(merchant_name.strip() != "")
    assume(len(merchant_name.strip()) >= 2)
    
    # Skip if merchant name is a payment prefix (edge case where prefix = merchant)
    payment_prefixes = ["PAYPAL", "VISA", "MASTERCARD", "EFTPOS", "CARD"]
    assume(merchant_name.strip().upper() not in payment_prefixes)
    
    # Test various reference formats
    reference_formats = [
        f"{merchant_name} *{reference}",
        f"{merchant_name} #{reference}",
        f"{merchant_name} REF:{reference}",
        f"{merchant_name} {reference}",
    ]
    
    parser = CSVParser()
    
    for description in reference_formats:
        merchant = parser.extract_merchant(description)
        
        # The extracted merchant should not contain the reference number
        # UNLESS it fell back to the original (which happens when extraction produces too short a result)
        is_fallback = merchant == description.strip()
        
        if not is_fallback:
            assert str(reference) not in merchant, (
                f"Extracted merchant should not contain reference number. "
                f"Description: '{description}', Merchant: '{merchant}', Reference: {reference}"
            )
        
        # The merchant should contain the original merchant name (or be the fallback)
        merchant_name_clean = merchant_name.strip()
        is_related = (
            merchant_name_clean.upper() in merchant.upper() or
            merchant.upper() in merchant_name_clean.upper() or
            is_fallback
        )
        
        assert is_related, (
            f"Extracted merchant should be related to original merchant name or be fallback. "
            f"Expected: '{merchant_name}', Got: '{merchant}', Description: '{description}'"
        )


@given(description=st.text(min_size=1, max_size=200))
@pytest.mark.property_test
def test_merchant_extraction_idempotent(description):
    """
    Property test for idempotency.
    
    Extracting merchant from an already-extracted merchant should return
    the same result (or the original if it's already clean).
    
    Validates: Requirements 2.3
    """
    assume(description.strip() != "")
    
    parser = CSVParser()
    
    # First extraction
    merchant1 = parser.extract_merchant(description)
    
    # Second extraction on the result
    merchant2 = parser.extract_merchant(merchant1)
    
    # The second extraction should return the same result or the original
    # (since the first extraction already cleaned it)
    assert merchant2 == merchant1 or merchant2 == merchant1.strip(), (
        f"Merchant extraction should be idempotent. "
        f"First: '{merchant1}', Second: '{merchant2}'"
    )
