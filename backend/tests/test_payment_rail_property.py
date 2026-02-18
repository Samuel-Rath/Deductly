"""
Property-based tests for payment rail detection.

Feature: tax-deduction-analyzer
Property 5: Payment Rail Detection

Validates: Requirements 2.5
"""

import pytest
from hypothesis import given, strategies as st, assume
from processing.csv_parser import CSVParser


# Define payment rail keywords and their expected detection results
PAYMENT_RAIL_KEYWORDS = {
    "paypal": ["PAYPAL", "paypal", "PayPal"],
    "osko": ["OSKO", "osko", "Osko"],
    "payid": ["PAYID", "payid", "PayID", "PAY ID", "pay id"],
    "bpay": ["BPAY", "bpay", "BPay"],
    "card": ["VISA", "visa", "MASTERCARD", "mastercard", "EFTPOS", "eftpos", 
             "AMEX", "amex", "DEBIT CARD", "debit card", "CREDIT CARD", "credit card"],
    "direct_debit": ["DIRECT DEBIT", "direct debit", "DIRECT CREDIT", "direct credit"],
}


# Feature: tax-deduction-analyzer, Property 5: Payment Rail Detection
@given(
    rail_type=st.sampled_from(list(PAYMENT_RAIL_KEYWORDS.keys())),
    keyword_index=st.integers(min_value=0, max_value=10),
    prefix=st.text(
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
        max_size=20
    ),
    suffix=st.text(
        alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
        max_size=20
    )
)
@pytest.mark.property_test
def test_payment_rail_detection(rail_type, keyword_index, prefix, suffix):
    """
    Property 5: Payment Rail Detection
    
    For any transaction description containing payment rail keywords
    (card, PayPal, BPAY, Osko, PayID), the payment_rail field should be
    populated with the detected rail type.
    
    This test validates that payment rail detection is:
    1. Case-insensitive
    2. Works with keywords anywhere in the description
    3. Returns the correct rail type (when only one keyword is present)
    
    Validates: Requirements 2.5
    """
    # Get a keyword for this rail type
    keywords = PAYMENT_RAIL_KEYWORDS[rail_type]
    keyword = keywords[keyword_index % len(keywords)]
    
    # Create description with keyword embedded
    description = f"{prefix} {keyword} {suffix}".strip()
    
    # Skip if description is empty
    assume(description != "")
    
    # Skip if the prefix or suffix contains other payment rail keywords
    # (to avoid testing priority behavior which is implementation-specific)
    desc_upper = description.upper()
    other_keywords = [
        kw.upper() for other_type, kws in PAYMENT_RAIL_KEYWORDS.items()
        if other_type != rail_type
        for kw in kws
    ]
    for other_kw in other_keywords:
        assume(other_kw not in desc_upper)
    
    parser = CSVParser()
    detected_rail = parser.detect_payment_rail(description)
    
    # Property: The detected rail should match the expected rail type
    assert detected_rail == rail_type, (
        f"Expected rail type '{rail_type}' for keyword '{keyword}' in description '{description}', "
        f"but got '{detected_rail}'"
    )


@given(
    keyword=st.sampled_from([
        kw for keywords in PAYMENT_RAIL_KEYWORDS.values() for kw in keywords
    ])
)
@pytest.mark.property_test
def test_payment_rail_detection_keyword_only(keyword):
    """
    Property test for payment rail detection with keyword only.
    
    For any payment rail keyword, detection should work even if it's
    the only content in the description.
    
    Validates: Requirements 2.5
    """
    parser = CSVParser()
    detected_rail = parser.detect_payment_rail(keyword)
    
    # Property: Detection should not return None for known keywords
    assert detected_rail is not None, (
        f"Payment rail detection returned None for known keyword '{keyword}'"
    )
    
    # Property: The detected rail should be one of the valid rail types
    valid_rails = list(PAYMENT_RAIL_KEYWORDS.keys())
    assert detected_rail in valid_rails, (
        f"Detected rail '{detected_rail}' is not a valid rail type. "
        f"Valid types: {valid_rails}"
    )


@given(description=st.text(min_size=1, max_size=200))
@pytest.mark.property_test
def test_payment_rail_detection_no_false_positives(description):
    """
    Property test to ensure no false positives.
    
    For any description that doesn't contain payment rail keywords,
    detection should return None.
    
    Validates: Requirements 2.5
    """
    # Check if description contains any payment rail keywords
    desc_upper = description.upper()
    contains_keyword = any(
        kw.upper() in desc_upper
        for keywords in PAYMENT_RAIL_KEYWORDS.values()
        for kw in keywords
    )
    
    parser = CSVParser()
    detected_rail = parser.detect_payment_rail(description)
    
    if not contains_keyword:
        # Property: If no keyword is present, detection should return None
        assert detected_rail is None, (
            f"Payment rail detection returned '{detected_rail}' for description "
            f"without payment rail keywords: '{description}'"
        )
    else:
        # If keyword is present, detection should return a valid rail type
        if detected_rail is not None:
            valid_rails = list(PAYMENT_RAIL_KEYWORDS.keys())
            assert detected_rail in valid_rails, (
                f"Detected rail '{detected_rail}' is not a valid rail type"
            )


