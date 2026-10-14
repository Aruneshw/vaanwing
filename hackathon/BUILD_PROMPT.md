# Build prompt — paste this into any coding AI (Claude Code, Cursor, Copilot, ChatGPT, Gemini)

> Copy everything inside the box below. If your AI can read the repo, also give it
> `hackathon/AGENTIC_PLAN.md` and `.claude/skills/agentic-career-builder/SKILL.md`.

---

```text
ROLE
You are a senior full-stack AI engineer. You build production-quality agentic systems with LangGraph,
LangChain and LlamaIndex, FastAPI and React. You work in small, verified steps: after each step you run
the app/tests and fix what breaks before moving on. You never invent library APIs — when unsure, check
the installed package's docs/source and pin versions.

CONTEXT
I am competing in "Agentic AI Hackathon 2026 – Powered by Ziro.Digital", track "Education & Career AI".
I already have a working project called StudyNest (this repo):
- Frontend: React 19 + TypeScript + Vite, no UI library, styles in src/index.css. Tabs: Home, Learn, AI Tutor.
  State in src/store.tsx (persisted to localStorage). Backend client in src/api.ts + src/remote.ts with an
  automatic offline fallback. Modals in src/modals/. Keep the existing visual style (soft pastel cards,
  Inter font, rounded 22px cards, dark pill buttons).
- Backend: FastAPI in backend/app. Services: ingest (PDF/slides/YouTube/web, page-located chunks),
  retrieve.py (hybrid BM25 + vectors + relevance gate), grounding.py (answers only from cited excerpts,
  declines off-material questions), quizgen.py (adaptive selection, LLM generation with a second-model
  verifier), bkt.py (Bayesian Knowledge Tracing), topics.py (course builder), evaluation.py (RAGAS-style
  metrics + simulated students). Per-role models in config.py; services/llm.py routes Claude through the
  Anthropic SDK and other providers through LiteLLM. 20 pytest tests in backend/tests.
Do not break any of this. Extend it.

GOAL — build "CareerPilot" on top of StudyNest
An autonomous, evidence-grounded team of agents that takes a student from "I want to become <role> in
<N> months" to: a verified skill profile, a skill-gap graph against real job descriptions, a week-by-week
plan it executes and re-plans, tutoring and quizzes on the gaps (reuse StudyNest), a portfolio project,
mock interviews, and tailored resumes/applications — with every claim about the student backed by evidence
and every outward action approved by the student.

THE DIFFERENTIATOR (must be visible in the demo)
Evidence Ledger: every skill the system says the student has must link to evidence (quiz attempts from the
BKT engine, project commits, certificates, interview scores) with a strength 0–1. The resume agent may only
write a bullet whose skills are backed by evidence with strength ≥ 0.6, and each bullet shows its evidence
chips. Unbacked bullets are blocked and shown with an "add proof" action. Fabricated-claim rate must be 0
in the evaluation.

STACK (use these; pin versions in requirements.txt / package.json)
- LangGraph: supervisor StateGraph + one sub-graph per specialist agent; Postgres checkpointer (thread per
  student); long-term Store for student memory; interrupt() + Command(resume=...) for human approval;
  streaming of graph events.
- LangChain: chat models (langchain-anthropic ChatAnthropic, optionally init_chat_model for other
  providers), @tool tools, structured output with Pydantic, langchain-mcp-adapters for MCP servers.
- LlamaIndex: ingestion pipeline, LlamaParse for resumes and messy PDFs, VectorStoreIndex over course
  content, PropertyGraphIndex for the skill graph (skills, prerequisites, role requirements); expose query
  engines/retrievers as LangChain tools.
- Models by role: planner/supervisor = claude-opus-5-5; worker agents = claude-haiku-5-5; critic and eval
  judge = claude-sonnet-5-5; optional second provider (GPT or Gemini) for cross-model verification; make
  every role configurable by env var, and keep an offline mode (rule-based / extractive) so the demo never
  dies without network.
- Tools: web search (Tavily or Exa) for job postings and opportunities (with a cached JSON dataset fallback),
  Google Calendar MCP (write only after approval), Gmail MCP (drafts only), GitHub MCP (read repos for
  project review), STT/TTS for voice interviews (faster-whisper + any TTS; text mode first).
- Data: Postgres + pgvector, Redis + RQ or APScheduler for weekly runs. SQLite allowed for local dev.
- Observability: LangSmith or Langfuse tracing on every agent and tool call.
- Evaluation: RAGAS (tutoring), DeepEval (task completion, tool correctness, G-Eval rubrics), LangSmith
  datasets/experiments.
- Frontend additions: React Flow (skill graph), Recharts (readiness trend). Optional CopilotKit/AG-UI.

AGENTS (each = model + tools + ToolNode loop, with a focused system prompt)
1. Profiler/Intake – asks 3–4 clarifying questions (role, timeline, hours/week, location, language: English
   or Hindi), parses the resume, triggers the existing diagnostic quiz, writes long-term memory.
2. Market Scout – fetches 20–50 job descriptions for the role, extracts skills + frequency → demand map.
3. Gap Analyzer – demand map vs. verified mastery (BKT + evidence) → gaps with prerequisites; computes
   readiness(role) = Σ demand_weight × verified_mastery / Σ demand_weight.
4. Planner – feasible week-by-week plan within the hours budget, prerequisites first, honest feasibility
   warning if the goal is unrealistic; proposes calendar blocks (approval required); re-plans weekly.
5. Tutor – wraps StudyNest grounding (cited answers from the student's own material); every lesson shows
   which target-role skill it closes.
6. Assessor – wraps StudyNest quizgen + BKT; writes quiz Evidence.
7. Project Coach – assigns one portfolio project per major gap, reviews the GitHub repo via MCP, writes
   project Evidence.
8. Interviewer – mock interviews from real JDs + weak skills; rubric (correctness, depth, structure,
   communication); cited feedback; writes interview Evidence.
9. Resume & Applications – tailors resume per job using only Evidence-backed claims; drafts cover note;
   tracks pipeline; sending requires approval.
10. Opportunity Scout – internships, hackathons, scholarships matching the profile; weekly digest.
11. Critic – a different model reviews every user-facing output (groundedness, feasibility, tone, no
   fabricated claims) and can send it back once.
Supervisor routes between them with structured output. All side effects go through an "approval" node.

BACKEND CHANGES
- New package backend/app/agents/: state.py, graph.py, models.py, memory.py, approval.py, guards.py,
  prompts/, tools/ (study.py wraps existing services; career.py; mcp.py; search.py).
- New tables: Goal, Role, JobPosting, Skill, SkillEdge, RoleSkill, Evidence, Plan, PlanTask, Application,
  InterviewSession, AgentRun, Approval.
- New routes: /api/career/goal, /career/skills (graph JSON), /career/readiness, /career/plan,
  /career/applications, /resume/tailor, /interview/sessions (+ WebSocket for voice), /opportunities,
  /agent/runs, /agent/runs/{id}/stream (SSE: agent_started, tool_call, tool_result, message,
  approval_required, plan_updated, done), /agent/approvals/{id} (approve | edit | reject).
- Weekly scheduled run per student that resumes the student's thread with {"event": "weekly_review"}.
- Guards: PII redaction before external calls, evidence validation for resumes, tool rate limits.
- Keep every existing endpoint and test passing; add tests for each new agent with mocked models.

FRONTEND CHANGES
- Tabs: Home · Learn · AI Tutor · Career · Interview. Agent Activity drawer available on every page.
- Home: target role + readiness gauge, top 3 gaps, this week's tasks, "waiting for your approval" cards,
  applications pipeline.
- Career page: goal setup, demand map, React Flow skill graph (green verified / yellow learning / grey gap,
  edges = prerequisites), Evidence Ledger per skill, readiness trend, resume studio with evidence chips and
  blocked claims.
- Interview page: role/company picker, text then voice session, live transcript, rubric scores, history.
- Agent Activity drawer: live SSE timeline (agent → tool calls → decisions) and approval cards.
- Extend IntakeModal with role, timeline, hours/week, location, language.
- Extend EvalCard with agent metrics.
- Everything must still work offline with seeded data (2–3 roles, 30–50 JDs, ~80-skill taxonomy).

EVALUATION (implement and show)
- Tutoring: RAGAS faithfulness, answer relevancy, context precision/recall, off-material refusal.
- Agents: task success on 20 scripted scenarios, tool-call accuracy vs. reference trajectories, plan
  feasibility checks, resume groundedness and fabricated-claim rate, interview rubric agreement with human
  labels (Cohen's kappa), readiness and mastery gain over 8 simulated weeks vs. a fixed-syllabus baseline,
  question repetition rate, cost and latency per weekly run.
- Provide `python -m eval.run_agent_eval` that writes a JSON report, and show it in the EvalCard.

WORKING RULES
- Work in this order: (1) data model + seed data, (2) LangGraph skeleton with supervisor + 2 agents + SSE +
  Activity drawer, (3) gap analyzer + readiness + skill graph, (4) planner + approval + calendar,
  (5) resume agent + Evidence Ledger, (6) interviewer, (7) evals + tracing, (8) polish + offline mode.
- After each step: run backend tests, run the frontend build, and click through the feature in a browser.
- Small commits with clear messages. No secrets in the repo; use .env.example.
- Never send email, create calendar events or submit applications without an approval interrupt.
- Never put a skill on a resume without evidence. Never answer study questions without citations.
- When a library API is uncertain, read the installed version's docs instead of guessing.

DELIVERABLES
Working app (frontend + backend), README with architecture diagram and setup, .env.example, eval report,
a 3-minute demo path: intake → market scout (live tool calls) → skill graph + readiness → plan approval →
cited tutoring + quiz raises readiness → resume with a blocked claim fixed by adding proof → mock interview
→ eval + trace.

Start by reading the repo, then propose the file-level plan for step 1 and implement it.
```
