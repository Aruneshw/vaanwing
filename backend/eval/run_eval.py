"""Run the evaluation from the command line and write the report + a RAGAS-format dataset.

    python -m eval.run_eval --user demo --judge llm --out results/

Requires the course material to be ingested for that user (upload it through the API first).
`ragas_dataset.jsonl` has user_input / response / retrieved_contexts rows, so the official RAGAS
library can re-score the same answers with its own LLM judge if you want a second opinion."""
import argparse
import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal, init_db
from app.models import Subject
from app.services import evaluation


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="demo")
    ap.add_argument("--judge", choices=["lexical", "llm"], default="lexical")
    ap.add_argument("--testset", help="JSON test set; defaults to the OS notes test set")
    ap.add_argument("--out", default="results")
    args = ap.parse_args()

    init_db()
    testset = json.loads(Path(args.testset).read_text()) if args.testset else evaluation.default_testset()
    with SessionLocal() as db:
        base = testset.get("subject", "")
        subject = next((s for s in db.scalars(select(Subject).where(Subject.user_id == args.user)) if s.id == base or s.id.startswith(f"{base}-")), None)
        if subject is None:
            raise SystemExit(f"No ingested course '{base}' for user '{args.user}' — upload the material first.")
        rag = await evaluation.run_rag_eval(db, args.user, testset, args.judge)
        perso = evaluation.run_personalization(db, subject.id)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = rag.pop("ragasRows")
    (out / "report.json").write_text(json.dumps({**rag, "personalization": perso}, indent=2))
    (out / "ragas_dataset.jsonl").write_text("\n".join(json.dumps(r) for r in rows))
    print(f"Test set: {rag['testSet']}  judge: {rag['judge']}")
    for k, v in rag["rag"].items():
        print(f"  {k:<14} {v:.3f}")
    print(f"  mastery gain   +{perso['masteryGain']:.3f}  ({len(perso['profiles'])} simulated students x {perso['sessions']} sessions)")
    print(f"  repetition     {perso['repetition']:.3f}  (random baseline {perso['baselineRepetition']:.3f})")
    print(f"Wrote {out / 'report.json'} and {out / 'ragas_dataset.jsonl'}")


if __name__ == "__main__":
    asyncio.run(main())
