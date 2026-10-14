from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import user_id
from ..services import tools

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.post("/{kind}")
async def run_tool(kind: str, subjectId: str | None = None, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    if kind not in tools.KINDS:
        raise HTTPException(404, f"Unknown tool; choose one of {sorted(tools.KINDS)}")
    return await tools.generate(db, uid, kind, subjectId)
