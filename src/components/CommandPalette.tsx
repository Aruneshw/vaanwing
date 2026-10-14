import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Home, Lightbulb, Search, Sparkles, GraduationCap, Target } from 'lucide-react';
import { concepts } from '../data';
import { lessonsOf, useStore } from '../store';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

export default function CommandPalette() {
  const { state, setPaletteOpen, actions, setModal, goTutorWith } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => setPaletteOpen(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (fn: () => void) => () => {
      close();
      fn();
    };
    const list: Item[] = [
      { id: 'p-home', group: 'Pages', label: 'Home', icon: <Home size={16} />, run: go(() => nav('/')) },
      { id: 'p-learn', group: 'Pages', label: 'Learn', icon: <GraduationCap size={16} />, run: go(() => nav('/learn')) },
      { id: 'p-tutor', group: 'Pages', label: 'AI Tutor', icon: <Sparkles size={16} />, run: go(() => nav('/tutor')) },
      { id: 'a-quiz', group: 'Actions', label: 'Start adaptive quiz', icon: <Target size={16} />, run: go(() => setModal({ type: 'quiz', adaptive: true })) },
      { id: 'a-notes', group: 'Actions', label: 'Open my notes', icon: <FileText size={16} />, run: go(() => setModal({ type: 'notes' })) },
      { id: 'a-src', group: 'Actions', label: 'Add a source', icon: <FileText size={16} />, run: go(() => setModal({ type: 'addSource' })) },
      ...state.subjects.map((s) => ({ id: `s-${s.id}`, group: 'Subjects', label: s.name, icon: <BookOpen size={16} />, run: go(() => nav(`/learn/${s.id}`)) })),
      ...state.subjects.flatMap((s) =>
        lessonsOf(s).map((l) => ({ id: `l-${l.id}`, group: 'Lessons', label: l.title, hint: s.name, icon: <BookOpen size={16} />, run: go(() => actions.openLesson(s.id, l.id)) })),
      ),
      ...concepts
        .filter((c) => state.subjects.some((s) => s.id === c.subjectId))
        .map((c) => ({ id: `c-${c.id}`, group: 'Concepts', label: c.name, hint: 'Ask AI Tutor', icon: <Lightbulb size={16} />, run: go(() => { goTutorWith(`Explain ${c.name}`); nav('/tutor'); }) })),
      ...state.resources.map((r) => ({ id: `r-${r.id}`, group: 'Resources', label: r.name, hint: r.meta, icon: <FileText size={16} />, run: go(() => setModal({ type: 'resource', resourceId: r.id })) })),
    ];
    const t = q.trim().toLowerCase();
    if (!t) return list.filter((i) => i.group === 'Pages' || i.group === 'Actions' || i.group === 'Subjects');
    const res = list.filter((i) => (i.label + ' ' + (i.hint ?? '')).toLowerCase().includes(t)).slice(0, 30);
    res.push({ id: 'ask', group: 'AI Tutor', label: `Ask AI Tutor: “${q.trim()}”`, icon: <Sparkles size={16} />, run: go(() => { goTutorWith(q.trim()); nav('/tutor'); }) });
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, state.subjects, state.resources]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  let lastGroup = '';
  return (
    <div className="modal-backdrop top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Search">
        <label className="palette-input">
          <Search size={20} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search lessons, concepts, resources… or ask a question"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === 'Enter') items[active]?.run();
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <div className="palette-list">
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="palette-group">{header}</div>}
                <button className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={it.run}>
                  {it.icon}
                  <span className="grow">{it.label}</span>
                  {it.hint && <span className="muted small">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
