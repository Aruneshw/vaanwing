import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Ellipsis,
  EllipsisVertical,
  FileText,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Layers,
  Link as LinkIcon,
  ListFilter,
  Lock,
  LockOpen,
  Mic,
  Network,
  NotebookPen,
  Paperclip,
  Pencil,
  Plus,
  Presentation,
  Radical,
  RefreshCw,
  ScanSearch,
  Search,
  Send,
  Sparkles,
  Table,
  Target,
  Trash,
  TriangleAlert,
  Volume2,
  ChartColumnIncreasing,
  Menu,
  X,
  SquarePen,
  BookMarked,
} from 'lucide-react';
import { suggestedQuestionPool, type ResourceKind } from '../data';
import { useStore, type ChatMessage, type ToolKind, type ModalState } from '../store';
import { answer } from '../tutor';
import { YouTubeIcon } from '../components/Icons';
import { useClickOutside } from '../components/ui';
import { fileToResource } from '../sources';
import EvalCard from '../components/EvalCard';

const osSuggestions = [
  { q: 'What are the four necessary conditions for deadlock?', from: 'from my OS notes', theme: 'blue' as const },
  { q: 'Explain paging and the TLB', from: 'from my OS notes', theme: 'yellow' as const },
  { q: 'Create a mind map for operating systems', from: 'with source links', theme: 'pink' as const },
  { q: 'Give me a quick test', from: 'adaptive, 5 questions', theme: 'green' as const },
  { q: 'What is a race condition?', from: 'from my OS notes', theme: 'purple' as const },
  { q: 'How does SSTF disk scheduling work?', from: 'from my OS notes', theme: 'blue' as const },
  { q: 'What does the process control block store?', from: 'from my OS notes', theme: 'yellow' as const },
  { q: 'How should passwords be stored?', from: 'from my OS notes', theme: 'pink' as const },
];

export const modes = [
  { id: 'course', label: 'Study Mode (Course Only)', desc: 'Answers only from your sources; declines otherwise.' },
  { id: 'guided', label: 'Guided Learning', desc: 'Socratic hints and self-checks, still source-grounded.' },
  { id: 'exam', label: 'Exam Prep', desc: 'Concise, exam-style answers with likely questions.' },
  { id: 'open', label: 'Open Mode (Course + General)', desc: 'May use outside knowledge — always flagged.' },
];

export function ResourceIcon({ kind, size = 'md' }: { kind: ResourceKind; size?: 'sm' | 'md' }) {
  const map: Record<ResourceKind, { el: ReactNode; cls: string }> = {
    pdf: { el: <FileText size={20} />, cls: 'res-dark' },
    video: { el: <YouTubeIcon size={22} />, cls: 'res-red' },
    youtube: { el: <YouTubeIcon size={22} />, cls: 'res-red' },
    slides: { el: <Presentation size={20} />, cls: 'res-yellow' },
    notes: { el: <FileText size={20} />, cls: 'res-blue' },
    image: { el: <ImageIcon size={20} />, cls: 'res-green' },
    web: { el: <LinkIcon size={20} />, cls: 'res-blue' },
    audio: { el: <Mic size={20} />, cls: 'res-purple' },
  };
  const m = map[kind];
  return <span className={`res-icon ${m.cls} ${size}`}>{m.el}</span>;
}

const tools: { id: ToolKind; label: string; icon: ReactNode; theme: string }[] = [
  { id: 'notes', label: 'Notes', icon: <FileText size={20} />, theme: 'blue' },
  { id: 'flashcards', label: 'Flashcards', icon: <Layers size={20} />, theme: 'yellow' },
  { id: 'slides', label: 'Slide Deck', icon: <Presentation size={20} />, theme: 'pink' },
  { id: 'mindmap', label: 'Mind Map', icon: <Network size={20} />, theme: 'blue' },
  { id: 'audio', label: 'Audio Brief', icon: <AudioLines size={20} />, theme: 'purple' },
  { id: 'summary', label: 'Summary', icon: <BookMarked size={20} />, theme: 'green' },
  { id: 'reports', label: 'Reports', icon: <ChartColumnIncreasing size={20} />, theme: 'yellow' },
  { id: 'table', label: 'Data Table', icon: <Table size={20} />, theme: 'pink' },
];

