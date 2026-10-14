import json
import re

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_db
from ..deps import user_id
from ..models import ChatTurn
from ..schemas import ChatIn, ChatOut
from ..services import grounding, llm

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _save(db: Session, uid: str, q: str, a: grounding.Answer) -> None:
    db.add(ChatTurn(user_id=uid, role="user", text=q))
    db.add(ChatTurn(user_id=uid, role="assistant", text=a.text, citations=a.citations, grounded=a.grounded, model=a.model))
    db.commit()


@router.post("", response_model=ChatOut)
async def chat(body: ChatIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    a = await grounding.answer(db, uid, body.message, mode=body.mode, web_search=body.webSearch, intent=body.intent, history=body.history)
    _save(db, uid, body.message, a)
    return ChatOut(text=a.text, citations=a.citations, grounded=a.grounded, model=a.model)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/stream")
async def chat_stream(body: ChatIn, uid: str = Depends(user_id)):
    """Server-sent events: `citations` (sources first), `token`* , then `done` with the final grounding verdict."""

    async def gen():
        with SessionLocal() as db:
            async for ev in _stream(db, uid, body):
                yield ev

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


async def _stream(db: Session, uid: str, body: ChatIn):
    hits = grounding.prepare(db, uid, body.message)
    if not hits or not llm.enabled("tutor"):
        a = await grounding.answer(db, uid, body.message, mode=body.mode, web_search=body.webSearch, intent=body.intent, history=body.history)
        yield _sse("citations", a.citations)
        yield _sse("token", a.text)
        yield _sse("done", {"grounded": a.grounded, "model": a.model})
        _save(db, uid, body.message, a)
        return
    cites = grounding.citation_payload(hits)
    yield _sse("citations", cites)
    text = ""
    try:
        msgs = grounding._history(body.history) + [{"role": "user", "content": grounding.user_prompt(body.message, hits, body.mode, body.intent)}]
        async for delta in llm.stream("tutor", grounding.SYSTEM, msgs, effort=llm.settings().tutor_effort):
            text += delta
            if not text.startswith(grounding.NOT_COVERED[: len(text)]):
                yield _sse("token", delta)
    except llm.LLMUnavailable as e:
        yield _sse("error", {"message": str(e)})
    if text.strip().startswith(grounding.NOT_COVERED):
        a = grounding.Answer(grounding._decline_text(), grounded="declined", model=llm.model_for("tutor"))
        yield _sse("token", a.text)
    else:
        used = {int(x) for x in re.findall(r"\[(\d+)\]", text) if 1 <= int(x) <= len(hits)}
        a = grounding.Answer(text, [c for c in cites if c["n"] in used], "source" if used else "outside", llm.model_for("tutor"), hits)
    yield _sse("done", {"grounded": a.grounded, "model": a.model, "citations": a.citations})
    _save(db, uid, body.message, a)


@router.get("/history")
def history(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    turns = db.scalars(select(ChatTurn).where(ChatTurn.user_id == uid).order_by(ChatTurn.created_at))
    return [{"id": t.id, "role": t.role, "text": t.text, "citations": t.citations, "grounded": t.grounded, "model": t.model} for t in turns]


@router.delete("/history", status_code=204)
def clear(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    db.query(ChatTurn).filter(ChatTurn.user_id == uid).delete()
    db.commit()
