// System evaluation, run in the browser against the live knowledge base.
// RAG metrics follow the RAGAS definitions, scored with lexical (token-overlap) judges
// instead of an LLM judge so they run offline and are fully reproducible:
//   faithfulness      – share of answer sentences supported by the retrieved context
//   answer relevancy  – share of the question's content terms addressed by the answer
//   context precision – rank-weighted precision of retrieved chunks vs. the known source page
//   context recall    – share of questions whose known source page was retrieved
//   refusal accuracy  – off-material queries correctly declined (Course-Only mode)
// Personalization is evaluated with simulated students over several sessions.
import { questionBank, type Chunk, type Question } from './data';
import { answer, retrieve, tokenize } from './tutor';
import { bktUpdate } from './store';

export interface EvalCase {
  q: string;
  expect?: { resource?: string; pages: string[] }; // undefined → off-material query
}

export interface CaseResult {
  q: string;
  offMaterial: boolean;
  retrieved: string[];
  faithfulness: number;
  relevancy: number;
  precision: number;
  recall: number;
  declined: boolean;
}

export interface ProfileResult {
  name: string;
  startMastery: number;
  endMastery: number;
  trueGain: number;
  repetition: number;
  baselineRepetition: number;
}

export interface EvalResult {
  at: number;
  testSet: string;
  rag: { faithfulness: number; relevancy: number; precision: number; recall: number; refusal: number; falseRefusal: number };
  personalization: { masteryGain: number; repetition: number; baselineRepetition: number; sessions: number; profiles: ProfileResult[] };
  cases: CaseResult[];
}

// Team-built test sets: questions with known source locations + off-material queries.
const osCases: EvalCase[] = [
  { q: 'What is an operating system?', expect: { pages: ['p. 3', 'p. 4', 'p. 55'] } },
  { q: 'What does the process control block store?', expect: { pages: ['p. 6', 'p. 7', 'p. 55'] } },
  { q: 'What is a race condition?', expect: { pages: ['p. 9', 'p. 10'] } },
  { q: 'What is a semaphore?', expect: { pages: ['p. 9', 'p. 10', 'p. 11'] } },
  { q: 'What causes thrashing in virtual memory?', expect: { pages: ['p. 15', 'p. 16', 'p. 17'] } },
  { q: 'What does a TLB cache in paging?', expect: { pages: ['p. 18', 'p. 19', 'p. 20'] } },
  { q: 'What does the segment table store?', expect: { pages: ['p. 21', 'p. 22', 'p. 23'] } },
  { q: 'What file allocation methods exist?', expect: { pages: ['p. 24', 'p. 25', 'p. 26'] } },
  { q: 'What is DMA used for?', expect: { pages: ['p. 27', 'p. 28', 'p. 29'] } },
  { q: 'What are the four necessary conditions for deadlock?', expect: { pages: ['p. 30', 'p. 31', 'p. 32', 'p. 54'] } },
  { q: 'What is the convoy effect in FCFS scheduling?', expect: { pages: ['p. 33', 'p. 34', 'p. 35'] } },
  { q: 'What does disk access time include?', expect: { pages: ['p. 36', 'p. 37', 'p. 38'] } },
  { q: 'How does SSTF disk scheduling work?', expect: { pages: ['p. 39', 'p. 40', 'p. 41'] } },
  { q: 'Difference between authentication and authorization?', expect: { pages: ['p. 42', 'p. 43', 'p. 44', 'p. 54'] } },
  { q: 'What is asymmetric cryptography?', expect: { pages: ['p. 45', 'p. 46', 'p. 47'] } },
  { q: 'How should passwords be stored?', expect: { pages: ['p. 48', 'p. 49', 'p. 50'] } },
  { q: 'Why is there no global clock in distributed systems?', expect: { pages: ['p. 51', 'p. 52', 'p. 53'] } },
];

const seedCases: EvalCase[] = [
  { q: 'Explain backpropagation', expect: { resource: 'r4', pages: ['p. 2'] } },
  { q: 'How does gradient descent use the learning rate?', expect: { resource: 'r1', pages: ['p. 34'] } },
  { q: 'What is overfitting?', expect: { resource: 'r7', pages: ['13:05'] } },
  { q: 'How does max pooling work in a CNN?', expect: { resource: 'r5', pages: ['Image 4'] } },
  { q: 'Difference between classification and regression', expect: { resource: 'r6', pages: ['13:40'] } },
  { q: 'What is k-fold cross validation?', expect: { resource: 'r1', pages: ['p. 70'] } },
  { q: 'Precision versus recall', expect: { resource: 'r7', pages: ['02:40'] } },
  { q: 'How do decision trees choose a split?', expect: { resource: 'r3', pages: ['Slide 34'] } },
];

const offMaterial: EvalCase[] = [
  { q: 'Who won the 2018 FIFA World Cup?' },
  { q: 'What is the capital of Australia?' },
  { q: 'Give me a recipe for chocolate cake' },
  { q: 'Explain photosynthesis in plants' },
  { q: 'Who wrote Romeo and Juliet?' },
  { q: 'What is the boiling point of nitrogen?' },
];

export function buildTestSet(chunks: Chunk[], resources: { id: string; name: string }[]) {
  const osRes = resources.find((r) => chunks.some((c) => c.resourceId === r.id && c.location === 'p. 30' && /deadlock/i.test(c.topic)));
  const cases = osRes ? osCases.map((c) => ({ ...c, expect: { resource: osRes.id, pages: c.expect!.pages } })) : seedCases;
  return { name: osRes ? `${osRes.name} (${cases.length} sourced + ${offMaterial.length} off-material)` : `Seed ML course (${cases.length} sourced + ${offMaterial.length} off-material)`, cases: [...cases, ...offMaterial] };
}

