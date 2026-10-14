"""API shapes, camelCase where they map onto the frontend's TypeScript types."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ResourceOut(BaseModel):
    id: str
    name: str
    kind: str
    meta: str
    date: str
    status: str
    progress: int
    stage: str
    error: str | None = None
    subjectId: str | None = None
    url: str | None = None


class ChunkOut(BaseModel):
    id: str
    resourceId: str
    location: str
    topic: str
    keywords: list[str]
    text: str
    modality: str


class UrlSourceIn(BaseModel):
    url: str
    kind: Literal["youtube", "web"]


class TextSourceIn(BaseModel):
    title: str = "Pasted notes"
    text: str = Field(min_length=20)


class RenameIn(BaseModel):
    name: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1)
    mode: Literal["course", "guided", "exam", "open"] = "course"
    webSearch: bool = False
    intent: Literal["explain", "solve", "notes", "summarize"] | None = None
    history: list[dict] = []


class Citation(BaseModel):
    n: int
    chunkId: str
    resource: str
    resourceId: str
    location: str
    topic: str
    excerpt: str


class ChatOut(BaseModel):
    text: str
    citations: list[Citation]
    grounded: Literal["source", "outside", "declined"]
    model: str


class QuestionOut(BaseModel):
    id: str
    subjectId: str
    concept: str
    difficulty: str
    type: str
    prompt: str
    options: list[str] | None = None
    source: str


class QuizIn(BaseModel):
    subjectId: str
    count: int = Field(5, ge=1, le=20)
    conceptIds: list[str] | None = None
    adaptive: bool = True


class QuizOut(BaseModel):
    quizId: str
    questions: list[QuestionOut]
    repeats: int


class AnswerIn(BaseModel):
    questionId: str
    answer: str


class AnswerOut(BaseModel):
    correct: bool
    correctAnswer: str
    explanation: str
    source: str
    concept: str
    masteryBefore: float
    masteryAfter: float


class LessonProgressIn(BaseModel):
    progress: int = Field(ge=0, le=100)


class DiagnosticSubmitIn(BaseModel):
    quizId: str
    name: str = ""
    level: Literal["beginner", "some", "confident"] = "some"
    goal: str = ""
    answers: list[AnswerIn]


class EvalIn(BaseModel):
    judge: Literal["lexical", "llm"] = "lexical"
    subjectId: str | None = None
    testset: dict | None = None  # {"name":..., "cases":[{"q":..., "expected_locations":[...] | null}]}
