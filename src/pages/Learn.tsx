import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  ChartColumnIncreasing,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  NotebookText,
  Play,
  Plus,
  Search,
  Sparkles,
  Workflow,
  Zap,
  ClipboardCheck,
  Trash,
} from 'lucide-react';
import { concepts, type Lesson, type LessonType, type Theme } from '../data';
import { lessonsOf, moduleProgress, subjectProgress, timeAgo, useStore } from '../store';
import { SubjectTile } from '../components/Icons';
import { Empty, Progress, useClickOutside } from '../components/ui';

const numberThemes: Theme[] = ['blue', 'yellow', 'coral', 'green', 'purple', 'pink'];
type Tab = 'topics' | 'concepts' | 'notes' | 'bookmarks';
type Sort = 'course' | 'progress-asc' | 'progress-desc' | 'az';
const sortLabels: Record<Sort, string> = {
  course: 'Course Order',
  'progress-asc': 'Least Progress',
  'progress-desc': 'Most Progress',
  az: 'A – Z',
};

export function LessonIcon({ type }: { type: LessonType }) {
  if (type === 'video')
    return (
      <span className="lesson-ic video">
        <Play size={11} fill="currentColor" />
      </span>
    );
  return (
    <span className={`lesson-ic ${type}`}>
      <FileText size={20} />
    </span>
  );
}