const sentences = (t: string) =>
  t
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.replace(/\[\d+\]|\*\*/g, '').trim())
    .filter((s) => s.length > 12 && !/^(Here's what|Summary of|Let's work|Notes on|Exam-focused|Check yourself|Likely exam)/.test(s));

export function evalCase(c: EvalCase, chunks: Chunk[]): CaseResult {
  const hits = retrieve(c.q, chunks, 3);
  const res = answer(c.q, chunks, { mode: 'course', webSearch: false });
  const ctx = new Set(tokenize(hits.map((h) => h.text).join(' ')));
  const sents = sentences(res.text);
  const faithfulness =
    res.grounded === 'source' && sents.length
      ? sents.filter((s) => {
          const t = tokenize(s);
          return t.length === 0 || t.filter((w) => ctx.has(w)).length / t.length >= 0.6;
        }).length / sents.length
      : res.grounded === 'declined'
        ? 1
        : 0;
  const qTerms = [...new Set(tokenize(c.q))];
  const aTerms = new Set(tokenize(res.text));
  const relevancy = qTerms.length ? qTerms.filter((w) => aTerms.has(w) || [...aTerms].some((a) => a.startsWith(w) || w.startsWith(a))).length / qTerms.length : 0;
  const isRel = (h: Chunk) => !!c.expect && (!c.expect.resource || h.resourceId === c.expect.resource) && c.expect.pages.includes(h.location);
  let hitsSoFar = 0;
  let precSum = 0;
  hits.forEach((h, i) => {
    if (isRel(h)) {
      hitsSoFar++;
      precSum += hitsSoFar / (i + 1);
    }
  });
  return {
    q: c.q,
    offMaterial: !c.expect,
    retrieved: hits.map((h) => h.location),
    faithfulness,
    relevancy: res.grounded === 'declined' ? 0 : relevancy,
    precision: hitsSoFar ? precSum / hitsSoFar : 0,
    recall: hitsSoFar ? 1 : 0,
    declined: res.grounded === 'declined',
  };
}

// ---------- personalization simulation ----------
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function simulate(name: string, skill: number, pool: Question[], sessions: number, perSession: number, adaptive: boolean, seed: number): ProfileResult {
  const rand = rng(seed);
  const concepts = [...new Set(pool.map((q) => q.concept))];
  const truth: Record<string, number> = Object.fromEntries(concepts.map((c, i) => [c, Math.min(0.95, Math.max(0.05, skill + ((i * 37) % 11) / 25 - 0.2))]));
  const est: Record<string, number> = Object.fromEntries(concepts.map((c) => [c, 0.3]));
  const startTrue = concepts.reduce((a, c) => a + truth[c], 0) / concepts.length;
  const seen = new Set<string>();
  let asked = 0;
  let repeats = 0;
  for (let s = 0; s < sessions; s++) {
    let pick: Question[];
    if (adaptive) {
      // Same policy as the app: weakest concepts first, skip already-seen questions.
      const unseen = pool.filter((q) => !seen.has(q.id)).sort((a, b) => est[a.concept] - est[b.concept]);
      pick = unseen.slice(0, perSession);
      if (pick.length < perSession) pick = [...pick, ...pool.filter((q) => !pick.includes(q)).sort((a, b) => est[a.concept] - est[b.concept]).slice(0, perSession - pick.length)];
    } else {
      pick = Array.from({ length: perSession }, () => pool[Math.floor(rand() * pool.length)]);
    }
    for (const q of pick) {
      asked++;
      if (seen.has(q.id)) repeats++;
      seen.add(q.id);
      const correct = rand() < truth[q.concept] * 0.85 + 0.1;
      est[q.concept] = bktUpdate(est[q.concept], correct);
      // practice with feedback teaches: weak concepts improve most
      truth[q.concept] = Math.min(0.97, truth[q.concept] + (1 - truth[q.concept]) * 0.18);
    }
  }
  const endTrue = concepts.reduce((a, c) => a + truth[c], 0) / concepts.length;
  return { name, startMastery: startTrue, endMastery: endTrue, trueGain: endTrue - startTrue, repetition: repeats / asked, baselineRepetition: 0 };
}

export function runPersonalization(subjectId: string) {
  const pool = questionBank.filter((q) => q.subjectId === subjectId);
  const use = pool.length >= 8 ? pool : questionBank.filter((q) => q.subjectId === 'ds');
  const sessions = 5;
  const per = 5;
  const profiles = [
    ['Struggling student', 0.25],
    ['Average student', 0.5],
    ['Strong student', 0.75],
  ].map(([n, k], i) => {
    const a = simulate(n as string, k as number, use, sessions, per, true, 7 + i);
    const b = simulate(n as string, k as number, use, sessions, per, false, 7 + i);
    return { ...a, baselineRepetition: b.repetition };
  });
  const mean = (f: (p: ProfileResult) => number) => profiles.reduce((s, p) => s + f(p), 0) / profiles.length;
  return { masteryGain: mean((p) => p.trueGain), repetition: mean((p) => p.repetition), baselineRepetition: mean((p) => p.baselineRepetition), sessions, profiles };
}
