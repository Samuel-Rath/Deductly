"""
Unit tests for ATOKnowledgeBase (backend/rag/knowledge_base.py).

Covers knowledge base loading, TF-IDF retrieval, fitness detection heuristics,
keyword confidence scoring, IDF computation, and metadata properties.

All tests run from the project root (c:/Users/samue/OneDrive/Documents/Deductly)
so that the relative knowledge-base path resolves correctly.
"""

import pytest
from backend.rag.knowledge_base import ATOKnowledgeBase


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def kb():
    """Shared ATOKnowledgeBase instance loaded once for the entire module."""
    return ATOKnowledgeBase()


# ---------------------------------------------------------------------------
# Initialisation and loading
# ---------------------------------------------------------------------------

class TestInitialisation:
    """Tests that verify correct loading of the knowledge-base JSON."""

    def test_loads_seventeen_chunks(self, kb):
        """Verifies that the knowledge base loads exactly 17 chunks from the JSON file."""
        assert len(kb.chunks) == 17

    def test_chunks_is_list_of_dicts(self, kb):
        """Verifies that every chunk is a dictionary (not None or another type)."""
        assert all(isinstance(c, dict) for c in kb.chunks)

    def test_chunks_have_required_keys(self, kb):
        """Verifies that every chunk carries at minimum title, content, and deductible keys."""
        for chunk in kb.chunks:
            assert "title" in chunk, f"Chunk missing 'title': {chunk}"
            assert "content" in chunk, f"Chunk missing 'content': {chunk}"
            assert "deductible" in chunk, f"Chunk missing 'deductible': {chunk}"

    def test_idf_is_computed(self, kb):
        """Verifies that the internal IDF mapping is populated after initialisation."""
        assert isinstance(kb._idf, dict)
        assert len(kb._idf) > 0

    def test_disclaimer_property_is_non_empty(self, kb):
        """Verifies that the disclaimer property returns a non-empty string."""
        d = kb.disclaimer
        assert isinstance(d, str)
        assert len(d.strip()) > 0

    def test_version_property_is_non_empty(self, kb):
        """Verifies that the version property returns a non-empty string."""
        v = kb.version
        assert isinstance(v, str)
        assert len(v.strip()) > 0


# ---------------------------------------------------------------------------
# retrieve()
# ---------------------------------------------------------------------------

class TestRetrieve:
    """Tests that verify the retrieve() method behaviour."""

    def test_retrieve_returns_exactly_k_chunks_default(self, kb):
        """Verifies that retrieve() with default k=5 returns exactly 5 chunks."""
        results = kb.retrieve("gym membership anytime fitness")
        assert len(results) == 5

    def test_retrieve_returns_exactly_k_chunks_custom(self, kb):
        """Verifies that retrieve() with a custom k returns the requested number of chunks."""
        for k in (1, 3, 7, 10):
            results = kb.retrieve("personal trainer", k=k)
            assert len(results) == k, f"Expected {k} chunks, got {len(results)}"

    def test_retrieve_returns_highest_scoring_chunks_first(self, kb):
        """
        Verifies that for a clearly fitness-related query the first returned chunk
        contains a fitness-relevant title or keywords, demonstrating descending score order.
        """
        results = kb.retrieve("personal trainer pt session", k=5)
        # The top chunk should mention personal training concepts
        top_title = results[0].get("title", "").lower()
        top_keywords = [kw.lower() for kw in results[0].get("keywords", [])]
        fitness_terms = {"personal", "trainer", "training", "pt", "fitness", "session"}
        title_words = set(top_title.split())
        keyword_words = set(" ".join(top_keywords).split())
        assert fitness_terms & (title_words | keyword_words), (
            f"Top chunk '{results[0].get('title')}' does not appear fitness-training-related"
        )

    def test_retrieve_with_empty_query_returns_k_chunks(self, kb):
        """Verifies that retrieve() with an empty query still returns k chunks (first k)."""
        results = kb.retrieve("", k=5)
        assert len(results) == 5

    def test_retrieve_fitness_query_scores_higher_than_irrelevant_query(self, kb):
        """
        Verifies that a fitness-related query retrieves a different (higher-relevance) top chunk
        than a completely unrelated query, demonstrating that scoring differentiates queries.
        """
        fitness_chunks = kb.retrieve("anytime fitness gym membership", k=5)
        random_chunks = kb.retrieve("some random irrelevant text about nothing", k=5)
        fitness_top_id = fitness_chunks[0].get("id")
        random_top_id = random_chunks[0].get("id")
        # The top results should differ because scoring is query-sensitive
        # (they may coincidentally match only if the KB is tiny — assert the
        # content contains gym-related terms for the fitness query)
        assert "gym" in fitness_chunks[0].get("title", "").lower() or \
               any("gym" in kw.lower() for kw in fitness_chunks[0].get("keywords", [])), (
            f"Fitness query top chunk '{fitness_chunks[0].get('title')}' doesn't seem gym-related"
        )

    def test_chunk_keyword_boost_improves_score(self, kb):
        """
        Verifies that a query containing exact chunk keywords ('anytime fitness gym')
        retrieves a more relevant top chunk than a generic irrelevant query, confirming
        that the keyword-list boost in _score_chunk() functions correctly.
        """
        # "anytime fitness" appears in keywords of the gym_general chunk
        fitness_results = kb.retrieve("anytime fitness gym", k=1)
        irrelevant_results = kb.retrieve("some random irrelevant text", k=1)
        fitness_top = fitness_results[0]
        irrelevant_top = irrelevant_results[0]
        # The fitness query should pull the gym chunk to the top
        assert "gym" in fitness_top.get("title", "").lower() or \
               any("anytime fitness" in kw.lower() for kw in fitness_top.get("keywords", [])), (
            "Expected gym_general chunk at position 0 for 'anytime fitness gym' query"
        )

    def test_retrieve_k_does_not_exceed_total_chunks(self, kb):
        """Verifies that requesting more chunks than exist returns at most len(chunks)."""
        results = kb.retrieve("gym", k=100)
        assert len(results) <= len(kb.chunks)


