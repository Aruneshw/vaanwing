"""Ingestion pipeline: extract → (caption figures) → chunk → embed → build course → generate questions.
Runs as a FastAPI background task, or on an RQ worker when REDIS_URL is set."""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from sqlalchemy import func, select

from ..config import settings
from ..db import SessionLocal
from ..models import Chunk, Concept, Question, Resource
from ..services import ingest, llm
from ..services.embed import embed, to_bytes
from ..services.ingest.chunker import chunk_segments
from ..services.quizgen import generate_for_concept
from ..services.topics import build_course

log = logging.getLogger(__name__)


def _stage(db, r: Resource, stage: str, progress: int) -> None:
    r.stage, r.progress = stage, progress
    db.commit()


async def ingest_resource(resource_id: str) -> None:
    with SessionLocal() as db:
        r = db.get(Resource, resource_id)
        if r is None:
            return
        try:
            await _run(db, r)
            r.status, r.stage, r.progress = "ready", "done", 100
            db.commit()
        except Exception as e:  # surface the failure on the resource instead of crashing the worker
            log.exception("ingestion failed for %s", resource_id)
            db.rollback()
            r.status, r.stage, r.error = "failed", "failed", str(e)[:500]
            db.commit()


async def _run(db, r: Resource) -> None:
    _stage(db, r, "text", 10)
    pages: list[str] | None = None
    figures = []
    path = Path(r.path) if r.path else None
    if r.kind == "pdf" and path:
        segments, figures, n = ingest.extract_pdf(path)
        pages = [s.text for s in segments]
        r.meta = f"{n} pages"
    elif r.kind == "slides" and path:
        segments, n = ingest.extract_pptx(path)
        r.meta = f"{n} slides"
    elif r.kind == "docx" and path:
        segments = ingest.extract_docx(path)
        r.kind, r.meta = "pdf", f"{len(segments)} sections"
    elif r.kind in {"video", "audio"} and path:
        _stage(db, r, "transcripts", 30)
        segments, dur = await asyncio.to_thread(ingest.transcribe, path)
        r.meta = dur
    elif r.kind == "youtube":
        _stage(db, r, "transcripts", 30)
        segments, dur = await asyncio.to_thread(ingest.youtube_transcript, r.url or "")
        r.meta = dur
    elif r.kind == "web":
        segments, title = await asyncio.to_thread(ingest.extract_web, r.url or "")
        r.name, r.meta = title, "Web page"
    elif r.kind == "image" and path:
        segments = await ingest.extract_image(path, f"image/{path.suffix.lstrip('.').replace('jpg', 'jpeg')}")
        r.meta = "1 image"
    else:
        segments = ingest.extract_text(r.text or (path.read_text(errors="ignore") if path else ""))
        r.meta = f"{len(segments)} sections"

    _stage(db, r, "figures", 40)
    segments += await ingest.caption_figures(figures)

    _stage(db, r, "chunking", 55)
    drafts = chunk_segments(segments)
    if not drafts:
        raise ValueError("No text could be extracted from this source")

    _stage(db, r, "embedding", 70)
    vecs = await asyncio.to_thread(embed, [f"{d.topic}. {d.text}" for d in drafts])
    db.query(Chunk).filter(Chunk.resource_id == r.id).delete()
    for d, v in zip(drafts, vecs):
        db.add(Chunk(resource_id=r.id, location=d.location, topic=d.topic, keywords=d.keywords, text=d.text, modality=d.modality, embedding=to_bytes(v)))
    db.commit()

    _stage(db, r, "organizing", 85)
    subject = await build_course(db, r, pages)
    if subject:
        r.subject_id = subject.id
    db.commit()

    if subject and llm.enabled("fast") and llm.enabled("verifier"):
        _stage(db, r, "questions", 92)
        concepts = list(db.scalars(select(Concept).where(Concept.subject_id == subject.id)))
        for c in concepts[:12]:
            have = db.scalar(select(func.count()).select_from(Question).where(Question.concept == c.id, Question.verified.is_(True)))
            if (have or 0) < 2:
                await generate_for_concept(db, c, n=3)


def run_ingest(resource_id: str) -> None:
    """Sync entry point for RQ workers."""
    asyncio.run(ingest_resource(resource_id))


def enqueue(resource_id: str, background_tasks) -> None:
    if settings().redis_url:
        from redis import Redis
        from rq import Queue

        Queue("ingest", connection=Redis.from_url(settings().redis_url)).enqueue(run_ingest, resource_id, job_timeout=3600)
    else:
        background_tasks.add_task(ingest_resource, resource_id)
