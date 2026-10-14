"""Turns ingested chunks into a course: subject → modules (topics) → lessons, plus concepts
that quizzes and the learner model are tagged to."""
from __future__ import annotations

import json
import logging
import re
from collections import OrderedDict
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Chunk, Concept, Question, Resource, Subject
from . import llm

log = logging.getLogger(__name__)
DATA = Path(__file__).resolve().parent.parent / "data"
THEMES = ["blue", "yellow", "coral", "green", "purple", "pink"]
LESSON_TYPES = ["pdf", "notes", "slides"]
LESSON_TITLES = ["Core Idea", "Deep Dive & Terminology", "Quick Revision"]


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "subject"


def os_bank() -> dict:
    return json.loads((DATA / "os_bank.json").read_text())


def _location_page(loc: str) -> int | None:
    m = re.search(r"p\. (\d+)", loc)
    return int(m.group(1)) if m else None


def _unique_subject_id(db: Session, user_id: str, base: str) -> str:
    sid, n = base, 2
    while db.get(Subject, sid) is not None and db.get(Subject, sid).user_id != user_id:
        sid, n = f"{base}-{n}", n + 1
    return sid


async def build_course(db: Session, resource: Resource, pages: list[str] | None = None) -> Subject | None:
    chunks = list(db.scalars(select(Chunk).where(Chunk.resource_id == resource.id)))
    if not chunks:
        return None
    if pages and _is_topic_structured(pages):
        return _course_from_topic_pages(db, resource, pages, chunks)
    return await _course_from_chunks(db, resource, chunks)


def _is_topic_structured(pages: list[str]) -> bool:
    return sum(1 for p in pages if re.search(r"TOPIC \d{1,2}", p)) >= 5


def _course_from_topic_pages(db: Session, resource: Resource, pages: list[str], chunks: list[Chunk]) -> Subject:
    """Notes organised as 'TOPIC NN' pages (like the Operating System notes)."""
    from .ingest import page_topic

    by_topic: "OrderedDict[int, list[int]]" = OrderedDict()
    for i, p in enumerate(pages, start=1):
        m = re.search(r"TOPIC (\d{1,2})", p)
        if m:
            by_topic.setdefault(int(m.group(1)), []).append(i)
    bank = os_bank()
    is_os = sum(1 for t in bank["topics"] if any(t in p for p in pages)) >= 8
    sid = _unique_subject_id(db, resource.user_id, "os" if is_os else slug(resource.name.rsplit(".", 1)[0]))
    prefix = sid  # ids are namespaced by subject so several students can upload the same notes

    modules, page_to_concept = [], {}
    for n, page_nums in sorted(by_topic.items()):
        title = page_topic(pages[page_nums[0] - 1])
        cid = f"{prefix}-{n:02d}"
        lessons = []
        for k, pg in enumerate(page_nums[:3]):
            lessons.append({
                "id": f"{prefix}-l{n}-{k}", "title": LESSON_TITLES[k] if k < 3 else f"Part {k + 1}", "type": LESSON_TYPES[k % 3],
                "meta": f"PDF • Page {pg}", "concepts": [cid], "source": f"{resource.name} • p. {pg}",
                "content": re.sub(r"\s+", " ", pages[pg - 1]).strip()[:900],
            })
            page_to_concept[pg] = cid
        modules.append({"id": f"{prefix}-m{n}", "title": title, "lessons": lessons})
        _upsert_concept(db, cid, sid, title, f"{resource.name} • p. {page_nums[0]}", lessons[0]["id"])

    for c in chunks:
        pg = _location_page(c.location)
        if pg in page_to_concept:
            c.concept_id = page_to_concept[pg]
    subject = _upsert_subject(db, sid, resource.user_id, "Operating Systems" if is_os else resource.name.rsplit(".", 1)[0], "network" if is_os else "book", "pink" if is_os else "blue", modules)
    if is_os:
        _load_bank(db, sid, bank, concept_prefix=prefix)
    return subject


