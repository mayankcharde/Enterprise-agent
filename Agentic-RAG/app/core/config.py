from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    app_name: str = "Enterprise IT Support Agentic RAG Copilot"
    app_env: str = "development"
    backend_api_url: str = "http://127.0.0.1:3000"
    groq_api_key: str = ""
    google_api_key: str = ""
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_index_name: str = "fde-it-support-rag"
    pinecone_namespace: str = "company-it-kb"
    embedding_model: str = "models/gemini-embedding-001"
    groq_model: str = "openai/gpt-oss-120b"
    top_k: int = 4
    max_retries: int = 1
    admin_api_key: str = "change-me"
    audit_db_path: str = str(BASE_DIR / "data" / "audit.db")
    upload_dir: str = str(BASE_DIR / "uploads")
    sample_kb_dir: str = str(BASE_DIR / "data" / "sample_kb")
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "nexadesk-agentic-rag"
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    observability_redact_inputs: bool = True
    observability_redact_retrieved_text: bool = True
    observability_redaction_placeholder: str = "[REDACTED]"
    evaluation_dataset_name: str = "nexadesk-internal-policy-evaluation"

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")




@lru_cache
def get_settings() -> Settings:
    return Settings()