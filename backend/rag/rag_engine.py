"""
RAG Engine: retrieves ATO context and calls Claude to classify a fitness transaction.

Composite confidence score (0–100):
  - keyword_score  : 0–30  (based on fitness keyword match strength)
  - rag_grounding  : 0–40  (how well retrieved chunks support a deduction claim)
  - claude_score   : 0–30  (Claude's own confidence rescaled)

Final score is converted to 0.0–1.0 for ClassifiedTransaction.confidence.
"""

import json
import os
import re
from typing import Dict, List, Optional

from backend.rag.knowledge_base import ATOKnowledgeBase
from backend.processing.redaction_service import RedactionService

# Module-level redaction service — applied before any data leaves the process
_redaction = RedactionService()


# System prompt given to Claude for every classification request
_SYSTEM_PROMPT = """You are an expert Australian tax accountant specialising in personal income tax deductions.

Your task is to analyse a single bank transaction and determine whether it represents a potential tax deduction under Australian law (ATO rules for 2025-26 / 2026-27 income years).

You will be given:
1. The transaction details (description, merchant, amount)
2. Relevant ATO knowledge chunks retrieved from a curated knowledge base

Respond ONLY with a valid JSON object matching this exact schema — no prose, no markdown fences:

{
  "is_fitness_related": <true|false>,
  "is_potentially_deductible": <true|false>,
  "occupation_dependent": <true|false>,
  "category": <string — one of: "fitness_gym", "fitness_pt", "fitness_supplements", "fitness_equipment", "fitness_clothing", "fitness_memberships", "fitness_medical", "fitness_software", "training_education", "non_deductible", "unknown">,
  "confidence": <integer 0–100>,
  "reason": <string — 1–2 sentence explanation citing ATO rules>,
  "ato_citation": <string — specific ATO reference e.g. "ATO ID 2007/182; Section 8-1 ITAA 1997">,
  "conditions": <array of strings — conditions that must be met to claim, empty if not deductible>,
  "evidence_required": <array of strings — e.g. ["receipt", "employer fitness requirement letter"]>,
  "disclaimer": "Not tax advice — always consult a registered tax agent or the ATO before claiming deductions."
}

Confidence guidelines:
- 85–100: Clearly deductible with no ambiguity (e.g. fitness instructor's CPR cert renewal)
- 65–84: Likely deductible but depends on occupation or usage percentage
- 40–64: Possible with specific conditions (e.g. police officer's gym membership)
- 1–39: Unlikely; specific rare circumstances only
- 0: Not deductible under any circumstances

Be conservative. The ATO is strict about the nexus requirement for fitness expenses. Most fitness expenses for general employees are private expenses."""


_CATEGORY_MAP = {
    "fitness_gym": "fitness_related",
    "fitness_pt": "fitness_related",
    "fitness_supplements": "fitness_related",
    "fitness_equipment": "fitness_related",
    "fitness_clothing": "fitness_related",
    "fitness_memberships": "fitness_related",
    "fitness_medical": "fitness_related",
    "fitness_software": "fitness_related",
    "training_education": "training_education",
    "non_deductible": None,
    "unknown": None,
}


class RAGResult:
    """Structured output from the RAG engine for a single transaction."""

    __slots__ = (
        "is_fitness_related",
        "is_potentially_deductible",
        "occupation_dependent",
        "category",
        "confidence",        # 0–100 composite integer
        "confidence_float",  # 0.0–1.0 for ClassifiedTransaction
        "reason",
        "ato_citation",
        "conditions",
        "evidence_required",
        "disclaimer",
        "mapped_category",   # maps to DeductionCategory value or None
        "keyword_score",
        "rag_grounding_score",
        "claude_score",
        "raw_response",
    )

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def to_dict(self) -> Dict:
        return {slot: getattr(self, slot, None) for slot in self.__slots__}


