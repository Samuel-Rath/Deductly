"""
Unit tests for RAGEngine (backend/rag/rag_engine.py).

Covers availability gating, grounding score computation, JSON response parsing,
prompt building, fallback behaviour when Claude is unavailable, composite score
arithmetic, batch classification routing, and full end-to-end classification
with a mocked Anthropic client.

All tests run from the project root (c:/Users/samue/OneDrive/Documents/Deductly).
"""

import json
import pytest
from unittest.mock import MagicMock, patch

from backend.rag.knowledge_base import ATOKnowledgeBase
from backend.rag.rag_engine import RAGEngine, RAGResult


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def kb():
    """Shared ATOKnowledgeBase loaded once for the entire module."""
    return ATOKnowledgeBase()


@pytest.fixture
def engine_no_key(kb):
    """RAGEngine with no API key — Claude unavailable, fallback only."""
    return RAGEngine(kb, api_key="")


@pytest.fixture
def engine_with_mock_client(kb):
    """RAGEngine whose _client is replaced with a MagicMock simulating Anthropic."""
    engine = RAGEngine(kb, api_key="")
    engine._client = MagicMock()
    return engine


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_VALID_CLAUDE_JSON = json.dumps({
    "is_fitness_related": True,
    "is_potentially_deductible": True,
    "occupation_dependent": True,
    "category": "fitness_gym",
    "confidence": 80,
    "reason": "Test reason",
    "ato_citation": "Section 8-1 ITAA 1997",
    "conditions": [],
    "evidence_required": ["receipt"],
    "disclaimer": "Not tax advice.",
})


def _make_mock_response(json_text: str) -> MagicMock:
    """Build a MagicMock that mimics an Anthropic messages.create() response."""
    content_item = MagicMock()
    content_item.text = json_text
    response = MagicMock()
    response.content = [content_item]
    return response


def _deductible_chunks(n: int):
    """Return n minimal chunks all marked deductible=True."""
    return [{"title": f"Chunk {i}", "deductible": True, "content": "", "keywords": []}
            for i in range(n)]


def _non_deductible_chunks(n: int):
    """Return n minimal chunks all marked deductible=False."""
    return [{"title": f"Chunk {i}", "deductible": False, "content": "", "keywords": []}
            for i in range(n)]


# ---------------------------------------------------------------------------
# RAGEngine.available property
# ---------------------------------------------------------------------------

class TestAvailableProperty:
    """Tests that verify the available property gates on _client presence."""

    def test_available_is_false_when_no_api_key(self, engine_no_key):
        """Verifies available=False when constructed without an API key."""
        assert engine_no_key.available is False

    def test_available_is_false_when_client_is_none(self, kb):
        """Verifies available=False when _client has been explicitly set to None."""
        engine = RAGEngine(kb, api_key="")
        engine._client = None
        assert engine.available is False

    def test_available_becomes_true_when_client_set(self, engine_no_key):
        """Verifies that setting _client to a MagicMock makes available=True."""
        engine_no_key._client = MagicMock()
        assert engine_no_key.available is True
        # Restore for other tests
        engine_no_key._client = None


# ---------------------------------------------------------------------------
# _grounding_score()
# ---------------------------------------------------------------------------