@given(
    rail_type=st.sampled_from(list(PAYMENT_RAIL_KEYWORDS.keys())),
    case_variant=st.sampled_from(["upper", "lower", "mixed"])
)
@pytest.mark.property_test
def test_payment_rail_detection_case_insensitive(rail_type, case_variant):
    """
    Property test for case-insensitive detection.
    
    Payment rail detection should work regardless of the case of the keyword.
    
    Validates: Requirements 2.5
    """
    # Get a keyword for this rail type
    keyword = PAYMENT_RAIL_KEYWORDS[rail_type][0]
    
    # Apply case variant
    if case_variant == "upper":
        keyword = keyword.upper()
    elif case_variant == "lower":
        keyword = keyword.lower()
    else:  # mixed
        keyword = "".join(
            c.upper() if i % 2 == 0 else c.lower()
            for i, c in enumerate(keyword)
        )
    
    description = f"Transaction via {keyword}"
    
    parser = CSVParser()
    detected_rail = parser.detect_payment_rail(description)
    
    # Property: Detection should work regardless of case
    assert detected_rail == rail_type, (
        f"Case-insensitive detection failed. Expected '{rail_type}' for keyword '{keyword}', "
        f"got '{detected_rail}'"
    )


@given(
    rail_type1=st.sampled_from(list(PAYMENT_RAIL_KEYWORDS.keys())),
    rail_type2=st.sampled_from(list(PAYMENT_RAIL_KEYWORDS.keys()))
)
@pytest.mark.property_test
def test_payment_rail_detection_priority(rail_type1, rail_type2):
    """
    Property test for detection priority when multiple keywords are present.
    
    When multiple payment rail keywords are present, the detection should
    return one of them (based on priority order in the implementation).
    
    Validates: Requirements 2.5
    """
    # Skip if both rail types are the same
    assume(rail_type1 != rail_type2)
    
    keyword1 = PAYMENT_RAIL_KEYWORDS[rail_type1][0]
    keyword2 = PAYMENT_RAIL_KEYWORDS[rail_type2][0]
    
    description = f"{keyword1} payment via {keyword2}"
    
    parser = CSVParser()
    detected_rail = parser.detect_payment_rail(description)
    
    # Property: Detection should return one of the present rail types
    # (the implementation has a priority order: paypal > osko > payid > bpay > card > direct_debit)
    assert detected_rail in [rail_type1, rail_type2], (
        f"When multiple keywords are present, detection should return one of them. "
        f"Keywords: '{keyword1}' ({rail_type1}), '{keyword2}' ({rail_type2}). "
        f"Got: '{detected_rail}'"
    )


@given(description=st.text(min_size=0, max_size=200))
@pytest.mark.property_test
def test_payment_rail_detection_never_crashes(description):
    """
    Property test to ensure detection never crashes.
    
    For any input (including empty, None-like, special characters),
    detection should return either a valid rail type or None without crashing.
    
    Validates: Requirements 2.5
    """
    parser = CSVParser()
    
    # This should never raise an exception
    try:
        detected_rail = parser.detect_payment_rail(description)
        
        # Property: Result should be either None or a valid rail type
        if detected_rail is not None:
            valid_rails = list(PAYMENT_RAIL_KEYWORDS.keys())
            assert detected_rail in valid_rails, (
                f"Detected rail '{detected_rail}' is not a valid rail type"
            )
    except Exception as e:
        pytest.fail(f"Payment rail detection crashed with description '{description}': {e}")


@given(
    merchant=st.text(
        alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
        min_size=3,
        max_size=30
    ),
    rail_keyword=st.sampled_from([
        kw for keywords in PAYMENT_RAIL_KEYWORDS.values() for kw in keywords
    ])
)
@pytest.mark.property_test
def test_payment_rail_detection_with_merchant(merchant, rail_keyword):
    """
    Property test for realistic transaction descriptions.
    
    For descriptions that combine merchant names with payment rail keywords
    (like "PAYPAL *ADOBE" or "VISA WOOLWORTHS"), detection should work correctly.
    
    Validates: Requirements 2.5
    """
    # Skip if merchant is empty
    assume(merchant.strip() != "")
    
    # Create realistic description formats
    description_formats = [
        f"{rail_keyword} {merchant}",
        f"{rail_keyword} *{merchant}",
        f"{merchant} {rail_keyword}",
        f"{rail_keyword.upper()} {merchant.upper()}",
    ]
    
    parser = CSVParser()
    
    for description in description_formats:
        detected_rail = parser.detect_payment_rail(description)
        
        # Property: Detection should work with merchant names present
        assert detected_rail is not None, (
            f"Payment rail detection failed for description with merchant. "
            f"Description: '{description}', Keyword: '{rail_keyword}'"
        )
        
        # Property: The detected rail should be valid
        valid_rails = list(PAYMENT_RAIL_KEYWORDS.keys())
        assert detected_rail in valid_rails, (
            f"Detected rail '{detected_rail}' is not a valid rail type"
        )