function renderRich(text: string, onCite: (n: number) => void) {
  return text.split('\n').map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
        const m = part.match(/^\[(\d+)\]$/);
        if (m)
          return (
            <button key={i} className="cite" onClick={() => onCite(Number(m[1]))}>
              {m[1]}
            </button>
          );
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  ));
}

export default function Tutor() {
  const { state, actions, setModal, toast, pendingTutorQuery, setPendingTutorQuery } = useStore();
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<string | undefined>();
  const [thinking, setThinking] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [searchType, setSearchType] = useState<'ai' | 'keyword'>('ai');
  const [modeOpen, setModeOpen] = useState(false);
  const [searchTypeOpen, setSearchTypeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [suggestSeed, setSuggestSeed] = useState(0);
  const [resQuery, setResQuery] = useState('');
  const [resSearchOpen, setResSearchOpen] = useState(false);
  const [resFilter, setResFilter] = useState<ResourceKind | 'all'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const stRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(modeRef, useCallback(() => setModeOpen(false), []), modeOpen);
  useClickOutside(stRef, useCallback(() => setSearchTypeOpen(false), []), searchTypeOpen);
  useClickOutside(moreRef, useCallback(() => setMoreOpen(false), []), moreOpen);
  useClickOutside(filterRef, useCallback(() => setFilterOpen(false), []), filterOpen);
  useClickOutside(menuRef, useCallback(() => setMenuFor(null), []), !!menuFor);

  const mode = modes.find((m) => m.id === state.tutorMode) ?? modes[0];

  const ask = useCallback(
    (raw: string, forcedIntent?: string) => {
      const q = raw.trim();
      if (!q || thinking) return;
      actions.pushChat({ role: 'user', text: q });
      setInput('');
      const lowerQ = q.toLowerCase();
      if (/practice question|quiz me|\btest me\b|(give|take|start|want)( me)? (a |an )?(quick |simple |short |small )?(test|quiz)|^(test|quiz)$/.test(lowerQ)) {
        const hasOs = state.subjects.some((s) => s.id === 'os') && !/machine|data science|python|math|web/.test(lowerQ);
        const modal: ModalState = { type: 'quiz', adaptive: true, count: 5, subjectId: hasOs ? 'os' : undefined };
        window.setTimeout(() => {
          actions.pushChat({
            role: 'assistant',
            grounded: 'source',
            text: `Here's a quick **5-question adaptive test**${hasOs ? ' on **Operating Systems**' : ''}. It targets your weakest topics first, each question cites the page it comes from, and your mastery updates after every answer.`,
            actions: [{ label: 'Start the test', modal }],
          });
          setModal(modal);
        }, 400);
        return;
      }
      setThinking(true);
      const useIntent = forcedIntent ?? intent;
      setIntent(undefined);
      const lower = q.toLowerCase();
      window.setTimeout(() => {
        const res = answer(q, state.chunks, { mode: state.tutorMode, webSearch, intent: useIntent });
        actions.pushChat({ role: 'assistant', text: res.text, citations: res.citations, grounded: res.grounded });
        actions.logActivity('chat', `Asked AI Tutor: ${q.length > 38 ? q.slice(0, 38) + '…' : q}`);
        setThinking(false);
        // Requests that map onto a learning tool also open it
        if (lower.includes('mind map')) setModal({ type: 'tool', tool: 'mindmap' });
        else if (/practice question|quiz me|\btest me\b|give me a (quick |simple |short )?(test|quiz)|take a (quick |simple )?(test|quiz)/.test(lower))
          setModal({ type: 'quiz', adaptive: true, count: 5, subjectId: state.subjects.some((s) => s.id === 'os') && !/machine|data science|python/.test(lower) ? 'os' : undefined });
      }, 650 + Math.random() * 500);
    },
    [actions, intent, state.chunks, state.tutorMode, thinking, webSearch, setModal],
  );

  // A question handed over from another page (e.g. "Ask AI Tutor" on a concept)
  useEffect(() => {
    if (pendingTutorQuery) {
      setPendingTutorQuery(null);
      ask(pendingTutorQuery);
    }
  }, [pendingTutorQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.chat.length, thinking]);

  const hasOs = state.subjects.some((s) => s.id === 'os');
  const suggestions = useMemo(() => {
    const pool = hasOs ? osSuggestions : suggestedQuestionPool;
    const start = (suggestSeed * 4) % pool.length;
    return Array.from({ length: 4 }, (_, i) => pool[(start + i) % pool.length]);
  }, [suggestSeed, hasOs]);

  const filtered = state.resources.filter(
    (r) => (resFilter === 'all' || r.kind === resFilter || (resFilter === 'video' && r.kind === 'youtube')) && r.name.toLowerCase().includes(resQuery.toLowerCase()),
  );
  const visible = showAll ? filtered : filtered.slice(0, 5);

  const quick = (label: string, key: string) => {
    if (input.trim()) {
      ask(input, key);
      return;
    }
    setIntent(key);
    const prefix: Record<string, string> = { explain: 'Explain ', solve: 'Solve: ', notes: 'Create notes on ', summarize: 'Summarize ' };
    setInput(prefix[key] ?? '');
    inputRef.current?.focus();
    toast(`${label}: type a topic and press send`);
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach(async (f) => {
      const { resource, chunks, subject } = await fileToResource(f);
      actions.addResource(resource, chunks, subject);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const citeOpen = (msg: ChatMessage, n: number) => {
    const c = msg.citations?.find((x) => x.n === n);
    if (c) setModal({ type: 'citation', chunkId: c.chunkId });
  };

  const sourceRows: { kind: NonNullable<Extract<ModalState, { type: 'addSource' }>['kind']>; title: string; sub: string; icon: ReactNode; cls: string }[] = [
    { kind: 'upload', title: 'Upload Files', sub: 'PDF, Docs, PPT, Images', icon: <FileText size={20} />, cls: 'src-pink' },
    { kind: 'youtube', title: 'YouTube Video', sub: 'Paste link or upload', icon: <YouTubeIcon size={22} />, cls: 'src-red' },
    { kind: 'web', title: 'Web Page', sub: 'Add URL for web content', icon: <LinkIcon size={20} />, cls: 'src-blue' },
    { kind: 'text', title: 'Text / Notes', sub: 'Paste text or take notes', icon: <SquarePen size={20} />, cls: 'src-yellow' },
    { kind: 'audio', title: 'Record Audio', sub: 'Lecture recording', icon: <Mic size={20} />, cls: 'src-purple' },
  ];

  const stage = (threshold: number) => state.analysis >= threshold;

  return (
    <main className="page tutor">
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.mp3,.wav,.m4a"
        onChange={(e) => onFiles(e.target.files)}
      />

      {/* SOURCES */}
      <aside className="card glass sources">
        <h2>Sources</h2>
        <button className="btn btn-dark btn-block" onClick={() => setModal({ type: 'addSource' })}>
          <Plus size={20} /> Add Sources
        </button>
        <div className="src-list">
          {sourceRows.map((s) => (
            <button key={s.kind} className="src-row" onClick={() => (s.kind === 'upload' ? fileRef.current?.click() : setModal({ type: 'addSource', kind: s.kind }))}>
              <span className={`src-icon ${s.cls}`}>{s.icon}</span>
              <span className="src-text">
                <strong>{s.title}</strong>
                <span>{s.sub}</span>
              </span>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>

        <div className="res-head">
          <h3>My Resources</h3>
          <button className={`icon-btn ghost sm ${resSearchOpen ? 'on' : ''}`} aria-label="Search resources" onClick={() => setResSearchOpen((o) => !o)}>
            <Search size={19} />
          </button>
          <div className="dropdown-wrap" ref={filterRef}>
            <button className={`icon-btn ghost sm ${resFilter !== 'all' ? 'on' : ''}`} aria-label="Filter resources" onClick={() => setFilterOpen((o) => !o)}>
              <ListFilter size={19} />
            </button>
            {filterOpen && (
              <div className="dropdown filter-menu">
                {(['all', 'pdf', 'video', 'slides', 'notes', 'image', 'web', 'audio'] as const).map((k) => (
                  <button
                    key={k}
                    className={`menu-item ${resFilter === k ? 'selected' : ''}`}
                    onClick={() => {
                      setResFilter(k);
                      setFilterOpen(false);
                    }}
                  >
                    {k === 'all' ? 'All types' : k[0].toUpperCase() + k.slice(1)}
                    {resFilter === k && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {resSearchOpen && (
          <label className="search-box sm">
            <Search size={16} />
            <input autoFocus value={resQuery} onChange={(e) => setResQuery(e.target.value)} placeholder="Find a resource…" />
            {resQuery && (
              <button className="icon-btn ghost xs" onClick={() => setResQuery('')} aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </label>
        )}
        <ul className="res-list">
          {visible.length === 0 && <li className="muted small pad">No resources match.</li>}
          {visible.map((r) => (
            <li key={r.id} className="res-row">
              <button className="res-main" onClick={() => setModal({ type: 'resource', resourceId: r.id })}>
                <ResourceIcon kind={r.kind} />
                <span className="res-text">
                  {renaming?.id === r.id ? (
                    <input
                      className="input xs"
                      autoFocus
                      value={renaming.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenaming({ id: r.id, name: e.target.value })}
                      onBlur={() => {
                        if (renaming.name.trim()) actions.renameResource(r.id, renaming.name.trim());
                        setRenaming(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    <strong>{r.name}</strong>
                  )}
                  <span>
                    {r.status === 'processing' ? <em className="processing">Analyzing…</em> : r.meta} • {r.date}
                  </span>
                </span>
              </button>
              <div className="dropdown-wrap" ref={menuFor === r.id ? menuRef : undefined}>
                <button className="icon-btn ghost sm" aria-label="Resource actions" onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}>
                  <EllipsisVertical size={18} />
                </button>
                {menuFor === r.id && (
                  <div className="dropdown res-menu">
                    <button className="menu-item" onClick={() => { setMenuFor(null); setModal({ type: 'resource', resourceId: r.id }); }}>
                      <BookOpen size={15} /> Open
                    </button>
                    <button className="menu-item" onClick={() => { setMenuFor(null); ask(`Summarize ${r.name.replace(/\.[a-z0-9]+$/i, '')}`, 'summarize'); }}>
                      <Sparkles size={15} /> Ask about this
                    </button>
                    <button className="menu-item" onClick={() => { setMenuFor(null); setRenaming({ id: r.id, name: r.name }); }}>
                      <Pencil size={15} /> Rename
                    </button>
                    <button className="menu-item danger" onClick={() => { setMenuFor(null); actions.deleteResource(r.id); }}>
                      <Trash size={15} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {filtered.length > 5 && (
          <button className="btn btn-light btn-block show-more" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show less' : `Show more`}
          </button>
        )}
      </aside>

      {/* CENTER */}
      <section className="card glass tutor-main">
        <div className="tutor-head">
          <Sparkles size={34} className="sparkle-blue" fill="#5b8fe0" color="#5b8fe0" />
          <div>
            <h2>AI Tutor</h2>
            <p>Your personal, source-grounded study companion</p>
          </div>
          <div className="dropdown-wrap mode-wrap" ref={modeRef}>
            <button className="mode-btn" onClick={() => setModeOpen((o) => !o)}>
              <GraduationCap size={20} />
              <span>{mode.label}</span>
              <ChevronDown size={18} />
            </button>
            {modeOpen && (
              <div className="dropdown mode-menu">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    className={`menu-item col ${m.id === mode.id ? 'selected' : ''}`}
                    onClick={() => {
                      actions.setTutorMode(m.id);
                      setModeOpen(false);
                      toast(`Switched to ${m.label}`);
                    }}
                  >
                    <span className="mi-row">
                      {m.label} {m.id === mode.id && <Check size={15} />}
                    </span>
                    <span className="muted small">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {state.chat.length === 0 && !thinking ? (
          <div className="greeting">
            <span className="g-blob g1" />
            <span className="g-blob g2" />
            <span className="g-blob g3" />
            <span className="g-blob g4" />
            <h1>Hi {state.userName}!</h1>
            <p>Ask me anything about your uploaded materials. I'll answer with citations from your sources.</p>
          </div>
        ) : (
          <div className="thread-wrap">
            <div className="thread-bar">
              <span className="muted small">
                {state.chat.filter((m) => m.role === 'user').length} questions · grounded in {state.resources.length} sources
              </span>
              <button className="link-btn" onClick={() => actions.clearChat()}>
                <Plus size={14} /> New chat
              </button>
            </div>
            <div className="thread" ref={threadRef}>
              {state.chat.map((m) => (
                <div key={m.id} className={`msg ${m.role}`}>
                  {m.role === 'assistant' && (
                    <span className="msg-avatar">
                      <Sparkles size={16} />
                    </span>
                  )}
                  <div className={`bubble ${m.grounded ?? ''}`}>
                    {m.grounded === 'declined' && (
                      <span className="flag decline">
                        <Info size={13} /> Not in your sources
                      </span>
                    )}
                    {m.grounded === 'outside' && (
                      <span className="flag outside">
                        <TriangleAlert size={13} /> Outside knowledge — not source-backed
                      </span>
                    )}
                    {m.grounded === 'source' && (
                      <span className="flag source">
                        <Check size={13} /> Source-grounded
                      </span>
                    )}
                    <div className="bubble-text">{renderRich(m.text, (n) => citeOpen(m, n))}</div>
                    {!!m.citations?.length && (
                      <div className="cite-list">
                        {m.citations.map((c) => {
                          const ch = state.chunks.find((x) => x.id === c.chunkId);
                          const r = state.resources.find((x) => x.id === ch?.resourceId);
                          return (
                            <button key={c.n} className="cite-chip" onClick={() => setModal({ type: 'citation', chunkId: c.chunkId })}>
                              <span className="cite">{c.n}</span>
                              {r?.name ?? 'Source'} · {ch?.location}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!!m.actions?.length && (
                      <div className="chat-cta">
                        {m.actions.map((a) => (
                          <button key={a.label} className="btn btn-dark btn-sm" onClick={() => setModal(a.modal)}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && (
                      <div className="msg-actions">
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText(m.text.replace(/\*\*/g, '')).then(
                              () => toast('Copied to clipboard'),
                              () => toast('Copy not available'),
                            );
                          }}
                        >
                          <Copy size={14} /> Copy
                        </button>
                        <button
                          onClick={() =>
                            actions.addNote({
                              subjectId: state.lastLesson.subjectId,
                              title: (m.text.match(/\*\*([^*]+)\*\*/)?.[1] ?? 'AI Tutor answer').slice(0, 60),
                              body: m.text.replace(/\*\*/g, ''),
                            })
                          }
                        >
                          <NotebookPen size={14} /> Save to notes
                        </button>
                        <button
                          onClick={() => {
                            if (!('speechSynthesis' in window)) return toast('Speech not supported in this browser');
                            window.speechSynthesis.cancel();
                            window.speechSynthesis.speak(new SpeechSynthesisUtterance(m.text.replace(/\*\*|\[\d+\]/g, '')));
                          }}
                        >
                          <Volume2 size={14} /> Read aloud
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="msg assistant">
                  <span className="msg-avatar">
                    <Sparkles size={16} />
                  </span>
                  <div className="bubble typing">
                    <i />
                    <i />
                    <i />
                    <span className="muted small">Searching your sources…</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="quick-row">
          <button className="quick" onClick={() => quick('Explain a topic', 'explain')}>
            <BookOpen size={20} className="qi-blue" /> Explain a topic
          </button>
          <button className="quick" onClick={() => quick('Solve a problem', 'solve')}>
            <Radical size={20} className="qi-blue" /> Solve a problem
          </button>
          <button className="quick" onClick={() => quick('Create notes', 'notes')}>
            <FileText size={20} className="qi-pink" /> Create notes
          </button>
          <button className="quick" onClick={() => quick('Summarize', 'summarize')}>
            <Menu size={20} className="qi-purple" /> Summarize
          </button>
          <div className="dropdown-wrap" ref={moreRef}>
            <button className="quick more" aria-label="More actions" onClick={() => setMoreOpen((o) => !o)}>
              <Ellipsis size={20} />
            </button>
            {moreOpen && (
              <div className="dropdown more-menu">
                <button className="menu-item" onClick={() => { setMoreOpen(false); setModal({ type: 'tool', tool: 'flashcards' }); }}>
                  <Layers size={15} /> Make flashcards
                </button>
                <button className="menu-item" onClick={() => { setMoreOpen(false); setModal({ type: 'tool', tool: 'mindmap' }); }}>
                  <Network size={15} /> Build a mind map
                </button>
                <button className="menu-item" onClick={() => { setMoreOpen(false); setModal({ type: 'quiz', adaptive: true, count: 5 }); }}>
                  <Target size={15} /> Quiz me
                </button>
                <button className="menu-item" onClick={() => { setMoreOpen(false); setModal({ type: 'tool', tool: 'audio' }); }}>
                  <AudioLines size={15} /> Audio brief
                </button>
              </div>
            )}
          </div>
        </div>

        <form
          className="ask-box"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask anything about your studies..."
          />
          <div className="ask-row">
            <div className="dropdown-wrap" ref={stRef}>
              <button type="button" className="pill-btn" onClick={() => setSearchTypeOpen((o) => !o)}>
                <ScanSearch size={18} /> {searchType === 'ai' ? 'AI Search' : 'Keyword Search'} <ChevronDown size={15} />
              </button>
              {searchTypeOpen && (
                <div className="dropdown up st-menu">
                  {(
                    [
                      ['ai', 'AI Search', 'Semantic search across all sources'],
                      ['keyword', 'Keyword Search', 'Exact terms only'],
                    ] as const
                  ).map(([k, l, d]) => (
                    <button
                      type="button"
                      key={k}
                      className={`menu-item col ${searchType === k ? 'selected' : ''}`}
                      onClick={() => {
                        setSearchType(k);
                        setSearchTypeOpen(false);
                      }}
                    >
                      <span className="mi-row">
                        {l} {searchType === k && <Check size={14} />}
                      </span>
                      <span className="muted small">{d}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className={`pill-btn ${webSearch ? 'on' : ''}`}
              onClick={() => {
                setWebSearch((w) => !w);
                toast(webSearch ? 'Web Search off — answers stay within your sources' : 'Web Search on — outside info will be flagged');
              }}
            >
              <Globe size={18} /> Web Search
            </button>
            <span className="grow" />
            <button type="button" className="icon-btn ghost" aria-label="Attach file" onClick={() => fileRef.current?.click()}>
              <Paperclip size={21} />
            </button>
            <button type="submit" className="send-btn" aria-label="Send" disabled={!input.trim() || thinking}>
              <Send size={20} fill="currentColor" />
            </button>
          </div>
        </form>

        <div className="suggest-head">
          <span className="sh-title">
            <Search size={18} strokeWidth={2.6} /> Suggested Questions
          </span>
          <button className="link-btn muted" onClick={() => setSuggestSeed((s) => s + 1)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
        <div className="suggest-grid">
          {suggestions.map((s) => (
            <button key={s.q} className={`suggest t-${s.theme}`} onClick={() => ask(s.q)}>
              <span className="sq">{s.q}</span>
              <span className="sfrom">({s.from})</span>
              <span className="round-chev xs">
                <ChevronRight size={14} />
              </span>
            </button>
          ))}
        </div>

        <div className="suggest-head">
          <span className="sh-title">
            <Network size={18} /> Analyzed Content <Info size={15} className="muted" />
          </span>
        </div>
        <div className="analyzed">
          <span className="tile tile-xl t-blue white-in">
            <FileText size={28} />
          </span>
          <div className="an-body">
            <strong>{state.analysis >= 100 ? 'Your knowledge base is ready!' : 'Your materials are being analyzed...'}</strong>
            <span className="muted">
              {state.analysis >= 100
                ? `${state.resources.length} sources · ${state.chunks.length} cited excerpts indexed across topics, concepts and diagrams.`
                : 'Extracting topics, key concepts, diagrams and building your knowledge base.'}
            </span>
            <div className="progress-line">
              <div className="bar t-green" style={{ height: 12 }}>
                <div className="bar-fill" style={{ width: `${state.analysis}%` }} />
              </div>
              <strong>{state.analysis}%</strong>
            </div>
            <div className="stages">
              <span className={`stage blue ${stage(30) ? 'done' : ''}`}>
                <i>{stage(30) && <Check size={12} strokeWidth={4} />}</i> Text content
              </span>
              <span className={`stage yellow ${stage(65) ? 'done' : ''}`}>
                <i>{stage(65) && <Check size={12} strokeWidth={4} />}</i> Diagrams &amp; Images
              </span>
              <span className={`stage red ${stage(85) ? 'done' : ''}`}>
                <i>{stage(85) && <Check size={12} strokeWidth={4} />}</i> Videos (Transcripts)
              </span>
              <span className={`stage purple ${stage(100) ? 'done' : ''}`}>
                <i>{stage(100) && <Check size={12} strokeWidth={4} />}</i> Organizing topics
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* LEARNING TOOLS */}
      <aside className="tutor-right">
        <div className="card glass tools-card">
          <h2>Learning Tools</h2>
          <div className="tool-grid">
            {tools.map((t) => (
              <button key={t.id} className="tool" onClick={() => setModal({ type: 'tool', tool: t.id })}>
                <span className={`tile tile-md t-${t.theme} white-in`}>{t.icon}</span>
                <span>{t.label}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <button className="adaptive" onClick={() => setModal({ type: 'quiz', adaptive: true, count: 5 })}>
            <Target size={42} className="adaptive-ic" />
            <span className="ad-text">
              <strong>Adaptive Quiz</strong>
              <span>Test your understanding based on your uploaded materials.</span>
            </span>
            <span className="round-chev white">
              <ChevronRight size={20} />
            </span>
          </button>
        </div>

        <div className={`card glass personalized ${state.personalizedUnlocked ? 'unlocked' : ''}`}>
          <div className="pl-head">
            <span className="tile tile-xl white">{state.personalizedUnlocked ? <LockOpen size={26} /> : <Lock size={26} />}</span>
            <div>
              <strong>Personalized Learning</strong>
              <span>
                {state.personalizedUnlocked
                  ? 'Your path adapts to your quiz results and weak topics.'
                  : 'Complete adaptive quizzes to unlock your personalized learning path.'}
              </span>
            </div>
            <span className={`lock-badge ${state.personalizedUnlocked ? 'open' : ''}`}>
              {state.personalizedUnlocked ? <LockOpen size={12} /> : <Lock size={12} />} {state.personalizedUnlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>
          <div className="path">
            {['Adaptive Quiz', 'Personalized Learning', 'Weak Topic Lessons', 'Practice & Improve'].map((label, i) => {
              const done = state.personalizedUnlocked && i <= state.pathStep;
              const unlocked = i === 0 || state.personalizedUnlocked;
              return (
                <Fragment key={label}>
                  {i > 0 && <span className={`path-line ${done ? 'done' : ''}`} />}
                  <button
                    className={`path-node ${i === 0 ? 'first' : ''} ${unlocked ? 'unlocked' : ''} ${done ? 'done' : ''}`}
                    onClick={() => {
                      if (i === 0) return setModal({ type: 'quiz', adaptive: true, count: 5 });
                      if (!state.personalizedUnlocked) return toast('Complete an adaptive quiz to unlock this step');
                      setModal({ type: 'path' });
                    }}
                  >
                    <span className="pn-icon">{i === 0 ? <Target size={i === 0 ? 24 : 16} /> : unlocked ? <Check size={16} /> : <Lock size={15} />}</span>
                    <span className="pn-label">{label}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
          <button
            className={`btn btn-block ${state.personalizedUnlocked ? 'btn-dark' : 'btn-locked'}`}
            onClick={() => (state.personalizedUnlocked ? setModal({ type: 'path' }) : setModal({ type: 'quiz', adaptive: true, count: 5 }))}
          >
            {state.personalizedUnlocked ? (
              <>
                <Sparkles size={18} /> Open My Learning Path
              </>
            ) : (
              <>
                <Lock size={18} /> Complete Quiz to Unlock
              </>
            )}
          </button>
        </div>
        <EvalCard />
      </aside>
    </main>
  );
}
