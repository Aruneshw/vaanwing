# CareerPilot — Agentic AI Hackathon 2026 · Education & Career AI

> **One line:** an autonomous, evidence-grounded agent team that takes a student from *"I want to become X"* to a
> verified skill profile, a week-by-week plan it actually runs, interview practice, and job applications —
> with every claim about the student backed by proof and every outward action approved by the student.

Built on top of the existing **StudyNest** repo (React frontend + FastAPI backend). StudyNest already does
source-grounded tutoring, adaptive quizzes with a BKT learner model, and evaluation. CareerPilot adds the
*agentic* layer: goals, planning, tools, memory, autonomy with human approval, and career outcomes.

---

## 1. Why this idea wins

| What judges look for in an agentic track | How CareerPilot shows it on screen |
|---|---|
| Real autonomy, not a chatbot | A LangGraph supervisor plans the week, calls tools, re-plans when the student misses a task, and runs on a schedule |
| Tool use | Job-market search, calendar, GitHub, resume parser, quiz engine, code sandbox, email drafts — all as tools/MCP servers |
| Multi-agent collaboration | 7 specialist agents + a critic that checks every output before the student sees it |
| Human-in-the-loop & safety | Nothing leaves the app (email, calendar invite, application) without an approval card; resume claims are blocked unless backed by evidence |
| Memory & personalization | Long-term student memory + BKT mastery from real quiz attempts, not self-reported skills |
| Measurable impact | Readiness score per target role, mastery gain over simulated weeks, resume groundedness %, interview score trend |
| Evaluation rigor | Agent trajectory evals (task success, tool-call accuracy), RAGAS for tutoring, simulated students over 8 weeks |
| Business / India relevance | Tier-2/3 colleges, Hindi + English, NPTEL/SWAYAM content, a placement-cell (TPO) dashboard as the B2B plan |

**The hook nobody else will have: the Evidence Ledger.** Every skill on the student's profile links to proof —
quiz attempts (from the existing BKT engine), project commits, uploaded certificates, interview scores. The
resume agent can only write a bullet if the ledger supports it, and shows the citation. This is the same
"source-grounding" StudyNest already does for tutoring, applied to the student's own career claims. It directly
answers the biggest fear about AI career tools: fabricated resumes.

---

## 2. The product (what the demo shows)

1. **Onboarding (intake agent):** student chats: "I'm a 3rd-year ECE student in Coimbatore, I want a data analyst
   job in 6 months." Uploads resume + syllabus PDFs. Agent asks 3–4 clarifying questions, then runs the existing
   diagnostic quiz.
2. **Market scout agent:** pulls 20–50 current job descriptions for the target role (search tool / sample dataset),
   extracts required skills with frequency → *demand map*.
3. **Gap analyzer:** compares demand map vs. the student's **verified** mastery (Evidence Ledger + BKT) → skill-gap
   graph with prerequisites and a **Readiness score** (e.g. 41% → target 75%).
4. **Planner agent:** builds a feasible week-by-week plan (time budget, exam dates, prerequisites). Honest
   feasibility check: "6 months is tight for X; here is the 6-month version and what you drop."
   Proposes calendar blocks → **approval card** → writes to Google Calendar.
5. **Execution loop (every week, scheduled):** tutor agent teaches from the student's own material + vetted open
   resources (cited); assessor agent runs adaptive quizzes; project coach assigns a portfolio project and reviews
   the GitHub repo; mastery updates; planner re-plans if behind.
6. **Interview agent:** voice or text mock interviews built from real JDs + the student's weak skills, scored on a
   rubric, with cited feedback ("revise p. 30 of your OS notes").
7. **Resume & application agent:** tailors the resume per job using only ledger-backed claims, drafts a cover
   note, tracks the application pipeline. Sending requires approval.
8. **Opportunity scout:** internships, hackathons, scholarships matching the profile; weekly digest.
9. **TPO dashboard (stretch):** a college placement officer sees cohort readiness and common gaps.

Everything streams into an **Agent Activity** timeline: which agent ran, which tools it called, what it decided, what
is waiting for approval.

---

## 3. Architecture

