"""
rag.py
RAG (Retrieval-Augmented Generation) handler.
Encodes user query -> vector search -> LLM answer with citations.
"""

import logging
import requests
from openai import OpenAI
from config import EMBEDDING_SERVICE_URL, MOONSHOT_API_KEY, MOONSHOT_BASE_URL, MOONSHOT_MODEL
from db import get_client

logger = logging.getLogger(__name__)
_llm_client = None


def _get_llm() -> OpenAI:
    global _llm_client
    if _llm_client is None:
        _llm_client = OpenAI(api_key=MOONSHOT_API_KEY, base_url=MOONSHOT_BASE_URL)
    return _llm_client


def encode_query(text: str) -> list[float]:
    """Call embedding-service to encode a query string."""
    url = f"{EMBEDDING_SERVICE_URL}/api/encode-query"
    resp = requests.post(url, json={"query": text}, timeout=30)
    resp.raise_for_status()
    return resp.json()["embedding"]


def search_documents(query_embedding: list[float], ticker: str = None, top_k: int = 8) -> list[dict]:
    """Call Supabase RPC search_documents for vector similarity search."""
    client = get_client()
    params = {
        "query_embedding": str(query_embedding),
        "match_count": top_k,
    }
    if ticker:
        params["match_ticker"] = ticker
    resp = client.rpc("search_documents", params).execute()
    return resp.data


RAG_SYSTEM_PROMPT = """You are a knowledgeable financial assistant. Answer the user's question based on the provided context documents.

Rules:
1. Only use information from the provided context — do not make up facts
2. Cite sources by mentioning the date and source type (e.g. "According to a March 15 news report...")
3. If the context doesn't contain relevant information, say so honestly
4. Be concise but thorough
5. Use Markdown formatting for readability"""


def build_rag_prompt(question: str, docs: list[dict]) -> str:
    context_parts = []
    for i, doc in enumerate(docs, 1):
        meta = f"[{doc.get('date', 'N/A')}] {doc.get('doc_type', '')} ({doc.get('source', '')})"
        title = doc.get("title") or ""
        if title:
            meta += f" — {title}"
        content = doc.get("content", "")[:2000]
        context_parts.append(f"**Document {i}** {meta}\n{content}")

    context_block = "\n\n---\n\n".join(context_parts)
    return f"### Context Documents\n\n{context_block}\n\n### User Question\n\n{question}"


def answer_question(question: str, ticker: str = None) -> dict:
    """Full RAG pipeline: encode -> search -> generate answer."""
    query_vec = encode_query(question)
    docs = search_documents(query_vec, ticker=ticker)

    if not docs:
        return {
            "answer": "I couldn't find any relevant documents to answer your question.",
            "sources": [],
        }

    user_prompt = build_rag_prompt(question, docs)
    llm = _get_llm()

    response = llm.chat.completions.create(
        model=MOONSHOT_MODEL,
        messages=[
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=1.0,
    )

    sources = [
        {
            "id": d.get("id"), "ticker": d.get("ticker"), "date": d.get("date"),
            "doc_type": d.get("doc_type"), "source": d.get("source"),
            "title": d.get("title"), "similarity": d.get("similarity"),
        }
        for d in docs
    ]

    return {
        "answer": response.choices[0].message.content,
        "sources": sources,
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        },
    }
