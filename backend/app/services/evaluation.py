"""System evaluation.
RAG metrics follow the RAGAS definitions:
  faithfulness      share of answer statements supported by the retrieved context
  answer relevancy  how directly the answer addresses the question
  context precision rank-weighted precision of retrieved chunks vs. the known source location
  context recall    share of questions whose known source location was retrieved
plus refusal accuracy on off-material queries. Faithfulness/relevancy use an LLM judge
(the `judge` role, a different model from the tutor) when judge="llm", else lexical judges.
Personalization is evaluated with simulated students across sessions.
The run also exports rows in RAGAS' dataset shape so the official library can re-score them."""
from __future__ import annotations

import json
import random
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Question
from . import bkt, llm
from .grounding import answer, answer_sentences
from .text import tokenize

DATA = Path(__file__).resolve().parent.parent / "data"


def default_testset() -> dict:
    return json.loads((DATA / "os_testset.json").read_text())


def _lexical_faithfulness(ans: str, contexts: list[str]) -> float:
    ctx = set(tokenize(" ".join(contexts)))
    sents = answer_sentences(ans)
    if not sents:
        return 0.0
    ok = 0
    for s in sents:
        t = tokenize(s)
        if not t or sum(w in ctx for w in t) / len(t) >= 0.6:
            ok += 1
    return ok / len(sents)


def _lexical_relevancy(q: str, ans: str) -> float:
    qt, at = set(tokenize(q)), set(tokenize(ans))
    if not qt:
        return 0.0
    return sum(1 for w in qt if w in at or any(a.startswith(w) or w.startswith(a) for a in at)) / len(qt)


JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "statements": {"type": "array", "items": {"type": "object", "properties": {"statement": {"type": "string"}, "supported": {"type": "boolean"}}, "required": ["statement", "supported"], "additionalProperties": False}},
        "relevancy": {"type": "number"},
    },
    "required": ["statements", "relevancy"],
    "additionalProperties": False,
}


async def _llm_judge(q: str, ans: str, contexts: list[str]) -> tuple[float, float]:
    data = await llm.complete_json(
        "judge",
        "You are an evaluation judge. Break the answer into atomic statements and mark each as supported only if the context entails it. "
        "Then rate relevancy from 0 to 1: how directly and completely the answer addresses the question.",
        f"Question: {q}\n\nContext:\n" + "\n---\n".join(contexts) + f"\n\nAnswer:\n{ans}",
        JUDGE_SCHEMA,
    )
    st = data.get("statements") or []
    faith = sum(1 for s in st if s.get("supported")) / len(st) if st else 0.0
    return faith, max(0.0, min(1.0, float(data.get("relevancy", 0))))


