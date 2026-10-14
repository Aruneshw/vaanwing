import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  NotebookPen,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';
import { Modal, Progress } from '../components/ui';
import { SubjectTile } from '../components/Icons';
import { concepts } from '../data';
import { findLesson, lessonsOf, useStore } from '../store';

function pageCount(meta: string) {
  const m = meta.match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? Math.max(1, Number(m[2]) - Number(m[1]) + 1) : 6;
}

export default function LessonViewer({ subjectId, lessonId }: { subjectId: string; lessonId: string }) {
  const { state, actions, setModal, goTutorWith } = useStore();
  const nav = useNavigate();
  const found = findLesson(state.subjects, subjectId, lessonId);
  const [playing, setPlaying] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const progressRef = useRef(found?.lesson.progress ?? 0);
  progressRef.current = found?.lesson.progress ?? 0;

  const total = found ? pageCount(found.lesson.meta) : 1;
  const [page, setPage] = useState(() => (found ? Math.max(1, Math.round((found.lesson.progress / 100) * total)) : 1));

  useEffect(() => {
    setPlaying(false);
    setNoteOpen(false);
    if (found) setPage(Math.max(1, Math.round((found.lesson.progress / 100) * pageCount(found.lesson.meta))));
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulated playback: watching advances the lesson progress.
  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      const next = Math.min(100, progressRef.current + 2);
      actions.setProgress(subjectId, lessonId, next);
      if (next >= 100) setPlaying(false);
    }, 300);
    return () => window.clearInterval(t);
  }, [playing, subjectId, lessonId, actions]);

  if (!found) return null;
  const { subject, module, lesson } = found;
  const all = lessonsOf(subject);
  const idx = all.findIndex((l) => l.id === lesson.id);
  const prev = all[idx - 1];
  const next = all[idx + 1];
  const done = lesson.progress >= 100;
  const lessonConcepts = concepts.filter((c) => lesson.concepts.includes(c.id));
  const close = () => setModal(null);

  const goPage = (p: number) => {
    const np = Math.max(1, Math.min(total, p));
    setPage(np);
    actions.setProgress(subjectId, lessonId, Math.max(lesson.progress, Math.round((np / total) * 100)));
  };

  return (
    <Modal
      width={860}
      onClose={close}
      icon={<SubjectTile icon={subject.icon} theme={subject.theme} />}
      title={lesson.title}
      subtitle={
        <>
          {subject.name} · {module.title} · <span className="muted">{lesson.source}</span>
        </>
      }
      footer={
        <>
          <button className="btn btn-light" disabled={!prev} onClick={() => prev && actions.openLesson(subjectId, prev.id)}>
            <ArrowLeft size={16} /> Previous
          </button>
          <span className="grow" />
          <button className={`btn ${done ? 'btn-success' : 'btn-light'}`} onClick={() => actions.toggleComplete(subjectId, lessonId)}>
            <Check size={16} /> {done ? 'Completed' : 'Mark complete'}
          </button>
          <button className="btn btn-dark" disabled={!next} onClick={() => next && actions.openLesson(subjectId, next.id)}>
            Next lesson <ArrowRight size={16} />
          </button>
        </>
      }
    >
      <div className={`viewer viewer-${lesson.type}`}>
        {lesson.type === 'video' ? (
          <div className="player">
            <span className="blob b1" />
            <span className="blob b2" />
            <span className="blob b3" />
            <div className="player-caption">
              <span className="chip t-blue">{lesson.meta}</span>
              <strong>{lesson.title}</strong>
            </div>
            <button className="big-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <div
              className="scrub"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                actions.setProgress(subjectId, lessonId, ((e.clientX - r.left) / r.width) * 100);
              }}
            >
              <div className="scrub-fill" style={{ width: `${lesson.progress}%` }} />
            </div>
          </div>
        ) : lesson.type === 'notes' ? (
          <div className="doc-page notes-page">
            <FileText size={20} />
            <p>{lesson.content}</p>
          </div>
        ) : (
          <div className={`doc-page ${lesson.type}`}>
            <div className="doc-top">
              <span className="muted small">
                {lesson.type === 'pdf' ? 'Page' : 'Slide'} {page} of {total}
              </span>
            </div>
            <h3>{lesson.title}</h3>
            <div className="doc-lines">
              {Array.from({ length: lesson.type === 'slides' ? 3 : 7 }, (_, i) => (
                <span key={i} style={{ width: `${60 + ((i * 37 + page * 13) % 38)}%` }} />
              ))}
            </div>
            <div className="doc-nav">
              <button className="icon-btn soft" onClick={() => goPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
                <ChevronLeft size={18} />
              </button>
              <button className="icon-btn soft" onClick={() => goPage(page + 1)} disabled={page >= total} aria-label="Next page">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="viewer-progress">
          <Progress value={lesson.progress} height={9} />
          <strong>{lesson.progress}%</strong>
        </div>

        <p className="viewer-text">{lesson.content}</p>

        {lessonConcepts.length > 0 && (
          <div className="viewer-concepts">
            <span className="small-label">Key concepts</span>
            <div className="chip-row">
              {lessonConcepts.map((c) => (
                <span key={c.id} className="chip t-purple">
                  {c.name} · {Math.round((state.mastery[c.id] ?? 0.3) * 100)}%
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="viewer-actions">
          <button className={`btn btn-light btn-sm ${lesson.bookmarked ? 'on' : ''}`} onClick={() => actions.toggleBookmark(subjectId, lessonId)}>
            <Bookmark size={15} fill={lesson.bookmarked ? 'currentColor' : 'none'} /> {lesson.bookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button className="btn btn-light btn-sm" onClick={() => setNoteOpen((o) => !o)}>
            <NotebookPen size={15} /> Add note
          </button>
          <button
            className="btn btn-light btn-sm"
            onClick={() => {
              goTutorWith(`Explain ${lesson.title}`);
              setModal(null);
              nav('/tutor');
            }}
          >
            <Sparkles size={15} /> Ask AI Tutor
          </button>
          <button
            className="btn btn-light btn-sm"
            onClick={() => setModal({ type: 'quiz', subjectId, conceptIds: lesson.concepts.length ? lesson.concepts : undefined, count: 3 })}
          >
            <ClipboardCheck size={15} /> Practice
          </button>
        </div>

        {noteOpen && (
          <form
            className="inline-note"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              actions.addNote({ subjectId, lessonId, title: lesson.title, body: note.trim() });
              setNote('');
              setNoteOpen(false);
            }}
          >
            <textarea className="input" rows={3} autoFocus placeholder="What did you learn?" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-dark btn-sm" disabled={!note.trim()}>
              Save note
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
