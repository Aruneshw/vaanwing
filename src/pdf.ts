// Real in-browser PDF ingestion: extract text page by page with pdf.js, then split
// each page into headed sections that become citable chunks ("p. N").
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Chunk } from './data';
import { tokenize } from './tutor';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPages(file: File): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    pages.push(text.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim());
  }
  return pages;
}

const clean = (s: string) => s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

// Diagram labels extracted from figures come out as runs of capitalised fragments
// ("Data Encrypt Ciphertext Authenticat e Decrypt"). Strip them from prose.
const isLabelToken = (t: string) => /^[A-Z0-9#+/&(]/.test(t) || t.length <= 2;
function stripDiagramLabels(text: string) {
  return text
    .split(/(?<=[.!?:])\s+/)
    .map((sent) => {
      const toks = sent.split(' ');
      if (!/[a-z]{3,}/.test(sent.replace(/^\S+/, '')) && !/[.!?]$/.test(sent)) return '';
      let k = 0;
      while (k < toks.length && isLabelToken(toks[k])) k++;
      if (k >= 5 && k < toks.length) return toks.slice(k - 1).join(' ');
      if (k === toks.length && !/[.!?]$/.test(sent)) return '';
      return sent;
    })
    .filter(Boolean)
    .join(' ');
}

// Boilerplate repeated on every page of a notes PDF adds noise to retrieval.
const BOILERPLATE = [/Remember: define the concept/i, /Define .{3,60} in one sentence/i, /^Exam method:/i, /Deep-dive notes and terminology/i];

export function pageTopic(page: string) {
  const lines = page.split('\n').map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^TOPIC \d+/.test(l));
  if (i >= 0 && lines[i + 1]) return lines[i + 1];
  return lines[0]?.slice(0, 60) ?? 'Document';
}

export function pagesToChunks(pages: string[]): Omit<Chunk, 'id' | 'resourceId'>[] {
  const out: Omit<Chunk, 'id' | 'resourceId'>[] = [];
  pages.forEach((page, idx) => {
    const topic = pageTopic(page);
    const topicWords = tokenize(topic);
    // Split on ALL-CAPS heading lines (CORE IDEA, WHAT YOU SHOULD KNOW, MUTEX, …)
    const sections: { head: string; body: string[] }[] = [{ head: '', body: [] }];
    for (const raw of page.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (/^[A-Z][A-Z0-9 /&'’()–-]{2,40}$/.test(line) && !/^TOPIC \d+$/.test(line) && line === line.toUpperCase()) sections.push({ head: line, body: [] });
      else sections[sections.length - 1].body.push(line);
    }
    for (const s of sections) {
      let text = stripDiagramLabels(clean(s.body.join('\n')).replace(/^\d+\s+/, '').replace(/\s+\d+$/, ''));
      if (!s.head) text = text.replace(/^TOPIC \d+\s+/, '').replace(topic, '').replace(/^\s*(Quick revision, comparison and worked thinking)?\s*/, '').trim();
      if (text.length < 40) continue;
      if (BOILERPLATE.some((r) => r.test(text))) {
        text = text
          .split(/(?<=[.!?])\s+|\s*•\s*/)
          .filter((x) => x && !BOILERPLATE.some((r) => r.test(x)) && !/reproduce the central diagram|formula\/rule before substituting|main components and the order/i.test(x))
          .join(' ');
        if (text.length < 40) continue;
      }
      if (text.length > 650) text = text.slice(0, 650).replace(/\s\S*$/, '') + '…';
      const freq = new Map<string, number>();
      for (const w of tokenize(text)) if (w.length > 3 && !/^\d+$/.test(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
      const keywords = [...new Set([...topicWords, ...(s.head ? tokenize(s.head) : []), ...[...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w)])];
      out.push({ location: `p. ${idx + 1}`, topic: s.head && !/^(CORE IDEA|WHAT YOU SHOULD KNOW|EXAM SNAPSHOT|WORKED THINKING|RAPID REVISION|STEP-BY-STEP)$/.test(s.head) ? `${topic}: ${titleCase(s.head)}` : topic, keywords, text: s.head ? `${titleCase(s.head)} — ${text}` : text });
    }
  });
  return out;
}

const ACRONYMS = new Set(['TLB', 'PCB', 'CPU', 'DMA', 'OS', 'I/O', 'RAM', 'MMU', 'FCFS', 'SJF', 'SSTF', 'SCAN', 'C-SCAN', 'LOOK', 'RPC', 'RAID']);
const titleCase = (s: string) => s.split(' ').map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
