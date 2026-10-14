import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import chat, course, eval as eval_router, learner, quiz, sources, tools
from .services import embed, llm

logging.basicConfig(level=logging.INFO)



@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan, title="StudyNest API", version="0.1.0", description="Source-grounded tutoring, adaptive assessment and learner modelling.")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings().cors_origins.split(",") if o.strip()], allow_methods=["*"], allow_headers=["*"])

for r in (sources.router, chat.router, course.router, quiz.router, learner.router, tools.router, eval_router.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True, "models": llm.describe(), "embeddings": {"provider": embed.provider(), "model": settings().embedding_model}}
