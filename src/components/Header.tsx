import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, RotateCcw, Search, Settings, CheckCheck, User } from 'lucide-react';
import { Logo } from './Icons';
import { useClickOutside } from './ui';
import { timeAgo, useStore } from '../store';

export function Header() {
  const { state, actions, setPaletteOpen, setModal, toast } = useStore();
  const { pathname } = useLocation();
  const onTutor = pathname.startsWith('/tutor');
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  useClickOutside(bellRef, useCallback(() => setBellOpen(false), []), bellOpen);
  useClickOutside(userRef, useCallback(() => setUserOpen(false), []), userOpen);
  const unread = state.notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <header className="topbar">
      <div className={`nav-pill glass ${onTutor ? 'wide' : ''}`}>
        <NavLink to="/" className="brand" aria-label="StudyNest home">
          <Logo />
          <span>StudyNest</span>
        </NavLink>
        <nav className="tabs">
          <NavLink to="/" end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/learn" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            Learn
          </NavLink>
          <NavLink to="/tutor" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            AI Tutor
          </NavLink>
        </nav>
        {onTutor && (
          <button className="search-inline" onClick={() => setPaletteOpen(true)}>
            <Search size={20} />
            <span>Search anything...</span>
            <kbd>Ctrl K</kbd>
          </button>
        )}
      </div>

      <div className="user-pill glass">
        {!onTutor && (
          <>
            <button className="icon-btn ghost" aria-label="Search" onClick={() => setPaletteOpen(true)}>
              <Search size={21} />
            </button>
            <span className="divider" />
          </>
        )}
        <div className="dropdown-wrap" ref={bellRef}>
          <button className="icon-btn ghost bell" aria-label="Notifications" onClick={() => setBellOpen((o) => !o)}>
            <Bell size={21} />
            {unread > 0 && <span className="dot" />}
          </button>
          {bellOpen && (
            <div className="dropdown notif-menu">
              <div className="dropdown-head">
                <strong>Notifications</strong>
                <button className="link-btn" onClick={() => actions.markAllRead()}>
                  <CheckCheck size={14} /> Mark all read
                </button>
              </div>
              {state.notifications.length === 0 && <p className="muted pad">You're all caught up.</p>}
              {state.notifications.slice(0, 8).map((n) => (
                <button key={n.id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => actions.markRead(n.id)}>
                  <span className="notif-dot" />
                  <span>
                    <span className="notif-text">{n.text}</span>
                    <span className="notif-time">{timeAgo(n.at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="divider" />
        <div className="dropdown-wrap" ref={userRef}>
          <button className="user-btn" onClick={() => setUserOpen((o) => !o)}>
            <span className="avatar">{state.userName.charAt(0).toUpperCase()}</span>
            <span className="hello">Hello, {state.userName}</span>
            <ChevronDown size={18} />
          </button>
          {userOpen && (
            <div className="dropdown user-menu">
              <div className="user-card">
                <span className="avatar lg">{state.userName.charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{state.userName}</strong>
                  <span className="muted small">{state.streak}-day streak · {state.subjects.length} subjects</span>
                </div>
              </div>
              <button className="menu-item" onClick={() => { setUserOpen(false); setModal({ type: 'settings' }); }}>
                <User size={16} /> Profile
              </button>
              <button className="menu-item" onClick={() => { setUserOpen(false); setModal({ type: 'settings' }); }}>
                <Settings size={16} /> Settings
              </button>
              <button className="menu-item" onClick={() => { setUserOpen(false); actions.reset(); }}>
                <RotateCcw size={16} /> Reset demo data
              </button>
              <button className="menu-item danger" onClick={() => { setUserOpen(false); toast('Signed out (demo) — your progress stays saved in this browser.'); }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
