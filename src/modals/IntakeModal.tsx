// New-student onboarding: a short intake conversation, then a diagnostic quiz with one
// question per topic. Results seed the learner model (strengths / weaknesses).
import { useMemo, useState } from 'react';
import { ArrowRight, Check, GraduationCap, Sparkles, Target, X } from 'lucide-react';
import { Modal, Progress } from '../components/ui';
import { concepts, questionBank, type Question } from '../data';
import { bktUpdate, useStore } from '../store';
import { isCorrect } from './QuizModal';

const levels = [
  { id: 'beginner', label: 'New to it', prior: 0.2 },
  { id: 'some', label: 'Studied some of it', prior: 0.35 },
  { id: 'confident', label: 'Fairly confident', prior: 0.5 },
];

export default function IntakeModal() {
  const { state, actions, setModal } = useStore();
  const [step, setStep] = useState<'name' | 'subject' | 'level' | 'goal' | 'quiz' | 'result'>('name');
  const [name, setName] = useState(state.userName === 'there' ? '' : state.userName);
  const quizSubjects = state.subjects.filter((s) => questionBank.filter((q) => q.subjectId === s.id).length >= 4);
  const [subjectId, setSubjectId] = useState(quizSubjects.find((s) => s.id === 'os')?.id ?? quizSubjects[0]?.id ?? 'ds');
  const [level, setLevel] = useState(levels[1]);
  const [goal, setGoal] = useState('');
  const [i, setI] = useState(0);
  const [given, setGiven] = useState('');
  const [answers, setAnswers] = useState<{ q: Question; correct: boolean }[]>([]);

  // One question per concept (easiest first) — breadth over depth for a diagnostic.
  const questions = useMemo(() => {
    const pool = questionBank.filter((q) => q.subjectId === subjectId);
    const byConcept = new Map<string, Question>();
    const rank = { Easy: 0, Medium: 1, Hard: 2 };
    for (const q of [...pool].sort((a, b) => rank[a.difficulty] - rank[b.difficulty])) if (!byConcept.has(q.concept)) byConcept.set(q.concept, q);
    return [...byConcept.values()].slice(0, 8);
  }, [subjectId]);

  const subject = state.subjects.find((s) => s.id === subjectId);
  const q = questions[i];
  const bot = (text: string) => (
    <div className="msg assistant">
      <span className="msg-avatar">
        <Sparkles size={16} />
      </span>
      <div className="bubble">{text}</div>
    </div>
  );
  const me = (text: string) => (
    <div className="msg user">
      <div className="bubble">{text}</div>
    </div>
  );

  const submit = () => {
    if (!q || !given.trim()) return;
    const next = [...answers, { q, correct: isCorrect(q, given) }];
    setAnswers(next);
    setGiven('');
    if (i + 1 >= questions.length) finish(next);
    else setI(i + 1);
  };

  const skip = () => {
    if (!q) return;
    const next = [...answers, { q, correct: false }];
    setAnswers(next);
    setGiven('');
    if (i + 1 >= questions.length) finish(next);
    else setI(i + 1);
  };

  const [mastery, setMastery] = useState<Record<string, number>>({});
  const finish = (all: { q: Question; correct: boolean }[]) => {
    const m: Record<string, number> = {};
    for (const c of concepts.filter((c) => c.subjectId === subjectId)) m[c.id] = level.prior;
    for (const a of all) m[a.q.concept] = bktUpdate(m[a.q.concept] ?? level.prior, a.correct);
    setMastery(m);
    actions.completeOnboarding(name.trim(), m, subjectId, all.map((a) => ({ questionId: a.q.id, correct: a.correct })));
    setStep('result');
  };

  const name_ = (id: string) => concepts.find((c) => c.id === id)?.name ?? id;
  const tested = answers.map((a) => ({ id: a.q.concept, ok: a.correct, m: mastery[a.q.concept] ?? 0 }));
  const strong = tested.filter((t) => t.ok).sort((a, b) => b.m - a.m);
  const weak = tested.filter((t) => !t.ok).sort((a, b) => a.m - b.m);

  return (
    <Modal
      width={680}
      onClose={() => setModal(null)}
      icon={<span className="tile tile-md t-green"><GraduationCap size={20} /></span>}
      title={step === 'quiz' ? 'Diagnostic quiz' : step === 'result' ? 'Your starting profile' : 'Welcome to StudyNest'}
      subtitle={step === 'quiz' ? `${subject?.name} · question ${i + 1} of ${questions.length} · one per topic` : 'New here? Let’s learn what you know so your path fits you.'}
    >
      {step !== 'quiz' && step !== 'result' && (
        <div className="intake">
          {bot('Hi! I’m your AI tutor. What should I call you?')}
          {step !== 'name' && me(name || 'Student')}
          {step !== 'name' && bot('Which subject do you want to start with?')}
          {['level', 'goal'].includes(step) && me(subject?.name ?? '')}
          {['level', 'goal'].includes(step) && bot(`How familiar are you with ${subject?.name}?`)}
          {step === 'goal' && me(level.label)}
          {step === 'goal' && bot('Any exam or goal coming up? (optional)')}

          <div className="intake-input">
            {step === 'name' && (
              <form className="row" onSubmit={(e) => { e.preventDefault(); setStep('subject'); }}>
                <input className="input" autoFocus placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn btn-dark">Next <ArrowRight size={16} /></button>
              </form>
            )}
            {step === 'subject' && (
              <div className="chip-row">
                {quizSubjects.map((s) => (
                  <button key={s.id} className={`chip choice t-${s.theme}`} onClick={() => { setSubjectId(s.id); setStep('level'); }}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {step === 'level' && (
              <div className="chip-row">
                {levels.map((l) => (
                  <button key={l.id} className="chip choice" onClick={() => { setLevel(l); setStep('goal'); }}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
            {step === 'goal' && (
              <form className="row" onSubmit={(e) => { e.preventDefault(); setStep('quiz'); }}>
                <input className="input" autoFocus placeholder="e.g. Mid-sem exam in 10 days" value={goal} onChange={(e) => setGoal(e.target.value)} />
                <button className="btn btn-dark"><Target size={16} /> Start diagnostic ({questions.length} Qs)</button>
              </form>
            )}
          </div>
        </div>
      )}

      {step === 'quiz' && q && (
        <div className="quiz-q">
          <Progress value={(i / questions.length) * 100} height={7} theme="green" />
          <div className="q-tags">
            <span className="chip t-purple">{name_(q.concept)}</span>
            <span className={`chip diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
          </div>
          <h3 className="q-prompt">{q.prompt}</h3>
          {q.type === 'mcq' ? (
            <div className="options">
              {q.options!.map((o, k) => (
                <button key={k} className={`option ${given === String(k) ? 'sel' : ''}`} onClick={() => setGiven(String(k))}>
                  <span className="opt-letter">{String.fromCharCode(65 + k)}</span>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <input className="input lg" autoFocus value={given} onChange={(e) => setGiven(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={q.type === 'numeric' ? 'Enter a number' : 'Type your answer'} />
          )}
          <div className="quiz-foot">
            <span className="muted small">No feedback during the diagnostic — just answer honestly.</span>
            <span className="grow" />
            <button className="btn btn-light btn-sm" onClick={skip}>
              I don’t know
            </button>
            <button className="btn btn-dark" disabled={!given.trim()} onClick={submit}>
              {i + 1 >= questions.length ? 'Finish' : 'Next'} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 'result' && (
        <div className="quiz-result">
          <h3>
            {name ? `${name}, here` : 'Here'}’s where you stand in {subject?.name}: {answers.filter((a) => a.correct).length}/{answers.length}
          </h3>
          <div className="sw-grid">
            <div className="report">
              <span className="small-label">Strengths</span>
              {strong.length === 0 && <span className="muted small">None yet — that’s fine, we’ll build them.</span>}
              {strong.map((t) => (
                <div key={t.id} className="sw-item ok"><Check size={14} /> {name_(t.id)} <em>{Math.round(t.m * 100)}%</em></div>
              ))}
            </div>
            <div className="report">
              <span className="small-label">Focus areas</span>
              {weak.length === 0 && <span className="muted small">No gaps found in this diagnostic!</span>}
              {weak.map((t) => (
                <div key={t.id} className="sw-item bad"><X size={14} /> {name_(t.id)} <em>{Math.round(t.m * 100)}%</em></div>
              ))}
            </div>
          </div>
          <p className="unlock-note"><Check size={16} /> Learner model initialised · Personalized Learning unlocked{goal ? ` · goal: ${goal}` : ''}</p>
          <div className="result-actions">
            {weak[0] && concepts.find((c) => c.id === weak[0].id)?.lessonId && (
              <button className="btn btn-pink" onClick={() => { const c = concepts.find((x) => x.id === weak[0].id)!; actions.openLesson(c.subjectId, c.lessonId!); }}>
                Start with {name_(weak[0].id)}
              </button>
            )}
            <button className="btn btn-dark" onClick={() => setModal({ type: 'path' })}>See my learning path</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