```
React (StudyNest UI + new Career / Interview / Agent Activity screens)
   │  REST + SSE (agent event stream) + WebSocket (voice interview)
   ▼
FastAPI
   ├── LangGraph app  ── Supervisor ─┬─ Intake/Profiler agent
   │   (Postgres checkpointer,       ├─ Market Scout agent ──── search tool / job dataset
   │    interrupts for approval,     ├─ Gap Analyzer ────────── Skill Graph + Evidence Ledger
   │    long-term Store memory)      ├─ Planner ─────────────── calendar MCP
   │                                 ├─ Tutor (existing grounding) ── LlamaIndex query engine over course docs
   │                                 ├─ Assessor (existing quizgen + BKT)
   │                                 ├─ Project Coach ───────── GitHub MCP, code sandbox
   │                                 ├─ Interview agent ─────── STT/TTS
   │                                 ├─ Resume/Application agent ── Evidence Ledger, email-draft tool
   │                                 └─ Critic (different model) checks every user-facing output
   ├── LlamaIndex  ingestion (LlamaParse for PDFs/resumes), VectorStoreIndex, PropertyGraphIndex (skill graph)
   ├── Postgres + pgvector (app data, checkpoints, vectors) · Redis (queues, schedules)
   └── Observability: LangSmith or Langfuse traces · Evals: RAGAS, DeepEval, LangSmith datasets
```

**Graph shape (LangGraph):** a supervisor `StateGraph` routes between specialist sub-graphs. Each specialist is a
tool-calling agent (model + tools + ToolNode loop). Actions with side effects go through an `approval` node that
calls `interrupt()`; the UI shows an approval card and resumes the graph with `Command(resume=...)`. A `critic`
node runs before any message reaches the student. A weekly cron (APScheduler/RQ) resumes the student's thread
with a "weekly review" event.

---

## 4. Stack (and what each piece is for)

| Layer | Choice | Used for |
|---|---|---|
| Agent orchestration | **LangGraph** | supervisor + sub-graphs, conditional routing, `interrupt()` HITL, Postgres checkpointer (resume, time-travel), long-term `Store` memory, streaming events |
| Agent building blocks | **LangChain** | `ChatAnthropic` / `init_chat_model`, tool definitions (`@tool`), structured output, retrievers, `langchain-mcp-adapters` |
| Data / RAG | **LlamaIndex** | ingestion pipeline, **LlamaParse** for messy PDFs & resumes, `VectorStoreIndex` for course content, `PropertyGraphIndex` for the skill graph, query engines exposed as LangChain tools |
| Tools via MCP | Google Calendar, Gmail (drafts only), GitHub, filesystem; web search (Tavily or Exa) | real-world actions |
| LLMs | Claude Opus 5.5 (`claude-opus-5-5`) planner/supervisor · Claude Haiku 5.5 (`claude-haiku-5-5`) workers · Claude Sonnet 5.5 (`claude-sonnet-5-5`) critic/judge · optional second provider (GPT/Gemini) for cross-model verification · local Llama via Ollama for offline demo | quality where it matters, cost where it doesn't |
| Embeddings | bge-m3 (multilingual, handles Hindi) via fastembed/sentence-transformers, or an embeddings API | |
| Storage | Postgres + **pgvector**; Redis | one DB for app data, vectors and LangGraph checkpoints |
| Skill graph | Postgres tables (or Neo4j if you want the graph UI) + LlamaIndex `PropertyGraphIndex` | skills, prerequisites, role requirements, evidence links |
| Voice | Whisper / faster-whisper (STT) + any TTS (or a realtime voice API) | mock interviews |
| Backend | FastAPI, SSE, WebSockets, APScheduler or RQ | API, streaming, weekly runs |
| Frontend | existing React + Vite; add **React Flow** (skill graph), Recharts (readiness trend); optional **CopilotKit / AG-UI** for agent UI | |
| Guardrails | Pydantic validation, Evidence Ledger check, Presidio (PII redaction), critic node | safety & honesty |
| Observability | **LangSmith** or **Langfuse** | traces of every agent/tool call — show this in the demo |
| Evaluation | **RAGAS** (tutor), **DeepEval** (task completion, tool correctness, G-Eval rubrics), LangSmith datasets & experiments | |

> Pin versions when you install and check each library's current docs — LangChain/LangGraph/LlamaIndex APIs move
> quickly (e.g. agent constructors were renamed in recent releases).

---

## 5. Modifying areas — file by file

### 5.1 Backend (`backend/`)

