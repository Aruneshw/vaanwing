"""Runtime configuration. Every model is chosen per *role*, so providers can be mixed:
e.g. Claude for tutoring, GPT for quiz verification, Gemini for figure captions, Ollama locally.

Model strings:
  - "claude-..." or "anthropic/claude-..."  -> official Anthropic SDK
  - any other LiteLLM string ("openai/gpt-...", "gemini/...", "ollama/llama3.1", ...) -> LiteLLM
  - "none" -> role disabled; the backend falls back to its offline (extractive) behaviour
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./studynest.db"
    storage_dir: str = "./storage"
    redis_url: str = ""  # set to use an RQ worker for ingestion; otherwise FastAPI background tasks
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ---- models per role ----
    model_tutor: str = "claude-opus-5-5"  # grounded answers (quality matters most)
    model_fast: str = "claude-haiku-5-5"  # quiz generation, notes, flashcards, topic extraction
    model_verifier: str = "claude-sonnet-5-5"  # cross-model validation of generated questions
    model_vision: str = "claude-sonnet-5-5"  # captions for diagrams / figures
    model_judge: str = "claude-sonnet-5-5"  # LLM judge for evaluation (not the generator)
    tutor_effort: str = "medium"  # low | medium | high | xhigh | max

    # ---- embeddings ----
    # "fastembed" (local ONNX), any LiteLLM embedding model ("openai/text-embedding-3-small",
    # "gemini/text-embedding-004", ...), or "hash" (dependency-free lexical fallback).
    embedding_model: str = "hash"
    fastembed_model: str = "BAAI/bge-small-en-v1.5"

    # ---- media ----
    whisper_model: str = "base"  # faster-whisper size, used for video/audio transcripts
    max_figures_per_doc: int = 24

    # ---- retrieval ----
    top_k: int = 4
    lexical_gate: float = 1.1  # minimum lexical relevance to count as "covered by the material"
    cosine_gate: float = 0.45  # minimum cosine similarity with real embeddings


@lru_cache
def settings() -> Settings:
    return Settings()
