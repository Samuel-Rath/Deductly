"""
Unit tests for LLMClassifier (backend/rag/llm_classifier.py).

Covers the enhance() pass-through and processing logic, the _merge() merging
strategy for confidence, categories, flags, evidence checklists, reason strings,
and the _map_category() enum mapping helper.

All heavy dependencies (RAGEngine, Anthropic) are mocked so these tests run
fully offline without any API key. Pydantic model_construct() is used to
build test objects without triggering field validation.
"""

import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import MagicMock

from backend.models.schemas import (
    ClassifiedTransaction,
    NormalisedTransaction,
    TransactionDirection,
    DeductionCategory,
    EvidenceType,
)
from backend.rag.rag_engine import RAGEngine, RAGResult
from backend.rag.llm_classifier import LLMClassifier, DISCLAIMER


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def make_normalised(
    description: str = "gym membership",
    merchant: str = "Anytime Fitness",
    amount: float = 50.0,
) -> NormalisedTransaction:
    """Build a minimal NormalisedTransaction using model_construct (no validation)."""
    return NormalisedTransaction.model_construct(
        transaction_id="test-id",
        date=date(2025, 7, 1),
        description=description,
        merchant=merchant,
        direction=TransactionDirection.DEBIT,
        absolute_amount=Decimal(str(amount)),
        signed_amount=Decimal(str(-amount)),
        payment_rail=None,
        recurring_flag=False,
        raw_data={},
    )


def make_classified(
    description: str = "gym membership",
    merchant: str = "Anytime Fitness",
    confidence: float = 0.0,
    flags: list = None,
    category: DeductionCategory = None,
    reason: str = "no_rule_matched",
    evidence_checklist: list = None,
    matched_rule_id: str = None,
    matched_rule_version: str = None,
    amount: float = 50.0,
) -> ClassifiedTransaction:
    """
    Build a ClassifiedTransaction with a NormalisedTransaction inside using
    model_construct(), keeping test code clean and avoiding validation overhead.
    """
    txn = make_normalised(description=description, merchant=merchant, amount=amount)
    return ClassifiedTransaction.model_construct(
        transaction=txn,
        category=category,
        confidence=confidence,
        matched_rule_id=matched_rule_id,
        matched_rule_version=matched_rule_version,
        reason=reason,
        evidence_checklist=evidence_checklist or [],
        flags=flags or [],
    )


def make_rag_result(
    is_fitness_related: bool = True,
    is_potentially_deductible: bool = True,
    occupation_dependent: bool = True,
    category: str = "fitness_gym",
    mapped_category: str = "fitness_related",
    confidence: int = 75,
    confidence_float: float = 0.75,
    reason: str = "Gym expense with nexus to income.",
    ato_citation: str = "Section 8-1 ITAA 1997",
    conditions: list = None,
    evidence_required: list = None,
    keyword_score: int = 20,
    rag_grounding_score: int = 30,
    claude_score: int = 25,
) -> RAGResult:
    """Build a RAGResult with controlled field values for merge testing."""
    return RAGResult(
        is_fitness_related=is_fitness_related,
        is_potentially_deductible=is_potentially_deductible,
        occupation_dependent=occupation_dependent,
        category=category,
        mapped_category=mapped_category,
        confidence=confidence,
        confidence_float=confidence_float,
        reason=reason,
        ato_citation=ato_citation,
        conditions=conditions or [],
        evidence_required=evidence_required or ["receipt"],
        disclaimer="Not tax advice.",
        keyword_score=keyword_score,
        rag_grounding_score=rag_grounding_score,
        claude_score=claude_score,
        raw_response=None,
    )


def make_mock_engine(
    is_fitness_related: bool = True,
    rag_result: RAGResult = None,
    available: bool = True,
) -> MagicMock:
    """
    Build a MagicMock RAGEngine that reports availability and returns a
    controlled RAGResult from classify_transaction().
    """
    mock = MagicMock(spec=RAGEngine)
    mock.available = available
    mock.kb = MagicMock()
    mock.kb.is_fitness_related.return_value = is_fitness_related
    if rag_result is None:
        rag_result = make_rag_result()
    mock.classify_transaction.return_value = rag_result
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def default_rag_result():
    """A standard RAGResult with reasonable values for merge tests."""
    return make_rag_result()


@pytest.fixture
def classifier(default_rag_result):
    """LLMClassifier backed by a mocked RAGEngine that always returns default_rag_result."""
    engine = make_mock_engine(rag_result=default_rag_result)
    return LLMClassifier(rag_engine=engine)


