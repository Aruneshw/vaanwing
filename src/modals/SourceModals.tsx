import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Link as LinkIcon, Mic, Sparkles, Square, SquarePen, Trash, Upload, Plus } from 'lucide-react';
import { Modal } from '../components/ui';
import { YouTubeIcon } from '../components/Icons';
import { useStore, type SourceKind } from '../store';
import { fileToResource, isUrl, textToChunks, youtubeId } from '../sources';
import { ResourceIcon } from '../pages/Tutor';

const options: { kind: SourceKind; title: string; sub: string; icon: ReactNode; cls: string }[] = [
  { kind: 'upload', title: 'Upload Files', sub: 'PDF, Docs, PPT, Images', icon: <FileText size={20} />, cls: 'src-pink' },
  { kind: 'youtube', title: 'YouTube Video', sub: 'Paste link or upload', icon: <YouTubeIcon size={22} />, cls: 'src-red' },
  { kind: 'web', title: 'Web Page', sub: 'Add URL for web content', icon: <LinkIcon size={20} />, cls: 'src-blue' },
  { kind: 'text', title: 'Text / Notes', sub: 'Paste text or take notes', icon: <SquarePen size={20} />, cls: 'src-yellow' },
  { kind: 'audio', title: 'Record Audio', sub: 'Lecture recording', icon: <Mic size={20} />, cls: 'src-purple' },
];

export function AddSourceModal({ kind: initial }: { kind?: SourceKind }) {
  const { setModal } = useStore();
  const [kind, setKind] = useState<SourceKind | undefined>(initial);
  const opt = options.find((o) => o.kind === kind);
  return (
    <Modal
      width={600}
      onClose={() => setModal(null)}
      icon={<span className="tile tile-md t-blue">{opt ? opt.icon : <Plus size={20} />}</span>}
      title={opt ? opt.title : 'Add Sources'}
      subtitle={opt ? opt.sub : 'Lecture videos, textbooks, slides, notes — no manual preprocessing needed.'}
    >
      {!kind && (
        <div className="src-list big">
          {options.map((o) => (
            <button key={o.kind} className="src-row" onClick={() => setKind(o.kind)}>
              <span className={`src-icon ${o.cls}`}>{o.icon}</span>
              <span className="src-text">
                <strong>{o.title}</strong>
                <span>{o.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {kind && !initial && (
        <button className="link-btn back" onClick={() => setKind(undefined)}>
          <ArrowLeft size={15} /> All source types
        </button>
      )}
      {kind === 'upload' && <UploadForm />}
      {kind === 'youtube' && <UrlForm kind="youtube" />}
      {kind === 'web' && <UrlForm kind="web" />}
      {kind === 'text' && <TextForm />}
      {kind === 'audio' && <Recorder />}
    </Modal>
  );
}

function UploadForm() {
  const { actions, setModal } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const handle = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const { resource, chunks, subject } = await fileToResource(f);
      actions.addResource(resource, chunks, subject);
    }
    setModal(null);
  };
  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => ref.current?.click()}
    >
      <Upload size={30} />
      <strong>Drop files here or click to browse</strong>
      <span className="muted small">PDF, DOCX, PPTX, images, video, audio, TXT/MD (text files are indexed instantly)</span>
      <input ref={ref} type="file" multiple hidden onChange={(e) => handle(e.target.files)} />
    </div>
  );
}

function UrlForm({ kind }: { kind: 'youtube' | 'web' }) {
  const { actions, setModal } = useStore();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const submit = () => {
    const u = url.trim();
    if (kind === 'youtube') {
      const id = youtubeId(u);
      if (!id) return setErr('That doesn’t look like a YouTube link (e.g. https://youtu.be/abc123).');
      actions.addResource({ name: `YouTube · ${id}`, kind: 'youtube', meta: 'Transcript queued', url: u });
    } else {
      if (!isUrl(u)) return setErr('Enter a full URL starting with http:// or https://');
      const parsed = new URL(u);
      actions.addResource({ name: `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`.slice(0, 48), kind: 'web', meta: 'Web page', url: u });
    }
    setModal(null);
  };
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span>{kind === 'youtube' ? 'YouTube link' : 'Page URL'}</span>
        <input
          className="input"
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setErr('');
          }}
          placeholder={kind === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
        />
      </label>
      {err && <p className="error">{err}</p>}
      <p className="muted small">
        {kind === 'youtube'
          ? 'We’ll fetch the transcript and link every excerpt to its timestamp.'
          : 'We’ll extract the main text and keep the URL as the citation.'}
      </p>
      <button className="btn btn-dark" disabled={!url.trim()}>
        Add source
      </button>
    </form>
  );
}

function TextForm() {
  const { actions, setModal } = useStore();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        const name = title.trim() || 'Pasted notes';
        const chunks = textToChunks(text, name);
        actions.addResource({ name, kind: 'notes', meta: `${chunks.length} sections`, text }, chunks);
        setModal(null);
      }}
    >
      <label className="field">
        <span>Title</span>
        <input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lecture 7 notes" />
      </label>
      <label className="field">
        <span>Text</span>
        <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type your notes. The AI Tutor will be able to cite them." />
      </label>
      <button className="btn btn-dark" disabled={text.trim().length < 20}>
        Save &amp; index
      </button>
    </form>
  );
}