export default function Learn() {
  const { subjectId } = useParams();
  const nav = useNavigate();
  const { state, actions, setModal, weakConcepts, goTutorWith } = useStore();
  const subject = state.subjects.find((s) => s.id === subjectId) ?? state.subjects[0];
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('topics');
  const [sort, setSort] = useState<Sort>('course');
  const [sortOpen, setSortOpen] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set([subject.modules[0]?.id]));
  const sortRef = useRef<HTMLDivElement>(null);
  useClickOutside(sortRef, useCallback(() => setSortOpen(false), []), sortOpen);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  useEffect(() => {
    setOpen(new Set([subject.modules[0]?.id]));
    setQuery('');
  }, [subject.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allLessons = lessonsOf(subject);
  const progress = subjectProgress(subject);
  const completed = allLessons.filter((l) => l.progress >= 100).length;
  const inProgress = allLessons.filter((l) => l.progress > 0 && l.progress < 100).length;
  const notStarted = allLessons.length - completed - inProgress;

  const current = useMemo(() => {
    if (state.lastLesson.subjectId === subject.id) {
      const l = allLessons.find((x) => x.id === state.lastLesson.lessonId);
      if (l) return l;
    }
    return allLessons.find((l) => l.progress > 0 && l.progress < 100) ?? allLessons.find((l) => l.progress < 100) ?? allLessons[0];
  }, [state.lastLesson, subject, allLessons]);
  const currentModule = subject.modules.find((m) => m.lessons.some((l) => l.id === current?.id));

  const q = query.trim().toLowerCase();
  const modules = useMemo(() => {
    let ms = subject.modules.map((m, i) => ({
      ...m,
      n: i + 1,
      lessons: q ? m.lessons.filter((l) => l.title.toLowerCase().includes(q) || m.title.toLowerCase().includes(q)) : m.lessons,
    }));
    if (q) ms = ms.filter((m) => m.lessons.length);
    if (sort === 'progress-asc') ms = [...ms].sort((a, b) => moduleProgress(a) - moduleProgress(b));
    if (sort === 'progress-desc') ms = [...ms].sort((a, b) => moduleProgress(b) - moduleProgress(a));
    if (sort === 'az') ms = [...ms].sort((a, b) => a.title.localeCompare(b.title));
    return ms;
  }, [subject, q, sort]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const subjectConcepts = concepts
    .filter((c) => c.subjectId === subject.id && (!q || c.name.toLowerCase().includes(q)))
    .map((c) => ({ ...c, mastery: state.mastery[c.id] ?? 0.3 }));
  const subjectNotes = state.notes.filter((n) => n.subjectId === subject.id && (!q || (n.title + n.body).toLowerCase().includes(q)));
  const bookmarks = allLessons.filter((l) => l.bookmarked && (!q || l.title.toLowerCase().includes(q)));

  const status = (p: number) => (p >= 100 ? 'done' : p > 0 ? 'progress' : 'todo');
  const weakForSubject = weakConcepts.filter((c) => c.subjectId === subject.id);

  return (
    <main className="page learn">
      {/* SIDEBAR */}
      <aside className="card glass learn-side">
        <div className="side-head">
          <h3>Your Subjects</h3>
          <button className="icon-btn soft" aria-label="Add subject" onClick={() => setModal({ type: 'addSubject' })}>
            <Plus size={18} />
          </button>
        </div>
        <div className="side-list">
          {state.subjects.map((s) => {
            const p = subjectProgress(s);
            return (
              <button key={s.id} className={`side-item ${s.id === subject.id ? 'active' : ''}`} onClick={() => nav(`/learn/${s.id}`)}>
                <SubjectTile icon={s.icon} theme={s.theme} />
                <span className="side-info">
                  <span className="side-name">{s.name}</span>
                  <span className="side-bar">
                    <Progress value={p} theme={s.theme} height={7} />
                    <span>{p}%</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER */}
      <section className="learn-main">
        <div className="learn-title">
          <div>
            <h1>{subject.name}</h1>
            <p>Explore topics, track your progress, and continue where you left off.</p>
          </div>
          <label className="search-box">
            <Search size={20} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search topics, concepts..." />
          </label>
        </div>

        {current && (
          <div className="card glass resume-banner">
            <span className="banner-blob" />
            <span className="banner-blob two" />
            <span className="tile tile-xxl t-blue">
              <BookOpen size={34} fill="currentColor" strokeWidth={1.4} />
            </span>
            <div className="resume-info">
              <span className="small-label">Continue Learning</span>
              <h3>{current.title}</h3>
              <span className="muted small">Last watched • {state.lastLesson.lessonId === current.id ? '12 min ago' : 'not started yet'}</span>
              <div className="progress-line">
                <Progress value={current.progress} height={10} />
                <strong>{current.progress}%</strong>
              </div>
            </div>
            <button className="btn btn-dark btn-lg" onClick={() => actions.openLesson(subject.id, current.id)}>
              Resume <ArrowRight size={18} />
            </button>
          </div>
        )}

        <div className="tabs-row">
          <div className="seg">
            {(
              [
                ['topics', 'All Topics'],
                ['concepts', 'Concepts'],
                ['notes', 'Notes'],
                ['bookmarks', 'Bookmarks'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} className={`seg-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="dropdown-wrap" ref={sortRef}>
            <button className="sort-btn" onClick={() => setSortOpen((o) => !o)}>
              Sort by: <span>{sortLabels[sort]}</span> <ChevronDown size={16} />
            </button>
            {sortOpen && (
              <div className="dropdown sort-menu">
                {(Object.keys(sortLabels) as Sort[]).map((k) => (
                  <button
                    key={k}
                    className={`menu-item ${sort === k ? 'selected' : ''}`}
                    onClick={() => {
                      setSort(k);
                      setSortOpen(false);
                    }}
                  >
                    {sortLabels[k]} {sort === k && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {tab === 'topics' && (
          <div className="module-list">
            {modules.length === 0 && <Empty>No topics match “{query}”.</Empty>}
            {modules.map((m) => {
              const p = moduleProgress(m);
              const isOpen = open.has(m.id) || !!q;
              return (
                <div key={m.id} className={`card glass module ${isOpen ? 'open' : ''}`} id={`module-${m.id}`}>
                  <button className="module-head" onClick={() => toggle(m.id)}>
                    <span className={`num t-${numberThemes[(m.n - 1) % numberThemes.length]}`}>{m.n}</span>
                    <span className="module-title">
                      {m.title}
                      {isOpen && <ChevronUp size={16} />}
                    </span>
                    <span className="module-prog">
                      <Progress value={p} height={9} theme={p < 25 ? 'purple' : 'green'} />
                      <span>{p}%</span>
                    </span>
                    {p >= 100 ? (
                      <span className="check-dot">
                        <Check size={13} strokeWidth={3.5} />
                      </span>
                    ) : (
                      <span className="round-chev small">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                    )}
                  </button>
                  {isOpen && (
                    <ul className="lesson-list">
                      {m.lessons.map((l, i) => (
                        <LessonRow
                          key={l.id}
                          lesson={l}
                          label={`${m.n}.${subject.modules.find((x) => x.id === m.id)!.lessons.indexOf(l) + 1 || i + 1}`}
                          onOpen={() => actions.openLesson(subject.id, l.id)}
                          onToggle={() => actions.toggleComplete(subject.id, l.id)}
                          onBookmark={() => actions.toggleBookmark(subject.id, l.id)}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'concepts' && (
          <div className="concept-grid">
            {subjectConcepts.length === 0 && <Empty>No concepts yet — add sources in AI Tutor to extract them.</Empty>}
            {subjectConcepts.map((c) => (
              <div key={c.id} className="card glass concept">
                <div className="concept-top">
                  <strong>{c.name}</strong>
                  <span className={`mastery-tag ${c.mastery < 0.45 ? 'low' : c.mastery < 0.7 ? 'mid' : 'high'}`}>{Math.round(c.mastery * 100)}% mastery</span>
                </div>
                <p>{c.summary}</p>
                <Progress value={c.mastery * 100} height={7} theme={c.mastery < 0.45 ? 'pink' : c.mastery < 0.7 ? 'yellow' : 'green'} />
                <span className="source-line">
                  <FileText size={13} /> {c.source}
                </span>
                <div className="concept-actions">
                  <button
                    className="btn btn-light btn-sm"
                    onClick={() => {
                      goTutorWith(`Explain ${c.name}`);
                      nav('/tutor');
                    }}
                  >
                    <Sparkles size={14} /> Ask AI Tutor
                  </button>
                  <button className="btn btn-light btn-sm" onClick={() => setModal({ type: 'quiz', subjectId: subject.id, conceptIds: [c.id], count: 3 })}>
                    <ClipboardCheck size={14} /> Practice
                  </button>
                  {c.lessonId && (
                    <button className="btn btn-light btn-sm" onClick={() => actions.openLesson(subject.id, c.lessonId!)}>
                      <BookOpen size={14} /> Lesson
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'notes' && (
          <div className="notes-tab">
            <form
              className="card glass note-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!noteTitle.trim()) return;
                actions.addNote({ subjectId: subject.id, title: noteTitle.trim(), body: noteBody.trim() });
                setNoteTitle('');
                setNoteBody('');
              }}
            >
              <input className="input" placeholder="Note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              <textarea className="input" rows={3} placeholder={`Write a note about ${subject.name}…`} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <button className="btn btn-dark btn-sm" type="submit" disabled={!noteTitle.trim()}>
                <Plus size={15} /> Add note
              </button>
            </form>
            {subjectNotes.length === 0 && <Empty>No notes for {subject.name} yet.</Empty>}
            {subjectNotes.map((n) => (
              <div key={n.id} className="card glass note-card">
                <div className="note-top">
                  <strong>{n.title}</strong>
                  <span className="muted small">{timeAgo(n.createdAt)}</span>
                  <button className="icon-btn ghost sm" aria-label="Delete note" onClick={() => actions.deleteNote(n.id)}>
                    <Trash size={15} />
                  </button>
                </div>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'bookmarks' && (
          <div className="card glass module open">
            {bookmarks.length === 0 ? (
              <Empty>
                No bookmarks yet. Tap the <Bookmark size={14} /> icon on any lesson to save it here.
              </Empty>
            ) : (
              <ul className="lesson-list">
                {bookmarks.map((l) => (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    label=""
                    onOpen={() => actions.openLesson(subject.id, l.id)}
                    onToggle={() => actions.toggleComplete(subject.id, l.id)}
                    onBookmark={() => actions.toggleBookmark(subject.id, l.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* RIGHT */}
      <aside className="learn-right">
        <div className="card glass subj-progress">
          <div className="card-head">
            <span className="head-icon blue">
              <ChartColumnIncreasing size={24} strokeWidth={2.4} />
            </span>
            <h3>Subject Progress</h3>
          </div>
          <div className="sp-row">
            <Progress value={progress} height={14} />
            <div className="sp-val">
              <strong>{progress}%</strong>
              <span>
                {completed} / {allLessons.length} topics completed
              </span>
            </div>
          </div>
          <div className="sp-stats">
            <div>
              <span>
                <i className="dot-g" /> Completed
              </span>
              <strong>{completed}</strong>
            </div>
            <div>
              <span>
                <i className="dot-y" /> In Progress
              </span>
              <strong>{inProgress}</strong>
            </div>
            <div>
              <span>
                <i className="dot-n" /> Not Started
              </span>
              <strong>{notStarted}</strong>
            </div>
          </div>
        </div>

        <div className="card glass topic-map">
          <div className="card-head">
            <Workflow size={26} />
            <h3>Topic Map</h3>
            <button className="chev-btn" aria-label="Open course flow map" onClick={() => setModal({ type: 'flowmap', subjectId: subject.id })}>
              <ChevronRight size={18} />
            </button>
          </div>
          <ul className="tmap">
            {subject.modules.map((m) => {
              const p = moduleProgress(m);
              const isCurrent = m.id === currentModule?.id && p < 100;
              return (
                <li key={m.id}>
                  <button
                    className={`tmap-item ${status(p)} ${isCurrent ? 'current' : ''}`}
                    onClick={() => {
                      setTab('topics');
                      setQuery('');
                      setOpen((s) => new Set(s).add(m.id));
                      setTimeout(() => document.getElementById(`module-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                    }}
                  >
                    <span className="tmap-dot">{p >= 100 && <Check size={11} strokeWidth={4} />}</span>
                    {m.title}
                  </button>
                  {isCurrent && (
                    <ul className="tmap-sub">
                      {m.lessons.slice(0, 4).map((l) => (
                        <li key={l.id}>
                          <button className={`tmap-item sub ${status(l.progress)}`} onClick={() => actions.openLesson(subject.id, l.id)}>
                            <span className="tmap-dot">{l.progress >= 100 && <Check size={10} strokeWidth={4} />}</span>
                            {l.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card glass quick-actions">
          <div className="card-head">
            <Zap size={26} fill="#8fb4e3" color="#8fb4e3" />
            <h3>Quick Actions</h3>
          </div>
          <button className="qa t-pink" onClick={() => setModal({ type: 'quiz', subjectId: subject.id, count: 5, adaptive: true })}>
            <span className="tile tile-md t-pink white-in">
              <ClipboardCheck size={20} />
            </span>
            <span className="qa-text">
              <strong>Take a Quiz</strong>
              <span>Test your understanding</span>
            </span>
            <span className="round-chev">
              <ChevronRight size={17} />
            </span>
          </button>
          <button
            className="qa t-yellow"
            onClick={() =>
              weakForSubject.length
                ? setModal({ type: 'quiz', subjectId: subject.id, conceptIds: weakForSubject.slice(0, 3).map((c) => c.id), count: 5 })
                : setModal({ type: 'weak' })
            }
          >
            <span className="tile tile-md t-yellow white-in">
              <NotebookText size={20} />
            </span>
            <span className="qa-text">
              <strong>Revise Weak Topics</strong>
              <span>Based on your recent activity</span>
            </span>
            <span className="round-chev">
              <ChevronRight size={17} />
            </span>
          </button>
          <button className="qa t-blue" onClick={() => setModal({ type: 'notes', subjectId: subject.id })}>
            <span className="tile tile-md t-blue white-in">
              <FileText size={20} />
            </span>
            <span className="qa-text">
              <strong>View Notes</strong>
              <span>All your saved notes</span>
            </span>
            <span className="round-chev">
              <ChevronRight size={17} />
            </span>
          </button>
        </div>
      </aside>
    </main>
  );
}

function LessonRow({
  lesson,
  label,
  onOpen,
  onToggle,
  onBookmark,
}: {
  lesson: Lesson;
  label: string;
  onOpen: () => void;
  onToggle: () => void;
  onBookmark: () => void;
}) {
  const done = lesson.progress >= 100;
  return (
    <li className="lesson-row" onClick={onOpen}>
      <LessonIcon type={lesson.type} />
      <span className="lesson-title">
        {label && <span className="lesson-num">{label}</span>}
        {lesson.title}
      </span>
      <span className="lesson-meta">{lesson.meta}</span>
      <button
        className={`bm-btn ${lesson.bookmarked ? 'on' : ''}`}
        aria-label="Bookmark"
        onClick={(e) => {
          e.stopPropagation();
          onBookmark();
        }}
      >
        <Bookmark size={15} fill={lesson.bookmarked ? 'currentColor' : 'none'} />
      </button>
      <button
        className={`lesson-check ${done ? 'done' : lesson.progress > 0 ? 'partial' : ''}`}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        title={done ? 'Mark as not done' : 'Mark as done'}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {done ? <Check size={12} strokeWidth={3.5} /> : lesson.progress > 0 ? <span className="partial-ring" style={{ ['--p' as string]: `${lesson.progress}%` }} /> : null}
      </button>
    </li>
  );
}
