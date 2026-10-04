"""Create the shared LangSmith evaluation dataset (never run during chat)."""

from langsmith import Client

from app.core.config import get_settings
from app.core.observability import evaluation_failure
from app.evaluation.dataset import EVALUATION_EXAMPLES, create_langsmith_dataset


def main() -> None:
    settings = get_settings()
    if not settings.langsmith_api_key:
        raise SystemExit("LANGSMITH_API_KEY is required to create an evaluation dataset")
    try:
        client = Client(api_url=settings.langsmith_endpoint, api_key=settings.langsmith_api_key)
        dataset = create_langsmith_dataset(client, settings.evaluation_dataset_name)
        client.create_examples(dataset_id=dataset.id, examples=EVALUATION_EXAMPLES)
        print(f"Created/updated dataset: {settings.evaluation_dataset_name}")
    except Exception as exc:
        evaluation_failure(exc)
        raise SystemExit("LangSmith dataset creation failed") from exc


if __name__ == "__main__":
    main()
