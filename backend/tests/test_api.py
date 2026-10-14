"""End-to-end API tests, offline (no model keys): upload → grounded chat → quiz → learner model → tools → eval."""
import pytest

from app.services import llm


def _upload(client, path, user="demo"):
    with open(path, "rb") as f:
        r = client.post("/api/sources", files={"file": (path.name, f, "application/pdf")}, headers={"X-User-Id": user})
    assert r.status_code == 202, r.text
    rid = r.json()["id"]
    src = client.get(f"/api/sources/{rid}", headers={"X-User-Id": user}).json()
    assert src["status"] == "ready", src
    return src


def test_health(client):
    body = client.get("/api/health").json()
    assert body["ok"] and set(body["models"]) == {"tutor", "fast", "verifier", "vision", "judge"}


def test_upload_builds_chunks_and_course(client, os_pdf):
    src = _upload(client, os_pdf)
    assert src["meta"] == "10 pages" and src["subjectId"] == "os"
    chunks = client.get(f"/api/sources/{src['id']}/chunks").json()
    assert len(chunks) >= 10 and all(c["location"].startswith("p. ") for c in chunks)
    course = client.get("/api/courses/os").json()
    assert [m["title"] for m in course["modules"]][:2] == ["Introduction to Operating Systems", "Process Management"]
    assert course["concepts"][0]["id"] == "os-01"


def test_grounded_answer_cites_the_right_page(client):
    r = client.post("/api/chat", json={"message": "What are the four necessary conditions for deadlock?"}).json()
    assert r["grounded"] == "source"
    assert r["citations"][0]["location"] == "p. 10"
    assert "circular wait" in r["text"].lower()


def test_off_material_is_declined_or_flagged(client):
    r = client.post("/api/chat", json={"message": "Who won the 2018 FIFA World Cup?"}).json()
    assert r["grounded"] == "declined" and r["citations"] == []
    r = client.post("/api/chat", json={"message": "Who won the 2018 FIFA World Cup?", "mode": "open"}).json()
    assert r["grounded"] == "outside"


def test_chat_stream_sse(client):
    with client.stream("POST", "/api/chat/stream", json={"message": "What is a semaphore?"}) as r:
        body = "".join(r.iter_text())
    assert "event: citations" in body and "event: done" in body and '"grounded": "source"' in body


def test_adaptive_quiz_updates_mastery_and_reports(client):
    quiz = client.post("/api/quiz", json={"subjectId": "os", "count": 5, "adaptive": True}).json()
    assert len(quiz["questions"]) == 5 and quiz["repeats"] == 0
    first = quiz["questions"][0]
    assert "answer" not in first  # answers never leave the server
    res = client.post(f"/api/quiz/{quiz['quizId']}/answer", json={"questionId": first["id"], "answer": "999"}).json()
    assert res["correct"] is False and res["masteryAfter"] < res["masteryBefore"]
    report = client.get(f"/api/quiz/{quiz['quizId']}/report").json()
    assert report["total"] == 1 and report["misconceptions"][0]["source"].startswith("Operating System Notes.pdf")
    # A second adaptive quiz avoids the question already seen
    again = client.post("/api/quiz", json={"subjectId": "os", "count": 5, "adaptive": True}).json()
    assert first["id"] not in [q["id"] for q in again["questions"]]


def test_new_student_diagnostic(client, os_pdf):
    user = {"X-User-Id": "new-student"}
    src = _upload(client, os_pdf, "new-student")
    sid = src["subjectId"]
    assert sid != "os"  # namespaced per student
    assert client.get("/api/learner/profile", headers=user).json()["onboarded"] is False
    diag = client.post(f"/api/learner/diagnostic/start?subjectId={sid}", headers=user).json()
    concepts = [q["concept"] for q in diag["questions"]]
    assert len(concepts) == len(set(concepts)) >= 10  # one question per topic
    answers = [{"questionId": q["id"], "answer": "0"} for q in diag["questions"]]
    out = client.post("/api/learner/diagnostic/submit", json={"quizId": diag["quizId"], "name": "Asha", "level": "beginner", "answers": answers}, headers=user).json()
    assert out["total"] == len(answers) and len(out["strengths"]) + len(out["weaknesses"]) == len(answers)
    assert client.get("/api/learner/profile", headers=user).json()["onboarded"] is True
    path = client.get(f"/api/learner/path?subjectId={sid}", headers=user).json()
    assert path["next"]


