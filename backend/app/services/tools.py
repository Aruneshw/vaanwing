"""Learning tools (notes, flashcards, summary, slides, mind map, audio brief, data table, reports).
LLM-written when the fast model is configured; otherwise built extractively from the excerpts."""
from __future__ import annotations

from collections import OrderedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Chunk, Concept, Mastery, Resource
from . import llm
from .text import sentences

_STR = {"type": "string"}
SCHEMAS = {
    "flashcards": {"type": "object", "properties": {"cards": {"type": "array", "items": {"type": "object", "properties": {"front": _STR, "back": _STR, "chunkId": _STR}, "required": ["front", "back", "chunkId"], "additionalProperties": False}}}, "required": ["cards"], "additionalProperties": False},
    "slides": {"type": "object", "properties": {"slides": {"type": "array", "items": {"type": "object", "properties": {"title": _STR, "bullets": {"type": "array", "items": _STR}, "chunkIds": {"type": "array", "items": _STR}}, "required": ["title", "bullets", "chunkIds"], "additionalProperties": False}}}, "required": ["slides"], "additionalProperties": False},
}
KINDS = {"notes", "flashcards", "summary", "slides", "mindmap", "audio", "table", "reports"}


def _first(text: str) -> str:
    s = sentences(text)
    return s[0] if s else text[:200]


def _chunks(db: Session, user_id: str, subject_id: str | None) -> list[Chunk]:
    q = select(Chunk).join(Resource).where(Resource.user_id == user_id)
    if subject_id:
        q = q.where(Resource.subject_id == subject_id)
    return list(db.scalars(q))


def _by_topic(chunks: list[Chunk]) -> "OrderedDict[str, list[Chunk]]":
    g: OrderedDict[str, list[Chunk]] = OrderedDict()
    for c in chunks:
        g.setdefault(c.topic.split(":")[0], []).append(c)
    return g


def _cite(c: Chunk) -> dict:
    return {"chunkId": c.id, "resource": c.resource.name, "location": c.location}


async def generate(db: Session, user_id: str, kind: str, subject_id: str | None = None) -> dict:
    chunks = _chunks(db, user_id, subject_id)
    groups = _by_topic(chunks)
    if kind == "table":
        return {"kind": kind, "rows": [{"topic": c.topic, "source": c.resource.name, "location": c.location, "excerpt": c.text, "chunkId": c.id} for c in chunks]}
    if kind == "reports":
        m = {x.concept_id: x.p for x in db.scalars(select(Mastery).where(Mastery.user_id == user_id))}
        cs = list(db.scalars(select(Concept).where(Concept.subject_id == subject_id) if subject_id else select(Concept)))
        rows = sorted(({"concept": c.id, "name": c.name, "mastery": m.get(c.id, 0.3)} for c in cs), key=lambda r: r["mastery"])
        return {"kind": kind, "mastery": rows, "weak": [r for r in rows if r["mastery"] < 0.45][:5]}
    if kind == "mindmap":
        cs = list(db.scalars(select(Concept).where(Concept.subject_id == subject_id))) if subject_id else []
        if cs:
            return {"kind": kind, "center": subject_id, "nodes": [{"id": c.id, "label": c.name, "source": c.source} for c in cs], "edges": [{"from": p, "to": c.id} for c in cs for p in c.prerequisites]}
        return {"kind": kind, "center": "Your Course", "nodes": [{"id": t, "label": t, "sources": len(cs_)} for t, cs_ in list(groups.items())[:14]], "edges": []}

    topics = list(groups.items())[:12]
    if llm.enabled("fast") and topics:
        material = "\n\n".join(f"## {t}\n" + "\n".join(f"[{c.id}] ({c.location}) {c.text[:500]}" for c in cs[:3]) for t, cs in topics)
        prompts = {
            "notes": "Write concise revision notes per topic. After each bullet cite the excerpt id in brackets, e.g. [abc123].",
            "summary": "Write one key-point sentence per topic, citing the excerpt id in brackets.",
            "flashcards": 'Return JSON {"cards":[{"front":..., "back":..., "chunkId":...}]} with one or two cards per topic, answers from the excerpts only.',
            "slides": 'Return JSON {"slides":[{"title":..., "bullets":[...], "chunkIds":[...]}]}, one slide per topic, max 4 bullets.',
            "audio": "Write a 60-90 second spoken recap script for a student, conversational, no markdown.",
        }
        try:
            if kind in {"flashcards", "slides"}:
                data = await llm.complete_json("fast", "You create study material strictly from the provided excerpts.", f"{prompts[kind]}\n\n{material}", SCHEMAS[kind])
                return {"kind": kind, **data, "model": llm.model_for("fast")}
            res = await llm.complete("fast", "You create study material strictly from the provided excerpts.", [{"role": "user", "content": f"{prompts[kind]}\n\n{material}"}], max_tokens=4000, effort="low")
            return {"kind": kind, "text": res.text, "model": res.model}
        except llm.LLMUnavailable:
            pass

    # Extractive fallback
    if kind == "flashcards":
        return {"kind": kind, "cards": [{"front": f"What is {t}?", "back": _first(cs[0].text), **_cite(cs[0])} for t, cs in topics]}
    if kind == "slides":
        return {"kind": kind, "slides": [{"title": t, "bullets": [_first(c.text) for c in cs[:3]], "sources": [_cite(c) for c in cs[:3]]} for t, cs in topics]}
    if kind == "audio":
        return {"kind": kind, "text": "Here is your audio brief. " + " ".join(f"{t}. {_first(cs[0].text)}" for t, cs in topics[:6])}
    if kind == "summary":
        return {"kind": kind, "items": [{"topic": t, "point": _first(cs[0].text), **_cite(cs[0])} for t, cs in topics]}
    return {"kind": kind, "sections": [{"topic": t, "points": [{"text": c.text, **_cite(c)} for c in cs[:4]]} for t, cs in topics]}
