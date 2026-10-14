"""Hybrid retrieval: BM25 + dense vectors fused with reciprocal-rank fusion, plus a relevance
gate that decides whether the material covers the question at all (drives refusals)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from rank_bm25 import BM25Okapi
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Chunk, Resource
from .embed import embed, from_bytes, provider
from .text import tokenize


@dataclass
class Hit:
    chunk: Chunk
    score: float  # fused score
    lexical: float  # keyword relevance (same scale as the frontend gate)
    cosine: float


def lexical_relevance(query_tokens: list[str], chunk: Chunk) -> float:
    if not query_tokens:
        return 0.0
    kw = {w.lower() for w in chunk.keywords or []}
    body = set(tokenize(chunk.text + " " + chunk.topic))
    score = 0.0
    for w in query_tokens:
        if w in kw:
            score += 2
        elif w in body:
            score += 1.25  # an exact term in the text is strong evidence even if it isn't a top keyword
        elif any(k.startswith(w) or w.startswith(k) for k in kw):
            score += 1
    return score / (len(query_tokens) ** 0.5)


def user_chunks(db: Session, user_id: str) -> list[Chunk]:
    return list(db.scalars(select(Chunk).join(Resource).where(Resource.user_id == user_id)))


def search(db: Session, user_id: str, query: str, k: int | None = None, chunks: list[Chunk] | None = None) -> list[Hit]:
    k = k or settings().top_k
    pool = chunks if chunks is not None else user_chunks(db, user_id)
    if not pool:
        return []
    q_tokens = tokenize(query)
    if not q_tokens:
        return []
    docs = [tokenize(c.topic + " " + c.text + " " + " ".join(c.keywords or [])) for c in pool]
    bm25 = BM25Okapi(docs).get_scores(q_tokens)
    qv = embed([query])[0]
    cos = np.array([float(np.dot(qv, from_bytes(c.embedding))) if c.embedding and len(from_bytes(c.embedding)) == len(qv) else 0.0 for c in pool])
    lex = np.array([lexical_relevance(q_tokens, c) for c in pool])

    rrf = np.zeros(len(pool))
    for ranking in (np.argsort(-bm25), np.argsort(-cos), np.argsort(-lex)):
        for rank, idx in enumerate(ranking[:50]):
            rrf[idx] += 1.0 / (60 + rank)

    s = settings()
    dense_is_semantic = provider() != "hash"
    hits = []
    for idx in np.argsort(-rrf):
        covered = lex[idx] >= s.lexical_gate or (dense_is_semantic and cos[idx] >= s.cosine_gate)
        if covered:
            hits.append(Hit(pool[idx], float(rrf[idx]), float(lex[idx]), float(cos[idx])))
        if len(hits) >= k:
            break
    return hits
