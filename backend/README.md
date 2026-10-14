# StudyNest API (backend)

FastAPI backend for the StudyNest frontend: multimodal ingestion, source-grounded tutoring with
citations, adaptive quizzes with cross-model verification, a Bayesian Knowledge Tracing learner
model, learning tools, and a RAGAS-style evaluation harness. It runs fully offline (no API keys) with
extractive answers, and switches to LLM answers per role as soon as a model is configured.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add ANTHROPIC_API_KEY (and/or other providers)
uvicorn app.main:app --reload   # http://localhost:8000/docs
pytest                          # 20 offline tests
```

Full stack (Postgres + Redis + background worker): `docker compose up --build`.

## Multiple models, one role each

| Role | Default | Used for |
|---|---|---|
| `MODEL_TUTOR` | `claude-opus-5-5` | grounded answers with `[n]` citations (streaming) |
| `MODEL_FAST` | `claude-haiku-5-5` | question generation, topic extraction, notes / flashcards / slides |
| `MODEL_VERIFIER` | `claude-sonnet-5-5` | answers each generated question blind; disagreement → question discarded |
| `MODEL_VISION` | `claude-sonnet-5-5` | explains diagrams and figures so they become searchable chunks |
| `MODEL_JUDGE` | `claude-sonnet-5-5` | LLM judge for faithfulness / relevancy in evaluation |

Claude IDs go through the official Anthropic SDK (adaptive thinking, explicit effort, server-side
refusal fallbacks on Opus/Sonnet). Any other string is sent through LiteLLM, so you can mix providers,
e.g. `MODEL_VERIFIER=openai/gpt-4o`, `MODEL_VISION=gemini/gemini-2.0-flash`, `MODEL_FAST=ollama/llama3.1`.
Set a role to `none` to disable it. Check what is active at `GET /api/health`.

## Pipeline

```
upload ─► extract (PDF pages · slides · Whisper/YouTube transcripts · web · text)
       ─► figure captions (vision model)        ─► section-aware chunks with location (p. 30 / Slide 4 / 12:40)
       ─► embeddings                             ─► course: topics → lessons → concepts (+ prerequisites)
       ─► generated questions (fast model → verifier model → dedupe)
question ─► hybrid retrieval (BM25 + vectors + keyword gate, RRF) ─► covered?  no → decline / flagged outside answer
                                                                       yes → tutor answers from numbered excerpts, citations validated
answer  ─► BKT mastery update ─► weakest-first, unseen-first question selection ─► learning path (prerequisite-aware)
```

## Endpoints (all under `/api`, user from the `X-User-Id` header, default `demo`)

| Area | Endpoints |
|---|---|
| Sources | `POST /sources` (multipart) · `POST /sources/url` {url, kind: youtube\|web} · `POST /sources/text` · `GET /sources` · `GET /sources/{id}` (status, progress, stage) · `GET /sources/{id}/chunks` · `PATCH /sources/{id}` · `DELETE /sources/{id}` · `GET /chunks/{id}` |
| Chat | `POST /chat` {message, mode: course\|guided\|exam\|open, webSearch, intent, history} → {text, citations[], grounded: source\|outside\|declined, model} · `POST /chat/stream` (SSE: citations → token* → done) · `GET/DELETE /chat/history` |
| Courses | `GET /courses` · `GET /courses/{id}` (modules, lessons, concepts + mastery) · `PUT /courses/lessons/{id}/progress` |
| Quiz | `POST /quiz` {subjectId, count, conceptIds?, adaptive} · `POST /quiz/{id}/answer` · `GET /quiz/{id}/report` (weak topics, cited misconceptions) · `GET /quiz/history/all` |
| Learner | `GET /learner/profile` · `GET /learner/mastery` · `POST /learner/diagnostic/start?subjectId=` · `POST /learner/diagnostic/submit` · `GET /learner/path?subjectId=` |
| Tools | `POST /tools/{notes\|flashcards\|summary\|slides\|mindmap\|audio\|table\|reports}?subjectId=` |
| Evaluation | `POST /eval/run` {judge: lexical\|llm, testset?} · `GET /eval/latest` |

Response field names match the frontend's TypeScript types (`Resource`, `Chunk`, `Citation`, `Question`, `Subject`), so the frontend's mocked services (`src/tutor.ts`, `src/sources.ts`, `src/eval.ts`, quiz/learner logic in `src/store.tsx`) can be swapped for `fetch` calls one at a time.

## Evaluation

`POST /api/eval/run` or `python -m eval.run_eval --judge llm --out results/` runs the team-built test set in
`app/data/os_testset.json` (17 questions with known source pages + 6 off-material queries) through the real
retrieval + generation pipeline and reports faithfulness, answer relevancy, context precision, context recall,
off-material refusal and false-refusal rates, plus personalization from 3 simulated students × 5 sessions
(mastery gain, question repetition vs a random baseline). The CLI also writes `ragas_dataset.jsonl` so the
same answers can be re-scored with the RAGAS library. Offline result on the OS notes (lexical judge,
extractive answers): faithfulness 1.00, relevancy 0.96, precision 0.97, recall 1.00, refusal 1.00,
mastery gain +0.125, repetition 4% vs 39% random. With a tutor model configured the answers change,
so re-run with `--judge llm` for the numbers you report.

## Notes and limits

- Vectors are stored as float32 blobs and searched in-process with numpy — fine up to ~100k chunks.
  Move to pgvector or Qdrant beyond that (`app/services/retrieve.py` is the only place to change).
- Video/audio transcription needs `pip install faster-whisper` (and ffmpeg); without it those uploads fail with a clear message.
- `hash` embeddings are lexical; set `EMBEDDING_MODEL=fastembed` or an embedding API for semantic search.
- Identity is a header for the hackathon; put real auth (JWT/Supabase) in `app/deps.py`.
