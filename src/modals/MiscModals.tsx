import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChartColumnIncreasing,
  Check,
  ClipboardCheck,
  Clock,
  NotebookText,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash,
  Workflow,
  Upload,
  Layers,
} from 'lucide-react';
import { Empty, Modal, Progress } from '../components/ui';
import { SubjectGlyph, SubjectTile } from '../components/Icons';
import type { SubjectIcon, Theme } from '../data';
import { moduleProgress, subjectProgress, timeAgo, useStore } from '../store';
import { ActivityRow } from '../pages/Home';
import { modes } from '../pages/Tutor';

export function NotesModal({ subjectId }: { subjectId?: string }) {
  const { state, actions, setModal } = useStore();
  const [filter, setFilter] = useState(subjectId ?? 'all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [adding, setAdding] = useState(false);
  const notes = state.notes.filter((n) => (filter === 'all' || n.subjectId === filter) && (n.title + n.body).toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal
      width={720}
      onClose={() => setModal(null)}
      icon={<span className="tile tile-md t-yellow">
        <NotebookText size={20} />
      </span>}
      title="Your Notes"
      subtitle={`${state.notes.length} notes in this term`}
    >
      <div className="toolbar">
        <label className="search-box sm grow">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes…" />
        </label>
        <select className="input xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All subjects</option>
          {state.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-dark btn-sm"
          onClick={() => {
            setAdding(true);
            setDraft({ title: '', body: '' });
          }}
        >
          <Plus size={15} /> New
        </button>
      </div>
      {adding && (
        <form
          className="card note-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.title.trim()) return;
            actions.addNote({ subjectId: filter === 'all' ? state.lastLesson.subjectId : filter, title: draft.title.trim(), body: draft.body.trim() });
            setAdding(false);
          }}
        >
          <input className="input" autoFocus placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Note" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <div className="row-end">
            <button type="button" className="btn btn-light btn-sm" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn btn-dark btn-sm" disabled={!draft.title.trim()}>
              Save
            </button>
          </div>
        </form>
      )}
      <div className="notes-list">
        {notes.length === 0 && <Empty>No notes found.</Empty>}
        {notes.map((n) => {
          const s = state.subjects.find((x) => x.id === n.subjectId);
          return editing === n.id ? (
            <form
              key={n.id}
              className="card note-form"
              onSubmit={(e) => {
                e.preventDefault();
                actions.updateNote(n.id, draft);
                setEditing(null);
              }}
            >
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="input" rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
              <div className="row-end">
                <button type="button" className="btn btn-light btn-sm" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="btn btn-dark btn-sm">Save</button>
              </div>
            </form>
          ) : (
            <div key={n.id} className="card note-card">
              <div className="note-top">
                {s && <span className={`chip t-${s.theme}`}>{s.name}</span>}
                <strong>{n.title}</strong>
                <span className="muted small">{timeAgo(n.createdAt)}</span>
                <button
                  className="icon-btn ghost sm"
                  aria-label="Edit note"
                  onClick={() => {
                    setEditing(n.id);
                    setDraft({ title: n.title, body: n.body });
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button className="icon-btn ghost sm" aria-label="Delete note" onClick={() => actions.deleteNote(n.id)}>
                  <Trash size={15} />
                </button>
              </div>
              <p>{n.body}</p>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function ActivityModal() {
  const { state, setModal } = useStore();
  return (
    <Modal width={560} onClose={() => setModal(null)} icon={<Clock size={22} />} title="Recent activity" subtitle="Everything you did across StudyNest">
      <ul className="activity-list full">
        {state.activity.map((a) => (
          <ActivityRow key={a.id} {...a} />
        ))}
      </ul>
    </Modal>
  );
}

export function WeekModal() {
  const { state, stats, setModal } = useStore();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const max = Math.max(...state.studyLog, 60);
  const today = (new Date().getDay() + 6) % 7;
  return (
    <Modal width={600} onClose={() => setModal(null)} icon={<span className="tile tile-md t-blue"><CalendarDays size={20} /></span>} title="This Week" subtitle="Study time per day and your streak">
      <div className="kpis">
        <div>
          <strong>{stats.weekHours} hrs</strong>
          <span>Study time</span>
        </div>
        <div>
          <strong className={stats.weekDelta >= 0 ? 'up' : 'down'}>
            {stats.weekDelta >= 0 ? '+' : ''}
            {stats.weekDelta}%
          </strong>
          <span>vs last week</span>
        </div>
        <div>
          <strong>{state.streak} days</strong>
          <span>Current streak</span>
        </div>
      </div>
      <div className="week-chart">
        {state.studyLog.map((m, i) => (
          <div key={i} className={`wc-col ${i === today ? 'today' : ''}`}>
            <em>{m}m</em>
            <span style={{ height: `${(m / max) * 100}%` }} />
            <b>{days[i]}</b>
          </div>
        ))}
      </div>
      <p className="muted small">Completing lessons and quizzes adds to today’s study time automatically.</p>
    </Modal>
  );
}

const demoSteps = [
  { icon: <Upload size={30} />, theme: 'pink', title: 'Add your sources', text: 'Upload lecture videos, PDFs, slides or notes. StudyNest extracts text, diagrams and transcripts and links every excerpt to its page, slide or timestamp.', to: '/tutor' },
  { icon: <Sparkles size={30} />, theme: 'blue', title: 'Ask the AI Tutor', text: 'Get answers grounded in your material with clickable citations. Questions your sources don’t cover are declined or clearly flagged.', to: '/tutor' },
  { icon: <Target size={30} />, theme: 'yellow', title: 'Take adaptive quizzes', text: 'MCQ, short-answer and numerical questions tagged to topic, source and difficulty — with cited feedback and a weak-topic report.', to: '/tutor' },
  { icon: <ChartColumnIncreasing size={30} />, theme: 'green', title: 'Follow your path', text: 'Per-concept mastery updates after every quiz and lesson, driving your focus topics, recommendations and personalized learning path.', to: '/' },
];

export function DemoModal() {
  const { setModal } = useStore();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % demoSteps.length), 3500);
    return () => window.clearInterval(t);
  }, [playing]);
  const s = demoSteps[i];
  return (
    <Modal width={680} onClose={() => setModal(null)} icon={<Play size={18} fill="currentColor" />} title="How StudyNest works" subtitle="A 4-step tour">
      <div className="demo">
        <div className={`demo-stage t-${s.theme}`} key={i}>
          <span className="blob b1" />
          <span className="blob b2" />
          <span className={`tile tile-xxl t-${s.theme} white-in`}>{s.icon}</span>
          <span className="small-label">Step {i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          <div className="demo-progress">
            <span style={{ animationPlayState: playing ? 'running' : 'paused' }} />
          </div>
        </div>
        <div className="flash-bar">
          <button className="icon-btn soft" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div className="dots">
            {demoSteps.map((_, k) => (
              <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Step ${k + 1}`} />
            ))}
          </div>
          <button
            className="btn btn-dark btn-sm"
            onClick={() => {
              setModal(null);
              nav(s.to);
            }}
          >
            Try it <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ManageSubjectsModal() {
  const { state, actions, setModal } = useStore();
  return (
    <Modal
      width={560}
      onClose={() => setModal(null)}
      icon={<BookOpen size={22} />}
      title="Manage Subjects"
      subtitle="Reorder or remove subjects. The first four appear on Home."
      footer={
        <button className="btn btn-dark" onClick={() => setModal({ type: 'addSubject' })}>
          <Plus size={16} /> Add subject
        </button>
      }
    >
      <ul className="manage-list">
        {state.subjects.map((s, i) => (
          <li key={s.id}>
            <SubjectTile icon={s.icon} theme={s.theme} size="sm" />
            <span className="grow">
              <strong>{s.name}</strong>
              <span className="muted small"> · {subjectProgress(s)}%</span>
            </span>
            <button className="icon-btn ghost sm" disabled={i === 0} onClick={() => actions.moveSubject(s.id, -1)} aria-label="Move up">
              <ArrowUp size={16} />
            </button>
            <button className="icon-btn ghost sm" disabled={i === state.subjects.length - 1} onClick={() => actions.moveSubject(s.id, 1)} aria-label="Move down">
              <ArrowDown size={16} />
            </button>
            <button className="icon-btn ghost sm" disabled={state.subjects.length <= 1} onClick={() => actions.removeSubject(s.id)} aria-label="Remove">
              <Trash size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const iconChoices: SubjectIcon[] = ['doc', 'pi', 'python', 'code', 'network', 'book', 'brain', 'flask'];
const themeChoices: Theme[] = ['blue', 'yellow', 'coral', 'green', 'purple', 'pink'];

export function AddSubjectModal() {
  const { actions, setModal } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<SubjectIcon>('book');
  const [theme, setTheme] = useState<Theme>('blue');
  return (
    <Modal width={520} onClose={() => setModal(null)} icon={<Plus size={20} />} title="Add a subject">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = actions.addSubject(name.trim(), icon, theme);
          setModal(null);
          nav(`/learn/${id}`);
        }}
      >
        <label className="field">
          <span>Name</span>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operating Systems" />
        </label>
        <div className="field">
          <span>Icon</span>
          <div className="picker">
            {iconChoices.map((ic) => (
              <button type="button" key={ic} className={`pick ${icon === ic ? 'on' : ''}`} onClick={() => setIcon(ic)}>
                <SubjectGlyph icon={ic} size={20} />
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Color</span>
          <div className="picker">
            {themeChoices.map((t) => (
              <button type="button" key={t} className={`pick swatch t-${t} ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)} aria-label={t} />
            ))}
          </div>
        </div>
        <div className="preview-row">
          <SubjectTile icon={icon} theme={theme} />
          <strong>{name || 'New subject'}</strong>
        </div>
        <button className="btn btn-dark" disabled={!name.trim()}>
          Create subject
        </button>
      </form>
    </Modal>
  );
}

export function WeakModal() {
  const { weakConcepts, actions, setModal } = useStore();
  const list = weakConcepts.slice(0, 8);
  return (
    <Modal
      width={620}
      onClose={() => setModal(null)}
      icon={<span className="tile tile-md t-pink"><Target size={20} /></span>}
      title="Your focus this week"
      subtitle="Lowest-mastery concepts from your learner model"
      footer={
        <button className="btn btn-pink" onClick={() => setModal({ type: 'quiz', adaptive: true, count: 5, conceptIds: list.slice(0, 4).map((c) => c.id), subjectId: list[0]?.subjectId })}>
          <ClipboardCheck size={16} /> Practice these
        </button>
      }
    >
      <ul className="weak-list">
        {list.map((c) => (
          <li key={c.id}>
            <span className="grow">
              <strong>{c.name}</strong>
              <span className="muted small">{c.source}</span>
            </span>
            <span className="weak-bar">
              <Progress value={c.mastery * 100} height={7} theme={c.mastery < 0.45 ? 'pink' : 'yellow'} />
              <span className="small">{Math.round(c.mastery * 100)}%</span>
            </span>
            {c.lessonId && (
              <button className="btn btn-light btn-sm" onClick={() => actions.openLesson(c.subjectId, c.lessonId!)}>
                Review
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function QuizHistoryModal() {
  const { state, stats, setModal } = useStore();
  const list = [...state.quizHistory].reverse();
  return (
    <Modal
      width={600}
      onClose={() => setModal(null)}
      icon={<span className="tile tile-md t-pink"><ClipboardCheck size={20} /></span>}
      title="Quizzes completed"
      subtitle={`${stats.quizzes} quizzes · ${stats.avgScore}% average`}
      footer={
        <button className="btn btn-dark" onClick={() => setModal({ type: 'quiz', adaptive: true })}>
          <Plus size={16} /> Start a new quiz
        </button>
      }
    >
      <ul className="history">
        {list.map((h) => {
          const s = state.subjects.find((x) => x.id === h.subjectId);
          const p = Math.round((h.score / h.total) * 100);
          return (
            <li key={h.id}>
              <span className="grow">
                <strong>{s?.name ?? 'Mixed'}</strong>
                <span className="muted small"> · {timeAgo(h.at)}</span>
              </span>
              <span className="weak-bar">
                <Progress value={p} height={7} theme={p >= 80 ? 'green' : p >= 60 ? 'yellow' : 'pink'} />
                <span className="small">
                  {h.score}/{h.total}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function SettingsModal() {
  const { state, actions, setModal, toast } = useStore();
  const [name, setName] = useState(state.userName);
  return (
    <Modal width={520} onClose={() => setModal(null)} icon={<Settings size={20} />} title="Profile & Settings">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) actions.setUserName(name.trim());
          toast('Settings saved');
          setModal(null);
        }}
      >
        <label className="field">
          <span>Display name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Default AI Tutor mode</span>
          <select className="input" value={state.tutorMode} onChange={(e) => actions.setTutorMode(e.target.value)}>
            {modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="row-end">
          <button type="button" className="btn btn-light danger" onClick={() => { actions.reset(); setModal(null); }}>
            Reset demo data
          </button>
          <button className="btn btn-dark">Save</button>
        </div>
      </form>
    </Modal>
  );
}

export function FlowMapModal({ subjectId }: { subjectId: string }) {
  const { state, actions, setModal } = useStore();
  const s = state.subjects.find((x) => x.id === subjectId);
  if (!s) return null;
  return (
    <Modal width={980} onClose={() => setModal(null)} icon={<Workflow size={22} />} title={`${s.name} — Course Flow`} subtitle="Topics in prerequisite order. Click a lesson to open it.">
      <div className="flow">
        {s.modules.map((m, i) => {
          const p = moduleProgress(m);
          return (
            <div key={m.id} className="flow-col">
              {i > 0 && (
                <span className="flow-arrow">
                  <ArrowRight size={18} />
                </span>
              )}
              <div className={`flow-node ${p >= 100 ? 'done' : p > 0 ? 'progress' : 'todo'}`}>
                <span className="flow-n">{i + 1}</span>
                <strong>{m.title}</strong>
                <Progress value={p} height={6} />
                <span className="muted small">{p}% · {m.lessons.length} lessons</span>
                <ul>
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <button onClick={() => actions.openLesson(s.id, l.id)}>
                        <i className={l.progress >= 100 ? 'g' : l.progress > 0 ? 'y' : 'n'}>{l.progress >= 100 && <Check size={9} strokeWidth={4} />}</i>
                        {l.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function ProgressModal() {
  const { state, stats, setModal } = useStore();
  const nav = useNavigate();
  return (
    <Modal width={600} onClose={() => setModal(null)} icon={<span className="tile tile-md t-blue"><ChartColumnIncreasing size={20} /></span>} title="Overall Progress" subtitle={`${stats.overall}% across ${state.subjects.length} subjects`}>
      <ul className="manage-list">
        {state.subjects.map((s) => {
          const p = subjectProgress(s);
          return (
            <li key={s.id} className="clickable" onClick={() => { setModal(null); nav(`/learn/${s.id}`); }}>
              <SubjectTile icon={s.icon} theme={s.theme} size="sm" />
              <span className="grow">
                <strong>{s.name}</strong>
                <Progress value={p} height={7} theme={s.theme} />
              </span>
              <strong>{p}%</strong>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function PathModal() {
  const { state, weakConcepts, actions, setModal } = useStore();
  const weak = weakConcepts.slice(0, 4);
  const steps = [
    { title: 'Adaptive Quiz', text: 'Diagnose what you know.', icon: <Target size={18} /> },
    { title: 'Personalized Learning', text: `Focus on ${weak[0]?.name ?? 'your weakest topic'} first.`, icon: <Sparkles size={18} /> },
    { title: 'Weak Topic Lessons', text: 'Short lessons for each gap.', icon: <BookOpen size={18} /> },
    { title: 'Practice & Improve', text: 'Spaced practice until mastery ≥ 80%.', icon: <Layers size={18} /> },
  ];
  if (!state.personalizedUnlocked)
    return (
      <Modal width={520} onClose={() => setModal(null)} title="Personalized Learning" icon={<Target size={20} />}>
        <p>Complete one adaptive quiz to unlock your path.</p>
        <button className="btn btn-dark" onClick={() => setModal({ type: 'quiz', adaptive: true, count: 5 })}>
          Start adaptive quiz
        </button>
      </Modal>
    );
  return (
    <Modal width={720} onClose={() => setModal(null)} icon={<span className="tile tile-md t-pink"><Sparkles size={20} /></span>} title="Your Learning Path" subtitle="Built from your learner model — updates after every quiz.">
      <ol className="path-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={i <= state.pathStep ? 'done' : i === state.pathStep + 1 ? 'next' : ''}>
            <span className="ps-icon">{i <= state.pathStep ? <Check size={16} /> : s.icon}</span>
            <div className="grow">
              <strong>{s.title}</strong>
              <span className="muted small">{s.text}</span>
            </div>
            {i === state.pathStep + 1 && (
              <button className="btn btn-dark btn-sm" onClick={() => actions.setPathStep(i)}>
                Mark done
              </button>
            )}
          </li>
        ))}
      </ol>
      <span className="small-label">Recommended for you</span>
      <ul className="weak-list">
        {weak.map((c) => (
          <li key={c.id}>
            <span className="grow">
              <strong>{c.name}</strong>
              <span className="muted small">{c.summary}</span>
            </span>
            <span className="weak-bar">
              <Progress value={c.mastery * 100} height={7} theme={c.mastery < 0.45 ? 'pink' : 'yellow'} />
              <span className="small">{Math.round(c.mastery * 100)}%</span>
            </span>
            {c.lessonId && (
              <button className="btn btn-light btn-sm" onClick={() => actions.openLesson(c.subjectId, c.lessonId!)}>
                Learn
              </button>
            )}
            <button className="btn btn-light btn-sm" onClick={() => setModal({ type: 'quiz', subjectId: c.subjectId, conceptIds: [c.id], count: 3 })}>
              Practice
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
