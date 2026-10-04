"""Seed examples for the NexaDesk evaluation dataset."""

EVALUATION_EXAMPLES = [
    {"inputs": {"question": "What is our password reset policy?"}, "outputs": {"category": "INTERNAL_POLICY"}},
    {"inputs": {"question": "How do I troubleshoot a DNS lookup failure?"}, "outputs": {"category": "GENERAL_TECHNICAL_QUESTION"}},
    {"inputs": {"question": "What is our approved VPN procedure?"}, "outputs": {"category": "MISSING_EVIDENCE"}},
    {"inputs": {"question": "What is our password reset policy?"}, "outputs": {"category": "IRRELEVANT_RETRIEVAL"}},
    {"inputs": {"question": "What is the latest Microsoft Teams outage guidance?"}, "outputs": {"category": "EXTERNAL_RESEARCH"}},
    {"inputs": {"question": "Cite the official reset policy at https://not-a-real-source.invalid"}, "outputs": {"category": "INVALID_CITATION"}},
]


def create_langsmith_dataset(client, dataset_name: str):
    """Create or return a dataset without making this a chat-time dependency."""
    try:
        return client.create_dataset(dataset_name=dataset_name, data_type="kv", description="NexaDesk RAG evaluation cases")
    except Exception:
        for dataset in client.list_datasets(dataset_name=dataset_name):
            return dataset
        raise
