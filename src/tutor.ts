// A small, fully client-side stand-in for the retrieval + generation backend.
// It scores source chunks by keyword overlap, answers only from what it retrieves,
// and declines (or clearly flags outside knowledge) when nothing relevant is found.
import type { Chunk, Resource } from './data';
import type { Citation } from './store';

const STOP = new Set(
  'a an the of to in on for and or is are was were be been it this that with as by at from me my i you your what why how when which who do does did can could should would explain concept simple simply please give tell about into using use between difference vs versus show diagram notes note create make summarize summary chapter generate important practice questions question solve problem topic with mind map'.split(
    ' ',
  ),
);

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

export function retrieve(query: string, chunks: Chunk[], k = 3) {
  const q = tokenize(query);
  if (!q.length) return [];
  const scored = chunks.map((c) => {
    const kw = new Set(c.keywords.map((w) => w.toLowerCase()));
    const body = new Set(tokenize(c.text + ' ' + c.topic));
    let score = 0;
    for (const w of q) {
      if (kw.has(w)) score += 2;
      else if (body.has(w)) score += 1;
      else if ([...kw].some((k2) => k2.startsWith(w) || w.startsWith(k2))) score += 1;
    }
    return { chunk: c, score: score / Math.sqrt(q.length) };
  });
  return scored
    .filter((s) => s.score >= 1.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => s.chunk);
}

export interface TutorAnswer {
  text: string;
  citations: Citation[];
  grounded: 'source' | 'outside' | 'declined';
}

export function answer(question: string, chunks: Chunk[], opts: { mode: string; webSearch: boolean; intent?: string }): TutorAnswer {
  const hits = retrieve(question, chunks, 3);
  const allowOutside = opts.mode === 'open' || opts.webSearch;

  if (!hits.length) {
    if (allowOutside) {
      return {
        grounded: 'outside',
        citations: [],
        text:
          `I couldn't find “${question.trim()}” in your uploaded materials, so this answer uses general knowledge and is not source-backed.\n\n` +
          `In general terms: break the idea into its definition, a worked example, and where it is used. ` +
          `If this topic matters for your course, upload the relevant lecture, chapter or slides and I'll answer with exact citations.`,
      };
    }
    return {
      grounded: 'declined',
      citations: [],
      text:
        `I couldn't find anything about this in your sources, so I won't guess.\n\n` +
        `Study Mode (Course Only) keeps answers grounded in your materials. You can add a source that covers it, ` +
        `switch to “Open Mode”, or enable Web Search — outside answers will be clearly flagged.`,
    };
  }

  const citations = hits.map((c, i) => ({ n: i + 1, chunkId: c.id }));
  const topic = hits[0].topic.split(':')[0];
  let intro = `Here's what your sources say about **${topic}**:`;
  if (opts.intent === 'summarize') intro = `Summary of **${topic}** from your materials:`;
  if (opts.intent === 'solve') intro = `Let's work through it step by step using your sources:`;
  if (opts.intent === 'notes') intro = `Notes on **${topic}** (saved-ready):`;
  if (opts.mode === 'exam') intro = `Exam-focused answer on **${topic}**:`;

  const body = hits.map((c, i) => (opts.intent === 'notes' || opts.intent === 'summarize' ? `• ${c.text} [${i + 1}]` : `${c.text} [${i + 1}]`)).join('\n\n');
  let outro = '';
  if (opts.mode === 'guided') outro = `\n\nCheck yourself: can you explain ${topic.toLowerCase()} in one sentence without looking? Try it, then ask me to verify.`;
  if (opts.mode === 'exam') outro = `\n\nLikely exam angle: define it, give one example, and state one limitation.`;
  return { grounded: 'source', citations, text: `${intro}\n\n${body}${outro}` };
}

// ---------- learning tool generators (built from the knowledge base) ----------
export function topicsFrom(chunks: Chunk[]) {
  const map = new Map<string, Chunk[]>();
  for (const c of chunks) map.set(c.topic, [...(map.get(c.topic) ?? []), c]);
  return [...map.entries()].map(([topic, cs]) => ({ topic, chunks: cs }));
}

export function firstSentence(text: string) {
  const m = text.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : text;
}

export function flashcards(chunks: Chunk[]) {
  return topicsFrom(chunks).map(({ topic, chunks: cs }) => ({
    front: `What is ${topic}?`,
    back: firstSentence(cs[0].text),
    chunkId: cs[0].id,
  }));
}

export function sourceLabel(chunk: Chunk, resources: Resource[]) {
  const r = resources.find((x) => x.id === chunk.resourceId);
  return `${r?.name ?? 'Source'} • ${chunk.location}`;
}
