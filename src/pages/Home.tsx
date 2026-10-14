import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChartColumnIncreasing,
  ChevronRight,
  CircleCheck,
  Clock,
  FileText,
  List,
  NotebookText,
  Play,
  Sparkles,
  Star,
  Target,
  BookMarked,
  ClipboardCheck,
  NotebookPen,
  Check,
} from 'lucide-react';
import { findLesson, nextLesson, subjectProgress, timeAgo, useStore, type ActivityKind } from '../store';
import { MiniBars, Progress, Sparkline } from '../components/ui';
import { SubjectGlyph } from '../components/Icons';
import type { Theme } from '../data';

const themeHex: Record<Theme, string> = {
  blue: '#9cc3e6',
  yellow: '#f5d27a',
  coral: '#f4a892',
  green: '#93ccaa',
  purple: '#c8b2ec',
  pink: '#f1a1b3',
};

function Donut({ segments, value }: { segments: { value: number; color: string }[]; value: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const n = segments.length;
  const slot = c / n;
  const gap = 6;
  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#ece8e2" strokeWidth="12" />
        {segments.map((s, i) => {
          const len = Math.max(2, (slot - gap) * (s.value / 100));
          return (
            <circle
              key={i}
              cx="90"
              cy="90"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-(i * slot) + c / 4}
              className="donut-seg"
            />
          );
        })}
      </svg>
      <div className="donut-label">
        <strong>{value}%</strong>
        <span>Completed</span>
      </div>
    </div>
  );
}

const activityIcon: Record<ActivityKind, { el: ReactNode; cls: string }> = {
  complete: { el: <Check size={12} strokeWidth={3.5} />, cls: 'ai-green' },
  quiz: { el: <ClipboardCheck size={13} />, cls: 'ai-purple' },
  review: { el: <BookOpen size={14} />, cls: 'ai-pink' },
  note: { el: <NotebookPen size={13} />, cls: 'ai-yellow' },
  upload: { el: <FileText size={13} />, cls: 'ai-blue' },
  chat: { el: <Sparkles size={13} />, cls: 'ai-blue' },
};

export function ActivityRow({ kind, text, at }: { kind: ActivityKind; text: string; at: number }) {
  const ic = activityIcon[kind];
  return (
    <li className="activity-row">
      <span className={`act-icon ${ic.cls}`}>{ic.el}</span>
      <span className="act-text">{text}</span>
      <span className="act-time">{timeAgo(at)}</span>
    </li>
  );
}

