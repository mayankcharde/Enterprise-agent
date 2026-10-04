"""Optional LangSmith tracing and privacy-safe observability helpers."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_SENSITIVE_PATTERNS = (
    re.compile(r"(?i)\b(?:api[_-]?key|token|password|secret|authorization)\b\s*[:=]\s*\S+"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+"),
)


def configure_langsmith(settings: Settings | None = None) -> bool:
    """Configure LangChain/LangSmith from existing environment-compatible settings.

    Tracing is deliberately best-effort: a missing key or unavailable endpoint must
    never prevent the application from serving a normal chat request.
    """
    settings = settings or get_settings()
    os.environ["LANGSMITH_TRACING"] = "true" if settings.langsmith_tracing else "false"
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project
    os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint
    if settings.langsmith_api_key:
        os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
    return bool(settings.langsmith_tracing and settings.langsmith_api_key)


def redact_text(value: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    if not settings.observability_redact_inputs:
        return value
    redacted = value
    for pattern in _SENSITIVE_PATTERNS:
        redacted = pattern.sub(settings.observability_redaction_placeholder, redacted)
    return redacted


def safe_metadata(
    *,
    request_id: str,
    question: str,
    category: str | None = None,
    model_name: str | None = None,
    retrieval_count: int | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    settings = settings or get_settings()
    metadata: dict[str, Any] = {
        "request_id": request_id,
        "question": redact_text(question, settings),
    }
    if category:
        metadata["question_category"] = category
    if model_name:
        metadata["model_name"] = model_name
    if retrieval_count is not None:
        metadata["retrieval_count"] = retrieval_count
    return metadata


def safe_retrieval_metadata(documents: list[Any], settings: Settings | None = None) -> list[dict[str, Any]]:
    """Return document identifiers/scores without sending document bodies to logs."""
    settings = settings or get_settings()
    result = []
    for doc in documents:
        metadata = getattr(doc, "metadata", {}) or {}
        item = {
            "document_id": str(metadata.get("document_id") or metadata.get("source") or ""),
            "chunk_id": str(metadata.get("chunk_id") or metadata.get("start_index") or ""),
            "similarity_score": metadata.get("similarity_score"),
        }
        if not settings.observability_redact_retrieved_text:
            item["text"] = redact_text(getattr(doc, "page_content", ""), settings)
        result.append(item)
    return result


def trace_failure(exc: Exception) -> None:
    logger.warning("LangSmith tracing unavailable; continuing without remote trace: %s", type(exc).__name__)


def evaluation_failure(exc: Exception) -> None:
    logger.warning("LangSmith evaluation unavailable; chat behavior is unchanged: %s", type(exc).__name__)