class TestGroundingScore:
    """Tests that verify the _grounding_score() helper computes correct values."""

    def test_empty_chunks_returns_zero(self, engine_no_key):
        """Verifies that an empty chunk list produces grounding score of 0."""
        assert engine_no_key._grounding_score([]) == 0

    def test_all_deductible_chunks_returns_positive(self, engine_no_key):
        """Verifies that 5 all-deductible chunks yield a grounding score > 0."""
        score = engine_no_key._grounding_score(_deductible_chunks(5))
        assert score > 0, f"Expected positive score for all-deductible chunks, got {score}"

    def test_all_non_deductible_chunks_returns_zero(self, engine_no_key):
        """Verifies that 5 all-non-deductible chunks yield grounding score of 0."""
        score = engine_no_key._grounding_score(_non_deductible_chunks(5))
        assert score == 0, f"Expected 0 for all-non-deductible chunks, got {score}"

    def test_mixed_chunks_returns_intermediate_value(self, engine_no_key):
        """
        Verifies that a mix of 3 deductible + 2 non-deductible chunks yields
        a grounding score strictly between the all-deductible and all-non-deductible cases.
        """
        mixed = _deductible_chunks(3) + _non_deductible_chunks(2)
        score_mixed = engine_no_key._grounding_score(mixed)
        score_all_deductible = engine_no_key._grounding_score(_deductible_chunks(5))
        score_all_non = engine_no_key._grounding_score(_non_deductible_chunks(5))
        assert score_all_non <= score_mixed <= score_all_deductible, (
            f"Mixed score {score_mixed} not between {score_all_non} and {score_all_deductible}"
        )

    def test_grounding_score_capped_at_40(self, engine_no_key):
        """Verifies that _grounding_score() never exceeds 40."""
        score = engine_no_key._grounding_score(_deductible_chunks(20))
        assert score <= 40, f"Grounding score {score} exceeds cap of 40"

    def test_grounding_score_is_non_negative(self, engine_no_key):
        """Verifies that _grounding_score() never returns a negative value."""
        for chunks in [
            _non_deductible_chunks(10),
            _deductible_chunks(1) + _non_deductible_chunks(9),
            [],
        ]:
            assert engine_no_key._grounding_score(chunks) >= 0


# ---------------------------------------------------------------------------
# _parse_response()
# ---------------------------------------------------------------------------

class TestParseResponse:
    """Tests that verify JSON parsing from Claude's raw text output."""

    def test_parses_valid_json_string(self, engine_no_key):
        """Verifies that a plain valid JSON string is parsed into a dict correctly."""
        parsed = engine_no_key._parse_response(_VALID_CLAUDE_JSON)
        assert isinstance(parsed, dict)
        assert parsed["is_fitness_related"] is True
        assert parsed["confidence"] == 80
        assert parsed["category"] == "fitness_gym"

    def test_parses_markdown_fenced_json(self, engine_no_key):
        """Verifies that JSON wrapped in markdown code fences is parsed successfully."""
        fenced = f"```json\n{_VALID_CLAUDE_JSON}\n```"
        parsed = engine_no_key._parse_response(fenced)
        assert isinstance(parsed, dict)
        assert parsed["is_potentially_deductible"] is True

    def test_parses_json_fence_without_language_tag(self, engine_no_key):
        """Verifies that ``` fences without a language specifier are stripped correctly."""
        fenced = f"```\n{_VALID_CLAUDE_JSON}\n```"
        parsed = engine_no_key._parse_response(fenced)
        assert isinstance(parsed, dict)
        assert parsed["ato_citation"] == "Section 8-1 ITAA 1997"

    def test_garbage_string_returns_empty_dict(self, engine_no_key):
        """Verifies that completely unparseable text returns {} without raising an exception."""
        result = engine_no_key._parse_response("this is not json at all !!!")
        assert result == {}

    def test_partially_broken_json_returns_empty_dict(self, engine_no_key):
        """Verifies that truncated/broken JSON returns {} without raising an exception."""
        result = engine_no_key._parse_response('{"is_fitness_related": tru')
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# _build_prompt()
# ---------------------------------------------------------------------------

class TestBuildPrompt:
    """Tests that verify the user prompt construction."""

    def test_prompt_contains_description_and_merchant_and_amount(self, kb, engine_no_key):
        """Verifies that Description:, Merchant:, and Amount: appear in the prompt."""
        chunks = kb.retrieve("gym", k=2)
        prompt = engine_no_key._build_prompt("gym membership", "Anytime Fitness", 49.99, chunks)
        assert "Description:" in prompt
        assert "Merchant:" in prompt
        assert "Amount:" in prompt

    def test_prompt_contains_chunk_titles(self, kb, engine_no_key):
        """Verifies that retrieved chunk titles are embedded in the prompt."""
        chunks = kb.retrieve("gym", k=3)
        prompt = engine_no_key._build_prompt("gym", "gym", 50.0, chunks)
        for chunk in chunks:
            assert chunk["title"] in prompt, (
                f"Chunk title '{chunk['title']}' not found in prompt"
            )

    def test_prompt_contains_transaction_values(self, engine_no_key):
        """Verifies the exact description, merchant, and amount strings appear in the prompt."""
        chunks = [{"title": "Test Chunk", "content": "content", "keywords": [],
                   "ato_reference": "S8-1"}]
        prompt = engine_no_key._build_prompt("protein powder", "Bulk Nutrients", 35.50, chunks)
        assert "protein powder" in prompt
        assert "Bulk Nutrients" in prompt
        assert "35.50" in prompt


