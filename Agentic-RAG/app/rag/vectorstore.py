import time

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec

from app.core.config import get_settings

settings = get_settings()
_embeddings = None
_vectorstore = None

EMBEDDING_DIMENSIONS = {"models/gemini-embedding-001": 3072, "gemini-embedding-001": 3072}


def get_embedding_dimension(model_name: str | None = None) -> int:
    name = (model_name or settings.embedding_model).strip().lower()
    if name in EMBEDDING_DIMENSIONS:
        return EMBEDDING_DIMENSIONS[name]
    raise ValueError(f"Unsupported embedding model '{name}'. Add its Pinecone dimension.")


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        if not settings.google_api_key:
            raise RuntimeError("GOOGLE_API_KEY is missing")
        _embeddings = GoogleGenerativeAIEmbeddings(model=settings.embedding_model, google_api_key=settings.google_api_key)
    return _embeddings


def ensure_index():
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is missing")
    pc = Pinecone(api_key=settings.pinecone_api_key)
    names = [x["name"] for x in pc.list_indexes()]
    dimension = get_embedding_dimension()
    if settings.pinecone_index_name in names:
        info = pc.describe_index(settings.pinecone_index_name)
        current = getattr(info, "dimension", None) or (info.get("dimension") if isinstance(info, dict) else None)
        if current is not None and current != dimension:
            raise RuntimeError(f"Pinecone index dimension {current} does not match embedding dimension {dimension}")
    else:
        pc.create_index(name=settings.pinecone_index_name, dimension=dimension, metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region="us-east-1"))
        while not pc.describe_index(settings.pinecone_index_name).status["ready"]:
            time.sleep(1)
    return pc.Index(settings.pinecone_index_name)


def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = PineconeVectorStore(index=ensure_index(), embedding=get_embeddings(), namespace=settings.pinecone_namespace)
    return _vectorstore


def retrieve_documents(query: str):
    store = get_vectorstore()
    matches = store.similarity_search_with_score(query, k=max(settings.top_k, 1))
    documents = []
    for doc, score in matches:
        doc.metadata = {**doc.metadata, "similarity_score": float(score)}
        documents.append(doc)
    return documents


def get_retriever():
    return get_vectorstore().as_retriever(search_kwargs={"k": settings.top_k})


def add_documents(chunks):
    return get_vectorstore().add_documents(chunks)
