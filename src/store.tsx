import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  concepts,
  notesBaseCount,
  seedChunks,
  seedMastery,
  seedResources,
  seedSubjects,
  type Chunk,
  type Lesson,
  type Resource,
  type Subject,
  type Theme,
  type SubjectIcon,
} from './data';
import type { EvalResult } from './eval';

export interface Note {
  id: string;
  subjectId: string;
  lessonId?: string;
  title: string;
  body: string;
  createdAt: number;
}

export type ActivityKind = 'complete' | 'quiz' | 'review' | 'note' | 'upload' | 'chat';
export interface Activity {
  id: string;
  kind: ActivityKind;
  text: string;
  at: number;
}

export interface QuizResult {
  id: string;
  subjectId: string;
  score: number;
  total: number;
  at: number;
  weak: string[];
}

export interface Citation {
  n: number;
  chunkId: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  grounded?: 'source' | 'outside' | 'declined';
  actions?: { label: string; modal: ModalState }[];
  at: number;
}

export interface Notification {
  id: string;
  text: string;
  at: number;
  read: boolean;
}

export type ToolKind = 'notes' | 'flashcards' | 'slides' | 'mindmap' | 'audio' | 'summary' | 'reports' | 'table';
export type SourceKind = 'upload' | 'youtube' | 'web' | 'text' | 'audio';

export type ModalState =
  | { type: 'lesson'; subjectId: string; lessonId: string }
  | { type: 'quiz'; subjectId?: string; count?: number; conceptIds?: string[]; adaptive?: boolean }
  | { type: 'notes'; subjectId?: string }
  | { type: 'activity' }
  | { type: 'week' }
  | { type: 'demo' }
  | { type: 'manageSubjects' }
  | { type: 'addSubject' }
  | { type: 'weak' }
  | { type: 'quizHistory' }
  | { type: 'tool'; tool: ToolKind }
  | { type: 'citation'; chunkId: string }
  | { type: 'resource'; resourceId: string }
  | { type: 'addSource'; kind?: SourceKind }
  | { type: 'settings' }
  | { type: 'flowmap'; subjectId: string }
  | { type: 'progress' }
  | { type: 'path' }
  | { type: 'intake' }
  | { type: 'evalReport' };

export interface State {
  userName: string;
  subjects: Subject[];
  lastLesson: { subjectId: string; lessonId: string };
  notes: Note[];
  activity: Activity[];
  quizHistory: QuizResult[];
  mastery: Record<string, number>;
  seenQuestions: string[];
  resources: Resource[];
  chunks: Chunk[];
  chat: ChatMessage[];
  notifications: Notification[];
  studyLog: number[]; // minutes per day, Mon..Sun of this week
  lastWeekMinutes: number;
  streak: number;
  personalizedUnlocked: boolean;
  pathStep: number;
  tutorMode: string;
  analysis: number; // knowledge-base processing progress 0-100
  onboarded: boolean; // false → new student: intake conversation + diagnostic quiz
  evalResult?: EvalResult;
}

const HOUR = 3600_000;
const now = () => Date.now();
export const uid = () => Math.random().toString(36).slice(2, 10);