| Area | Change | Files |
|---|---|---|
| Agent package (new) | `app/agents/` with `state.py`, `graph.py` (supervisor), one module per agent, `tools/` wrappers, `prompts/` | new |
| Wrap existing services as tools | `search_course_material` (retrieve.py), `explain_with_citations` (grounding.py), `make_quiz` / `grade_answer` (quizgen.py + bkt.py), `get_mastery`, `get_learning_path` | `app/agents/tools/study.py` |
| LLM layer | add LangChain chat models per role next to the existing `llm.py` (keep `llm.py` for non-agent paths) | `app/agents/models.py`, `app/config.py` (new role env vars: `MODEL_PLANNER`, `MODEL_WORKER`, `MODEL_CRITIC`) |
| Ingestion | add LlamaIndex pipeline + LlamaParse for resumes/JDs; keep PyMuPDF path as fallback | `app/services/ingest/llama.py`, `workers/jobs.py` |
| New data model | `Goal`, `Role`, `JobPosting`, `Skill`, `SkillEdge` (prereq), `RoleSkill` (demand weight), `Evidence` (type, ref, strength, skill_id), `Plan`, `PlanTask`, `Application`, `InterviewSession`, `AgentRun`, `Approval` | `app/models.py` |
| Memory | LangGraph Postgres checkpointer (thread per student) + Store for long-term facts (preferences, constraints, past decisions) | `app/agents/memory.py` |
| Human approval | approval node using `interrupt()`; REST to list/approve/reject; resume with `Command(resume=...)` | `app/agents/approval.py`, `app/routers/agent.py` |
| Streaming | SSE endpoint streaming graph events (`astream` with updates/messages) mapped to UI events: `agent_started`, `tool_call`, `tool_result`, `message`, `approval_required`, `plan_updated` | `app/routers/agent.py` |
| Scheduling | weekly review job per student (APScheduler or RQ scheduler) → resumes thread with `{"event": "weekly_review"}` | `app/workers/schedules.py` |
| MCP tools | calendar, gmail (drafts), github via `langchain-mcp-adapters`; web search tool | `app/agents/tools/mcp.py` |
| Career endpoints | `/api/career/goal`, `/career/skills` (graph JSON), `/career/readiness`, `/career/plan`, `/career/applications`, `/resume/tailor`, `/interview/sessions` (+ WebSocket for voice), `/opportunities`, `/agent/runs`, `/agent/runs/{id}/stream`, `/agent/approvals/{id}` | `app/routers/career.py`, `agent.py`, `interview.py` |
| Readiness score | `readiness(role) = Σ demand_weight(skill) × verified_mastery(skill) / Σ demand_weight` — mastery comes from BKT + evidence strength | `app/services/readiness.py` |
| Evaluation | extend `evaluation.py`: agent trajectory evals, plan feasibility, resume groundedness, interview rubric agreement, 8-week simulated cohorts; export to LangSmith/DeepEval | `app/services/evaluation.py`, `eval/run_agent_eval.py` |
| Guardrails | Evidence check on resume claims; PII redaction before external calls; critic node; rate limits on tools | `app/agents/guards.py` |

### 5.2 Frontend (`src/`)

| Area | Change | Files |
|---|---|---|
| Navigation | tabs: **Home · Learn · AI Tutor · Career · Interview**; Agent Activity as a right drawer available everywhere | `components/Header.tsx`, `App.tsx` |
| Home | replace stat cards with: Target role + Readiness gauge, Skill gaps (top 3), This week's plan (tasks from the planner), Waiting for your approval, Applications pipeline | `pages/Home.tsx` |
| Career page (new) | goal setup, demand map (skills × frequency from JDs), **Skill Graph** (React Flow: green = verified, yellow = learning, grey = gap, edges = prerequisites), Evidence Ledger per skill, readiness trend | `pages/Career.tsx`, `components/SkillGraph.tsx`, `components/EvidenceList.tsx` |
| Interview page (new) | role/company picker, text or voice session, live transcript, rubric scores, cited feedback, history | `pages/Interview.tsx` |
| Agent Activity drawer (new) | live timeline from SSE: agent → tool calls → decisions; approval cards (Approve / Edit / Reject) | `components/AgentActivity.tsx`, `components/ApprovalCard.tsx` |
| Resume studio | upload resume → parsed profile; pick a job → tailored resume with each bullet showing its evidence chip; blocked claims listed | `pages/Career.tsx` (section) or `modals/ResumeModal.tsx` |
| Intake | extend `IntakeModal.tsx`: target role, timeline, hours/week, location, language; then diagnostic (already built) | `modals/IntakeModal.tsx` |
| State | add `goal`, `readiness`, `skills`, `evidence`, `plan`, `approvals`, `applications`, `agentEvents` | `store.tsx`, `data.ts` (seed roles + sample JDs for offline demo) |
| API client | new endpoints + SSE reader for agent events (reuse the `chatStream` pattern) | `api.ts`, `remote.ts` |
| Learn / AI Tutor | keep; tutor answers and quizzes now also write Evidence; "Why am I learning this?" chip links each lesson to the target-role skill it closes | `pages/Learn.tsx`, `pages/Tutor.tsx` |
| Eval card | add agent metrics (task success, tool accuracy, resume groundedness, readiness gain) | `components/EvalCard.tsx` |

