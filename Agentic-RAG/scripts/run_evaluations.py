"""Run the NexaDesk dataset against the graph with isolated evaluators."""

from langsmith import Client
from langsmith.evaluation import evaluate

from app.core.config import get_settings
from app.core.observability import evaluation_failure
from app.evaluation.evaluators import DETERMINISTIC_EVALUATORS
from app.rag.workflow import ask


def target(inputs: dict) -> dict:
    result = ask(inputs["question"])
    return {
        "answer": result.get("answer", ""),
        "citations": result.get("citations", []),
        "evidence_status": result.get("evidence_status"),
        "retrieved_documents": result.get("trace_metadata", {}).get("retrieved_documents", []),
    }


def main() -> None:
    settings = get_settings()
    if not settings.langsmith_api_key:
        raise SystemExit("LANGSMITH_API_KEY is required to run evaluations")
    try:
        client = Client(api_url=settings.langsmith_endpoint, api_key=settings.langsmith_api_key)
        evaluate(
            target,
            data=settings.evaluation_dataset_name,
            evaluators=DETERMINISTIC_EVALUATORS,
            experiment_prefix="nexadesk-evaluation",
            client=client,
        )
    except Exception as exc:
        evaluation_failure(exc)
        raise SystemExit("LangSmith evaluation run failed") from exc


if __name__ == "__main__":
    main()
