from typing import Any, Literal

from langchain_core.documents import Document
from pydantic import BaseModel, Field
from typing_extensions import TypedDict


QuestionCategory = Literal[
    "INTERNAL_POLICY",
    "INTERNAL_KNOWLEDGE",
    "CURRENT_EXTERNAL_INFORMATION",
    "GENERAL_TECHNICAL_QUESTION",
]
EvidenceStatus = Literal[
    "verified_internally",
    "external_guidance_only",
    "insufficient_evidence",
]


class Citation(BaseModel):
    title: str
    type: Literal["internal", "external"]
    url: str = ""
    document_id: str = ""
    chunk_id: str = ""


class AnswerDraft(BaseModel):
    answer: str = Field(min_length=1)
    steps: list[str] = Field(default_factory=list)


class AnswerResponse(BaseModel):
    answer: str
    steps: list[str] = Field(default_factory=list)
    sources: list[Citation] = Field(default_factory=list)
    evidence_status: EvidenceStatus
    source_type: Literal["internal", "external", "mixed", "none"]
    needs_it_support: bool


class AgentState(TypedDict, total=False):
    question: str
    current_query: str
    category: QuestionCategory
    kb_docs: list[Document]
    web_results: str
    web_sources: list[dict[str, Any]]
    evidence_status: EvidenceStatus
    answer: str
    steps: list[str]
    source_type: str
    source_used: str
    needs_it_support: bool
    retry_count: int
    trace: list[str]
    citations: list[dict[str, Any]]
    request_id: str
    trace_metadata: dict[str, Any]
