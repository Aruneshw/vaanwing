"""ORM tables. Field names mirror the frontend types (Resource, Chunk, Subject, Question, ...)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def now() -> datetime:
    return datetime.now(timezone.utc)


class Resource(Base):
    __tablename__ = "resources"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)  # pdf | video | youtube | slides | notes | image | web | audio
    meta: Mapped[str] = mapped_column(String, default="")
    path: Mapped[str | None] = mapped_column(String, nullable=True)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="processing")  # processing | ready | failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[str] = mapped_column(String, default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="resource", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    resource_id: Mapped[str] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    location: Mapped[str] = mapped_column(String)  # "p. 30", "Slide 12", "12:40", "Figure p. 18"
    topic: Mapped[str] = mapped_column(String)
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    text: Mapped[str] = mapped_column(Text)
    modality: Mapped[str] = mapped_column(String, default="text")  # text | figure | transcript | table
    concept_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)  # float32 vector
    resource: Mapped[Resource] = relationship(back_populates="chunks")


class Subject(Base):
    """A course built from ingested material. `modules` holds modules → lessons as JSON."""

    __tablename__ = "subjects"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    icon: Mapped[str] = mapped_column(String, default="book")
    theme: Mapped[str] = mapped_column(String, default="blue")
    modules: Mapped[list] = mapped_column(JSON, default=list)


class Concept(Base):
    __tablename__ = "concepts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    subject_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    lesson_id: Mapped[str | None] = mapped_column(String, nullable=True)
    prerequisites: Mapped[list] = mapped_column(JSON, default=list)


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    subject_id: Mapped[str] = mapped_column(String, index=True)
    concept: Mapped[str] = mapped_column(String, index=True)
    difficulty: Mapped[str] = mapped_column(String)  # Easy | Medium | Hard
    type: Mapped[str] = mapped_column(String)  # mcq | numeric | short
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    answer: Mapped[str] = mapped_column(String)  # option index for mcq, value otherwise
    accept: Mapped[list | None] = mapped_column(JSON, nullable=True)
    explanation: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String, default="")
    chunk_id: Mapped[str | None] = mapped_column(String, nullable=True)
    origin: Mapped[str] = mapped_column(String, default="bank")  # bank | generated
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
    verified_by: Mapped[str | None] = mapped_column(String, nullable=True)
    embedding: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)


class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    subject_id: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String, default="practice")  # practice | adaptive | diagnostic
    question_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Attempt(Base):
    __tablename__ = "attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    quiz_id: Mapped[str] = mapped_column(String, index=True)
    question_id: Mapped[str] = mapped_column(String, index=True)
    concept: Mapped[str] = mapped_column(String)
    given: Mapped[str] = mapped_column(String)
    correct: Mapped[bool] = mapped_column(Boolean)
    mastery_before: Mapped[float] = mapped_column(Float)
    mastery_after: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Mastery(Base):
    __tablename__ = "mastery"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    concept_id: Mapped[str] = mapped_column(String, primary_key=True)
    p: Mapped[float] = mapped_column(Float, default=0.3)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String, primary_key=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    level: Mapped[str] = mapped_column(String, default="some")
    goal: Mapped[str] = mapped_column(String, default="")
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False)


class ChatTurn(Base):
    __tablename__ = "chat_turns"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    role: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    grounded: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class EvalRun(Base):
    __tablename__ = "eval_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
