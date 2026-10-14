"""Embeddings behind one function. Providers: local fastembed (ONNX, no API key), any LiteLLM
embedding model, or a dependency-free hashing embedder used when nothing else is configured."""
from __future__ import annotations

import hashlib
import logging

import numpy as np

from ..config import settings
from .text import tokenize

log = logging.getLogger(__name__)
HASH_DIM = 512
_fastembed = None


def _hash_embed(texts: list[str]) -> np.ndarray:
    out = np.zeros((len(texts), HASH_DIM), dtype=np.float32)
    for i, t in enumerate(texts):
        toks = tokenize(t)
        grams = toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]
        for g in grams:
            h = int(hashlib.md5(g.encode()).hexdigest(), 16)
            out[i, h % HASH_DIM] += 1.0 if (h >> 9) & 1 else -1.0
    return _normalise(out)


def _normalise(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=1, keepdims=True)
    n[n == 0] = 1
    return (m / n).astype(np.float32)


def provider() -> str:
    m = settings().embedding_model
    return "hash" if m == "hash" else "fastembed" if m == "fastembed" else "litellm"


def embed(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, HASH_DIM), dtype=np.float32)
    p = provider()
    try:
        if p == "fastembed":
            global _fastembed
            if _fastembed is None:
                from fastembed import TextEmbedding

                _fastembed = TextEmbedding(settings().fastembed_model)
            return _normalise(np.array(list(_fastembed.embed(texts)), dtype=np.float32))
        if p == "litellm":
            import litellm

            resp = litellm.embedding(model=settings().embedding_model, input=texts)
            return _normalise(np.array([d["embedding"] for d in resp.data], dtype=np.float32))
    except Exception as e:  # fall back rather than failing ingestion
        log.warning("embedding provider %s failed (%s); using hash embeddings", p, e)
    return _hash_embed(texts)


def to_bytes(v: np.ndarray) -> bytes:
    return v.astype(np.float32).tobytes()


def from_bytes(b: bytes) -> np.ndarray:
    return np.frombuffer(b, dtype=np.float32)