function seedState(): State {
  const t = now();
  const quizScores = [70, 85, 78, 92, 80, 74, 88, 90, 76, 84, 80, 87];
  return {
    userName: 'Praveen',
    subjects: structuredClone(seedSubjects),
    lastLesson: { subjectId: 'ds', lessonId: findLessonByTitle('Introduction to Machine Learning') },
    notes: [
      { id: 'n1', subjectId: 'ds', title: 'Backpropagation in one line', body: 'Chain rule from the loss back to every weight; forward pass first, backward pass second. (Notes - Backpropagation, p. 2)', createdAt: t - 26 * HOUR },
      { id: 'n2', subjectId: 'ds', title: 'Train-test split', body: 'Split before fitting anything. 80/20 is typical. Never tune on the test set. (Lecture 4 • 03:15)', createdAt: t - 3 * HOUR },
      { id: 'n3', subjectId: 'ds', title: 'Precision vs recall', body: 'Precision: of predicted positives, how many were right. Recall: of real positives, how many were found.', createdAt: t - 50 * HOUR },
      { id: 'n4', subjectId: 'math', title: "Bayes' theorem", body: 'P(A|B) = P(B|A)·P(A) / P(B). Prior × likelihood, normalised.', createdAt: t - 72 * HOUR },
      { id: 'n5', subjectId: 'python', title: 'Mutable vs immutable', body: 'Lists, dicts and sets are mutable. Tuples, strings and ints are immutable.', createdAt: t - 96 * HOUR },
      { id: 'n6', subjectId: 'web', title: 'Flexbox cheat sheet', body: 'justify-content → main axis, align-items → cross axis, gap for spacing.', createdAt: t - 120 * HOUR },
    ],
    activity: [
      { id: 'a1', kind: 'complete', text: 'Completed: Train-test split', at: t - 2 * HOUR },
      { id: 'a2', kind: 'quiz', text: 'Quiz: Python basics · 8/10', at: t - 5 * HOUR },
      { id: 'a3', kind: 'review', text: 'Reviewed: Linear regression', at: t - 24 * HOUR },
      { id: 'a4', kind: 'upload', text: 'Uploaded: Machine Learning.pdf', at: t - 6 * 24 * HOUR },
      { id: 'a5', kind: 'note', text: 'Note: Bayes’ theorem', at: t - 3 * 24 * HOUR },
    ],
    quizHistory: quizScores.map((s, i) => ({
      id: `qh${i}`,
      subjectId: ['ds', 'python', 'math', 'ds'][i % 4],
      score: Math.round(s / 10),
      total: 10,
      at: t - (12 - i) * 30 * HOUR,
      weak: [],
    })),
    mastery: { ...seedMastery },
    seenQuestions: [],
    resources: structuredClone(seedResources),
    chunks: structuredClone(seedChunks),
    chat: [],
    notifications: [
      { id: 'nt1', text: 'Your Machine Learning.pdf has been indexed — 120 pages, 312 concepts.', at: t - HOUR, read: false },
      { id: 'nt2', text: 'Classification vs Regression needs attention. A 5-minute review is ready.', at: t - 4 * HOUR, read: false },
      { id: 'nt3', text: 'You kept your streak for 6 days. Nice!', at: t - 20 * HOUR, read: true },
    ],
    studyLog: [85, 70, 95, 60, 80, 55, 65],
    lastWeekMinutes: 455,
    streak: 6,
    personalizedUnlocked: false,
    pathStep: 0,
    tutorMode: 'course',
    analysis: 70,
    onboarded: true,
  };
}

function findLessonByTitle(title: string): string {
  for (const s of seedSubjects) for (const m of s.modules) for (const l of m.lessons) if (l.title === title) return l.id;
  return seedSubjects[0].modules[0].lessons[0].id;
}

// ---------- derived helpers ----------
export const lessonsOf = (s: Subject) => s.modules.flatMap((m) => m.lessons);
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const moduleProgress = (m: { lessons: Lesson[] }) => Math.round(avg(m.lessons.map((l) => l.progress)));
export const subjectProgress = (s: Subject) => Math.round(avg(lessonsOf(s).map((l) => l.progress)));

export function findLesson(subjects: Subject[], subjectId: string, lessonId: string) {
  const s = subjects.find((x) => x.id === subjectId);
  if (!s) return null;
  for (const m of s.modules) {
    const i = m.lessons.findIndex((l) => l.id === lessonId);
    if (i >= 0) return { subject: s, module: m, lesson: m.lessons[i], index: i };
  }
  return null;
}

export function findLessonAnywhere(subjects: Subject[], lessonId: string) {
  for (const s of subjects) {
    const r = findLesson(subjects, s.id, lessonId);
    if (r) return r;
  }
  return null;
}

export function nextLesson(subjects: Subject[], subjectId: string, lessonId: string): Lesson | null {
  const s = subjects.find((x) => x.id === subjectId);
  if (!s) return null;
  const all = lessonsOf(s);
  const i = all.findIndex((l) => l.id === lessonId);
  for (let j = i + 1; j < all.length; j++) if (all[j].progress < 100) return all[j];
  return all[i + 1] ?? null;
}

export function timeAgo(at: number) {
  const d = Math.max(0, now() - at);
  const m = Math.round(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Bayesian Knowledge Tracing update for a single observation.
export function bktUpdate(p: number, correct: boolean) {
  const slip = 0.1;
  const guess = 0.2;
  const learn = 0.12;
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess));
  return Math.min(0.99, Math.max(0.01, posterior + (1 - posterior) * learn));
}

const STORAGE_KEY = 'studynest-state-v1';

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...seedState(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return seedState();
}

// ---------- context ----------
interface Toast {
  id: string;
  text: string;
}