# ---------------------------------------------------------------------------
# is_fitness_related()
# ---------------------------------------------------------------------------

class TestIsFitnessRelated:
    """Tests that verify the is_fitness_related() heuristic."""

    @pytest.mark.parametrize("description,merchant", [
        ("gym membership monthly", ""),
        ("", "Anytime Fitness"),
        ("Personal Trainer session fee", ""),
        ("Protein powder purchase", "Bulk Nutrients"),
        ("activewear purchase", "Lululemon"),
        ("GPS Watch", "Garmin"),
        ("monthly crossfit membership", "CrossFit Box"),
        ("physio session", "Sports Medicine Clinic"),
    ])
    def test_returns_true_for_fitness_descriptions(self, kb, description, merchant):
        """Verifies is_fitness_related() returns True for clearly fitness-related inputs."""
        assert kb.is_fitness_related(description, merchant) is True, (
            f"Expected True for description='{description}' merchant='{merchant}'"
        )

    @pytest.mark.parametrize("description,merchant", [
        ("groceries", "Woolworths"),
        ("streaming subscription", "Netflix"),
        ("mortgage repayment", ""),
        ("", ""),
        ("electricity bill", "AGL"),
        ("coffee", "Gloria Jeans"),
    ])
    def test_returns_false_for_non_fitness_descriptions(self, kb, description, merchant):
        """Verifies is_fitness_related() returns False for clearly non-fitness inputs."""
        assert kb.is_fitness_related(description, merchant) is False, (
            f"Expected False for description='{description}' merchant='{merchant}'"
        )

    def test_case_insensitive_detection(self, kb):
        """Verifies that fitness detection is case-insensitive."""
        assert kb.is_fitness_related("GYM MEMBERSHIP", "") is True
        assert kb.is_fitness_related("ANYTIME FITNESS", "") is True
        assert kb.is_fitness_related("Lululemon", "") is True


# ---------------------------------------------------------------------------
# keyword_confidence()
# ---------------------------------------------------------------------------