async def _course_from_chunks(db: Session, resource: Resource, chunks: list[Chunk]) -> Subject:
    """Generic material: group chunks by topic (LLM-assisted when available)."""
    groups: "OrderedDict[str, list[Chunk]]" = OrderedDict()
    for c in chunks:
        groups.setdefault(c.topic.split(":")[0].strip() or c.location, []).append(c)
    names = list(groups)[:40]
    titles = {n: n for n in names}
    prereqs: dict[str, list[str]] = {}
    if llm.enabled("fast") and len(names) > 1:
        try:
            schema = {"type": "object", "properties": {"topics": {"type": "array", "items": {"type": "object", "properties": {
                "label": {"type": "string"}, "title": {"type": "string"}, "prerequisites": {"type": "array", "items": {"type": "string"}}},
                "required": ["label", "title", "prerequisites"], "additionalProperties": False}}}, "required": ["topics"], "additionalProperties": False}
            data = await (llm.complete_json("fast", "You organise course material into a syllabus.",
                "Give each raw section label a short, clean topic title and list prerequisite labels (from the same list) for it.\n"
                + "\n".join(f"- {n}: {groups[n][0].text[:160]}" for n in names), schema))
            for t in data.get("topics", []):
                if t["label"] in titles:
                    titles[t["label"]] = t["title"][:80]
                    prereqs[t["label"]] = [p for p in t.get("prerequisites", []) if p in titles]
        except Exception as e:
            log.info("topic extraction via LLM skipped: %s", e)

    sid = _unique_subject_id(db, resource.user_id, slug(resource.name.rsplit(".", 1)[0]))
    modules = []
    for i, n in enumerate(names, start=1):
        cid = f"{sid}-{i:02d}"
        lessons = [{
            "id": f"{sid}-l{i}-{k}", "title": c.location, "type": {"pdf": "pdf", "slides": "slides", "video": "video", "youtube": "video"}.get(resource.kind, "notes"),
            "meta": c.location, "concepts": [cid], "source": f"{resource.name} • {c.location}", "content": c.text,
        } for k, c in enumerate(groups[n][:4])]
        modules.append({"id": f"{sid}-m{i}", "title": titles[n], "lessons": lessons})
        _upsert_concept(db, cid, sid, titles[n], f"{resource.name} • {groups[n][0].location}", lessons[0]["id"], [f"{sid}-{names.index(p) + 1:02d}" for p in prereqs.get(n, [])])
        for c in groups[n]:
            c.concept_id = cid
    return _upsert_subject(db, sid, resource.user_id, resource.name.rsplit(".", 1)[0][:60], "book", THEMES[len(modules) % len(THEMES)], modules)


def _upsert_concept(db: Session, cid: str, sid: str, name: str, source: str, lesson_id: str, prereq: list[str] | None = None) -> None:
    c = db.get(Concept, cid) or Concept(id=cid, subject_id=sid, name=name)
    c.subject_id, c.name, c.source, c.lesson_id, c.prerequisites = sid, name, source, lesson_id, prereq or []
    c.summary = c.summary or f"{name} — from {source}"
    db.add(c)


def _upsert_subject(db: Session, sid: str, user_id: str, name: str, icon: str, theme: str, modules: list) -> Subject:
    s = db.get(Subject, sid) or Subject(id=sid, user_id=user_id, name=name)
    s.name, s.icon, s.theme, s.modules = name, icon, theme, modules
    db.add(s)
    return s


def _load_bank(db: Session, sid: str, bank: dict, concept_prefix: str) -> None:
    """Verified, page-cited questions written for the OS notes (bank concept ids are 'os-NN')."""
    for q in bank["questions"]:
        qid = q["id"] if sid == "os" else f"{sid}:{q['id']}"
        if db.get(Question, qid):
            continue
        db.add(Question(
            id=qid, subject_id=sid, concept=q["concept"].replace("os-", f"{concept_prefix}-", 1), difficulty=q["difficulty"], type=q["type"], prompt=q["prompt"],
            options=q.get("options"), answer=str(q["answer"]), accept=q.get("accept"), explanation=q["explanation"],
            source=q["source"], origin="bank", verified=True, verified_by="human",
        ))