function useStoreValue() {
  const [state, setState] = useState<State>(load);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingTutorQuery, setPendingTutorQuery] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }, 250);
  }, [state]);

  const update = useCallback((fn: (s: State) => State) => setState(fn), []);

  const toast = useCallback((text: string) => {
    const id = uid();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const actions = useMemo(() => {
    const logActivity = (s: State, kind: ActivityKind, text: string): State => ({
      ...s,
      activity: [{ id: uid(), kind, text, at: now() }, ...s.activity].slice(0, 50),
    });
    const addMinutes = (s: State, mins: number): State => {
      const log = [...s.studyLog];
      const today = (new Date().getDay() + 6) % 7;
      log[today] += mins;
      return { ...s, studyLog: log };
    };
    const mapLesson = (s: State, subjectId: string, lessonId: string, fn: (l: Lesson) => Lesson): State => ({
      ...s,
      subjects: s.subjects.map((sub) =>
        sub.id !== subjectId
          ? sub
          : { ...sub, modules: sub.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => (l.id === lessonId ? fn(l) : l)) })) },
      ),
    });

    return {
      setProgress(subjectId: string, lessonId: string, progress: number) {
        update((s) => {
          const found = findLesson(s.subjects, subjectId, lessonId);
          if (!found) return s;
          const wasDone = found.lesson.progress >= 100;
          let next = mapLesson(s, subjectId, lessonId, (l) => ({ ...l, progress: Math.max(0, Math.min(100, Math.round(progress))) }));
          next = { ...next, lastLesson: { subjectId, lessonId } };
          if (!wasDone && progress >= 100) {
            next = logActivity(next, 'complete', `Completed: ${found.lesson.title}`);
            next = addMinutes(next, 10);
            // completing a lesson nudges mastery of its concepts
            const mastery = { ...next.mastery };
            for (const c of found.lesson.concepts) mastery[c] = Math.min(0.99, (mastery[c] ?? 0.3) + 0.08);
            next = { ...next, mastery };
          }
          return next;
        });
      },
      toggleComplete(subjectId: string, lessonId: string) {
        const f = findLesson(state.subjects, subjectId, lessonId);
        if (!f) return;
        const done = f.lesson.progress >= 100;
        this.setProgress(subjectId, lessonId, done ? 0 : 100);
        toast(done ? `Marked “${f.lesson.title}” as not done` : `Completed “${f.lesson.title}” 🎉`);
      },
      openLesson(subjectId: string, lessonId: string) {
        update((s) => ({ ...s, lastLesson: { subjectId, lessonId } }));
        setModal({ type: 'lesson', subjectId, lessonId });
      },
      toggleBookmark(subjectId: string, lessonId: string) {
        const added = !findLesson(state.subjects, subjectId, lessonId)?.lesson.bookmarked;
        update((s) => mapLesson(s, subjectId, lessonId, (l) => ({ ...l, bookmarked: added })));
        toast(added ? 'Bookmarked' : 'Bookmark removed');
      },
      addNote(note: Omit<Note, 'id' | 'createdAt'>) {
        update((s) => logActivity({ ...s, notes: [{ ...note, id: uid(), createdAt: now() }, ...s.notes] }, 'note', `Note: ${note.title}`));
        toast('Note saved');
      },
      updateNote(id: string, patch: Partial<Note>) {
        update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
      },
      deleteNote(id: string) {
        update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
        toast('Note deleted');
      },
      logActivity(kind: ActivityKind, text: string) {
        update((s) => logActivity(s, kind, text));
      },
      recordQuiz(subjectId: string, answers: { questionId: string; concept: string; correct: boolean }[], adaptive: boolean) {
        update((s) => {
          const mastery = { ...s.mastery };
          for (const a of answers) mastery[a.concept] = bktUpdate(mastery[a.concept] ?? 0.3, a.correct);
          const score = answers.filter((a) => a.correct).length;
          const weak = [...new Set(answers.filter((a) => !a.correct).map((a) => a.concept))];
          const subj = s.subjects.find((x) => x.id === subjectId);
          let next: State = {
            ...s,
            mastery,
            seenQuestions: [...new Set([...s.seenQuestions, ...answers.map((a) => a.questionId)])],
            quizHistory: [...s.quizHistory, { id: uid(), subjectId, score, total: answers.length, at: now(), weak }],
            personalizedUnlocked: s.personalizedUnlocked || adaptive,
          };
          next = logActivity(next, 'quiz', `Quiz: ${subj?.name ?? 'Mixed'} · ${score}/${answers.length}`);
          next = addMinutes(next, answers.length * 2);
          if (adaptive && !s.personalizedUnlocked) {
            next = {
              ...next,
              notifications: [{ id: uid(), text: 'Personalized Learning unlocked! Your path is ready.', at: now(), read: false }, ...next.notifications],
            };
          }
          return next;
        });
      },
      resetSeen() {
        update((s) => ({ ...s, seenQuestions: [] }));
      },
      addSubject(name: string, icon: SubjectIcon, theme: Theme) {
        const id = uid();
        update((s) => ({
          ...s,
          subjects: [
            ...s.subjects,
            {
              id,
              name,
              icon,
              theme,
              modules: [
                {
                  id: `${id}-m1`,
                  title: 'Getting Started',
                  lessons: [
                    { id: `${id}-l1`, title: `Introduction to ${name}`, type: 'notes', meta: 'Notes', progress: 0, concepts: [], source: 'Add sources in AI Tutor to build this course', content: `Upload lecture videos, textbooks or slides about ${name} in the AI Tutor tab — StudyNest will organise them into topics here.` },
                  ],
                },
              ],
            },
          ],
        }));
        toast(`Added subject “${name}”`);
        return id;
      },
      removeSubject(id: string) {
        update((s) => (s.subjects.length <= 1 ? s : { ...s, subjects: s.subjects.filter((x) => x.id !== id) }));
      },
      moveSubject(id: string, dir: -1 | 1) {
        update((s) => {
          const arr = [...s.subjects];
          const i = arr.findIndex((x) => x.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= arr.length) return s;
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return { ...s, subjects: arr };
        });
      },
      addResource(r: Omit<Resource, 'id' | 'date' | 'status'>, chunks: Omit<Chunk, 'id' | 'resourceId'>[] = [], subject?: Subject | null) {
        const id = uid();
        const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        update((s) => {
          let next = logActivity(
            {
              ...s,
              resources: [{ ...r, id, date, status: 'processing' }, ...s.resources],
              chunks: [...s.chunks.filter((c) => !(subject && s.resources.some((x) => x.name === r.name && x.id === c.resourceId))), ...chunks.map((c) => ({ ...c, id: uid(), resourceId: id }))],
              analysis: chunks.length ? Math.min(s.analysis, 75) : Math.min(s.analysis, 35),
            },
            'upload',
            `Added source: ${r.name}`,
          );
          if (chunks.length) {
            const topics = [...new Set(chunks.map((c) => c.topic.split(':')[0]))];
            const msg: ChatMessage = {
              id: uid(),
              role: 'assistant',
              at: now(),
              grounded: 'source',
              text:
                `I've read **${r.name}** — ${r.meta}, ${chunks.length} cited excerpts across ${topics.length} topics` +
                (subject ? ` (${subject.modules.length} topics added to Learn as “${subject.name}”).` : '.') +
                `\n\nAsk me anything about it — e.g. “What is a deadlock?” or “Explain paging” — and I'll answer with page citations. Or take a quick test to see where you stand.`,
              actions: subject
                ? [
                    { label: 'Take a quick test', modal: { type: 'quiz', subjectId: subject.id, count: 5, adaptive: true } },
                    { label: 'Open in Learn', modal: { type: 'flowmap', subjectId: subject.id } },
                  ]
                : [{ label: 'View extracted excerpts', modal: { type: 'resource', resourceId: id } }],
            };
            next = { ...next, chat: [...next.chat, msg] };
          }
          if (subject && !next.subjects.some((x) => x.id === subject.id)) {
            next = {
              ...next,
              subjects: [...next.subjects, subject],
              notifications: [{ id: uid(), text: `“${subject.name}” course built from ${r.name}. Take the quick test!`, at: now(), read: false }, ...next.notifications],
            };
          }
          return next;
        });
        toast(chunks.length ? `Indexed “${r.name}” — ${chunks.length} excerpts` : `Added “${r.name}” — analyzing…`);
        return id;
      },
      renameResource(id: string, name: string) {
        update((s) => ({ ...s, resources: s.resources.map((r) => (r.id === id ? { ...r, name } : r)) }));
      },
      deleteResource(id: string) {
        update((s) => ({ ...s, resources: s.resources.filter((r) => r.id !== id), chunks: s.chunks.filter((c) => c.resourceId !== id) }));
        toast('Source removed');
      },
      tickAnalysis() {
        update((s) => {
          if (s.analysis >= 100) return s;
          const analysis = Math.min(100, s.analysis + 1);
          return {
            ...s,
            analysis,
            resources: analysis >= 100 ? s.resources.map((r) => ({ ...r, status: 'ready' as const })) : s.resources,
          };
        });
      },
      pushChat(msg: Omit<ChatMessage, 'id' | 'at'>) {
        update((s) => ({ ...s, chat: [...s.chat, { ...msg, id: uid(), at: now() }] }));
      },
      clearChat() {
        update((s) => ({ ...s, chat: [] }));
      },
      setTutorMode(mode: string) {
        update((s) => ({ ...s, tutorMode: mode }));
      },
      markAllRead() {
        update((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
      },
      markRead(id: string) {
        update((s) => ({ ...s, notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
      },
      setUserName(userName: string) {
        update((s) => ({ ...s, userName }));
      },
      setPathStep(pathStep: number) {
        update((s) => ({ ...s, pathStep }));
      },
      reset() {
        localStorage.removeItem(STORAGE_KEY);
        setState(seedState());
        toast('Demo data reset');
      },
      newStudent() {
        // A brand-new learner: no history, unknown mastery, same course material.
        const seed = seedState();
        setState((s) => ({
          ...seed,
          userName: 'there',
          resources: s.resources,
          chunks: s.chunks,
          subjects: s.subjects.map((sub) => ({ ...sub, modules: sub.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, progress: 0, bookmarked: false })) })) })),
          notes: [],
          activity: [],
          quizHistory: [],
          mastery: {},
          notifications: [{ id: uid(), text: 'Welcome to StudyNest! Start with a 2-minute intake and diagnostic quiz.', at: now(), read: false }],
          studyLog: [0, 0, 0, 0, 0, 0, 0],
          lastWeekMinutes: 1,
          streak: 0,
          analysis: 100,
          onboarded: false,
        }));
        setModal({ type: 'intake' });
      },
      completeOnboarding(name: string, mastery: Record<string, number>, subjectId: string, answers: { questionId: string; correct: boolean }[]) {
        update((s) =>
          logActivity(
            {
              ...s,
              userName: name || s.userName,
              mastery: { ...s.mastery, ...mastery },
              onboarded: true,
              personalizedUnlocked: true,
              seenQuestions: [...new Set([...s.seenQuestions, ...answers.map((a) => a.questionId)])],
              quizHistory: [...s.quizHistory, { id: uid(), subjectId, score: answers.filter((a) => a.correct).length, total: answers.length, at: now(), weak: [] }],
              lastLesson: s.subjects.find((x) => x.id === subjectId) ? { subjectId, lessonId: lessonsOf(s.subjects.find((x) => x.id === subjectId)!)[0].id } : s.lastLesson,
            },
            'quiz',
            `Diagnostic: ${answers.filter((a) => a.correct).length}/${answers.length}`,
          ),
        );
      },
      setEvalResult(evalResult: EvalResult) {
        update((s) => ({ ...s, evalResult }));
      },
    };
  }, [update, toast, state.subjects]);

  // aggregate stats
  const stats = useMemo(() => {
    const allLessons = state.subjects.flatMap(lessonsOf);
    const mastered = allLessons.filter((l) => l.progress >= 100).length;
    const scores = state.quizHistory.map((q) => (q.score / q.total) * 100);
    const overall = Math.round(avg(state.subjects.map(subjectProgress)));
    const weekMinutes = state.studyLog.reduce((a, b) => a + b, 0);
    return {
      mastered,
      notes: notesBaseCount + state.notes.length,
      quizzes: state.quizHistory.length,
      avgScore: Math.round(avg(scores)),
      scoreTrend: scores.slice(-8),
      overall,
      weekHours: Math.round((weekMinutes / 60) * 10) / 10,
      weekDelta: Math.round(((weekMinutes - state.lastWeekMinutes) / state.lastWeekMinutes) * 100),
    };
  }, [state]);

  const weakConcepts = useMemo(
    () =>
      concepts
        .filter((c) => state.subjects.some((s) => s.id === c.subjectId))
        .map((c) => ({ ...c, mastery: state.mastery[c.id] ?? 0.3 }))
        .sort((a, b) => a.mastery - b.mastery),
    [state.mastery, state.subjects],
  );

  const goTutorWith = useCallback((q: string) => setPendingTutorQuery(q), []);

  return {
    state,
    actions,
    stats,
    weakConcepts,
    modal,
    setModal,
    toasts,
    toast,
    paletteOpen,
    setPaletteOpen,
    pendingTutorQuery,
    setPendingTutorQuery,
    goTutorWith,
  };
}

type Store = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}
