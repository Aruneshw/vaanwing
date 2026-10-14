from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import user_id
from ..models import Chunk, Resource
from ..schemas import ChunkOut, RenameIn, ResourceOut, TextSourceIn, UrlSourceIn
from ..services.ingest import kind_from_name
from ..workers.jobs import enqueue

router = APIRouter(prefix="/api", tags=["sources"])
MAX_BYTES = 200 * 1024 * 1024


def out(r: Resource) -> ResourceOut:
    return ResourceOut(id=r.id, name=r.name, kind=r.kind, meta=r.meta, date=r.created_at.strftime("%b %d, %Y").replace(" 0", " "), status=r.status, progress=r.progress, stage=r.stage, error=r.error, subjectId=r.subject_id, url=r.url)


def chunk_out(c: Chunk) -> ChunkOut:
    return ChunkOut(id=c.id, resourceId=c.resource_id, location=c.location, topic=c.topic, keywords=c.keywords or [], text=c.text, modality=c.modality)


@router.post("/sources", response_model=ResourceOut, status_code=202)
async def upload(background: BackgroundTasks, file: UploadFile = File(...), uid: str = Depends(user_id), db: Session = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 200 MB)")
    name = Path(file.filename or "upload").name
    r = Resource(user_id=uid, name=name, kind=kind_from_name(name), meta=f"{max(1, len(data) // 1000)} KB")
    db.add(r)
    db.flush()
    folder = Path(settings().storage_dir) / uid
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{r.id}_{name}"
    path.write_bytes(data)
    r.path = str(path)
    db.commit()
    enqueue(r.id, background)
    return out(r)


@router.post("/sources/url", response_model=ResourceOut, status_code=202)
def add_url(body: UrlSourceIn, background: BackgroundTasks, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    if not body.url.startswith(("http://", "https://")):
        raise HTTPException(422, "URL must start with http:// or https://")
    r = Resource(user_id=uid, name=body.url[:80], kind=body.kind, url=body.url, meta="Queued")
    db.add(r)
    db.commit()
    enqueue(r.id, background)
    return out(r)


@router.post("/sources/text", response_model=ResourceOut, status_code=202)
def add_text(body: TextSourceIn, background: BackgroundTasks, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    r = Resource(user_id=uid, name=body.title, kind="notes", text=body.text)
    db.add(r)
    db.commit()
    enqueue(r.id, background)
    return out(r)


@router.get("/sources", response_model=list[ResourceOut])
def list_sources(uid: str = Depends(user_id), db: Session = Depends(get_db)):
    return [out(r) for r in db.scalars(select(Resource).where(Resource.user_id == uid).order_by(Resource.created_at.desc()))]


def _own(db: Session, uid: str, rid: str) -> Resource:
    r = db.get(Resource, rid)
    if r is None or r.user_id != uid:
        raise HTTPException(404, "Source not found")
    return r


@router.get("/sources/{rid}", response_model=ResourceOut)
def get_source(rid: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    return out(_own(db, uid, rid))


@router.get("/sources/{rid}/chunks", response_model=list[ChunkOut])
def source_chunks(rid: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    return [chunk_out(c) for c in _own(db, uid, rid).chunks]


@router.patch("/sources/{rid}", response_model=ResourceOut)
def rename(rid: str, body: RenameIn, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    r = _own(db, uid, rid)
    r.name = body.name.strip() or r.name
    db.commit()
    return out(r)


@router.delete("/sources/{rid}", status_code=204)
def delete(rid: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    r = _own(db, uid, rid)
    if r.path:
        Path(r.path).unlink(missing_ok=True)
    db.delete(r)
    db.commit()


@router.get("/chunks/{cid}", response_model=ChunkOut)
def get_chunk(cid: str, uid: str = Depends(user_id), db: Session = Depends(get_db)):
    c = db.get(Chunk, cid)
    if c is None or c.resource.user_id != uid:
        raise HTTPException(404, "Excerpt not found")
    return chunk_out(c)