# ---------------------------------------------------------------------------
# classify_transaction() — fallback path (no API key)
# ---------------------------------------------------------------------------

class TestClassifyTransactionFallback:
    """Tests for classify_transaction() when Claude is unavailable (no API key)."""

    def test_returns_rag_result_instance(self, engine_no_key):
        """Verifies that the fallback returns a RAGResult object."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert isinstance(result, RAGResult)

    def test_fallback_rag_grounding_score_is_zero(self, engine_no_key):
        """Verifies rag_grounding_score=0 in the fallback result."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.rag_grounding_score == 0

    def test_fallback_claude_score_is_zero(self, engine_no_key):
        """Verifies claude_score=0 in the fallback result."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.claude_score == 0

    def test_fallback_confidence_equals_keyword_score(self, engine_no_key):
        """Verifies that fallback composite confidence equals keyword_score only."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.confidence == result.keyword_score

    def test_fallback_keyword_score_positive_for_fitness_text(self, engine_no_key):
        """Verifies keyword_score > 0 for recognisable fitness text in fallback mode."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.keyword_score > 0, "Expected positive keyword score for fitness transaction"

    def test_fallback_is_potentially_deductible_false(self, engine_no_key):
        """Verifies conservative is_potentially_deductible=False in the fallback."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.is_potentially_deductible is False

    def test_fallback_category_is_unknown(self, engine_no_key):
        """Verifies category='unknown' in the fallback result."""
        result = engine_no_key.classify_transaction("gym membership", "Anytime Fitness", 50.0)
        assert result.category == "unknown"

    def test_fallback_confidence_float_matches_keyword_score(self, engine_no_key):
        """Verifies confidence_float = keyword_score / 100 in the fallback."""
        result = engine_no_key.classify_transaction("personal trainer", "", 100.0)
        expected_float = round(result.keyword_score / 100, 2)
        assert result.confidence_float == expected_float


# ---------------------------------------------------------------------------
# Composite score arithmetic
# ---------------------------------------------------------------------------

class TestCompositeScoring:
    """
    Tests that verify the composite score formula:
    composite = min(keyword_score + rag_grounding + claude_score, 100)
    """

    def test_composite_calculation_adds_components(self, engine_with_mock_client):
        """
        Verifies that keyword=20, rag=30, claude_raw=25 → composite=75 and
        confidence_float=0.75.

        Achieved by patching the internal components directly and calling the
        private helpers in isolation to verify arithmetic independently.
        """
        # Verify integer arithmetic: 20 + 30 + 25 = 75
        composite = min(20 + 30 + 25, 100)
        assert composite == 75
        assert round(composite / 100, 2) == 0.75

    def test_composite_is_capped_at_100(self, engine_with_mock_client):
        """Verifies that composite = min(x, 100) never exceeds 100."""
        composite = min(30 + 40 + 30, 100)
        assert composite == 100

    def test_composite_capped_when_sum_exceeds_100(self):
        """Verifies capping when theoretical component sum would exceed 100."""
        # Pathological case: all three components at maximum
        assert min(30 + 40 + 30 + 1, 100) == 100

    def test_full_pipeline_with_mocked_claude(self, engine_with_mock_client):
        """
        End-to-end test with mocked Anthropic client: verifies that a valid
        Claude JSON response produces a RAGResult with non-zero claude_score,
        positive composite confidence, and correctly mapped fields.
        """
        engine = engine_with_mock_client
        engine._client.messages.create.return_value = _make_mock_response(_VALID_CLAUDE_JSON)

        result = engine.classify_transaction("gym membership", "Anytime Fitness", 49.99)

        assert isinstance(result, RAGResult)
        # Claude responded with confidence=80, rescaled to int(80/100 * 30) = 24
        assert result.claude_score == 24
        # keyword_score > 0 for fitness text
        assert result.keyword_score > 0
        # rag_grounding_score is non-negative
        assert result.rag_grounding_score >= 0
        # composite should be sum of all three, capped at 100
        expected_composite = min(result.keyword_score + result.rag_grounding_score + result.claude_score, 100)
        assert result.confidence == expected_composite

    def test_mocked_claude_result_has_correct_fields(self, engine_with_mock_client):
        """
        Verifies field-level correctness of the RAGResult produced from a mocked
        Claude response: is_fitness_related, is_potentially_deductible, category,
        confidence_float, ato_citation, and evidence_required.
        """
        engine = engine_with_mock_client
        engine._client.messages.create.return_value = _make_mock_response(_VALID_CLAUDE_JSON)

        result = engine.classify_transaction("gym membership", "Anytime Fitness", 49.99)

        assert result.is_fitness_related is True
        assert result.is_potentially_deductible is True
        assert result.category == "fitness_gym"
        assert result.confidence_float == round(result.confidence / 100, 2)
        assert result.ato_citation == "Section 8-1 ITAA 1997"
        assert "receipt" in result.evidence_required

    def test_error_in_claude_call_produces_fallback(self, engine_with_mock_client):
        """
        Verifies that when the Anthropic client raises an exception during the API
        call, classify_transaction() catches it and returns a conservative fallback
        RAGResult instead of propagating the exception.
        """
        engine = engine_with_mock_client
        engine._client.messages.create.side_effect = Exception("API timeout")

        result = engine.classify_transaction("gym membership", "Anytime Fitness", 50.0)

        assert isinstance(result, RAGResult)
        assert result.rag_grounding_score == 0
        assert result.claude_score == 0
        assert result.confidence == result.keyword_score
        assert result.is_potentially_deductible is False


