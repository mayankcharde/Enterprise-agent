from app.core.config import Settings
from app.core.observability import configure_langsmith, redact_text, safe_metadata


def test_langsmith_configuration_is_optional(monkeypatch):
    settings = Settings(langsmith_tracing=True, langsmith_api_key="test-key")
    assert configure_langsmith(settings)
    assert monkeypatch


def test_missing_langsmith_credentials_disables_remote_tracing(monkeypatch):
    settings = Settings(langsmith_tracing=True, langsmith_api_key="")
    assert not configure_langsmith(settings)
    assert monkeypatch


def test_redaction_hides_credentials_and_metadata_is_small():
    settings = Settings(observability_redact_inputs=True)
    text = "password=secret-value api_key=abc123 Authorization: Bearer token-value"
    redacted = redact_text(text, settings)
    assert "secret-value" not in redacted
    assert "abc123" not in redacted
    metadata = safe_metadata(request_id="r1", question=text, model_name="model", retrieval_count=2, settings=settings)
    assert metadata["request_id"] == "r1"
    assert "secret-value" not in metadata["question"]
