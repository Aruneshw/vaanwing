"""Source-grounded answering. The model sees only numbered excerpts and must cite them as [n];
questions the material does not cover are declined, or answered and clearly flagged as outside
knowledge when the student allows it (Open mode / Web Search)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from . import llm
from .retrieve import Hit, search
from .text import sentences

NOT_COVERED = "NOT_IN_SOURCES"

MODE_STYLE = {
    "course": "Explain clearly for a student.",
    "guided": "Teach Socratically: explain briefly, then end with one short check-yourself question.",
    "exam": "Be concise and exam-oriented: definition, key points, one example, one likely exam angle.",
    "open": "Explain clearly for a student.",
}
INTENT_STYLE = {
    "summarize": "Format the answer as a short bulleted summary.",
    "notes": "Format the answer as revision notes with bullet points.",
    "solve": "Work through the problem step by step, writing the rule or formula before substituting values.",
    "explain": "",
}

SYSTEM = """You are StudyNest's AI tutor. Answer the student's question using ONLY the numbered source excerpts provided.
Rules:
- Put a citation like [1] or [2][3] right after every sentence that uses a source. Only cite numbers that exist.
- Do not add facts that are not in the excerpts.
- If the excerpts do not contain the answer, reply with exactly: NOT_IN_SOURCES
- Reply in the language the student used (English or Hindi)."""

SYSTEM_OUTSIDE = """You are StudyNest's AI tutor. The student's course material does not cover this question.
Answer briefly from general knowledge. Do not invent citations or claim it comes from the course material."""


@dataclass
class Answer:
    text: str
    citations: list[dict] = field(default_factory=list)
    grounded: str = "source"  # source | outside | declined
    model: str = "extractive"
    hits: list[Hit] = field(default_factory=list)


def citation_payload(hits: list[Hit]) -> list[dict]:
    return [
        {"n": i + 1, "chunkId": h.chunk.id, "resource": h.chunk.resource.name, "resourceId": h.chunk.resource_id, "location": h.chunk.location, "topic": h.chunk.topic, "excerpt": h.chunk.text[:400]}
        for i, h in enumerate(hits)
    ]


def build_context(hits: list[Hit]) -> str:
    return "\n\n".join(f"[{i + 1}] ({h.chunk.resource.name}, {h.chunk.location}) {h.chunk.text}" for i, h in enumerate(hits))


def _decline_text() -> str:
    return (
        "I couldn't find anything about this in your sources, so I won't guess.\n\n"
        "Study Mode (Course Only) keeps answers grounded in your materials. Add a source that covers it, "
        "switch to Open Mode, or enable Web Search — outside answers are clearly flagged."
    )


def extractive(question: str, hits: list[Hit], intent: str | None, mode: str) -> str:
    topic = hits[0].chunk.topic.split(":")[0]
    intro = {"summarize": f"Summary of **{topic}** from your materials:", "notes": f"Notes on **{topic}**:", "solve": "Let's work through it using your sources:"}.get(
        intent or "", f"Here's what your sources say about **{topic}**:"
    )
    bullet = intent in {"summarize", "notes"}
    body = "\n\n".join(f"{'• ' if bullet else ''}{h.chunk.text} [{i + 1}]" for i, h in enumerate(hits))
    return f"{intro}\n\n{body}"


def _valid_citations(text: str, n: int) -> set[int]:
    return {int(x) for x in re.findall(r"\[(\d+)\]", text) if 1 <= int(x) <= n}


def _history(history: list[dict] | None) -> list[dict]:
    msgs = []
    for h in (history or [])[-6:]:
        if h.get("role") in {"user", "assistant"} and h.get("text"):
            msgs.append({"role": h["role"], "content": h["text"]})
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return msgs


def prepare(db: Session, user_id: str, question: str) -> list[Hit]:
    return search(db, user_id, question)


def user_prompt(question: str, hits: list[Hit], mode: str, intent: str | None) -> str:
    style = " ".join(x for x in (MODE_STYLE.get(mode, ""), INTENT_STYLE.get(intent or "", "")) if x)
    return f"Source excerpts:\n{build_context(hits)}\n\nStyle: {style}\n\nStudent question: {question}"


def web_tools() -> list[dict] | None:
    # Claude's server-side web search, used only when the student enables Web Search.
    return [{"type": "web_search_20260209", "name": "web_search", "max_uses": 3}] if llm.model_for("tutor").startswith(("claude-", "anthropic/")) else None


async def answer(db: Session, user_id: str, question: str, *, mode: str = "course", web_search: bool = False, intent: str | None = None, history: list[dict] | None = None) -> Answer:
    hits = prepare(db, user_id, question)
    allow_outside = mode == "open" or web_search

    if not hits:
        if not allow_outside:
            return Answer(_decline_text(), grounded="declined")
        if llm.enabled("tutor"):
            try:
                res = await llm.complete("tutor", SYSTEM_OUTSIDE, _history(history) + [{"role": "user", "content": question}], max_tokens=4000, effort="low", tools=web_tools() if web_search else None)
                if not res.refused and res.text.strip():
                    return Answer(res.text.strip(), grounded="outside", model=res.model)
            except llm.LLMUnavailable:
                pass
        return Answer(
            f"I couldn't find “{question}” in your uploaded materials, so this is not source-backed. "
            "Upload the relevant lecture, chapter or slides and I'll answer with exact citations.",
            grounded="outside",
        )

    cites = citation_payload(hits)
    if llm.enabled("tutor"):
        try:
            res = await llm.complete("tutor", SYSTEM, _history(history) + [{"role": "user", "content": user_prompt(question, hits, mode, intent)}], max_tokens=6000, effort=llm.settings().tutor_effort)
            text = res.text.strip()
            if res.refused:
                return Answer("The model declined to answer this request.", grounded="declined", model=res.model)
            if text.startswith(NOT_COVERED):
                return Answer(_decline_text(), grounded="declined", model=res.model, hits=hits)
            used = _valid_citations(text, len(hits))
            if used:
                text = re.sub(r"\[(\d+)\]", lambda m: m.group(0) if int(m.group(1)) in used else "", text)
                return Answer(text, [c for c in cites if c["n"] in used], "source", res.model, hits)
            # An uncited answer is not trusted as grounded.
            return Answer(text, [], "outside", res.model, hits)
        except llm.LLMUnavailable:
            pass
    return Answer(extractive(question, hits, intent, mode), cites, "source", "extractive", hits)


def answer_sentences(text: str) -> list[str]:
    return [re.sub(r"\[\d+\]|\*\*", "", s).strip() for s in sentences(text) if not re.match(r"^(Here's what|Summary of|Let's work|Notes on)", s)]
