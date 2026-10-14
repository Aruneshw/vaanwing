---
name: agentic-career-builder
description: Build and extend CareerPilot (StudyNest + agentic career layer) for the Education & Career AI hackathon track. Use when adding or changing LangGraph agents, LangChain tools, LlamaIndex ingestion/skill graph, the Evidence Ledger, approval (human-in-the-loop) flows, agent streaming to the React UI, or agent evaluation in this repo.
---

# Agentic Career Builder

Know-how for building CareerPilot in this repo. The product plan is in `hackathon/AGENTIC_PLAN.md`;
the full build brief is in `hackathon/BUILD_PROMPT.md`. Read both before starting a large change.

## Ground rules (non-negotiable)

1. **Extend, don't break.** StudyNest's tutor, quizzes, learner model, ingestion and eval keep working.
   Run `cd backend && pytest` and `npm run build` after every change.
2. **Evidence before claims.** Any statement that the student *has* a skill (profile, resume, readiness)
   must come from the `Evidence` table (quiz, project, certificate, interview) with strength ≥ 0.6.
3. **Approval before side effects.** Calendar writes, emails, applications and anything leaving the app go
   through the `approval` node (`interrupt()`), never directly from an agent.
4. **Citations for teaching.** Study answers come from `grounding.answer()` and carry citations, or are
   declined/flagged.
5. **Offline must work.** Every agent has a deterministic fallback using seeded data so the demo runs
   without network or keys.
6. **Don't guess APIs.** LangChain, LangGraph and LlamaIndex change fast. Check the installed version
   (`pip show`, read the package source/docs) before writing calls; pin versions.

## Repo map

| Path | What lives there |
|---|---|
| `backend/app/services/` | existing engines: `grounding.py`, `retrieve.py`, `quizgen.py`, `bkt.py`, `topics.py`, `evaluation.py`, `llm.py`, `ingest/` |
| `backend/app/agents/` | (new) `state.py`, `graph.py`, `models.py`, `memory.py`, `approval.py`, `guards.py`, `prompts/`, `tools/` |
| `backend/app/routers/` | REST/SSE; add `agent.py`, `career.py`, `interview.py` |
| `backend/app/models.py` | ORM; add Goal, Role, JobPosting, Skill, SkillEdge, RoleSkill, Evidence, Plan, PlanTask, Application, InterviewSession, AgentRun, Approval |
| `src/api.ts`, `src/remote.ts` | backend client + sync; follow the existing pattern (offline fallback, SSE reader) |
| `src/store.tsx` | app state; add goal, readiness, skills, evidence, plan, approvals, applications, agentEvents |
| `src/pages/` | add `Career.tsx`, `Interview.tsx`; components `AgentActivity.tsx`, `ApprovalCard.tsx`, `SkillGraph.tsx` |

## Workflow for adding an agent

1. **Define its job in one sentence** and the state keys it reads/writes (`CareerState` in `agents/state.py`).
2. **Tools first.** Write `@tool` functions with tight docstrings and typed args. Wrap existing services
   instead of re-implementing (e.g. `explain_with_citations` → `grounding.answer`, `make_quiz` →
   `quizgen.select_questions`, `grade_answer` → `quizgen.check_answer` + `bkt.update`).
3. **System prompt** in `agents/prompts/<name>.md`: role, tools, what "done" looks like, what it must never do.
4. **Sub-graph:** model.bind_tools(tools) + `ToolNode` + `tools_condition` loop; compile; register in
   `graph.py` and in the supervisor's routing schema.
5. **Side effects** → set `pending_action` and route to `approval`; never call the side-effect tool directly.
6. **Critic pass:** route output through `critic` (different model) before it reaches the student.
7. **Stream it:** make sure its tool calls and messages appear in the SSE event stream with the agent name.
8. **Offline fallback:** a rule-based path using seeded data when models are unavailable.
9. **Tests:** mock the chat model (fake responses / fake tool calls) and assert state transitions, tool
   arguments, approval interrupts and Evidence writes.
10. **Eval:** add 2–3 scripted scenarios for it to the agent eval set.

## Patterns

**Model per role** (configurable by env; keep IDs exact):
- planner / supervisor / gap analyzer: `claude-opus-5-5`
- worker agents: `claude-haiku-5-5`
- critic / eval judge: `claude-sonnet-5-5`
- optional second provider for verification; offline mode when a role is set to `none`.

**Approval (HITL):**
```python
answer = interrupt({"type": "approval_required", "action": state["pending_action"]})
# UI: POST /api/agent/approvals/{id} → graph.invoke(Command(resume={"approved": True, "edits": {...}}),
#      config={"configurable": {"thread_id": student_id}})
```

**Memory:** thread per student (`thread_id = student_id`) with a Postgres checkpointer for the conversation
and run state; a long-term Store namespace `("students", student_id)` for durable facts (constraints,
preferences, decisions). Read memory at the start of supervisor turns; write only facts the student
confirmed.

**Streaming to the UI:** stream graph updates and messages, map them to UI events
`agent_started | tool_call | tool_result | message | approval_required | plan_updated | done`, send as SSE
(same reader pattern as `chatStream` in `src/api.ts`).

**Readiness:** `Σ demand_weight(skill) × verified_mastery(skill) / Σ demand_weight`, where verified mastery
combines BKT `p` with evidence strength (e.g. `max(p, best_evidence_strength)` capped by recency).

**Skill graph:** LlamaIndex `PropertyGraphIndex` built from job descriptions + a reviewed taxonomy; store
the canonical skills/edges in Postgres so the UI and readiness math do not depend on the LLM at request time.

**MCP tools:** load with `langchain-mcp-adapters` (`MultiServerMCPClient(...).get_tools()`); give each agent
only the tools it needs (calendar → planner, github → project coach, gmail drafts → resume agent).

## Evaluation checklist

- [ ] RAGAS tutoring metrics still pass on the team test set
- [ ] Task success on 20 scripted scenarios (goal state reached)
- [ ] Tool-call accuracy vs. reference trajectories
- [ ] Plan feasibility (hours ≤ budget, prerequisites ordered, deadline met)
- [ ] Resume groundedness = 100%, fabricated claims = 0
- [ ] Interview rubric agreement (Cohen's κ) on labelled transcripts
- [ ] Readiness/mastery gain over 8 simulated weeks vs. fixed-syllabus baseline; repetition rate
- [ ] Cost and latency per weekly run from LangSmith/Langfuse traces

## Pitfalls

- Agents that "decide" side effects inside a tool call — always route through `approval`.
- Unbounded loops between supervisor and agents — cap steps per run (recursion limit) and log why it stopped.
- Letting the LLM compute readiness or mastery — do the math in code; the LLM explains it.
- Mixing demo seed data with real student data — tag seeded rows and hide them once real data exists.
- Huge prompts with whole PDFs — retrieve, don't stuff; cite locations.
- Breaking offline mode — test the demo path with all model roles set to `none`.
