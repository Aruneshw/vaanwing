import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import { Header } from './components/Header';
import CommandPalette from './components/CommandPalette';
import ModalHost from './modals/ModalHost';
import Home from './pages/Home';
import Learn from './pages/Learn';
import Tutor from './pages/Tutor';

function Shell() {
  const { state, actions, paletteOpen, toasts, modal, setModal } = useStore();
  const { pathname } = useLocation();

  useEffect(() => window.scrollTo(0, 0), [pathname]);

  // New students (no history) start with the intake conversation + diagnostic quiz.
  useEffect(() => {
    if (!state.onboarded && !modal) setModal({ type: 'intake' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Background "ingestion" of newly added sources.
  useEffect(() => {
    if (state.analysis >= 100) return;
    const t = window.setInterval(() => actions.tickAnalysis(), 700);
    return () => window.clearInterval(t);
  }, [state.analysis >= 100, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
