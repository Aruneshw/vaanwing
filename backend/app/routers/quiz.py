from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import user_id
from ..models import Attempt, Concept, Mastery, Question, QuizSession
from ..schemas import AnswerIn, AnswerOut, QuestionOut, QuizIn, QuizOut
from ..services import bkt, llm
from ..services.quizgen import check_answer, generate_for_concept, mastery_map, select_questions

router = APIRouter(prefix="/api/quiz", tags=["quiz"])


def q_out(q: Question) -> QuestionOut:
    return QuestionOut(id=q.id, subjectId=q.subject_id, concept=q.concept, difficulty=q.difficulty, type=q.type, prompt=q.prompt, options=q.options, source=q.source)


@router.post("", response_model=QuizOut)
async def create_quiz(body: QuizIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    questions, repeats = select_questions(db, uid, body.subjectId, body.count, body.conceptIds, body.adaptive)
    # Top up with freshly generated, cross-model-verified questions when the bank runs dry.
    if (repeats or len(questions) < body.count) and llm.enabled("fast") and llm.enabled("verifier"):
        m = mastery_map(db, uid)
        concepts = sorted(db.scalars(select(Concept).where(Concept.subject_id == body.subjectId)), key=lambda c: m.get(c.id, 0.3))
        for c in [c for c in concepts if not body.conceptIds or c.id in body.conceptIds][:2]:
            await generate_for_concept(db, c, n=3)
        questions, repeats = select_questions(db, uid, body.subjectId, body.count, body.conceptIds, body.adaptive)
    if not questions:
        raise HTTPException(404, "No questions available for this subject yet")
    s = QuizSession(user_id=uid, subject_id=body.subjectId, kind="adaptive" if body.adaptive else "practice", question_ids=[q.id for q in questions])
    db.add(s)
    db.commit()
    return QuizOut(quizId=s.id, questions=[q_out(q) for q in questions], repeats=repeats)


def record_answer(db: Session, uid: str, quiz: QuizSession, body: AnswerIn) -> AnswerOut:
    if body.questionId not in quiz.question_ids:
        raise HTTPException(422, "Question is not part of this quiz")
    q = db.get(Question, body.questionId)
    correct = check_answer(q, body.answer)
    m = db.get(Mastery, (uid, q.concept)) or Mastery(user_id=uid, concept_id=q.concept, p=0.3, attempts=0)
    before = m.p
    m.p, m.attempts = bkt.update(before, correct), (m.attempts or 0) + 1
    db.add(m)
    db.add(Attempt(user_id=uid, quiz_id=quiz.id, question_id=q.id, concept=q.concept, given=body.answer, correct=correct, mastery_before=before, mastery_after=m.p))
    db.commit()
    shown = q.options[int(q.answer)] if q.type == "mcq" and q.options else q.answer
    return AnswerOut(correct=correct, correctAnswer=shown, explanation=q.explanation, source=q.source, concept=q.concept, masteryBefore=before, masteryAfter=m.p)


@router.post("/{quiz_id}/answer", response_model=AnswerOut)
def answer(quiz_id: str, body: AnswerIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    quiz = db.get(QuizSession, quiz_id)
    if quiz is None or quiz.user_id != uid:
        raise HTTPException(404, "Quiz not found")
    return record_answer(db, uid, quiz, body)


@router.get("/{quiz_id}/report")
def report(quiz_id: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    """Post-assessment report: score, per-concept mastery change, weak topics, likely misconceptions (cited)."""
    quiz = db.get(QuizSession, quiz_id)
    if quiz is None or quiz.user_id != uid:
        raise HTTPException(404, "Quiz not found")
    attempts = list(db.scalars(select(Attempt).where(Attempt.quiz_id == quiz_id).order_by(Attempt.created_at)))
    per: dict[str, dict] = {}
    for a in attempts:
        r = per.setdefault(a.concept, {"concept": a.concept, "before": a.mastery_before, "after": a.mastery_after, "correct": 0, "total": 0})
        r["after"], r["total"], r["correct"] = a.mastery_after, r["total"] + 1, r["correct"] + int(a.correct)
    names = {c.id: c.name for c in db.scalars(select(Concept).where(Concept.id.in_(list(per))))}
    misconceptions = []
    for a in attempts:
        if not a.correct:
            q = db.get(Question, a.question_id)
            given = q.options[int(a.given)] if q.type == "mcq" and q.options and a.given.isdigit() and int(a.given) < len(q.options) else a.given
            misconceptions.append({"question": q.prompt, "given": given, "explanation": q.explanation, "source": q.source, "concept": names.get(q.concept, q.concept)})
    rows = [{**r, "name": names.get(r["concept"], r["concept"])} for r in per.values()]
    return {
        "quizId": quiz_id, "score": sum(a.correct for a in attempts), "total": len(attempts),
        "concepts": rows, "weak": [r for r in rows if r["correct"] < r["total"]], "misconceptions": misconceptions,
    }


@router.get("/history/all")
def quiz_history(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    out = []
    for s in db.scalars(select(QuizSession).where(QuizSession.user_id == uid).order_by(QuizSession.created_at)):
        atts = list(db.scalars(select(Attempt).where(Attempt.quiz_id == s.id)))
        if atts:
            out.append({"id": s.id, "subjectId": s.subject_id, "kind": s.kind, "score": sum(a.correct for a in atts), "total": len(atts), "at": s.created_at.isoformat()})
    return out