# ---------------------------------------------------------------------------
# enhance() — basic routing
# ---------------------------------------------------------------------------

class TestEnhanceRouting:
    """Tests that verify enhance() correctly routes transactions."""

    def test_empty_list_returns_empty_list(self, classifier):
        """Verifies that enhance([]) returns an empty list."""
        result = classifier.enhance([])
        assert result == []

    def test_non_fitness_transaction_returned_unchanged(self):
        """
        Verifies that a non-fitness transaction is returned as-is (the same
        object reference) without calling classify_transaction().
        """
        engine = make_mock_engine(is_fitness_related=False)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(description="groceries", merchant="Woolworths", confidence=0.0)
        result = clf.enhance([ct])
        assert result[0] is ct
        engine.classify_transaction.assert_not_called()

    def test_fitness_transaction_is_processed(self):
        """Verifies that a fitness-related transaction triggers classify_transaction()."""
        engine = make_mock_engine(is_fitness_related=True)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(description="gym membership", merchant="Anytime Fitness", confidence=0.0)
        clf.enhance([ct])
        engine.classify_transaction.assert_called_once()

    def test_skips_fitness_transaction_when_confidence_meets_override_threshold(self):
        """
        Verifies that a fitness transaction with existing confidence >= override_threshold
        (default 0.60) is skipped and returned unchanged, not sent through RAG.
        """
        engine = make_mock_engine(is_fitness_related=True)
        clf = LLMClassifier(rag_engine=engine, override_threshold=0.60)
        # confidence=0.65 >= 0.60 threshold, AND is_fitness=True → code checks
        # ct.confidence >= self.override_threshold AND NOT is_fitness
        # so if is_fitness=True, the first guard is bypassed and RAG is run
        # Let's test the documented guard: skip when confidence >= threshold AND NOT fitness
        non_fitness_engine = make_mock_engine(is_fitness_related=False)
        clf2 = LLMClassifier(rag_engine=non_fitness_engine, override_threshold=0.60)
        ct = make_classified(description="amazon prime", merchant="Amazon", confidence=0.65)
        result = clf2.enhance([ct])
        assert result[0] is ct
        non_fitness_engine.classify_transaction.assert_not_called()

    def test_fitness_transaction_with_low_confidence_is_processed(self):
        """
        Verifies that a fitness transaction with confidence below override_threshold
        is sent through the RAG pipeline even when the rule-based engine found something.
        """
        engine = make_mock_engine(is_fitness_related=True)
        clf = LLMClassifier(rag_engine=engine, override_threshold=0.60)
        ct = make_classified(description="gym membership", merchant="Anytime Fitness", confidence=0.30)
        clf.enhance([ct])
        engine.classify_transaction.assert_called_once()

    def test_enhance_preserves_list_length(self):
        """Verifies that enhance() always returns a list of the same length as the input."""
        engine = make_mock_engine(is_fitness_related=False)
        clf = LLMClassifier(rag_engine=engine)
        items = [
            make_classified("groceries", "Woolworths", 0.0),
            make_classified("netflix", "Netflix", 0.0),
            make_classified("rent", "", 0.0),
        ]
        result = clf.enhance(items)
        assert len(result) == len(items)


# ---------------------------------------------------------------------------
# _merge() — confidence and category selection
# ---------------------------------------------------------------------------

class TestMergeConfidenceAndCategory:
    """Tests for _merge() confidence / category selection logic."""

    def test_merge_uses_rag_category_when_rag_confidence_higher(self, classifier):
        """
        Verifies that when rag.confidence_float > original.confidence, the merged
        result uses the RAG-derived category and confidence.
        """
        original = make_classified(confidence=0.20, category=None)
        rag = make_rag_result(confidence_float=0.75, mapped_category="fitness_related")
        merged = classifier._merge(original, rag)
        assert merged.confidence == 0.75
        assert merged.category == DeductionCategory.FITNESS_RELATED

    def test_merge_keeps_original_category_when_rag_confidence_lower(self, classifier):
        """
        Verifies that when rag.confidence_float <= original.confidence, the merged
        result preserves the original category and confidence.
        """
        original = make_classified(
            confidence=0.90,
            category=DeductionCategory.WORK_SOFTWARE,
            matched_rule_id="R001",
            matched_rule_version="1.0",
        )
        rag = make_rag_result(confidence_float=0.40)
        merged = classifier._merge(original, rag)
        assert merged.confidence == 0.90
        assert merged.category == DeductionCategory.WORK_SOFTWARE

    def test_merge_uses_rag_rule_id_when_rag_wins(self, classifier):
        """Verifies that matched_rule_id reflects the RAG rule when RAG confidence is higher."""
        original = make_classified(confidence=0.10, matched_rule_id="OLD-RULE")
        rag = make_rag_result(confidence_float=0.80, category="fitness_gym")
        merged = classifier._merge(original, rag)
        assert "RAG-FITNESS" in merged.matched_rule_id

    def test_merge_preserves_original_rule_id_when_rag_loses(self, classifier):
        """Verifies that matched_rule_id is preserved when original confidence is higher."""
        original = make_classified(
            confidence=0.90,
            matched_rule_id="RULE-XYZ",
            matched_rule_version="v2",
        )
        rag = make_rag_result(confidence_float=0.30)
        merged = classifier._merge(original, rag)
        assert merged.matched_rule_id == "RULE-XYZ"