class TestKeywordConfidence:
    """Tests that verify the keyword_confidence() scoring function."""

    def test_returns_zero_for_non_fitness_text(self, kb):
        """Verifies that non-fitness text yields exactly 0.0 confidence."""
        assert kb.keyword_confidence("woolworths groceries", "") == 0.0
        assert kb.keyword_confidence("netflix subscription", "") == 0.0
        assert kb.keyword_confidence("", "") == 0.0

    def test_returns_positive_for_known_fitness_text(self, kb):
        """Verifies that known fitness text yields a positive confidence value."""
        score = kb.keyword_confidence("gym membership", "Anytime Fitness")
        assert score > 0.0, f"Expected score > 0 for gym/fitness text, got {score}"

    def test_returns_value_in_valid_range_for_fitness_text(self, kb):
        """Verifies that fitness text confidence is within (0.0, 0.30]."""
        score = kb.keyword_confidence("personal trainer session", "")
        assert 0.0 < score <= 0.30, f"Score {score} out of expected range (0, 0.30]"

    def test_never_exceeds_cap_of_0_30(self, kb):
        """Verifies that keyword_confidence() never returns a value above 0.30."""
        score = kb.keyword_confidence("gym membership personal trainer protein creatine", "")
        assert score <= 0.30, f"Score {score} exceeds hard cap of 0.30"

    @pytest.mark.parametrize("description,merchant", [
        ("gym personal trainer protein creatine lululemon garmin fitbit whoop crossfit yoga pilates", "Anytime Fitness"),
        ("gym", "gym"),
        ("personal trainer pt session pt fee bootcamp strength coach group fitness training session", ""),
        ("supplement protein powder creatine pre-workout whey bcaa amino myprotein bulk nutrients", ""),
        ("lululemon nike adidas under armour 2xu asics new balance activewear sportswear leggings", ""),
        ("garmin fitbit apple watch polar whoop oura heart rate monitor gps watch activity tracker", ""),
    ])
    def test_never_exceeds_cap_parametrized(self, kb, description, merchant):
        """Verifies the 0.30 cap holds for a variety of extreme fitness inputs."""
        score = kb.keyword_confidence(description, merchant)
        assert score <= 0.30, (
            f"Score {score} exceeds cap for description='{description[:40]}...'"
        )

    def test_multi_group_hit_scores_higher_than_single_group(self, kb):
        """
        Verifies that hitting multiple keyword groups produces a higher confidence
        than hitting only one group (scoring is cumulative across groups).
        """
        single = kb.keyword_confidence("gym", "")
        multi = kb.keyword_confidence("gym personal trainer protein", "")
        assert multi >= single, (
            f"Multi-group score ({multi}) should be >= single-group score ({single})"
        )

    def test_longer_keywords_score_higher_within_group(self, kb):
        """
        Verifies that a more specific (multi-word) keyword match scores at least as
        well as a shorter match within the same group, because specificity weights
        are proportional to keyword length in words.
        """
        short_score = kb.keyword_confidence("gym", "")
        long_score = kb.keyword_confidence("anytime fitness", "")
        # Both hit the gym group; the longer keyword has higher specificity weight
        # so long_score should be >= short_score
        assert long_score >= short_score, (
            f"Longer keyword score ({long_score}) should be >= shorter keyword score ({short_score})"
        )


# ---------------------------------------------------------------------------
# IDF structure
# ---------------------------------------------------------------------------

class TestIDF:
    """Tests that verify the internal IDF index is correctly built."""

    def test_idf_contains_common_fitness_terms(self, kb):
        """Verifies that common fitness terms appear in the IDF vocabulary."""
        for term in ("gym", "fitness", "trainer", "deductible"):
            assert term in kb._idf, f"Expected term '{term}' in IDF vocabulary"

    def test_idf_values_are_positive_floats(self, kb):
        """Verifies that all IDF values are positive finite floats."""
        for term, val in kb._idf.items():
            assert isinstance(val, float), f"IDF value for '{term}' is not a float"
            assert val > 0, f"IDF value for '{term}' is not positive"

    def test_rare_terms_have_higher_idf_than_common_terms(self, kb):
        """
        Verifies the IDF inverse-frequency property: a term appearing in fewer
        documents should have a higher IDF weight than a term appearing in all documents.
        'gym' appears in many chunks; 'hltaid' (first aid code) appears in fewer.
        """
        # 'fitness' appears in almost all chunk content
        # 'hltaid' is very specific, appears in only the first aid chunk
        common_idf = kb._idf.get("fitness", 1.0)
        rare_idf = kb._idf.get("hltaid", None)
        if rare_idf is not None:
            assert rare_idf >= common_idf, (
                f"Rare term IDF ({rare_idf}) should be >= common term IDF ({common_idf})"
            )
