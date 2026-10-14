from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import user_id
from ..models import EvalRun, Subject
from ..schemas import EvalIn
from ..services import evaluation

router = APIRouter(prefix="/api/eval", tags=["evaluation"])


@router.post("/run")
async def run(body: EvalIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    testset = body.testset or evaluation.default_testset()
    subject_id = body.subjectId
    if not subject_id and testset.get("subject"):
        base = testset["subject"]
        own = db.scalars(select(Subject).where(Subject.user_id == uid)).all()
        subject_id = next((s.id for s in own if s.id == base or s.id.startswith(f"{base}-")), None)
    if not subject_id or db.get(Subject, subject_id) is None:
        raise HTTPException(409, "Upload and process the course material for this test set first")
    rag = await evaluation.run_rag_eval(db, uid, testset, body.judge)
    result = {**rag, "personalization": evaluation.run_personalization(db, subject_id)}
    run = EvalRun(user_id=uid, result=result)
    db.add(run)
    db.commit()
    return {"id": run.id, "at": run.created_at.isoformat(), **result}


@router.get("/latest")
def latest(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    run = db.scalars(select(EvalRun).where(EvalRun.user_id == uid).order_by(EvalRun.created_at.desc())).first()
    if run is None:
        raise HTTPException(404, "No evaluation has been run yet")
    return {"id": run.id, "at": run.created_at.isoformat(), **run.result}
