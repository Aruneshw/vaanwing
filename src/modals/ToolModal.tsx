import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AudioLines,
  BookMarked,
  ChartColumnIncreasing,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Network,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Shuffle,
  Table,
  Save,
} from 'lucide-react';
import { Modal, Progress } from '../components/ui';
import { concepts } from '../data';
import { useStore, type ToolKind } from '../store';
import { firstSentence, flashcards, sourceLabel, topicsFrom } from '../tutor';

const meta: Record<ToolKind, { title: string; sub: string; icon: ReactNode; theme: string }> = {
  notes: { title: 'Notes', sub: 'Structured study notes generated from your sources', icon: <FileText size={20} />, theme: 'blue' },
  flashcards: { title: 'Flashcards', sub: 'Tap a card to flip it', icon: <Layers size={20} />, theme: 'yellow' },
  slides: { title: 'Slide Deck', sub: 'A revision deck built from your materials', icon: <Presentation size={20} />, theme: 'pink' },
  mindmap: { title: 'Mind Map', sub: 'Topics and how they connect — click a node to ask about it', icon: <Network size={20} />, theme: 'blue' },
  audio: { title: 'Audio Brief', sub: 'A short spoken recap you can listen to', icon: <AudioLines size={20} />, theme: 'purple' },
  summary: { title: 'Summary', sub: 'Key points with citations', icon: <BookMarked size={20} />, theme: 'green' },
  reports: { title: 'Reports', sub: 'Your learner model: mastery per concept and quiz trend', icon: <ChartColumnIncreasing size={20} />, theme: 'yellow' },
  table: { title: 'Data Table', sub: 'Every extracted excerpt with its source location', icon: <Table size={20} />, theme: 'pink' },
};

export default function ToolModal({ tool }: { tool: ToolKind }) {
  const { setModal } = useStore();
  const [loading, setLoading] = useState(tool !== 'reports');
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(t);
  }, []);
  const m = meta[tool];
  return (
    <Modal
      width={tool === 'mindmap' || tool === 'table' ? 900 : 760}
      onClose={() => setModal(null)}
      icon={<span className={`tile tile-md t-${m.theme}`}>{m.icon}</span>}
      title={m.title}
      subtitle={m.sub}
    >
      {loading ? (
        <div className="generating">
          <span className="spinner" />
          Generating from your sources…
        </div>
      ) : (
        <>
          {tool === 'notes' && <NotesTool />}
          {tool === 'flashcards' && <FlashcardsTool />}
          {tool === 'slides' && <SlidesTool />}
          {tool === 'mindmap' && <MindMapTool />}
          {tool === 'audio' && <AudioTool />}
          {tool === 'summary' && <SummaryTool />}
          {tool === 'reports' && <ReportsTool />}
          {tool === 'table' && <TableTool />}
        </>
      )}
    </Modal>
  );
}

function useTopics() {
  const { state } = useStore();
  return useMemo(() => topicsFrom(state.chunks), [state.chunks]);
}

function Cite({ chunkId, label }: { chunkId: string; label: string }) {
  const { setModal } = useStore();
  return (
    <button className="cite-chip sm" onClick={() => setModal({ type: 'citation', chunkId })}>
      <FileText size={12} /> {label}
    </button>
  );
}