class RAGEngine:
    """
    Retrieval-Augmented Generation engine for fitness tax deduction classification.

    Uses a local keyword-based knowledge base for retrieval and Anthropic Claude
    for generation. Requires ANTHROPIC_API_KEY in the environment.
    """

    def __init__(
        self,
        knowledge_base: ATOKnowledgeBase,
        api_key: Optional[str] = None,
        model: str = "claude-haiku-4-5-20251001",
        retrieve_k: int = 5,
    ):
        self.kb = knowledge_base
        self.model = model
        self.retrieve_k = retrieve_k
        self._client = None

        key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if key:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=key)
            except ImportError:
                pass  # graceful degradation — RAG disabled

    @property
    def available(self) -> bool:
        return self._client is not None

    def classify_transaction(
        self,
        description: str,
        merchant: str,
        amount: float,
    ) -> RAGResult:
        """
        Classify a single transaction via RAG.

        Args:
            description: Raw transaction description
            merchant: Normalised merchant name
            amount: Transaction amount (absolute, positive)

        Returns:
            RAGResult with confidence, reason, ATO citation, etc.
        """
        # Redact PII (BSB codes, account numbers, card numbers) before any
        # external API call or logging — preserves merchant/keyword signals
        safe_description = _redaction.redact_text(description)
        safe_merchant = _redaction.redact_text(merchant)

        query = f"{safe_description} {safe_merchant}"

        # Step 1 — keyword confidence (0–30)
        keyword_score_float = self.kb.keyword_confidence(safe_description, safe_merchant)
        keyword_score_int = int(keyword_score_float * 100)  # 0–30

        if not self.available:
            return self._fallback_result(safe_description, safe_merchant, keyword_score_int)

        # Step 2 — retrieve relevant ATO chunks
        chunks = self.kb.retrieve(query, k=self.retrieve_k)

        # Step 3 — rag grounding score: fraction of top chunks supporting deductibility (0–40)
        rag_grounding = self._grounding_score(chunks)

        # Step 4 — call Claude
        try:
            raw = self._call_claude(safe_description, safe_merchant, amount, chunks)
            parsed = self._parse_response(raw)
        except Exception as e:
            return self._fallback_result(safe_description, safe_merchant, keyword_score_int, error=str(e))

        # Step 5 — composite confidence
        claude_score = int((parsed.get("confidence", 0) / 100) * 30)  # 0–30
        composite = min(keyword_score_int + rag_grounding + claude_score, 100)

        mapped = _CATEGORY_MAP.get(parsed.get("category", "unknown"), None)

        return RAGResult(
            is_fitness_related=parsed.get("is_fitness_related", True),
            is_potentially_deductible=parsed.get("is_potentially_deductible", False),
            occupation_dependent=parsed.get("occupation_dependent", True),
            category=parsed.get("category", "unknown"),
            confidence=composite,
            confidence_float=round(composite / 100, 2),
            reason=parsed.get("reason", ""),
            ato_citation=parsed.get("ato_citation", "Section 8-1 ITAA 1997"),
            conditions=parsed.get("conditions", []),
            evidence_required=parsed.get("evidence_required", []),
            disclaimer=parsed.get("disclaimer", self.kb.disclaimer),
            mapped_category=mapped,
            keyword_score=keyword_score_int,
            rag_grounding_score=rag_grounding,
            claude_score=claude_score,
            raw_response=raw,
        )

    def classify_batch(
        self,
        transactions: List[Dict],
    ) -> List[RAGResult]:
        """
        Classify a list of transaction dicts with keys: description, merchant, amount.
        Only processes fitness-related transactions; others get a None-marked fallback.
        """
        results = []
        for txn in transactions:
            desc = txn.get("description", "")
            merchant = txn.get("merchant", "")
            amount = float(txn.get("amount", 0))

            if self.kb.is_fitness_related(desc, merchant):
                results.append(self.classify_transaction(desc, merchant, amount))
            else:
                results.append(None)
        return results

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _grounding_score(self, chunks: List[Dict]) -> int:
        """
        Score how well the retrieved chunks ground a deductibility claim (0–40).

        Chunks explicitly marked deductible=true contribute positively;
        those marked deductible=false reduce the score.
        """
        if not chunks:
            return 0
        support = sum(1 for c in chunks if c.get("deductible", False))
        against = sum(1 for c in chunks if not c.get("deductible", True))
        ratio = support / len(chunks)
        # Scale: 0–40, punish if most chunks say non-deductible
        raw = ratio * 40 - (against / len(chunks)) * 10
        return max(0, min(40, int(raw)))

    def _build_prompt(
        self,
        description: str,
        merchant: str,
        amount: float,
        chunks: List[Dict],
    ) -> str:
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[{i}] {chunk['title']}\n"
                f"ATO Reference: {chunk.get('ato_reference', 'N/A')}\n"
                f"Content: {chunk['content'][:600]}"
            )
        context = "\n\n".join(context_parts)

        return (
            f"Transaction Details:\n"
            f"  Description: {description}\n"
            f"  Merchant: {merchant}\n"
            f"  Amount: AUD ${amount:.2f}\n\n"
            f"Retrieved ATO Knowledge (most relevant first):\n\n{context}\n\n"
            f"Based on the above, classify this transaction."
        )

    def _call_claude(
        self,
        description: str,
        merchant: str,
        amount: float,
        chunks: List[Dict],
    ) -> str:
        user_message = self._build_prompt(description, merchant, amount, chunks)
        response = self._client.messages.create(
            model=self.model,
            max_tokens=512,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text.strip()

    def _parse_response(self, raw: str) -> Dict:
        # Strip any accidental markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
        cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Best-effort extraction
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                return json.loads(match.group())
            return {}

    def _fallback_result(
        self,
        description: str,
        merchant: str,
        keyword_score_int: int,
        error: Optional[str] = None,
    ) -> RAGResult:
        """Return a conservative fallback when Claude is unavailable."""
        is_fitness = self.kb.is_fitness_related(description, merchant)
        reason = (
            "RAG engine unavailable — rule-based classification only. "
            + (f"Error: {error}" if error else "Set ANTHROPIC_API_KEY to enable AI analysis.")
        )
        return RAGResult(
            is_fitness_related=is_fitness,
            is_potentially_deductible=False,
            occupation_dependent=True,
            category="unknown",
            confidence=keyword_score_int,
            confidence_float=round(keyword_score_int / 100, 2),
            reason=reason,
            ato_citation="Section 8-1 ITAA 1997",
            conditions=[],
            evidence_required=["receipt"],
            disclaimer=self.kb.disclaimer,
            mapped_category=None,
            keyword_score=keyword_score_int,
            rag_grounding_score=0,
            claude_score=0,
            raw_response=None,
        )
