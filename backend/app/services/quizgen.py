"""Adaptive question selection and generation.
Generation: the fast model writes questions from a cited chunk → a *different* verifier model
answers each question blind; only questions where both agree are kept (cross-model validation).
Near-duplicates of existing questions are dropped by embedding similarity."""
from __future__ import annotations

import logging
import re

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Attempt, Chunk, Concept, Mastery, Question
from . import llm
from .embed import embed, from_bytes, to_bytes

log = logging.getLogger(__name__)
RANK = {"Easy": 0, "Medium": 1, "Hard": 2}
DUP_THRESHOLD = 0.9


def check_answer(q: Question, given: str) -> bool:
    g = (given or "").strip().lower()
    if q.type == "mcq":
        return g == str(q.answer).strip()
    if q.type == "numeric":
        try:
            a, v = float(q.answer), float(g.replace(",", ""))
        except ValueError:
            return False
        return abs(a - v) <= max(0.011, abs(a) * 0.01)
    return any(k.lower() in g for k in (q.accept or [q.answer]))


def mastery_map(db: Session, user_id: str) -> dict[str, float]:
    return {m.concept_id: m.p for m in db.scalars(select(Mastery).where(Mastery.user_id == user_id))}


def seen_ids(db: Session, user_id: str) -> set[str]:
    return set(db.scalars(select(Attempt.question_id).where(Attempt.user_id == user_id)))


def select_questions(db: Session, user_id: str, subject_id: str, count: int, concept_ids: list[str] | None, adaptive: bool) -> tuple[list[Question], int]:
    """Weakest concepts first, unseen questions first; returns (questions, repeats)."""
    pool = list(db.scalars(select(Question).where(Question.subject_id == subject_id, Question.verified.is_(True))))
    if concept_ids:
        focused = [q for q in pool if q.concept in concept_ids]
        pool = focused or pool
    m = mastery_map(db, user_id)
    seen = seen_ids(db, user_id)
    key = (lambda q: (m.get(q.concept, 0.3), RANK.get(q.difficulty, 1))) if adaptive or concept_ids else (lambda q: hash(q.id) % 97)
    unseen = sorted([q for q in pool if q.id not in seen], key=key)
    chosen = unseen[:count]
    repeats = 0
    if len(chosen) < count:
        extra = sorted([q for q in pool if q not in chosen], key=key)[: count - len(chosen)]
        repeats = len(extra)
        chosen += extra
    return chosen, repeats


QUESTION_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {"type": "object", "properties": {
        "type": {"type": "string", "enum": ["mcq", "numeric", "short"]},
        "difficulty": {"type": "string", "enum": ["Easy", "Medium", "Hard"]},
        "prompt": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},
        "answer": {"type": "string"},
        "accept": {"type": "array", "items": {"type": "string"}},
        "explanation": {"type": "string"},
    }, "required": ["type", "difficulty", "prompt", "options", "answer", "accept", "explanation"], "additionalProperties": False}}},
    "required": ["questions"], "additionalProperties": False,
}
VERIFY_SCHEMA = {"type": "object", "properties": {"answer": {"type": "string"}, "supported_by_excerpt": {"type": "boolean"}}, "required": ["answer", "supported_by_excerpt"], "additionalProperties": False}


async def generate_for_concept(db: Session, concept: Concept, n: int = 3) -> list[Question]:
    """Generate n verified, non-duplicate questions for a concept from its source chunks."""
    if not llm.enabled("fast"):
        return []
    chunks = list(db.scalars(select(Chunk).where(Chunk.concept_id == concept.id)).all())[:4]
    if not chunks:
        return []
    excerpt = "\n\n".join(f"({c.location}) {c.text}" for c in chunks)
    try:
        data = await llm.complete_json(
            "fast",
            "You write exam questions strictly from the given excerpt. Mix multiple-choice (4 options, answer = index '0'-'3'), "
            "numerical (answer = number) and short-answer (accept = key words). Every fact must come from the excerpt.",
            f"Topic: {concept.name}\nExcerpt:\n{excerpt}\n\nWrite {n} questions.",
            QUESTION_SCHEMA,
        )
    except (llm.LLMUnavailable, ValueError) as e:
        log.warning("question generation failed: %s", e)
        return []

    existing = [q for q in db.scalars(select(Question).where(Question.subject_id == concept.subject_id)) if q.embedding]
    existing_vecs = np.array([from_bytes(q.embedding) for q in existing]) if existing else None
    kept: list[Question] = []
    for raw in data.get("questions", []):
        q = Question(
            subject_id=concept.subject_id, concept=concept.id, difficulty=raw["difficulty"], type=raw["type"], prompt=raw["prompt"].strip(),
            options=raw["options"] if raw["type"] == "mcq" else None, answer=str(raw["answer"]).strip(), accept=raw.get("accept") or None,
            explanation=raw["explanation"], source=f"{chunks[0].resource.name} • {chunks[0].location}", chunk_id=chunks[0].id, origin="generated",
        )
        if q.type == "mcq" and (not q.options or not re.fullmatch(r"[0-9]", q.answer) or int(q.answer) >= len(q.options)):
            continue
        vec = embed([q.prompt])[0]
        if existing_vecs is not None and len(existing_vecs) and existing_vecs.shape[1] == vec.shape[0] and float(np.max(existing_vecs @ vec)) >= DUP_THRESHOLD:
            continue  # near-duplicate of a question the student may already have seen
        if not await verify(q, excerpt):
            continue
        q.embedding = to_bytes(vec)
        q.verified, q.verified_by = True, llm.model_for("verifier")
        db.add(q)
        kept.append(q)
        existing_vecs = vec[None, :] if existing_vecs is None or not len(existing_vecs) else np.vstack([existing_vecs, vec])
    db.commit()
    return kept


async def verify(q: Question, excerpt: str) -> bool:
    """Cross-model validation: a second model answers blind; keep only if it agrees."""
    if not llm.enabled("verifier"):
        return False  # unverified questions are never served
    opts = "\n".join(f"{i}: {o}" for i, o in enumerate(q.options or []))
    try:
        res = await llm.complete_json(
            "verifier",
            "Answer the question using only the excerpt. For multiple choice answer with the option index.",
            f"Excerpt:\n{excerpt}\n\nQuestion ({q.type}): {q.prompt}\n{opts}",
            VERIFY_SCHEMA,
            max_tokens=800,
        )
    except (llm.LLMUnavailable, ValueError):
        return False
    return bool(res.get("supported_by_excerpt")) and check_answer(q, str(res.get("answer", "")))