function NotesTool() {
  const { state, actions } = useStore();
  const topics = useTopics();
  return (
    <div className="gen-notes">
      {topics.map(({ topic, chunks }) => (
        <section key={topic}>
          <h4>{topic}</h4>
          <ul>
            {chunks.map((c) => (
              <li key={c.id}>
                {c.text} <Cite chunkId={c.id} label={sourceLabel(c, state.resources)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="gen-actions">
        <button
          className="btn btn-dark"
          onClick={() =>
            topics.forEach(({ topic, chunks }) =>
              actions.addNote({ subjectId: state.lastLesson.subjectId, title: topic, body: chunks.map((c) => `${c.text} (${sourceLabel(c, state.resources)})`).join('\n') }),
            )
          }
        >
          <Save size={16} /> Save all to my notes
        </button>
        <DownloadBtn
          name="studynest-notes.md"
          content={() => topics.map(({ topic, chunks }) => `## ${topic}\n${chunks.map((c) => `- ${c.text} (${sourceLabel(c, state.resources)})`).join('\n')}`).join('\n\n')}
        />
      </div>
    </div>
  );
}

function DownloadBtn({ name, content }: { name: string; content: () => string }) {
  return (
    <button
      className="btn btn-light"
      onClick={() => {
        const url = URL.createObjectURL(new Blob([content()], { type: 'text/markdown' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download size={16} /> Download
    </button>
  );
}

function FlashcardsTool() {
  const { state } = useStore();
  const [cards, setCards] = useState(() => flashcards(state.chunks));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const card = cards[i];
  const go = (d: number) => {
    setFlipped(false);
    setI((x) => (x + d + cards.length) % cards.length);
  };
  if (!card) return <p className="muted">Add sources to generate flashcards.</p>;
  return (
    <div className="flash">
      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="fc-face front">
          <span className="small-label">Question</span>
          <strong>{card.front}</strong>
          <span className="muted small">Click to reveal</span>
        </div>
        <div className="fc-face back">
          <span className="small-label">Answer</span>
          <p>{card.back}</p>
        </div>
      </div>
      <div className="flash-bar">
        <button className="icon-btn soft" onClick={() => go(-1)} aria-label="Previous">
          <ChevronLeft size={18} />
        </button>
        <span className="muted">
          {i + 1} / {cards.length} · {known} known
        </span>
        <button className="icon-btn soft" onClick={() => go(1)} aria-label="Next">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="gen-actions center">
        <button className="btn btn-light" onClick={() => go(1)}>
          <RotateCcw size={16} /> Again
        </button>
        <button
          className="btn btn-success"
          onClick={() => {
            setKnown((k) => k + 1);
            go(1);
          }}
        >
          Got it
        </button>
        <button
          className="btn btn-light"
          onClick={() => {
            setCards((c) => [...c].sort(() => Math.random() - 0.5));
            setI(0);
            setFlipped(false);
          }}
        >
          <Shuffle size={16} /> Shuffle
        </button>
      </div>
    </div>
  );
}

function SlidesTool() {
  const { state } = useStore();
  const topics = useTopics();
  const slides = [
    { title: 'Revision Deck', bullets: [`${topics.length} topics from ${state.resources.length} sources`, 'Every point links back to its source'], src: '' },
    ...topics.map(({ topic, chunks }) => ({
      title: topic,
      bullets: chunks.slice(0, 3).map((c) => firstSentence(c.text)),
      src: chunks.map((c) => sourceLabel(c, state.resources)).join(' · '),
    })),
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);
  const s = slides[i];
  return (
    <div className="deck">
      <div className={`slide ${i === 0 ? 'cover' : ''}`}>
        <span className="slide-num">
          {i + 1}/{slides.length}
        </span>
        <h3>{s.title}</h3>
        <ul>
          {s.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {s.src && <span className="slide-src">Sources: {s.src}</span>}
      </div>
      <div className="flash-bar">
        <button className="icon-btn soft" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous slide">
          <ChevronLeft size={18} />
        </button>
        <div className="dots">
          {slides.map((_, k) => (
            <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
          ))}
        </div>
        <button className="icon-btn soft" disabled={i === slides.length - 1} onClick={() => setI(i + 1)} aria-label="Next slide">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function MindMapTool() {
  const { setModal, goTutorWith } = useStore();
  const nav = useNavigate();
  const topics = useTopics().slice(0, 12);
  const W = 860;
  const H = 460;
  const cx = W / 2;
  const cy = H / 2;
  const colors = ['#9cc3e6', '#f5d27a', '#f4a892', '#93ccaa', '#c8b2ec', '#f1a1b3'];
  const ask = (t: string) => {
    goTutorWith(`Explain ${t}`);
    setModal(null);
    nav('/tutor');
  };
  return (
    <div className="mindmap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {topics.map(({ topic }, i) => {
          const a = (i / topics.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 320;
          const y = cy + Math.sin(a) * 170;
          return <path key={topic + 'l'} d={`M${cx},${cy} Q${(cx + x) / 2},${cy} ${x},${y}`} stroke={colors[i % colors.length]} strokeWidth="2.5" fill="none" />;
        })}
        <g className="mm-center">
          <rect x={cx - 85} y={cy - 26} width="170" height="52" rx="26" fill="#2b2b2b" />
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontWeight="700" fontSize="16">
            Your Course
          </text>
        </g>
        {topics.map(({ topic, chunks }, i) => {
          const a = (i / topics.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 320;
          const y = cy + Math.sin(a) * 170;
          const w = Math.max(110, topic.length * 8.5 + 30);
          return (
            <g key={topic} className="mm-node" onClick={() => ask(topic)}>
              <rect x={x - w / 2} y={y - 22} width={w} height="44" rx="14" fill="#fff" stroke={colors[i % colors.length]} strokeWidth="2" />
              <text x={x} y={y - 1} textAnchor="middle" fontSize="13.5" fontWeight="600" fill="#2b2b2b">
                {topic}
              </text>
              <text x={x} y={y + 14} textAnchor="middle" fontSize="10.5" fill="#8a857f">
                {chunks.length} source{chunks.length > 1 ? 's' : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AudioTool() {
  const { state } = useStore();
  const topics = useTopics();
  const script = useMemo(
    () =>
      `Hi ${state.userName}, here is your audio brief. ` +
      topics
        .slice(0, 6)
        .map(({ topic, chunks }) => `${topic}. ${firstSentence(chunks[0].text)}`)
        .join(' ') +
      ' That is the recap. Try the adaptive quiz next to lock it in.',
    [topics, state.userName],
  );
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => {
    window.speechSynthesis?.cancel();
  }, []);
  const toggle = () => {
    if (!supported) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(script);
    u.rate = rate;
    u.onend = () => setPlaying(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setPlaying(true);
  };
  return (
    <div className="audio-brief">
      <div className="audio-player">
        <button className="big-play dark" onClick={toggle} aria-label={playing ? 'Stop' : 'Play'}>
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
        <div className={`wave ${playing ? 'on' : ''}`}>
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} style={{ height: `${20 + ((i * 47) % 70)}%`, animationDelay: `${(i % 9) * 0.08}s` }} />
          ))}
        </div>
        <select className="input xs" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
          {[0.75, 1, 1.25, 1.5].map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </div>
      {!supported && <p className="muted small">Speech playback isn’t supported in this browser — read the transcript below.</p>}
      <span className="small-label">Transcript</span>
      <p className="transcript">{script}</p>
    </div>
  );
}

function SummaryTool() {
  const { state } = useStore();
  const topics = useTopics();
  return (
    <div className="gen-notes">
      <p className="muted">
        {state.resources.length} sources · {topics.length} topics · {state.chunks.length} excerpts
      </p>
      <ol className="summary-list">
        {topics.map(({ topic, chunks }) => (
          <li key={topic}>
            <strong>{topic}:</strong> {firstSentence(chunks[0].text)} <Cite chunkId={chunks[0].id} label={sourceLabel(chunks[0], state.resources)} />
          </li>
        ))}
      </ol>
      <div className="gen-actions">
        <DownloadBtn name="studynest-summary.md" content={() => topics.map(({ topic, chunks }) => `- **${topic}:** ${firstSentence(chunks[0].text)}`).join('\n')} />
      </div>
    </div>
  );
}

function ReportsTool() {
  const { state, stats, setModal } = useStore();
  const rows = concepts
    .filter((c) => state.subjects.some((s) => s.id === c.subjectId))
    .map((c) => ({ ...c, m: state.mastery[c.id] ?? 0.3 }))
    .sort((a, b) => a.m - b.m);
  const hist = state.quizHistory.slice(-10);
  return (
    <div className="reports">
      <div className="kpis">
        <div>
          <strong>{stats.avgScore}%</strong>
          <span>Average score</span>
        </div>
        <div>
          <strong>{stats.quizzes}</strong>
          <span>Quizzes</span>
        </div>
        <div>
          <strong>{rows.filter((r) => r.m >= 0.8).length}</strong>
          <span>Concepts mastered</span>
        </div>
        <div>
          <strong>{rows.filter((r) => r.m < 0.45).length}</strong>
          <span>Need attention</span>
        </div>
      </div>
      <span className="small-label">Quiz scores (last {hist.length})</span>
      <div className="hist-bars">
        {hist.map((h) => {
          const p = Math.round((h.score / h.total) * 100);
          return (
            <div key={h.id} className="hb">
              <span style={{ height: `${p}%` }} className={p >= 80 ? 'g' : p >= 60 ? 'y' : 'r'} />
              <em>{p}</em>
            </div>
          );
        })}
      </div>
      <span className="small-label">Mastery by concept (weakest first)</span>
      <div className="mastery-list">
        {rows.map((r) => (
          <div key={r.id} className="report-row">
            <span>{r.name}</span>
            <Progress value={r.m * 100} height={8} theme={r.m < 0.45 ? 'pink' : r.m < 0.7 ? 'yellow' : 'green'} />
            <span className="delta-txt">{Math.round(r.m * 100)}%</span>
          </div>
        ))}
      </div>
      <div className="gen-actions">
        <button className="btn btn-dark" onClick={() => setModal({ type: 'quiz', adaptive: true, count: 5, conceptIds: rows.slice(0, 3).map((r) => r.id) })}>
          Practice weakest concepts
        </button>
      </div>
    </div>
  );
}

function TableTool() {
  const { state, setModal } = useStore();
  const [q, setQ] = useState('');
  const rows = state.chunks.filter((c) => (c.topic + c.text).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="data-table">
      <input className="input" placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Source</th>
              <th>Location</th>
              <th>Excerpt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} onClick={() => setModal({ type: 'citation', chunkId: c.id })}>
                <td>
                  <strong>{c.topic}</strong>
                </td>
                <td>{state.resources.find((r) => r.id === c.resourceId)?.name}</td>
                <td>{c.location}</td>
                <td className="excerpt">{c.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="gen-actions">
        <DownloadBtn
          name="studynest-table.csv"
          content={() =>
            'topic,source,location,excerpt\n' +
            rows.map((c) => [c.topic, state.resources.find((r) => r.id === c.resourceId)?.name ?? '', c.location, c.text].map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
          }
        />
      </div>
    </div>
  );
}