export default function Home() {
  const { state, stats, weakConcepts, actions, setModal } = useStore();
  const nav = useNavigate();
  const last = findLesson(state.subjects, state.lastLesson.subjectId, state.lastLesson.lessonId);
  const next = last ? nextLesson(state.subjects, last.subject.id, last.lesson.id) : null;
  const focus = weakConcepts[0];
  const focusLesson = focus?.lessonId ? findLesson(state.subjects, focus.subjectId, focus.lessonId) : null;
  const top4 = state.subjects.slice(0, 4);
  const donutSubjects = [...state.subjects].sort((a, b) => subjectProgress(b) - subjectProgress(a)).slice(0, 4);
  const weekDots = 5;
  const filledDots = Math.min(weekDots, Math.max(0, state.streak - 2));

  // Recommended "Decision Trees"-style lesson: the next unfinished lesson in the current module
  const recLesson = next ?? (last ? last.lesson : null);

  return (
    <main className="page home">
      {/* HERO + top cards */}
      <section className="home-top">
        <div className="hero">
          <span className="badge-soft">
            <Sparkles size={17} /> Your Personal Learning Space
          </span>
          <h1>
            Learn Smarter,
            <br />
            <span className="accent">One Step at a Time.</span>
          </h1>
          <p className="lead">
            Track your progress, continue learning, and get
            <br className="hide-sm" /> personalized guidance — all in one place.
          </p>
          <div className="hero-actions">
            <button className="btn btn-dark btn-lg" onClick={() => last && actions.openLesson(last.subject.id, last.lesson.id)}>
              Continue Learning <ArrowRight size={18} />
            </button>
            <button className="btn btn-light btn-lg" onClick={() => setModal({ type: 'demo' })}>
              <span className="play-dot">
                <Play size={10} fill="currentColor" />
              </span>
              Watch Demo
            </button>
          </div>
        </div>

        <div className="card glass progress-card clickable" onClick={() => setModal({ type: 'progress' })}>
          <div className="card-head">
            <span className="head-icon blue">
              <ChartColumnIncreasing size={24} strokeWidth={2.4} />
            </span>
            <h3>Overall Progress</h3>
            <button className="chev-btn" aria-label="Open progress details">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="progress-body">
            <Donut value={stats.overall} segments={donutSubjects.map((s) => ({ value: subjectProgress(s), color: themeHex[s.theme] }))} />
            <ul className="legend">
              {donutSubjects.map((s) => (
                <li
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    nav(`/learn/${s.id}`);
                  }}
                >
                  <span className="legend-dot" style={{ background: themeHex[s.theme] }} />
                  <span className="legend-name">{s.name}</span>
                  <span className="legend-val">{subjectProgress(s)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card glass week-card clickable" onClick={() => setModal({ type: 'week' })}>
          <div className="card-head">
            <span className="head-icon blue">
              <CalendarDays size={22} />
            </span>
            <h3>This Week</h3>
            <button className="chev-btn" aria-label="Open weekly stats">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="week-row">
            <span className="tile tile-lg t-green">
              <CircleCheck size={24} />
            </span>
            <div className="week-stat">
              <strong>{stats.weekHours} hrs</strong>
              <span>Study time</span>
            </div>
            <span className={`delta ${stats.weekDelta < 0 ? 'down' : ''}`}>
              <ArrowUpRight size={15} /> {stats.weekDelta >= 0 ? '+' : ''}
              {stats.weekDelta}%
            </span>
          </div>
          <div className="week-row">
            <span className="tile tile-lg t-pink">
              <Target size={24} />
            </span>
            <div className="week-stat">
              <strong>{state.streak} days</strong>
              <span>Current streak</span>
            </div>
            <span className="streak-dots">
              {Array.from({ length: weekDots }, (_, i) => (
                <i key={i} className={i < filledDots ? 'on' : ''} />
              ))}
            </span>
          </div>
        </div>
      </section>

      {/* STAT CARDS */}
      <section className="stat-row">
        <button className="card glass stat" onClick={() => nav('/learn')}>
          <span className="tile tile-lg t-blue">
            <BookOpen size={24} fill="currentColor" strokeWidth={1.5} />
          </span>
          <div className="stat-text">
            <strong>{stats.mastered}</strong>
            <span>Topics mastered</span>
          </div>
          <MiniBars theme="blue" values={[3, 4, 5, 6, 8, 11]} />
        </button>
        <button className="card glass stat" onClick={() => setModal({ type: 'notes' })}>
          <span className="tile tile-lg t-yellow">
            <NotebookText size={24} />
          </span>
          <div className="stat-text">
            <strong>{stats.notes}</strong>
            <span>Notes created</span>
          </div>
          <MiniBars theme="yellow" values={[2, 3, 5, 6, 8, 9]} />
        </button>
        <button className="card glass stat" onClick={() => setModal({ type: 'quizHistory' })}>
          <span className="tile tile-lg t-pink">
            <CircleCheck size={24} />
          </span>
          <div className="stat-text">
            <strong>{stats.quizzes}</strong>
            <span>Quizzes completed</span>
          </div>
          <MiniBars theme="pink" values={[2, 4, 3, 6, 5, 8]} />
        </button>
        <button className="card glass stat" onClick={() => setModal({ type: 'tool', tool: 'reports' })}>
          <span className="tile tile-lg t-purple">
            <Star size={24} fill="currentColor" />
          </span>
          <div className="stat-text">
            <strong>{stats.avgScore}%</strong>
            <span>Average score</span>
          </div>
          <Sparkline values={stats.scoreTrend.length > 2 ? stats.scoreTrend : [60, 70, 65, 80, 78, 90]} />
        </button>
      </section>

      {/* MIDDLE ROW */}
      <section className="home-mid">
        <div className="card glass continue-card">
          <div className="card-head">
            <span className="head-icon dark-circle">
              <Play size={14} fill="currentColor" />
            </span>
            <h3>Continue Learning</h3>
            <button className="link-btn" onClick={() => nav(`/learn/${state.lastLesson.subjectId}`)}>
              View all <ArrowRight size={16} />
            </button>
          </div>
          {last ? (
            <div className="continue-body">
              <div className="thumb" onClick={() => actions.openLesson(last.subject.id, last.lesson.id)}>
                <span className="blob b1" />
                <span className="blob b2" />
                <span className="blob b3" />
                <span className="thumb-play">
                  <Play size={18} fill="currentColor" />
                </span>
              </div>
              <div className="continue-info">
                <span className={`chip t-${last.subject.theme === 'blue' ? 'green' : last.subject.theme}`}>{last.subject.name}</span>
                <h4>{last.lesson.title}</h4>
                <div className="progress-line">
                  <Progress value={last.lesson.progress} height={12} />
                  <strong>{last.lesson.progress}%</strong>
                </div>
                <div className="continue-foot">
                  <span className="next" onClick={() => next && actions.openLesson(last.subject.id, next.id)}>
                    <List size={18} /> Next: {next ? next.title : 'You’re at the end 🎉'}
                  </span>
                  <button className="btn btn-dark" onClick={() => actions.openLesson(last.subject.id, last.lesson.id)}>
                    Resume <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="muted">Pick a lesson in Learn to get started.</p>
          )}
        </div>

        <div className="card glass subjects-card">
          <div className="card-head">
            <span className="head-icon">
              <BookOpen size={24} fill="currentColor" strokeWidth={1.5} />
            </span>
            <h3>Your Subjects</h3>
            <button className="link-btn" onClick={() => setModal({ type: 'manageSubjects' })}>
              Manage <ArrowRight size={16} />
            </button>
          </div>
          <div className="subject-grid">
            {top4.map((s) => {
              const p = subjectProgress(s);
              return (
                <button key={s.id} className={`subject-tile t-${s.theme}`} onClick={() => nav(`/learn/${s.id}`)}>
                  <div className="st-head">
                    <span className="st-icon">
                      <SubjectGlyph icon={s.icon} size={26} />
                    </span>
                    <span>{s.name}</span>
                  </div>
                  <div className="st-foot">
                    <Progress value={p} theme={s.theme === 'yellow' ? 'olive' : 'green'} />
                    <span>{p}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mid-right">
          <div className="card glass focus-card">
            <div className="card-head">
              <span className="head-icon pink">
                <Target size={26} />
              </span>
              <h3>Your focus this week</h3>
              <button className="chev-btn plain" aria-label="All weak topics" onClick={() => setModal({ type: 'weak' })}>
                <ChevronRight size={18} />
              </button>
            </div>
            {focus && (
              <div className="focus-box">
                <span className="tile tile-xl white">
                  <FileText size={30} />
                </span>
                <div>
                  <span className="pill-tag">Needs attention</span>
                  <h4>{focus.name}</h4>
                  <p>A little revision here will help.</p>
                  <button
                    className="btn btn-pink btn-sm"
                    onClick={() => {
                      if (focusLesson) {
                        actions.logActivity('review', `Reviewed: ${focus.name}`);
                        actions.openLesson(focusLesson.subject.id, focusLesson.lesson.id);
                      } else setModal({ type: 'quiz', conceptIds: [focus.id] });
                    }}
                  >
                    Review topic <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card glass activity-card">
            <div className="card-head tight">
              <Clock size={22} strokeWidth={2.4} />
              <h3>Recent activity</h3>
              <button className="link-btn" onClick={() => setModal({ type: 'activity' })}>
                See all <ArrowRight size={15} />
              </button>
            </div>
            <ul className="activity-list">
              {state.activity.slice(0, 3).map((a) => (
                <ActivityRow key={a.id} {...a} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* RECOMMENDED */}
      <section className="card glass recommended">
        <div className="card-head tight">
          <Star size={22} fill="#f5c04e" color="#f5c04e" />
          <h3>Recommended next</h3>
        </div>
        <div className="rec-grid">
          <button className="rec t-blue" onClick={() => recLesson && last && actions.openLesson(last.subject.id, recLesson.id)}>
            <span className="tile tile-xl t-blue">
              <FileText size={28} />
            </span>
            <span className="rec-text">
              <strong>{recLesson?.title ?? 'Decision Trees'}</strong>
              <span>Understand how {recLesson?.title.toLowerCase() ?? 'decision trees'} work with simple examples.</span>
              <span className="rec-time">
                <Clock size={14} /> 12 min
              </span>
            </span>
            <span className="round-chev">
              <ChevronRight size={18} />
            </span>
          </button>
          <button className="rec t-yellow" onClick={() => setModal({ type: 'quiz', subjectId: state.lastLesson.subjectId, count: 5, adaptive: true })}>
            <span className="tile tile-xl t-yellow">
              <NotebookText size={28} />
            </span>
            <span className="rec-text">
              <strong>Practice 5 questions</strong>
              <span>Test your understanding with curated questions.</span>
              <span className="rec-time">
                <Clock size={14} /> 10 min
              </span>
            </span>
            <span className="round-chev">
              <ChevronRight size={18} />
            </span>
          </button>
          <button className="rec t-green" onClick={() => setModal({ type: 'notes', subjectId: state.lastLesson.subjectId })}>
            <span className="tile tile-xl t-green">
              <BookMarked size={28} />
            </span>
            <span className="rec-text">
              <strong>Review your notes</strong>
              <span>Go through key points from this module.</span>
              <span className="rec-time">
                <Clock size={14} /> 8 min
              </span>
            </span>
            <span className="round-chev">
              <ChevronRight size={18} />
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