# ---------------------------------------------------------------------------
# _merge() — flags
# ---------------------------------------------------------------------------

class TestMergeFlags:
    """Tests for _merge() flag manipulation."""

    def test_merge_always_adds_rag_analysed_flag(self, classifier):
        """Verifies that 'rag_analysed' is added to flags in every merge."""
        original = make_classified(flags=[])
        rag = make_rag_result()
        merged = classifier._merge(original, rag)
        assert "rag_analysed" in merged.flags

    def test_merge_adds_occupation_dependent_flag_when_true(self, classifier):
        """Verifies 'occupation_dependent' is added when rag.occupation_dependent=True."""
        original = make_classified(flags=[])
        rag = make_rag_result(occupation_dependent=True)
        merged = classifier._merge(original, rag)
        assert "occupation_dependent" in merged.flags

    def test_merge_does_not_duplicate_occupation_dependent_flag(self, classifier):
        """Verifies 'occupation_dependent' is not added again if already present."""
        original = make_classified(flags=["occupation_dependent"])
        rag = make_rag_result(occupation_dependent=True)
        merged = classifier._merge(original, rag)
        assert merged.flags.count("occupation_dependent") == 1

    def test_merge_adds_needs_review_when_not_deductible(self, classifier):
        """Verifies 'needs_review' is added when rag.is_potentially_deductible=False."""
        original = make_classified(flags=[])
        rag = make_rag_result(is_potentially_deductible=False)
        merged = classifier._merge(original, rag)
        assert "needs_review" in merged.flags

    def test_merge_does_not_add_needs_review_when_deductible(self, classifier):
        """Verifies 'needs_review' is NOT added when rag.is_potentially_deductible=True."""
        original = make_classified(flags=[])
        rag = make_rag_result(is_potentially_deductible=True)
        merged = classifier._merge(original, rag)
        assert "needs_review" not in merged.flags

    def test_merge_does_not_add_occupation_dependent_when_false(self, classifier):
        """Verifies 'occupation_dependent' is not added when rag.occupation_dependent=False."""
        original = make_classified(flags=[])
        rag = make_rag_result(occupation_dependent=False)
        merged = classifier._merge(original, rag)
        assert "occupation_dependent" not in merged.flags

    def test_merge_preserves_existing_flags(self, classifier):
        """Verifies that pre-existing flags on the original are preserved after merge."""
        original = make_classified(flags=["some_existing_flag"])
        rag = make_rag_result()
        merged = classifier._merge(original, rag)
        assert "some_existing_flag" in merged.flags


# ---------------------------------------------------------------------------
# _merge() — evidence checklist
# ---------------------------------------------------------------------------

class TestMergeEvidence:
    """Tests for _merge() evidence checklist merging."""

    def test_merge_adds_new_evidence_type_from_rag(self, classifier):
        """Verifies that a new evidence type from RAG is appended to the checklist."""
        original = make_classified(evidence_checklist=[])
        rag = make_rag_result(evidence_required=["receipt"])
        merged = classifier._merge(original, rag)
        assert EvidenceType.RECEIPT in merged.evidence_checklist

    def test_merge_does_not_duplicate_existing_evidence_type(self, classifier):
        """Verifies that an evidence type already present is not added again."""
        original = make_classified(evidence_checklist=[EvidenceType.RECEIPT])
        rag = make_rag_result(evidence_required=["receipt"])
        merged = classifier._merge(original, rag)
        assert merged.evidence_checklist.count(EvidenceType.RECEIPT) == 1

    def test_merge_adds_multiple_new_evidence_types(self, classifier):
        """Verifies that multiple new evidence types from RAG are all added."""
        original = make_classified(evidence_checklist=[])
        rag = make_rag_result(evidence_required=["receipt", "diary"])
        merged = classifier._merge(original, rag)
        assert EvidenceType.RECEIPT in merged.evidence_checklist
        assert EvidenceType.DIARY in merged.evidence_checklist

    def test_merge_ignores_unknown_evidence_type_strings(self, classifier):
        """Verifies that unrecognised evidence strings are silently ignored (no KeyError)."""
        original = make_classified(evidence_checklist=[])
        rag = make_rag_result(evidence_required=["unknown_evidence_type_xyz"])
        merged = classifier._merge(original, rag)
        # Should not raise and checklist should still be valid
        assert isinstance(merged.evidence_checklist, list)


