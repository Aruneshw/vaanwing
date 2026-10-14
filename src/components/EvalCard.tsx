import { useState } from 'react';
import { ChartNoAxesColumnIncreasing, Download, FlaskConical, Play, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { buildTestSet, evalCase, runPersonalization, type CaseResult, type EvalResult } from '../eval';
import { Modal, Progress } from './ui';
import { OS_SUBJECT_ID } from '../osCourse';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(cases: CaseResult[]) {
  const on = cases.filter((c) => !c.offMaterial);
  const off = cases.filter((c) => c.offMaterial);
  return {
    faithfulness: mean(on.map((c) => c.faithfulness)),
    relevancy: mean(on.map((c) => c.relevancy)),
    precision: mean(on.map((c) => c.precision)),
    recall: mean(on.map((c) => c.recall)),
    refusal: off.length ? off.filter((c) => c.declined).length / off.length : 0,
    falseRefusal: on.length ? on.filter((c) => c.declined).length / on.length : 0,
  };
}

export default function EvalCard() {
  const { state, actions, setModal, toast } = useStore();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [partial, setPartial] = useState<CaseResult[]>([]);
  const r = state.evalResult;

  const run = () => {
    const set = buildTestSet(state.chunks, state.resources);
    setRunning(true);
    setTotal(set.cases.length + 1);
    setDone(0);
    setPartial([]);
    const results: CaseResult[] = [];
    let i = 0;
    const tick = () => {
      if (i < set.cases.length) {
        results.push(evalCase(set.cases[i], state.chunks));
        i++;
        setDone(i);
        setPartial([...results]);
        window.setTimeout(tick, 90);
        return;
      }
      const subj = state.subjects.some((s) => s.id === OS_SUBJECT_ID) ? OS_SUBJECT_ID : 'ds';
      const personalization = runPersonalization(subj);
      const res: EvalResult = { at: Date.now(), testSet: set.name, rag: summarize(results), personalization, cases: results };
      actions.setEvalResult(res);
      setDone(i + 1);
      setRunning(false);
      toast('Evaluation complete');
    };
    window.setTimeout(tick, 120);
  };

  const rag = running ? summarize(partial) : r?.rag;
  const rows: [string, number | undefined, string][] = [
    ['Faithfulness', rag?.faithfulness, 'green'],
    ['Answer relevancy', rag?.relevancy, 'blue'],
    ['Context precision', rag?.precision, 'purple'],
    ['Context recall', rag?.recall, 'yellow'],
    ['Off-material refusal', rag?.refusal, 'pink'],
  ];

  return (
    <div className="card glass eval-card">
      <div className="pl-head">
        <span className="tile tile-xl white eval-ic">
          <FlaskConical size={26} />
        </span>
        <div>
          <strong>System Evaluation</strong>
          <span>RAGAS-style metrics on a team-built test set + simulated students.</span>
        </div>
      </div>

      {running && (
        <div className="eval-run">
          <span className="muted small">
            Running {Math.min(done, total)}/{total}…
          </span>
          <Progress value={(done / Math.max(1, total)) * 100} height={6} theme="blue" />
        </div>
      )}

      <div className="eval-rows">
        {rows.map(([label, v, theme]) => (
          <div key={label} className="eval-row">
            <span>{label}</span>
            <Progress value={(v ?? 0) * 100} height={8} theme={theme as 'green'} />
            <strong>{v === undefined ? '—' : pct(v)}</strong>
          </div>
        ))}
      </div>

      <div className="eval-perso">
        <div>
          <strong>{r && !running ? `+${pct(r.personalization.masteryGain)}` : '—'}</strong>
          <span>Mastery gain</span>
          <em>{r ? `${r.personalization.profiles.length} profiles × ${r.personalization.sessions} sessions` : 'simulated students'}</em>
        </div>
        <div>
          <strong>{r && !running ? pct(r.personalization.repetition) : '—'}</strong>
          <span>Question repetition</span>
          <em>{r ? `vs ${pct(r.personalization.baselineRepetition)} random` : 'lower is better'}</em>
        </div>
      </div>

      {r && !running && <p className="muted small eval-meta">Test set: {r.testSet}</p>}

      <div className="eval-actions">
        <button className="btn btn-dark btn-block" disabled={running} onClick={run}>
          {r ? <RefreshCw size={17} /> : <Play size={17} />} {running ? 'Evaluating…' : r ? 'Re-run evaluation' : 'Run evaluation'}
        </button>
        {r && !running && (
          <button className="btn btn-light" onClick={() => setModal({ type: 'evalReport' })}>
            <ChartNoAxesColumnIncreasing size={16} /> Report
          </button>
        )}
      </div>
    </div>
  );
}

export function EvalReportModal() {
  const { state, setModal } = useStore();
  const r = state.evalResult;
  if (!r) return null;
  return (
    <Modal width={920} onClose={() => setModal(null)} icon={<FlaskConical size={22} />} title="Evaluation report" subtitle={`${r.testSet} · ${new Date(r.at).toLocaleString()}`}>
      <div className="kpis">
        <div><strong>{pct(r.rag.faithfulness)}</strong><span>Faithfulness</span></div>
        <div><strong>{pct(r.rag.relevancy)}</strong><span>Answer relevancy</span></div>
        <div><strong>{pct(r.rag.precision)}</strong><span>Context precision</span></div>
        <div><strong>{pct(r.rag.recall)}</strong><span>Context recall</span></div>
        <div><strong>{pct(r.rag.refusal)}</strong><span>Off-material refused</span></div>
        <div><strong>{pct(r.rag.falseRefusal)}</strong><span>False refusals</span></div>
      </div>
      <span className="small-label">Per-question results</span>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Question</th><th>Type</th><th>Retrieved</th><th>Faith.</th><th>Relev.</th><th>Prec.</th><th>Recall</th></tr>
          </thead>
          <tbody>
            {r.cases.map((c) => (
              <tr key={c.q}>
                <td>{c.q}</td>
                <td>{c.offMaterial ? (c.declined ? 'Off · declined ✓' : 'Off · answered ✗') : 'Sourced'}</td>
                <td>{c.retrieved.join(', ') || '—'}</td>
                <td>{c.offMaterial ? '—' : pct(c.faithfulness)}</td>
                <td>{c.offMaterial ? '—' : pct(c.relevancy)}</td>
                <td>{c.offMaterial ? '—' : pct(c.precision)}</td>
                <td>{c.offMaterial ? '—' : pct(c.recall)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="small-label" style={{ display: 'block', marginTop: 16 }}>Personalization — simulated students ({r.personalization.sessions} sessions × 5 questions)</span>
      <div className="mastery-list">
        {r.personalization.profiles.map((p) => (
          <div key={p.name} className="report-row">
            <span>{p.name}</span>
            <Progress value={p.endMastery * 100} height={8} theme="green" />
            <span className="delta-txt up">
              {pct(p.startMastery)} → {pct(p.endMastery)} · rep {pct(p.repetition)} (random {pct(p.baselineRepetition)})
            </span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        Metrics follow RAGAS definitions but are scored with lexical judges (token overlap) in the browser so they are offline and reproducible.
        Swap in RAGAS/DeepEval with an LLM judge on the backend for the final report.
      </p>
      <div className="gen-actions">
        <button
          className="btn btn-light"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'studynest-eval.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={16} /> Download JSON
        </button>
      </div>
    </Modal>
  );
}