### 5.3 Data you need for the demo

- 30–50 real job descriptions for 2–3 target roles (Data Analyst, SDE intern, ML intern) saved as JSON (offline-safe).
- A skill taxonomy (~80 skills) with prerequisite edges (hand-written + LLM-assisted, reviewed).
- 2 sample resumes (one weak, one decent), the OS notes PDF + one DS syllabus PDF.
- Interview rubric (communication, correctness, depth, structure) and 30 seed questions per role.

---

## 6. Key code (only the parts that are easy to get wrong)

**6.1 Shared state and supervisor graph (LangGraph)**

```python
# app/agents/state.py
from typing import Annotated, Literal, TypedDict
from langgraph.graph.message import add_messages

class CareerState(TypedDict):
    messages: Annotated[list, add_messages]
    student_id: str
    goal: dict | None             # {"role": "Data Analyst", "months": 6, "hours_per_week": 10}
    gaps: list[dict]              # [{"skill": "SQL joins", "demand": 0.8, "mastery": 0.3}]
    plan: list[dict]              # week -> tasks
    pending_action: dict | None   # side-effect waiting for approval
    next_agent: str | None
```

```python
# app/agents/graph.py
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command

AGENTS = ["profiler", "market_scout", "gap_analyzer", "planner", "tutor", "assessor",
          "project_coach", "interviewer", "resume", "opportunities"]

def supervisor(state: CareerState) -> Command:
    decision = route_with_llm(state)          # structured output: {"next": one of AGENTS | "critic" | "end"}
    return Command(goto=decision["next"] if decision["next"] != "end" else END)

def approval(state: CareerState) -> Command:
    action = state["pending_action"]
    answer = interrupt({"type": "approval_required", "action": action})   # pauses; UI shows a card
    if answer.get("approved"):
        execute_side_effect(action, edits=answer.get("edits"))
    return Command(goto="supervisor", update={"pending_action": None})

builder = StateGraph(CareerState)
builder.add_node("supervisor", supervisor)
for name in AGENTS:
    builder.add_node(name, build_agent_subgraph(name))     # each = model.bind_tools(tools) + ToolNode loop
    builder.add_edge(name, "critic")
builder.add_node("critic", critic)                           # different model checks output, may send back
builder.add_node("approval", approval)
builder.add_edge(START, "supervisor")
graph = builder.compile(checkpointer=postgres_checkpointer, store=postgres_store)

# resume after the student clicks Approve:
# graph.invoke(Command(resume={"approved": True}), config={"configurable": {"thread_id": student_id}})
```

**6.2 A specialist agent = model + tools + loop**

```python
from langchain_anthropic import ChatAnthropic
from langgraph.prebuilt import ToolNode, tools_condition

worker = ChatAnthropic(model="claude-haiku-5-5", max_tokens=8000)
planner_model = ChatAnthropic(model="claude-opus-5-5", max_tokens=16000)

def build_agent_subgraph(name):
    tools = TOOLS[name]
    model = (planner_model if name in {"planner", "gap_analyzer"} else worker).bind_tools(tools)
    g = StateGraph(CareerState)
    g.add_node("llm", lambda s: {"messages": [model.invoke([SYSTEM[name], *s["messages"]])]})
    g.add_node("tools", ToolNode(tools))
    g.add_edge(START, "llm")
    g.add_conditional_edges("llm", tools_condition)        # tool call -> "tools", else END
    g.add_edge("tools", "llm")
    return g.compile()
```

**6.3 Reuse StudyNest services as tools (no rewrite)**

```python
from langchain_core.tools import tool
from app.services import grounding, quizgen, bkt

@tool
async def explain_with_citations(student_id: str, question: str) -> dict:
    """Answer a study question from the student's own material, with page/slide/timestamp citations."""
    with SessionLocal() as db:
        a = await grounding.answer(db, student_id, question)
        return {"text": a.text, "citations": a.citations, "grounded": a.grounded}

@tool
def record_evidence(student_id: str, skill_id: str, kind: str, ref: str, strength: float) -> str:
    """Store proof of a skill: kind in {quiz, project, certificate, interview}."""
    ...
```

**6.4 The Evidence Ledger rule for resumes (the differentiator)**

