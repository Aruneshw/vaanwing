import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import { Header } from './components/Header';
import CommandPalette from './components/CommandPalette';
import ModalHost from './modals/ModalHost';
import Home from './pages/Home';
import Learn from './pages/Learn';
import Tutor from './pages/Tutor';
import { api } from './api';
import { useRemote } from './remote';

function Shell() {
  const { state, actions, paletteOpen, toasts, modal, setModal, backend, setBackend, toast } = useStore();
  const remote = useRemote();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // New students (no history) start with the intake conversation + diagnostic quiz.
  useEffect(() => {
    if (!state.onboarded && !modal) setModal({ type: 'intake' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect to the backend when it is running; re-check every 15 s while offline.
  useEffect(() => {
    if (backend.online) return;
    let stop = false;
    const check = () =>
      api
        .health()
        .then((health) => {
          if (stop) return;
          setBackend({ online: true, checked: true, health });
          remote.syncAll().catch(() => undefined);
          if (backend.checked) toast('Connected to the StudyNest backend');
        })
        .catch(() => !stop && setBackend({ online: false, checked: true }));
    check();
    const t = window.setInterval(check, 15000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [backend.online]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background "ingestion" of newly added in-browser sources (backend sources report real progress).
  useEffect(() => {
    if (state.analysis >= 100 || state.resources.some((r) => r.remote && r.status === 'processing')) return;
    const t = window.setInterval(() => actions.tickAnalysis(), 700);
    return () => window.clearInterval(t);
  }, [state.analysis >= 100, state.resources, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:subjectId" element={<Learn />} />
        <Route path="/tutor" element={<Tutor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ModalHost />
      {paletteOpen && <CommandPalette />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}
