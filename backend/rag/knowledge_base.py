"""
ATO Knowledge Base for fitness tax deduction retrieval.

Loads the ato_fitness_knowledge.json knowledge base and provides
keyword-based retrieval of relevant ATO rules for a given transaction.
No ML dependencies - uses TF-IDF style keyword overlap scoring.
"""

import json
import math
import re
from pathlib import Path
from typing import List, Dict


# Fitness-related keyword groups used to detect fitness transactions
FITNESS_KEYWORDS = {
    "gym": ["gym", "fitness centre", "fitness center", "health club", "anytime fitness",
            "goodlife", "fitness first", "f45", "crossfit", "planet fitness", "jetts",
            "snap fitness", "vision pt", "orange theory", "barry's bootcamp"],
    "personal_training": ["personal trainer", "pt session", "pt fee", "personal training",
                          "strength coach", "sports coach", "bootcamp", "group fitness",
                          "training session", "fitness coaching"],
    "supplements": ["supplement", "protein powder", "protein", "creatine", "pre-workout",
                    "whey", "bcaa", "amino", "myprotein", "bulk nutrients", "gnc",
                    "nutrition warehouse", "protein king", "caffeine", "recovery"],
    "equipment": ["weights", "dumbbells", "treadmill", "exercise bike", "rowing machine",
                  "kettlebell", "barbell", "yoga mat", "foam roller", "resistance band",
                  "home gym", "fitness equipment", "lifting"],
    "activewear": ["lululemon", "nike", "adidas", "under armour", "2xu", "asics",
                   "new balance", "reebok", "puma", "activewear", "sportswear",
                   "gym clothes", "workout clothes", "running shoes", "sports bra",
                   "leggings", "athletic wear"],
    "sports_stores": ["rebel sport", "decathlon", "athlete's foot", "athletes foot",
                      "amart sports", "anaconda", "mountain designs", "super retail"],
    "wearables": ["garmin", "fitbit", "apple watch", "polar", "whoop", "oura",
                  "heart rate monitor", "gps watch", "activity tracker"],
    "memberships": ["yoga", "pilates", "crossfit membership", "swim club", "running club",
                    "cycling club", "triathlon", "martial arts", "boxing gym"],
    "fitness_apps": ["myfitnesspal", "strava", "zwift", "peloton app", "nike training",
                     "fitness app", "training app"],
    "medical_fitness": ["physiotherapy", "physio", "sports massage", "massage therapy",
                        "chiropractic", "sports medicine", "sports doctor", "rehabilitation"],
    "certifications": ["cert iii", "cert iv", "fitness certification", "cpr",
                       "first aid", "cec", "ausactive", "fitness australia"],
}

# Occupations that expand deduction rights
DEDUCTIBLE_OCCUPATIONS = [
    "fitness instructor", "personal trainer", "yoga teacher", "pilates instructor",
    "gym owner", "fitness professional", "sports coach", "professional athlete",
    "police", "military", "defence", "army", "navy", "air force", "firefighter",
    "lifeguard", "correctional officer", "emergency services"
]


class ATOKnowledgeBase:
    """
    Loads ATO fitness deduction knowledge and provides keyword-based retrieval.

    Each knowledge chunk is scored against a query using term frequency overlap
    with an IDF-like boost for rarer, more specific terms.
    """

    def __init__(self, knowledge_path: str = "backend/config/ato_fitness_knowledge.json"):
        self.knowledge_path = Path(knowledge_path)
        self._data = self._load()
        self.chunks: List[Dict] = self._data["chunks"]
        self._idf = self._build_idf()

    def _load(self) -> Dict:
        with open(self.knowledge_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _tokenize(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        return [t for t in text.split() if len(t) > 2]

    def _build_idf(self) -> Dict[str, float]:
        """Build inverse document frequency for keyword scoring."""
        doc_count: Dict[str, int] = {}
        total = len(self.chunks)
        for chunk in self.chunks:
            terms = set(
                self._tokenize(chunk.get("content", ""))
                + self._tokenize(chunk.get("title", ""))
                + chunk.get("keywords", [])
            )
            for term in terms:
                doc_count[term] = doc_count.get(term, 0) + 1
        return {
            term: math.log((total + 1) / (count + 1)) + 1
            for term, count in doc_count.items()
        }

    def _score_chunk(self, query_terms: List[str], chunk: Dict) -> float:
        """Score a single chunk against the query terms."""
        chunk_terms = (
            self._tokenize(chunk.get("content", ""))
            + self._tokenize(chunk.get("title", ""))
            + [kw.lower() for kw in chunk.get("keywords", [])]
        )
        chunk_term_set = set(chunk_terms)

        score = 0.0
        for qt in query_terms:
            if qt in chunk_term_set:
                score += self._idf.get(qt, 1.0)

        # Boost chunks whose keywords list contains an exact match
        chunk_keywords = [kw.lower() for kw in chunk.get("keywords", [])]
        for qt in query_terms:
            if qt in chunk_keywords:
                score += 2.0

        return score

    def retrieve(self, query: str, k: int = 5) -> List[Dict]:
        """
        Retrieve the top-k most relevant knowledge chunks for a query.

        Args:
            query: Transaction description + merchant text
            k: Number of chunks to return

        Returns:
            List of knowledge chunks sorted by relevance, most relevant first
        """
        query_terms = self._tokenize(query)
        if not query_terms:
            return self.chunks[:k]

        scored = [(self._score_chunk(query_terms, chunk), chunk) for chunk in self.chunks]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [chunk for _, chunk in scored[:k]]

    def is_fitness_related(self, description: str, merchant: str) -> bool:
        """
        Heuristic check: does this transaction look fitness-related?

        Args:
            description: Transaction description
            merchant: Merchant name

        Returns:
            True if the transaction is likely fitness-related
        """
        text = f"{description} {merchant}".lower()
        for keywords in FITNESS_KEYWORDS.values():
            for kw in keywords:
                if kw.lower() in text:
                    return True
        return False

    def keyword_confidence(self, description: str, merchant: str) -> float:
        """
        Calculate a keyword-match confidence contribution (0.0 - 0.30).

        Longer / more specific keywords score higher (weight = len(kw.split())).
        Caps at 0.30 after any match; score grows with number of distinct groups hit.
        """
        text = f"{description} {merchant}".lower()
        matched_weight = 0.0
        total_groups = len(FITNESS_KEYWORDS)

        for keywords in FITNESS_KEYWORDS.values():
            group_score = 0.0
            for kw in keywords:
                if kw.lower() in text:
                    # Longer/more specific keywords score higher
                    specificity = len(kw.split())
                    group_score = max(group_score, specificity)
            matched_weight += min(group_score, 2.0)  # cap per group at 2

        if total_groups == 0:
            return 0.0

        # Normalise against a realistic max of 4 group-hits (not all 10 groups)
        # so typical fitness transactions score 0.15–0.25
        raw = matched_weight / (4 * 2.0)
        return min(raw * 0.30, 0.30)

    @property
    def disclaimer(self) -> str:
        return self._data.get("disclaimer", "Not tax advice. Consult a registered tax agent or the ATO.")

    @property
    def version(self) -> str:
        return self._data.get("version", "unknown")
