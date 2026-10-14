import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { ArrowRight, BookOpen, Check, CircleCheck, ClipboardCheck, FileText, RotateCcw, Target, X } from 'lucide-react';
import { Modal, Progress } from '../components/ui';
import { concepts, questionBank, type Question } from '../data';
import { bktUpdate, useStore } from '../store';

interface Props {
  subjectId?: string;
  count?: number;
  conceptIds?: string[];
  adaptive?: boolean;
}

interface Answered {
  q: Question;
  given: string;
  correct: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function isCorrect(q: Question, given: string) {
  const g = given.trim().toLowerCase();
  if (q.type === 'mcq') return Number(given) === q.answer;
  if (q.type === 'numeric') {
    const a = parseFloat(String(q.answer));
    const v = parseFloat(g.replace(/,/g, ''));
    return !Number.isNaN(v) && Math.abs(a - v) <= Math.max(0.011, Math.abs(a) * 0.01);
  }
  return (q.accept ?? [String(q.answer)]).some((k) => g.includes(k.toLowerCase()));
}

export default function QuizModal(props: Props) {
  const { state, actions, setModal, backend, toast } = useStore();
  const [subjectId, setSubjectId] = useState(props.subjectId ?? state.lastLesson.subjectId);
  const [count, setCount] = useState(props.count ?? 5);
  const [phase, setPhase] = useState<'intro' | 'question' | 'result'>(props.conceptIds ? 'question' : 'intro');
  const [seed, setSeed] = useState(0);
  const [i, setI] = useState(0);
  const [given, setGiven] = useState('');
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const adaptive = props.adaptive ?? false;
  const [before, setBefore] = useState(state.mastery);

  // Backend mode: the server selects (weakest-first, unseen-first), grades and updates mastery.
  const remote = backend.online && !!state.subjects.find((s) => s.id === subjectId)?.remote;
  const [rq, setRq] = useState<{ quizId: string; questions: Question[]; repeats: number } | null>(null);
  const [remoteBefore, setRemoteBefore] = useState<Record<string, number>>({});
  const [remoteAfter, setRemoteAfter] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!remote || phase !== 'question' || rq) return;
    let cancelled = false;
    api
      .quiz({ subjectId, count, conceptIds: props.conceptIds, adaptive: adaptive || !!props.conceptIds })
      .then((r) => {
        if (cancelled) return;
        setRq({ quizId: r.quizId, repeats: r.repeats, questions: r.questions.map((x) => ({ ...x, options: x.options ?? undefined, answer: '', explanation: '' })) });
      })
      .catch((e) => {
        toast(`Couldn't load questions: ${(e as Error).message}`);
        setModal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [remote, phase, rq, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const local = useMemo(() => {
    let pool = questionBank.filter((q) => q.subjectId === subjectId);
    if (props.conceptIds?.length) {
      const focused = pool.filter((q) => props.conceptIds!.includes(q.concept));
      if (focused.length) pool = focused;
    }
    if (!pool.length) pool = questionBank.filter((q) => q.subjectId === 'ds');
    const unseen = pool.filter((q) => !state.seenQuestions.includes(q.id));
    const m = (q: Question) => state.mastery[q.concept] ?? 0.3;
    const order = (qs: Question[]) =>
      adaptive || props.conceptIds
        ? [...qs].sort((a, b) => m(a) - m(b) || (a.difficulty > b.difficulty ? 1 : -1))
        : [...qs].sort(() => Math.random() - 0.5);
    let chosen = order(unseen).slice(0, count);
    let reps = 0;
    if (chosen.length < count) {
      const extra = order(pool.filter((q) => !chosen.includes(q))).slice(0, count - chosen.length);
      reps = extra.length;
      chosen = [...chosen, ...extra];
    }
    return { questions: chosen, repeats: reps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, count, seed, props.conceptIds, adaptive]);
  const { questions, repeats } = remote ? { questions: rq?.questions ?? [], repeats: rq?.repeats ?? 0 } : local;

  const q = questions[i];
  const close = () => setModal(null);
  const subject = state.subjects.find((s) => s.id === subjectId);
  const quizSubjects = state.subjects.filter((s) => (backend.online && s.remote) || questionBank.some((x) => x.subjectId === s.id));

  const check = async () => {
    if (!q || !given.trim() || busy) return;
    if (remote && rq) {
      setBusy(true);
      try {
        const r = await api.answer(rq.quizId, q.id, given);
        const graded: Question = {
          ...q,
          explanation: r.explanation,
          source: r.source,
          answer: q.type === 'mcq' && q.options ? String(Math.max(0, q.options.indexOf(r.correctAnswer))) : r.correctAnswer,
        };
        setRq({ ...rq, questions: rq.questions.map((x) => (x.id === q.id ? graded : x)) });
        setRemoteBefore((b) => (q.concept in b ? b : { ...b, [q.concept]: r.masteryBefore }));
        setRemoteAfter((a) => ({ ...a, [q.concept]: r.masteryAfter }));
        setAnswers((a) => [...a, { q: graded, given, correct: r.correct }]);
        setChecked(true);
      } catch (e) {
        toast(`Couldn't check the answer: ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    setChecked(true);
    setAnswers((a) => [...a, { q, given, correct: isCorrect(q, given) }]);
  };
  const next = () => {
    if (i + 1 >= questions.length) {
      const all = answers;
      actions.recordQuiz(subjectId, all.map((a) => ({ questionId: a.q.id, concept: a.q.concept, correct: a.correct })), adaptive);
      if (remote) actions.setMasteryMany(remoteAfter); // the server's estimates are authoritative
      setPhase('result');
      return;
    }
    setI(i + 1);
    setGiven('');
    setChecked(false);
  };
  const restart = () => {
    setSeed((s) => s + 1);
    setI(0);
    setGiven('');
    setChecked(false);
    setAnswers([]);
    setBefore(state.mastery);
    setRq(null);
    setRemoteBefore({});
    setRemoteAfter({});
    setPhase('question');
  };

  const last = answers[answers.length - 1];
  const conceptName = (id: string) => concepts.find((c) => c.id === id)?.name ?? id;

  return (
    <Modal
      width={720}
      onClose={close}
      icon={<span className="tile tile-md t-pink">{adaptive ? <Target size={20} /> : <ClipboardCheck size={20} />}</span>}
      title={adaptive ? 'Adaptive Quiz' : 'Practice Quiz'}
      subtitle={
        phase === 'question' && q
          ? `${subject?.name ?? 'Mixed'} · Question ${i + 1} of ${questions.length}`
          : 'Questions are tagged to a topic, source location and difficulty.'
      }
    >
      {phase === 'intro' && (
        <div className="quiz-intro">
          <label className="field">
            <span>Scope</span>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {quizSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Number of questions</span>
            <div className="seg small">
              {[3, 5, 10].map((n) => (
                <button key={n} className={`seg-btn ${count === n ? 'active' : ''}`} onClick={() => setCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="quiz-explain">
            <Target size={18} />
            <span>
              {adaptive
                ? 'Adaptive mode targets your weakest concepts first and skips questions you have already seen. Your mastery estimates update after every answer.'
                : 'A mixed set of MCQ, short-answer and numerical questions from your course material.'}
            </span>
          </div>
          <button className="btn btn-dark btn-lg" onClick={() => setPhase('question')}>
            Start quiz <ArrowRight size={18} />
          </button>
        </div>
      )}

      {phase === 'question' && !q && remote && (
        <div className="generating">
          <span className="spinner" />
          Preparing your questions…
        </div>
      )}

      {phase === 'question' && q && (
        <div className="quiz-q">
          <Progress value={((i + (checked ? 1 : 0)) / questions.length) * 100} height={7} theme="pink" />
          <div className="q-tags">
            <span className="chip t-purple">{conceptName(q.concept)}</span>
            <span className={`chip diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
            <span className="chip t-blue">{q.type === 'mcq' ? 'Multiple choice' : q.type === 'numeric' ? 'Numerical' : 'Short answer'}</span>
            {repeats > 0 && i >= questions.length - repeats && <span className="chip">Repeat</span>}
          </div>
          <h3 className="q-prompt">{q.prompt}</h3>
          {q.type === 'mcq' ? (
            <div className="options">
              {q.options!.map((o, k) => {
                const sel = given === String(k);
                const state2 = checked ? (k === q.answer ? 'right' : sel ? 'wrong' : '') : sel ? 'sel' : '';
                return (
                  <button key={k} className={`option ${state2}`} disabled={checked} onClick={() => setGiven(String(k))}>
                    <span className="opt-letter">{String.fromCharCode(65 + k)}</span>
                    {o}
                    {checked && k === q.answer && <Check size={16} />}
                    {checked && sel && k !== q.answer && <X size={16} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              className="input lg"
              autoFocus
              disabled={checked}
              placeholder={q.type === 'numeric' ? 'Enter a number' : 'Type your answer'}
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (checked ? next() : check())}
            />
          )}

          {checked && last && (
            <div className={`feedback ${last.correct ? 'ok' : 'bad'}`}>
              <strong>{last.correct ? 'Correct!' : `Not quite — answer: ${q.type === 'mcq' ? q.options![q.answer as number] : q.answer}`}</strong>
              <p>{q.explanation}</p>
              <span className="source-line">
                <FileText size={13} /> Source: {q.source}
              </span>
            </div>
          )}

          <div className="quiz-foot">
            <span className="muted small">
              Mastery of {conceptName(q.concept)}: {Math.round((state.mastery[q.concept] ?? 0.3) * 100)}%
            </span>
            <span className="grow" />
            {!checked ? (
              <button className="btn btn-dark" disabled={!given.trim() || busy} onClick={check}>
                {busy ? 'Checking…' : 'Check answer'}
              </button>
            ) : (
              <button className="btn btn-dark" onClick={next}>
                {i + 1 >= questions.length ? 'See results' : 'Next question'} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'result' && <QuizResult answers={answers} before={remote ? { ...before, ...remoteBefore } : before} adaptive={adaptive} onRetake={restart} conceptName={conceptName} />}
    </Modal>
  );
}

function QuizResult({
  answers,
  before: start,
  adaptive,
  onRetake,
  conceptName,
}: {
  answers: Answered[];
  before: Record<string, number>;
  adaptive: boolean;
  onRetake: () => void;
  conceptName: (id: string) => string;
}) {
  const { actions, setModal } = useStore();
  const score = answers.filter((a) => a.correct).length;
  const pct = Math.round((score / Math.max(1, answers.length)) * 100);
  const byConcept = new Map<string, Answered[]>();
  for (const a of answers) byConcept.set(a.q.concept, [...(byConcept.get(a.q.concept) ?? []), a]);
  const rows = [...byConcept.entries()].map(([c, as]) => {
    const before = start[c] ?? 0.3;
    let after = before;
    for (const a of as) after = bktUpdate(after, a.correct);
    return { c, before, after, wrong: as.filter((a) => !a.correct) };
  });
  const weak = rows.filter((r) => r.wrong.length);
  const weakConcept = concepts.find((c) => c.id === weak[0]?.c);

  return (
    <div className="quiz-result">
      <div className="score-ring" style={{ ['--p' as string]: `${pct}%` }}>
        <div>
          <strong>
            {score}/{answers.length}
          </strong>
          <span>{pct}%</span>
        </div>
      </div>
      <h3>{pct >= 80 ? 'Excellent work!' : pct >= 50 ? 'Good effort — a few gaps to close.' : 'Let’s strengthen the basics.'}</h3>
      {adaptive && (
        <p className="unlock-note">
          <CircleCheck size={16} /> Personalized Learning is unlocked — your path now adapts to these results.
        </p>
      )}

      <div className="report">
        <span className="small-label">Mastery update (Bayesian knowledge tracing)</span>
        {rows.map((r) => (
          <div key={r.c} className="report-row">
            <span>{conceptName(r.c)}</span>
            <Progress value={r.after * 100} height={8} theme={r.after < 0.45 ? 'pink' : r.after < 0.7 ? 'yellow' : 'green'} />
            <span className={`delta-txt ${r.after >= r.before ? 'up' : 'down'}`}>
              {Math.round(r.before * 100)}% → {Math.round(r.after * 100)}%
            </span>
          </div>
        ))}
      </div>

      {weak.length > 0 && (
        <div className="report">
          <span className="small-label">Likely misconceptions</span>
          {weak.flatMap((w) =>
            w.wrong.map((a) => (
              <div key={a.q.id} className="miscon">
                <strong>{a.q.prompt}</strong>
                <span>
                  You answered “{a.q.type === 'mcq' ? a.q.options![Number(a.given)] : a.given}”. {a.q.explanation}
                </span>
                <span className="source-line">
                  <FileText size={12} /> {a.q.source}
                </span>
              </div>
            )),
          )}
        </div>
      )}

      <div className="result-actions">
        <button className="btn btn-light" onClick={onRetake}>
          <RotateCcw size={16} /> New quiz
        </button>
        {weakConcept?.lessonId && (
          <button className="btn btn-pink" onClick={() => actions.openLesson(weakConcept.subjectId, weakConcept.lessonId!)}>
            <BookOpen size={16} /> Review {weakConcept.name}
          </button>
        )}
        <button className="btn btn-dark" onClick={() => setModal(adaptive ? { type: 'path' } : null)}>
          {adaptive ? 'View my path' : 'Done'}
        </button>
      </div>
    </div>
  );
}