@pytest.mark.parametrize("kind", ["notes", "flashcards", "summary", "slides", "mindmap", "audio", "table", "reports"])
def test_tools(client, kind):
    r = client.post(f"/api/tools/{kind}?subjectId=os")
    assert r.status_code == 200 and r.json()["kind"] == kind


def test_evaluation(client):
    testset = {"name": "mini", "cases": [
        {"q": "What causes thrashing?", "expected_locations": ["p. 5"]},
        {"q": "What does a TLB cache?", "expected_locations": ["p. 6"]},
        {"q": "What is the capital of Australia?", "expected_locations": None},
    ]}
    r = client.post("/api/eval/run", json={"subjectId": "os", "testset": testset}).json()
    assert r["rag"]["recall"] == 1.0 and r["rag"]["refusal"] == 1.0 and r["rag"]["faithfulness"] > 0.9
    p = r["personalization"]
    assert p["repetition"] < p["baselineRepetition"] and p["masteryGain"] > 0
    assert client.get("/api/eval/latest").json()["id"] == r["id"]


def test_llm_path_filters_citations_and_refusals(client, monkeypatch):
    """With a model configured: invalid citation numbers are stripped; NOT_IN_SOURCES becomes a decline."""
    replies = iter(["Deadlock needs four conditions [1]. Also see [9].", "NOT_IN_SOURCES"])

    async def fake_complete(role, system, messages, **kw):
        return llm.LLMResult(text=next(replies), model="fake-model")

    monkeypatch.setattr(llm, "enabled", lambda role: role == "tutor")
    monkeypatch.setattr(llm, "complete", fake_complete)
    r = client.post("/api/chat", json={"message": "What is a deadlock?"}).json()
    assert r["grounded"] == "source" and "[9]" not in r["text"] and [c["n"] for c in r["citations"]] == [1]
    r = client.post("/api/chat", json={"message": "What is a deadlock?"}).json()
    assert r["grounded"] == "declined"


def test_generated_questions_need_cross_model_agreement(client, monkeypatch):
    import asyncio

    from app.db import SessionLocal
    from app.models import Concept
    from app.services import quizgen

    gen = {"questions": [
        {"type": "mcq", "difficulty": "Easy", "prompt": "Which structure caches page translations in a CPU?", "options": ["TLB", "PCB", "FAT", "DMA"], "answer": "0", "accept": [], "explanation": "TLB caches translations.", },
        {"type": "mcq", "difficulty": "Easy", "prompt": "Paging splits physical memory into?", "options": ["pages", "frames", "segments", "blocks"], "answer": "0", "accept": [], "explanation": "Deliberately wrong key."},
    ]}

    async def fake_json(role, system, user, schema, **kw):
        if role == "fast":
            return gen
        return {"answer": "0" if "caches page translations" in user else "1", "supported_by_excerpt": True}

    monkeypatch.setattr(llm, "enabled", lambda role: True)
    monkeypatch.setattr(llm, "complete_json", fake_json)
    with SessionLocal() as db:
        kept = asyncio.run(quizgen.generate_for_concept(db, db.get(Concept, "os-06"), n=2))
        assert [q.prompt for q in kept] == ["Which structure caches page translations in a CPU?"]  # the wrong key was rejected
        again = asyncio.run(quizgen.generate_for_concept(db, db.get(Concept, "os-06"), n=2))
        assert again == []  # near-duplicate of the stored question is dropped


def test_delete_source(client, tmp_path):
    p = tmp_path / "notes.txt"
    p.write_text("Spooling buffers output for a slow device such as a printer so programs need not wait.")
    with open(p, "rb") as f:
        rid = client.post("/api/sources", files={"file": ("notes.txt", f, "text/plain")}).json()["id"]
    assert client.delete(f"/api/sources/{rid}").status_code == 204
    assert client.get(f"/api/sources/{rid}").status_code == 404


def test_stream_survives_provider_failure(client, monkeypatch):
    """If the model errors mid-stream the client gets an `error` event and a `done`, not a dropped connection."""

    async def broken_stream(*a, **kw):
        raise llm.LLMUnavailable("provider down")
        yield  # pragma: no cover

    monkeypatch.setattr(llm, "enabled", lambda role: role == "tutor")
    monkeypatch.setattr(llm, "stream", broken_stream)
    with client.stream("POST", "/api/chat/stream", json={"message": "What is a semaphore?"}) as r:
        body = "".join(r.iter_text())
    assert "event: error" in body and "event: done" in body