function Recorder() {
  const { actions, setModal, toast } = useStore();
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const media = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (!rec) return;
    const t = window.setInterval(() => setSecs((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [rec]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  const start = async () => {
    setSecs(0);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      media.current = new MediaRecorder(stream.current);
      media.current.start();
    } catch {
      toast('Microphone unavailable — recording in demo mode');
    }
    setRec(true);
  };
  const stop = () => {
    media.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    setRec(false);
    const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    actions.addResource({ name: `Recording ${stamp}.webm`, kind: 'audio', meta: `${mm} · transcribing` });
    setModal(null);
  };
  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="recorder">
      <div className={`rec-orb ${rec ? 'on' : ''}`}>
        <Mic size={34} />
      </div>
      <strong className="rec-time">{mm}</strong>
      <span className="muted small">{rec ? 'Recording… the lecture will be transcribed with timestamps.' : 'Record a lecture or your own explanation.'}</span>
      {rec ? (
        <button className="btn btn-pink" onClick={stop}>
          <Square size={14} fill="currentColor" /> Stop &amp; save
        </button>
      ) : (
        <button className="btn btn-dark" onClick={start}>
          <Mic size={16} /> Start recording
        </button>
      )}
    </div>
  );
}

export function CitationModal({ chunkId }: { chunkId: string }) {
  const { state, setModal, goTutorWith } = useStore();
  const nav = useNavigate();
  const c = state.chunks.find((x) => x.id === chunkId);
  const r = state.resources.find((x) => x.id === c?.resourceId);
  if (!c) return null;
  const where = r?.kind === 'video' || r?.kind === 'youtube' ? 'Timestamp' : r?.kind === 'slides' ? 'Slide' : r?.kind === 'image' ? 'Figure' : 'Location';
  return (
    <Modal
      width={620}
      onClose={() => setModal(null)}
      icon={r ? <ResourceIcon kind={r.kind} /> : <FileText size={20} />}
      title={r?.name ?? 'Source'}
      subtitle={`${where}: ${c.location} · Topic: ${c.topic}`}
      footer={
        <>
          {r && (
            <button className="btn btn-light" onClick={() => setModal({ type: 'resource', resourceId: r.id })}>
              Open full source
            </button>
          )}
          <span className="grow" />
          <button
            className="btn btn-dark"
            onClick={() => {
              goTutorWith(`Tell me more about ${c.topic}`);
              setModal(null);
              nav('/tutor');
            }}
          >
            <Sparkles size={15} /> Ask a follow-up
          </button>
        </>
      }
    >
      <div className="citation-view">
        <div className={`cite-preview k-${r?.kind ?? 'pdf'}`}>
          <span className="cite-loc">{c.location}</span>
          <blockquote>{c.text}</blockquote>
        </div>
        <div className="chip-row">
          {c.keywords.slice(0, 6).map((k) => (
            <span key={k} className="chip">
              {k}
            </span>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function ResourceModal({ resourceId }: { resourceId: string }) {
  const { state, actions, setModal, goTutorWith } = useStore();
  const nav = useNavigate();
  const r = state.resources.find((x) => x.id === resourceId);
  if (!r) return null;
  const chunks = state.chunks.filter((c) => c.resourceId === r.id);
  return (
    <Modal
      width={680}
      onClose={() => setModal(null)}
      icon={<ResourceIcon kind={r.kind} />}
      title={r.name}
      subtitle={`${r.meta} · Added ${r.date} · ${r.status === 'ready' ? 'Indexed' : 'Analyzing…'}`}
      footer={
        <>
          <button
            className="btn btn-light danger"
            onClick={() => {
              actions.deleteResource(r.id);
              setModal(null);
            }}
          >
            <Trash size={15} /> Remove
          </button>
          <span className="grow" />
          {r.url && (
            <a className="btn btn-light" href={r.url} target="_blank" rel="noreferrer">
              Open link
            </a>
          )}
          <button
            className="btn btn-dark"
            onClick={() => {
              goTutorWith(`Summarize ${chunks[0]?.topic ?? r.name.replace(/\.[a-z0-9]+$/i, '')}`);
              setModal(null);
              nav('/tutor');
            }}
          >
            <Sparkles size={15} /> Ask about this
          </button>
        </>
      }
    >
      {chunks.length === 0 ? (
        <p className="muted">
          {r.status === 'processing'
            ? 'This source is still being analyzed. Extracted excerpts will appear here.'
            : 'No text excerpts were extracted from this source yet. In the full system the backend transcribes videos/audio and runs OCR on images and slides.'}
        </p>
      ) : (
        <div className="chunk-list">
          <span className="small-label">{chunks.length} extracted excerpts</span>
          {chunks.map((c) => (
            <button key={c.id} className="chunk" onClick={() => setModal({ type: 'citation', chunkId: c.id })}>
              <span className="cite-loc">{c.location}</span>
              <span>
                <strong>{c.topic}</strong> — {c.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