async def run_rag_eval(db: Session, user_id: str, testset: dict, judge: str = "lexical") -> dict:
    use_llm_judge = judge == "llm" and llm.enabled("judge")
    cases, ragas_rows = [], []
    for c in testset["cases"]:
        expected = c.get("expected_locations")
        a = await answer(db, user_id, c["q"], mode="course")
        contexts = [h.chunk.text for h in a.hits]
        retrieved = [h.chunk.location for h in a.hits]
        rel = [loc in (expected or []) for loc in retrieved]
        hits_so_far, prec_sum = 0, 0.0
        for i, r in enumerate(rel):
            if r:
                hits_so_far += 1
                prec_sum += hits_so_far / (i + 1)
        declined = a.grounded == "declined"
        if expected is None:
            cases.append({"q": c["q"], "offMaterial": True, "retrieved": retrieved, "declined": declined, "grounded": a.grounded})
            continue
        if declined:
            faith, relv = 0.0, 0.0
        elif use_llm_judge:
            try:
                faith, relv = await _llm_judge(c["q"], a.text, contexts)
            except llm.LLMUnavailable:
                faith, relv = _lexical_faithfulness(a.text, contexts), _lexical_relevancy(c["q"], a.text)
        else:
            faith, relv = _lexical_faithfulness(a.text, contexts), _lexical_relevancy(c["q"], a.text)
        cases.append({
            "q": c["q"], "offMaterial": False, "retrieved": retrieved, "declined": declined, "grounded": a.grounded, "model": a.model,
            "faithfulness": faith, "relevancy": relv, "precision": prec_sum / hits_so_far if hits_so_far else 0.0, "recall": 1.0 if hits_so_far else 0.0,
        })
        ragas_rows.append({"user_input": c["q"], "response": a.text, "retrieved_contexts": contexts, "reference_locations": expected})

    on = [x for x in cases if not x["offMaterial"]]
    off = [x for x in cases if x["offMaterial"]]
    mean = lambda xs: sum(xs) / len(xs) if xs else 0.0  # noqa: E731
    return {
        "testSet": f"{testset.get('name', 'custom')} ({len(on)} sourced + {len(off)} off-material)",
        "judge": "llm:" + llm.model_for("judge") if use_llm_judge else "lexical",
        "rag": {
            "faithfulness": mean([x["faithfulness"] for x in on]),
            "relevancy": mean([x["relevancy"] for x in on]),
            "precision": mean([x["precision"] for x in on]),
            "recall": mean([x["recall"] for x in on]),
            "refusal": mean([1.0 if x["declined"] else 0.0 for x in off]),
            "falseRefusal": mean([1.0 if x["declined"] else 0.0 for x in on]),
        },
        "cases": cases,
        "ragasRows": ragas_rows,
    }


def _simulate(name: str, skill: float, pool: list[Question], sessions: int, per: int, adaptive: bool, seed: int) -> dict:
    rnd = random.Random(seed)
    concepts = sorted({q.concept for q in pool})
    truth = {c: min(0.95, max(0.05, skill + ((i * 37) % 11) / 25 - 0.2)) for i, c in enumerate(concepts)}
    est = {c: 0.3 for c in concepts}
    start = sum(truth.values()) / len(truth)
    seen: set[str] = set()
    asked = repeats = 0
    for _ in range(sessions):
        if adaptive:  # the production policy: weakest estimated concepts first, unseen first
            unseen = sorted([q for q in pool if q.id not in seen], key=lambda q: est[q.concept])
            pick = unseen[:per]
            if len(pick) < per:
                pick += sorted([q for q in pool if q not in pick], key=lambda q: est[q.concept])[: per - len(pick)]
        else:
            pick = [rnd.choice(pool) for _ in range(per)]
        for q in pick:
            asked += 1
            repeats += q.id in seen
            seen.add(q.id)
            correct = rnd.random() < truth[q.concept] * 0.85 + 0.1
            est[q.concept] = bkt.update(est[q.concept], correct)
            truth[q.concept] = min(0.97, truth[q.concept] + (1 - truth[q.concept]) * 0.18)
    end = sum(truth.values()) / len(truth)
    return {"name": name, "startMastery": start, "endMastery": end, "trueGain": end - start, "repetition": repeats / asked}


def run_personalization(db: Session, subject_id: str, sessions: int = 5, per_session: int = 5) -> dict:
    pool = list(db.scalars(select(Question).where(Question.subject_id == subject_id, Question.verified.is_(True))))
    if len(pool) < per_session:
        return {"masteryGain": 0.0, "repetition": 0.0, "baselineRepetition": 0.0, "sessions": sessions, "profiles": [], "note": "not enough questions"}
    profiles = []
    for i, (name, skill) in enumerate([("Struggling student", 0.25), ("Average student", 0.5), ("Strong student", 0.75)]):
        a = _simulate(name, skill, pool, sessions, per_session, True, 7 + i)
        b = _simulate(name, skill, pool, sessions, per_session, False, 7 + i)
        profiles.append({**a, "baselineRepetition": b["repetition"]})
    mean = lambda k: sum(p[k] for p in profiles) / len(profiles)  # noqa: E731
    return {"masteryGain": mean("trueGain"), "repetition": mean("repetition"), "baselineRepetition": mean("baselineRepetition"), "sessions": sessions, "profiles": profiles}
