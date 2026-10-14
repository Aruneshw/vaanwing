// Client for the StudyNest FastAPI backend. Every call is optional: if the backend is not
// reachable the app keeps using its in-browser logic, so the UI never breaks.
import type { Chunk, Resource, Subject } from './data';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const USER_KEY = 'studynest-user-id';

export function userId(): string {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = `u-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    return 'demo';
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-User-Id', userId());
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).detail ?? msg;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) => req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// ---------- types (mirror backend/app/schemas.py) ----------
export interface Health {
  ok: boolean;
  models: Record<string, { model: string; enabled: boolean }>;
  embeddings: { provider: string; model: string };
}
export interface RemoteResource {
  id: string;
  name: string;
  kind: Resource['kind'] | 'docx';
  meta: string;
  date: string;
  status: 'processing' | 'ready' | 'failed';
  progress: number;
  stage: string;
  error: string | null;
  subjectId: string | null;
  url: string | null;
}
export interface RemoteCitation {
  n: number;
  chunkId: string;
  resource: string;
  resourceId: string;
  location: string;
  topic: string;
  excerpt: string;
}
export interface ChatReply {
  text: string;
  citations: RemoteCitation[];
  grounded: 'source' | 'outside' | 'declined';
  model: string;
}
export interface RemoteQuestion {
  id: string;
  subjectId: string;
  concept: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'mcq' | 'numeric' | 'short';
  prompt: string;
  options?: string[] | null;
  source: string;
}
export interface AnswerReply {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  source: string;
  concept: string;
  masteryBefore: number;
  masteryAfter: number;
}
export interface QuizReport {
  score: number;
  total: number;
  concepts: { concept: string; name: string; before: number; after: number; correct: number; total: number }[];
  weak: { concept: string; name: string }[];
  misconceptions: { question: string; given: string; explanation: string; source: string; concept: string }[];
}
export interface RemoteCourse extends Subject {
  concepts?: { id: string; name: string; source: string; summary: string; lessonId: string | null; prerequisites: string[]; mastery: number }[];
}

export const api = {
  health: () => req<Health>('/health'),
  sources: () => req<RemoteResource[]>('/sources'),
  source: (id: string) => req<RemoteResource>(`/sources/${id}`),
  chunks: (id: string) => req<Chunk[]>(`/sources/${id}/chunks`),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return req<RemoteResource>('/sources', { method: 'POST', body: fd });
  },
  addUrl: (url: string, kind: 'youtube' | 'web') => post<RemoteResource>('/sources/url', { url, kind }),
  addText: (title: string, text: string) => post<RemoteResource>('/sources/text', { title, text }),
  rename: (id: string, name: string) => req<RemoteResource>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  remove: (id: string) => req<void>(`/sources/${id}`, { method: 'DELETE' }),
  courses: () => req<RemoteCourse[]>('/courses'),
  course: (id: string) => req<RemoteCourse>(`/courses/${id}`),
  lessonProgress: (lessonId: string, progress: number) => req<unknown>(`/courses/lessons/${lessonId}/progress`, { method: 'PUT', body: JSON.stringify({ progress }) }),
  chat: (body: { message: string; mode: string; webSearch: boolean; intent?: string; history: { role: string; text: string }[] }) => post<ChatReply>('/chat', body),
  quiz: (body: { subjectId: string; count: number; conceptIds?: string[]; adaptive: boolean }) =>
    post<{ quizId: string; questions: RemoteQuestion[]; repeats: number }>('/quiz', body),
  answer: (quizId: string, questionId: string, answer: string) => post<AnswerReply>(`/quiz/${quizId}/answer`, { questionId, answer }),
  report: (quizId: string) => req<QuizReport>(`/quiz/${quizId}/report`),
  diagnosticStart: (subjectId: string) => post<{ quizId: string; questions: RemoteQuestion[] }>(`/learner/diagnostic/start?subjectId=${encodeURIComponent(subjectId)}`),
  diagnosticSubmit: (body: { quizId: string; name: string; level: string; goal: string; answers: { questionId: string; answer: string }[] }) =>
    post<{ score: number; total: number; strengths: { concept: string; name: string; mastery: number }[]; weaknesses: { concept: string; name: string; mastery: number }[] }>('/learner/diagnostic/submit', body),
  mastery: () => req<{ concept: string; name: string; subjectId: string; mastery: number | null }[]>('/learner/mastery'),
  evalRun: (judge: 'lexical' | 'llm') => post<Record<string, unknown>>('/eval/run', { judge }),
};

/** Streamed chat over SSE. Calls back with citations first, then text deltas, then the verdict. */
export async function chatStream(
  body: Parameters<typeof api.chat>[0],
  on: { citations: (c: RemoteCitation[]) => void; token: (t: string) => void; done: (d: { grounded: ChatReply['grounded']; model: string; citations?: RemoteCitation[] }) => void },
): Promise<void> {
  const res = await fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId() },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, res.statusText);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = raw.match(/^event: (.*)$/m)?.[1];
      const data = raw.match(/^data: (.*)$/m)?.[1];
      if (!event || data === undefined) continue;
      const parsed = JSON.parse(data);
      if (event === 'citations') on.citations(parsed);
      else if (event === 'token') on.token(parsed);
      else if (event === 'done') on.done(parsed);
      else if (event === 'error') throw new ApiError(502, parsed.message);
    }
  }
}

export function toResource(r: RemoteResource): Resource {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === 'docx' ? 'pdf' : r.kind,
    meta: r.status === 'failed' ? `Failed: ${r.error ?? 'error'}` : r.meta,
    date: r.date,
    status: r.status === 'ready' ? 'ready' : 'processing',
    url: r.url ?? undefined,
    remote: true,
  };
}
