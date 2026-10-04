from pathlib import Path
from app.core.config import get_settings
from app.services.ingestion import SUPPORTED, load_file, chunk_documents
from app.rag.vectorstore import add_documents

settings = get_settings()

folder = Path(settings.sample_kb_dir)
files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED]
if not files:
    raise FileNotFoundError(f"No supported documents found in '{folder}'.")

all_docs = []

for path in files:
    all_docs.extend(load_file(path))
chunks = chunk_documents(all_docs)
ids = add_documents(chunks)
print(f"Indexed {len(files)} files -> {len(chunks)} chunks -> {len(ids)} Pinecone vectors")