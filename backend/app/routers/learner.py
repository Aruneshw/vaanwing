"""Learner model endpoints: mastery, new-student diagnostic, learning path."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import user_id
from ..models import Concept, LearnerProfile, Mastery, Question, QuizSession
from ..schemas import DiagnosticSubmitIn
from ..services import bkt
from .quiz import q_out, record_answer

router = APIRouter(prefix="/api/learner", tags=["learner"])
RANK = {"Easy": 0, "Medium": 1, "Hard": 2}


@router.get("/profile")
def profile(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    p = db.get(LearnerProfile, uid)
    return {"userId": uid, "name": p.name if p else "", "level": p.level if p else None, "goal": p.goal if p else "", "onboarded": bool(p and p.onboarded)}


@router.get("/mastery")
def mastery(subjectId: str | None = None, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    m = {x.concept_id: x for x in db.scalars(select(Mastery).where(Mastery.user_id == uid))}
    q = select(Concept).where(Concept.subject_id == subjectId) if subjectId else select(Concept)
    rows = [{"concept": c.id, "name": c.name, "subjectId": c.subject_id, "mastery": m[c.id].p if c.id in m else None, "attempts": m[c.id].attempts if c.id in m else 0} for c in db.scalars(q)]
    return sorted(rows, key=lambda r: (r["mastery"] is None, r["mastery"] or 0))


@router.post("/diagnostic/start")
def diagnostic_start(subjectId: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    """One question per concept, easiest first — breadth over depth for a student with no history."""
    by_concept: dict[str, Question] = {}
    for q in sorted(db.scalars(select(Question).where(Question.subject_id == subjectId, Question.verified.is_(True))), key=lambda q: RANK.get(q.difficulty, 1)):
        by_concept.setdefault(q.concept, q)
    questions = list(by_concept.values())[:10]
    if not questions:
        raise HTTPException(404, "No questions for this subject yet — upload material first")
    s = QuizSession(user_id=uid, subject_id=subjectId, kind="diagnostic", question_ids=[q.id for q in questions])
    db.add(s)
    db.commit()
    return {"quizId": s.id, "questions": [q_out(q) for q in questions]}


@router.post("/diagnostic/submit")
def diagnostic_submit(body: DiagnosticSubmitIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    quiz = db.get(QuizSession, body.quizId)
    if quiz is None or quiz.user_id != uid or quiz.kind != "diagnostic":
        raise HTTPException(404, "Diagnostic not found")
    prior = bkt.PRIORS[body.level]
    # Seed every concept of the subject with the self-reported prior, then update from answers.
    for c in db.scalars(select(Concept).where(Concept.subject_id == quiz.subject_id)):
        m = db.get(Mastery, (uid, c.id)) or Mastery(user_id=uid, concept_id=c.id, attempts=0)
        m.p = prior
        db.add(m)
    db.commit()
    results = [record_answer(db, uid, quiz, a) for a in body.answers]
    p = db.get(LearnerProfile, uid) or LearnerProfile(user_id=uid)
    p.name, p.level, p.goal, p.onboarded = body.name, body.level, body.goal, True
    db.add(p)
    db.commit()
    names = {c.id: c.name for c in db.scalars(select(Concept).where(Concept.subject_id == quiz.subject_id))}
    strengths = [{"concept": r.concept, "name": names.get(r.concept, r.concept), "mastery": r.masteryAfter} for r in results if r.correct]
    weaknesses = [{"concept": r.concept, "name": names.get(r.concept, r.concept), "mastery": r.masteryAfter} for r in results if not r.correct]
    return {"score": sum(r.correct for r in results), "total": len(results), "strengths": strengths, "weaknesses": sorted(weaknesses, key=lambda w: w["mastery"])}


@router.get("/path")
def learning_path(subjectId: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    """Weakest concepts first, but a concept is only recommended once its prerequisites are reasonably mastered."""
    m = {x.concept_id: x.p for x in db.scalars(select(Mastery).where(Mastery.user_id == uid))}
    concepts = list(db.scalars(select(Concept).where(Concept.subject_id == subjectId)))
    ready, blocked = [], []
    for c in sorted(concepts, key=lambda c: m.get(c.id, 0.3)):
        if m.get(c.id, 0.3) >= 0.8:
            continue
        missing = [p for p in c.prerequisites if m.get(p, 0.3) < 0.6]
        item = {"concept": c.id, "name": c.name, "mastery": m.get(c.id, 0.3), "lessonId": c.lesson_id, "source": c.source, "blockedBy": missing}
        (blocked if missing else ready).append(item)
    return {"next": ready[:5], "blocked": blocked[:5], "mastered": [c.id for c in concepts if m.get(c.id, 0) >= 0.8]}
