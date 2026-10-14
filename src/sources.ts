// Turns user-provided material into resources + retrievable chunks on the client.
// Plain-text sources are chunked for real so the tutor can cite them; binary files
// (PDF, video, slides, images) are registered and would be processed by the backend.
import type { Chunk, Resource, ResourceKind } from './data';
import { tokenize } from './tutor';

type NewResource = Omit<Resource, 'id' | 'date' | 'status'>;
type NewChunk = Omit<Chunk, 'id' | 'resourceId'>;

export function kindFromName(name: string): ResourceKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'pdf';
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slides';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext)) return 'audio';
  return 'notes';
}

function sizeLabel(bytes: number) {
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function textToChunks(text: string, title: string): NewChunk[] {
  const paras = text
    .split(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const groups: string[] = [];
  for (let i = 0; i < paras.length; i += 2) groups.push(paras.slice(i, i + 2).join(' '));
  return groups.slice(0, 60).map((g, i) => {
    const words = tokenize(g);
    const freq = new Map<string, number>();
    for (const w of words) if (w.length > 3) freq.set(w, (freq.get(w) ?? 0) + 1);
    const keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    const topic = keywords[0] ? keywords[0][0].toUpperCase() + keywords[0].slice(1) : title;
    return { location: `Para ${i + 1}`, topic, keywords, text: g };
  });
}

export async function fileToResource(f: File): Promise<{ resource: NewResource; chunks: NewChunk[] }> {
  const kind = kindFromName(f.name);
  const isText = /\.(txt|md|csv)$/i.test(f.name) || f.type.startsWith('text/');
  if (isText) {
    const text = await f.text();
    const chunks = textToChunks(text, f.name);
    return { resource: { name: f.name, kind: 'notes', meta: `${chunks.length} sections`, text }, chunks };
  }
  let meta = sizeLabel(f.size);
  if (kind === 'pdf') meta = `${Math.max(1, Math.round(f.size / 60_000))} pages`;
  if (kind === 'slides') meta = `${Math.max(1, Math.round(f.size / 120_000))} slides`;
  if (kind === 'image') meta = '1 image';
  if (kind === 'video' || kind === 'audio') meta = `${sizeLabel(f.size)} · transcribing`;
  return { resource: { name: f.name, kind, meta }, chunks: [] };
}

export function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m?.[1] ?? null;
}

export function isUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