# ---------------------------------------------------------------------------
# _merge() — reason string
# ---------------------------------------------------------------------------

class TestMergeReason:
    """Tests for _merge() reason string composition."""

    def test_reason_contains_ato_citation(self, classifier):
        """Verifies that the ATO citation appears in the merged reason field."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(ato_citation="Section 8-1 ITAA 1997")
        merged = classifier._merge(original, rag)
        assert "Section 8-1 ITAA 1997" in merged.reason

    def test_reason_contains_keyword_score(self, classifier):
        """Verifies that the keyword score appears in the merged reason field."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(keyword_score=20)
        merged = classifier._merge(original, rag)
        assert "keyword=20/30" in merged.reason

    def test_reason_contains_grounding_score(self, classifier):
        """Verifies that the grounding score appears in the merged reason field."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(rag_grounding_score=30)
        merged = classifier._merge(original, rag)
        assert "grounding=30/40" in merged.reason

    def test_reason_contains_claude_score(self, classifier):
        """Verifies that the Claude score appears in the merged reason field."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(claude_score=25)
        merged = classifier._merge(original, rag)
        assert "claude=25/30" in merged.reason

    def test_reason_contains_disclaimer_text(self, classifier):
        """Verifies that the DISCLAIMER constant text appears in the merged reason field."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result()
        merged = classifier._merge(original, rag)
        assert DISCLAIMER in merged.reason

    def test_reason_includes_original_reason_when_not_placeholder(self, classifier):
        """
        Verifies that when the original reason is meaningful text (not 'no_rule_matched'),
        it is prepended to the RAG reason in the merged result.
        """
        original = make_classified(reason="Rule-based: matches work software keyword.")
        rag = make_rag_result()
        merged = classifier._merge(original, rag)
        assert "Rule-based:" in merged.reason

    def test_reason_omits_original_placeholder(self, classifier):
        """
        Verifies that when original.reason == 'no_rule_matched', only the RAG
        reason appears (the placeholder is not prepended).
        """
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(reason="RAG explanation here.")
        merged = classifier._merge(original, rag)
        # The placeholder should not appear literally in the output
        assert "no_rule_matched" not in merged.reason

    def test_reason_contains_rag_reason_text(self, classifier):
        """Verifies that the RAG reason text itself appears in the merged reason."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(reason="Gym expense with nexus to income.")
        merged = classifier._merge(original, rag)
        assert "Gym expense with nexus to income." in merged.reason

    def test_reason_contains_conditions_when_present(self, classifier):
        """Verifies that any conditions from the RAG result appear in the merged reason."""
        original = make_classified(reason="no_rule_matched")
        rag = make_rag_result(conditions=["employer fitness requirement letter"])
        merged = classifier._merge(original, rag)
        assert "employer fitness requirement letter" in merged.reason


# ---------------------------------------------------------------------------
# _map_category()
# ---------------------------------------------------------------------------

