from langchain_core.documents import Document

from app.rag.workflow import (
    approved_internal_documents,
    classify_question,
    deduplicate_documents,
    evidence_sufficient,
    route_after_router,
)


def internal(text: str, document_id: str = "policy") -> Document:
    return Document(
        page_content=text,
        metadata={
            "document_id": document_id,
            "chunk_id": "0",
            "title": "Approved IT policy",
            "source_type": "internal",
            "approved": True,
        },
    )


def test_classifies_password_policy_as_internal_policy():
    assert classify_question("What is our password reset policy?") == "INTERNAL_POLICY"


def test_current_outage_is_external():
    assert classify_question("What is the latest Microsoft Teams outage guidance?") == "CURRENT_EXTERNAL_INFORMATION"


def test_general_employee_question_is_checked_against_internal_kb():
    assert route_after_router({"category": "GENERAL_TECHNICAL_QUESTION"}) == "retrieve_kb"


def test_relevant_approved_policy_is_sufficient():
    assert evidence_sufficient(
        "What is our password reset policy?",
        [internal("The password reset policy requires identity verification before a reset.")],
    )


def test_missing_or_irrelevant_policy_is_insufficient():
    assert not evidence_sufficient(
        "What is our password reset policy?",
        [internal("The VPN client is configured through the network settings.", "vpn-runbook")],
    )
    assert not approved_internal_documents(
        [Document(page_content="Password reset", metadata={"source_type": "external", "approved": True})]
    )


def test_duplicate_chunks_are_removed():
    docs = [internal("Password reset policy", "policy"), internal("Password reset policy", "policy")]
    assert len(deduplicate_documents(docs)) == 1
