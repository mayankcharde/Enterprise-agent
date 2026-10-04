from app.evaluation.evaluators import (
    answer_relevance,
    citation_validity,
    correct_abstention,
    faithfulness,
    retrieval_relevance,
)


def run(outputs):
    return type("Run", (), {"outputs": outputs})()


def test_deterministic_evaluators_cover_grounding_and_citations():
    result = run({
        "answer": "I couldn't verify the company's official policy from the available internal documents.",
        "evidence_status": "insufficient_evidence",
        "citations": [],
        "retrieved_documents": [],
    })
    assert answer_relevance(result)["score"] == 1.0
    assert correct_abstention(result)["score"] == 1.0
    assert faithfulness(result)["score"] == 0.0
    assert retrieval_relevance(result)["score"] == 0.0
    assert citation_validity(result)["score"] == 1.0


def test_invalid_citation_is_rejected():
    result = run({
        "answer": "See source.",
        "evidence_status": "external_guidance_only",
        "citations": [{"title": "bad", "type": "external", "url": "not-a-url"}],
    })
    assert citation_validity(result)["score"] == 0.0