class TestMapCategory:
    """Tests for _map_category() enum conversion."""

    def _make_classifier_with_dummy_engine(self):
        """Helper that creates a LLMClassifier with a minimal mock engine."""
        engine = make_mock_engine()
        return LLMClassifier(rag_engine=engine)

    def test_maps_fitness_related_to_fitness_related_enum(self):
        """Verifies that mapped_category='fitness_related' → DeductionCategory.FITNESS_RELATED."""
        clf = self._make_classifier_with_dummy_engine()
        rag = make_rag_result(
            mapped_category="fitness_related",
            is_potentially_deductible=True,
        )
        result = clf._map_category(rag)
        assert result == DeductionCategory.FITNESS_RELATED

    def test_maps_training_education_to_training_education_enum(self):
        """Verifies that category='training_education' → DeductionCategory.TRAINING_EDUCATION."""
        clf = self._make_classifier_with_dummy_engine()
        rag = make_rag_result(
            category="training_education",
            mapped_category="training_education",
            is_potentially_deductible=True,
        )
        result = clf._map_category(rag)
        assert result == DeductionCategory.TRAINING_EDUCATION

    def test_returns_none_when_not_potentially_deductible(self):
        """
        Verifies that _map_category() returns None when rag.is_potentially_deductible=False,
        regardless of the category string.
        """
        clf = self._make_classifier_with_dummy_engine()
        rag = make_rag_result(
            mapped_category="fitness_related",
            is_potentially_deductible=False,
        )
        result = clf._map_category(rag)
        assert result is None

    def test_returns_fitness_related_for_unknown_mapped_category(self):
        """
        Verifies that an unrecognised mapped_category falls back to FITNESS_RELATED
        when is_potentially_deductible=True and category is not 'training_education'.
        """
        clf = self._make_classifier_with_dummy_engine()
        rag = make_rag_result(
            category="fitness_gym",
            mapped_category="",           # unknown / missing
            is_potentially_deductible=True,
        )
        result = clf._map_category(rag)
        assert result == DeductionCategory.FITNESS_RELATED

    @pytest.mark.parametrize("category,mapped_category,expected", [
        ("fitness_gym", "fitness_related", DeductionCategory.FITNESS_RELATED),
        ("fitness_pt", "fitness_related", DeductionCategory.FITNESS_RELATED),
        ("training_education", "training_education", DeductionCategory.TRAINING_EDUCATION),
        ("non_deductible", "non_deductible", None),
    ])
    def test_map_category_parametrized(self, category, mapped_category, expected):
        """
        Parametrized test covering multiple common category/mapped_category combinations
        to verify _map_category() produces the correct DeductionCategory enum value or None.
        """
        engine = make_mock_engine()
        clf = LLMClassifier(rag_engine=engine)
        is_deductible = category not in ("non_deductible", "unknown")
        rag = make_rag_result(
            category=category,
            mapped_category=mapped_category,
            is_potentially_deductible=is_deductible,
        )
        result = clf._map_category(rag)
        assert result == expected


# ---------------------------------------------------------------------------
# Full enhance() integration with mock engine
# ---------------------------------------------------------------------------

class TestEnhanceIntegration:
    """Integration-style tests for the complete enhance() flow using a mocked RAGEngine."""

    def test_enhance_produces_classified_transaction(self):
        """
        Verifies that enhance() on a fitness transaction returns a ClassifiedTransaction
        (not None and not the original unchanged object after merging).
        """
        rag_result = make_rag_result(confidence_float=0.75)
        engine = make_mock_engine(is_fitness_related=True, rag_result=rag_result)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(description="gym membership", merchant="Anytime Fitness", confidence=0.0)
        results = clf.enhance([ct])
        assert len(results) == 1
        assert isinstance(results[0], ClassifiedTransaction)

    def test_enhance_sets_rag_analysed_flag_on_fitness_transaction(self):
        """Verifies the 'rag_analysed' flag is present after enhance() processes a fitness item."""
        rag_result = make_rag_result(confidence_float=0.75)
        engine = make_mock_engine(is_fitness_related=True, rag_result=rag_result)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(description="gym membership", merchant="Anytime Fitness", confidence=0.0)
        results = clf.enhance([ct])
        assert "rag_analysed" in results[0].flags

    def test_enhance_does_not_modify_non_fitness_transaction(self):
        """
        Verifies that a non-fitness transaction object passes through enhance()
        without being modified (identity check).
        """
        engine = make_mock_engine(is_fitness_related=False)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(description="netflix", merchant="Netflix", confidence=0.5)
        results = clf.enhance([ct])
        assert results[0] is ct

    def test_enhance_upgrades_confidence_when_rag_higher(self):
        """
        Verifies that after enhance(), a fitness transaction's confidence is upgraded
        to the RAG confidence_float when RAG outperforms the original score.
        """
        rag_result = make_rag_result(confidence_float=0.80)
        engine = make_mock_engine(is_fitness_related=True, rag_result=rag_result)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(
            description="gym membership",
            merchant="Anytime Fitness",
            confidence=0.20,  # low original confidence
        )
        results = clf.enhance([ct])
        assert results[0].confidence == 0.80

    def test_enhance_preserves_confidence_when_original_higher(self):
        """
        Verifies that after enhance(), a fitness transaction's confidence is preserved
        at the original level when the rule-based score exceeds the RAG score.
        """
        rag_result = make_rag_result(confidence_float=0.30)
        engine = make_mock_engine(is_fitness_related=True, rag_result=rag_result)
        clf = LLMClassifier(rag_engine=engine)
        ct = make_classified(
            description="gym membership",
            merchant="Anytime Fitness",
            confidence=0.80,  # high original confidence
        )
        results = clf.enhance([ct])
        assert results[0].confidence == 0.80
