"""Deterministic evaluators and optional model-based evaluator adapters."""

from __future__ import annotations

from collections.abc import Mapping
from urllib.parse import urlparse

ABSTENTION_MARKERS = ("couldn't verify", "insufficient", "contact your it", "available evidence")


def _answer(run) -> str:
    outputs = getattr(run, "outputs", None) or (run.get("outputs", {}) if isinstance(run, Mapping) else {})
    return str(outputs.get("answer", ""))


def citation_validity(run, example=None) -> dict:
    outputs = getattr(run, "outputs", None) or {}
    citations = outputs.get("citations", []) if isinstance(outputs, Mapping) else []
    valid = all(
        (citation.get("document_id") or citation.get("url"))
        and (not citation.get("url") or urlparse(citation["url"]).scheme in {"http", "https"})
        for citation in citations
    )
    return {"key": "citation_validity", "score": float(valid)}


def correct_abstention(run, example=None) -> dict:
    outputs = getattr(run, "outputs", None) or {}
    status = outputs.get("evidence_status")
    answer = _answer(run).casefold()
    return {"key": "correct_abstention", "score": float(status == "insufficient_evidence" and any(marker in answer for marker in ABSTENTION_MARKERS))}


def retrieval_relevance(run, example=None) -> dict:
    outputs = getattr(run, "outputs", None) or {}
    docs = outputs.get("retrieved_documents", []) if isinstance(outputs, Mapping) else []
    return {"key": "retrieval_relevance", "score": float(bool(docs))}


def answer_relevance(run, example=None) -> dict:
    return {"key": "answer_relevance", "score": float(bool(_answer(run).strip()))}


def faithfulness(run, example=None) -> dict:
    outputs = getattr(run, "outputs", None) or {}
    status = outputs.get("evidence_status")
    return {"key": "faithfulness", "score": float(status in {"verified_internally", "external_guidance_only"})}


DETERMINISTIC_EVALUATORS = [answer_relevance, retrieval_relevance, faithfulness, citation_validity, correct_abstention]


def model_based_evaluators():
    """Return LangSmith evaluator names only when the caller explicitly opts in."""
    return ["qa", "cot_qa"] 
