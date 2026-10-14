from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import user_id
from ..models import Concept, LessonProgress, Mastery, Subject
from ..schemas import LessonProgressIn

router = APIRouter(prefix="/api/courses", tags=["courses"])


def _with_progress(s: Subject, progress: dict[str, int]) -> dict:
    return {
        "id": s.id, "name": s.name, "icon": s.icon, "theme": s.theme,
        "modules": [{**m, "lessons": [{**l, "progress": progress.get(l["id"], 0)} for l in m["lessons"]]} for m in s.modules],
    }


@router.get("")
def list_courses(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    progress = {p.lesson_id: p.progress for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == uid))}
    return [_with_progress(s, progress) for s in db.scalars(select(Subject).where(Subject.user_id == uid))]


@router.get("/{sid}")
def get_course(sid: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    s = db.get(Subject, sid)
    if s is None or s.user_id != uid:
        raise HTTPException(404, "Course not found")
    progress = {p.lesson_id: p.progress for p in db.scalars(select(LessonProgress).where(LessonProgress.user_id == uid))}
    mastery = {m.concept_id: m.p for m in db.scalars(select(Mastery).where(Mastery.user_id == uid))}
    concepts = [{"id": c.id, "name": c.name, "source": c.source, "summary": c.summary, "lessonId": c.lesson_id, "prerequisites": c.prerequisites, "mastery": mastery.get(c.id, 0.3)}
                for c in db.scalars(select(Concept).where(Concept.subject_id == sid))]
    return {**_with_progress(s, progress), "concepts": concepts}


@router.put("/lessons/{lesson_id}/progress")
def set_progress(lesson_id: str, body: LessonProgressIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    p = db.get(LessonProgress, (uid, lesson_id)) or LessonProgress(user_id=uid, lesson_id=lesson_id)
    p.progress = body.progress
    db.add(p)
    db.commit()
    return {"lessonId": lesson_id, "progress": p.progress}