```python
def validate_resume(bullets: list[dict], ledger: dict[str, list[dict]]) -> tuple[list, list]:
    """Each bullet must cite >=1 evidence id for every skill it claims, with strength >= 0.6."""
    kept, blocked = [], []
    for b in bullets:                       # b = {"text": ..., "skills": [...], "evidence_ids": [...]}
        ok = all(any(e["id"] in b["evidence_ids"] and e["strength"] >= 0.6 for e in ledger.get(s, []))
                 for s in b["skills"])
        (kept if ok else blocked).append(b)
    return kept, blocked                    # blocked bullets are shown to the student with "add proof" actions
```

**6.5 Skill graph with LlamaIndex (build once from JDs + taxonomy)**

```python
from llama_index.core import PropertyGraphIndex, Document
docs = [Document(text=jd["text"], metadata={"role": jd["role"], "company": jd["company"]}) for jd in jds]
skill_graph = PropertyGraphIndex.from_documents(docs, kg_extractors=[skill_extractor], show_progress=True)
retriever = skill_graph.as_retriever(include_text=False)   # "which skills does Data Analyst need, and their prereqs?"
```

**6.6 MCP tools into LangGraph**

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
mcp = MultiServerMCPClient({
    "calendar": {"url": CALENDAR_MCP_URL, "transport": "streamable_http"},
    "github":   {"url": GITHUB_MCP_URL,   "transport": "streamable_http"},
})
external_tools = await mcp.get_tools()      # give calendar tools only to the planner, github only to project_coach
```

---

## 7. Evaluation plan (put this on a slide)

| What | Metric | How |
|---|---|---|
| Tutoring (kept from StudyNest) | faithfulness, answer relevancy, context precision/recall, refusal | RAGAS on the team test set |
| Agent task success | % of scenarios where the goal state is reached (plan created, approvals requested, calendar written) | 20 scripted scenarios, DeepEval task completion / LangSmith evaluators |
| Tool-call accuracy | right tool + valid args / total calls | trajectory comparison against reference traces |
| Plan feasibility | hours planned ≤ budget, prerequisites ordered, deadline met | deterministic checks |
| Resume groundedness | % bullets backed by evidence; fabricated-claim rate (target 0) | Evidence Ledger validator + LLM judge |
| Interview scoring | agreement with a human rubric on 15 transcripts (Cohen's κ) | team-labelled set |
| Personalization | readiness gain and mastery gain over 8 simulated weeks vs. a fixed syllabus baseline; question repetition rate | simulated student profiles (extend existing simulator) |
| Cost/latency | tokens and seconds per weekly run | LangSmith/Langfuse traces |

---

## 8. 3-minute demo script

1. New student → intake chat → diagnostic (15 s).
2. Market scout runs live in the Agent Activity drawer (tool calls visible) → demand map.
3. Skill graph lights up: green verified / grey gaps → Readiness 41%.
4. Planner proposes week 1 → approval card → calendar updated.
5. Tutor answers a question with citations; quiz → mastery up → readiness 41% → 47%, evidence added.
6. Resume studio: tailored resume; one bullet **blocked** ("no proof of Tableau") → student uploads certificate → unblocked.
7. 30-second voice mock interview → rubric + cited feedback.
8. Eval slide + LangSmith trace.

---

## 9. If the official problem statement is narrower

| If the statement is about… | Lead with | Keep as supporting |
|---|---|---|
| Career guidance / counselling | intake + market scout + gap analyzer + feasibility planner | tutor, quizzes |
| Personalized learning paths | gap analyzer + planner + tutor + assessor (StudyNest core) | resume |
| Placement / interview readiness | interview agent + readiness score + TPO dashboard | planner |
| Resume / job matching | Evidence Ledger + resume agent + opportunity scout | interview |
| Skill assessment / credentialing | assessor + Evidence Ledger + verifiable skill passport (signed JSON / QR) | planner |

---

## 10. Build order (team of 3–4, ~5 days)

1. **Day 1:** data model, seed data (JDs, taxonomy), LangGraph skeleton with supervisor + 2 agents, SSE stream to an Activity drawer.
2. **Day 2:** gap analyzer + readiness score + skill graph UI; wrap tutor/quiz services as tools; Evidence writes.
3. **Day 3:** planner with approval interrupt + calendar MCP; weekly re-plan job.
4. **Day 4:** resume agent with Evidence Ledger; interview agent (text first, voice if time).
5. **Day 5:** evals + LangSmith traces, polish, record demo, offline fallback (sample data, local model).