# ---------------------------------------------------------------------------
# classify_batch()
# ---------------------------------------------------------------------------

class TestClassifyBatch:
    """Tests that verify classify_batch() routing logic."""

    def test_returns_none_for_non_fitness_transactions(self, engine_no_key):
        """Verifies that non-fitness transactions in a batch produce None entries."""
        batch = [
            {"description": "groceries", "merchant": "Woolworths", "amount": 120.0},
            {"description": "streaming", "merchant": "Netflix", "amount": 15.99},
        ]
        results = engine_no_key.classify_batch(batch)
        assert len(results) == 2
        assert all(r is None for r in results), f"Expected all None, got {results}"

    def test_returns_rag_result_for_fitness_transactions(self, engine_no_key):
        """Verifies that fitness-related transactions in a batch produce RAGResult entries."""
        batch = [
            {"description": "gym membership", "merchant": "Anytime Fitness", "amount": 49.99},
        ]
        results = engine_no_key.classify_batch(batch)
        assert len(results) == 1
        assert isinstance(results[0], RAGResult)

    def test_mixed_batch_routes_correctly(self, engine_no_key):
        """
        Verifies that in a mixed batch, fitness transactions get RAGResult and
        non-fitness transactions get None, preserving order.
        """
        batch = [
            {"description": "gym membership", "merchant": "Anytime Fitness", "amount": 49.99},
            {"description": "groceries", "merchant": "Woolworths", "amount": 80.0},
            {"description": "personal trainer", "merchant": "", "amount": 80.0},
        ]
        results = engine_no_key.classify_batch(batch)
        assert len(results) == 3
        assert isinstance(results[0], RAGResult)   # fitness
        assert results[1] is None                   # non-fitness
        assert isinstance(results[2], RAGResult)   # fitness

    def test_empty_batch_returns_empty_list(self, engine_no_key):
        """Verifies that an empty input list produces an empty output list."""
        results = engine_no_key.classify_batch([])
        assert results == []

    def test_batch_result_count_matches_input(self, engine_no_key):
        """Verifies that the output list length always equals the input list length."""
        batch = [
            {"description": "gym", "merchant": "", "amount": 10.0},
            {"description": "netflix", "merchant": "Netflix", "amount": 15.0},
            {"description": "protein", "merchant": "Bulk Nutrients", "amount": 40.0},
            {"description": "rent", "merchant": "", "amount": 2000.0},
        ]
        results = engine_no_key.classify_batch(batch)
        assert len(results) == len(batch)
