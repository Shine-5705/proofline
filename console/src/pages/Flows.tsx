import { useEffect, useState } from 'react';
import type { Workspace, Step } from '../types';
import { href } from '../router';
import { Status, HistoryStrip, Empty } from '../components/ui';
import { DurationLine } from '../components/charts';
import { ago, duration, pct, median } from '../format';
import { startCheck, subscribe } from '../data';

export function Flows({ ws }: { ws: Workspace }) {
  return (
    <div className="page">
      <div className="page-head"><div><h1>Flows</h1><p>Plain-English Kane CLI tests in <span className="mono">{ws.project.flowsDir}/</span>, and the files each one guards.</p></div></div>
      {ws.flows.length === 0 ? <Empty title="No flows yet"><p>Create <code>{ws.project.flowsDir}/home_test.md</code> with <code>npx proofline init</code>, or let Kane design them from your PRD with <code>kane-cli design tests</code>.</p></Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Flow</th><th className="hide-sm">Guards</th><th>Latest</th><th className="hide-sm">History</th><th className="r">Median</th><th className="r">Pass rate</th></tr></thead>
            <tbody>
              {ws.flows.map((f) => {
                const fr = ws.runs.filter((r) => r.flowId === f.id && r.status !== 'running');
                const med = median(fr.filter((r) => r.status === 'passed' && r.duration).map((r) => r.duration as number));
                return (
                  <tr key={f.id} className="click" onClick={() => { location.hash = href('flows', f.id); }}>
                    <td><div className="title">{f.title}</div><div className="sub">{f.steps.length} steps {f.tags.map((t) => <span key={t} className="tag" style={{ marginLeft: 4 }}>{t}</span>)}</div></td>
                    <td className="hide-sm mono faint" style={{ fontSize: 12 }}>{f.covers.join(', ')}</td>
                    <td>{fr[0] ? <Status value={fr[0].status} /> : <span className="faint">never run</span>}</td>
                    <td className="hide-sm"><HistoryStrip runs={fr} /></td>
                    <td className="r num">{duration(med)}</td>
                    <td className="r num">{pct(fr.filter((r) => r.status === 'passed').length, fr.length)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FlowDetail({ ws, id, onChanged }: { ws: Workspace; id: string; onChanged: () => void }) {
  const flow = ws.flows.find((f) => f.id === id);
  const [live, setLive] = useState<{ status: 'idle' | 'starting' | 'running' | 'done' | 'error'; steps: Step[]; message?: string }>({ status: 'idle', steps: [] });
  useEffect(() => {
    if (ws.mode !== 'local') return;
    return subscribe((type, data) => {
      const d = data as { steps?: Step[]; flowId?: string; status?: string };
      if (type === 'run:start' && d.flowId === id) setLive({ status: 'running', steps: [] });
      if (type === 'run:event' && d.steps) setLive((s) => (s.status === 'running' ? { ...s, steps: d.steps as Step[] } : s));
      if (type === 'run:end' && d.flowId === id) { setLive((s) => ({ ...s, status: 'done', message: `Kane CLI finished: ${d.status}` })); onChanged(); }
    });
  }, [id, ws.mode, onChanged]);
  if (!flow) return <div className="page"><Empty title="Flow not found"><p><a href={href('flows')}>Back to flows</a></p></Empty></div>;
  const fr = ws.runs.filter((r) => r.flowId === flow.id && r.status !== 'running');
  const run = async () => {
    setLive({ status: 'starting', steps: [] });
    const res = await startCheck([flow.id]);
    if (!res.ok) setLive({ status: 'error', steps: [], message: res.error });
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{flow.title}</h1><p className="mono">{flow.file}</p></div>
        {ws.mode === 'local'
          ? <button className="btn primary" onClick={run} disabled={live.status === 'starting' || live.status === 'running'}>{live.status === 'running' || live.status === 'starting' ? 'Kane CLI is running…' : 'Run with Kane CLI'}</button>
          : <span className="faint" title="Runs need kane-cli on your machine">Run locally: <span className="mono">npx proofline check --flow {flow.id}</span></span>}
      </div>
      {live.status !== 'idle' && (
        <div className={`callout ${live.status === 'error' ? '' : 'ok'}`} style={{ marginTop: 0, marginBottom: 16 }} role="status">
          {live.status === 'starting' && 'Starting kane-cli…'}
          {live.status === 'running' && <>Live: {live.steps.length ? live.steps[live.steps.length - 1].remark : 'opening the browser'} <span className="faint">({live.steps.length} steps)</span></>}
          {(live.status === 'done' || live.status === 'error') && live.message}
        </div>
      )}
      <div className="split">
        <div>
          <div className="section-head"><h2>Steps</h2><span className="hint">as written in the test.md</span></div>
          <div className="panel">
            <ol className="steps">
              {flow.steps.map((s, i) => (
                <li key={i}><span className="idx">{i + 1}</span><span><div style={{ fontWeight: 500 }}>{s.title}</div><div className="muted">{s.text}</div></span><span /></li>
              ))}
            </ol>
          </div>
          <div className="section-head" style={{ marginTop: 28 }}><h2>Duration per run</h2><span className="hint">red = failed run</span></div>
          <div className="panel" style={{ padding: '12px 12px 4px' }}><DurationLine runs={fr} /></div>
          <div className="section-head" style={{ marginTop: 28 }}><h2>Recent runs</h2><a className="hint" href={`${href('runs')}?flow=${flow.id}`}>All →</a></div>
          {fr.length === 0 ? <Empty title="Never run"><p>This flow has no Kane CLI runs yet.</p></Empty> : (
            <div className="table-wrap">
              <table className="t"><tbody>
                {fr.slice(0, 8).map((r) => (
                  <tr key={r.id} className="click" onClick={() => { location.hash = href('runs', r.id); }}>
                    <td><Status value={r.status} /></td>
                    <td className="ellipsis">{r.status === 'passed' ? <span className="faint">{r.steps.length} steps passed</span> : (r.failedStep ? `Step ${r.failedStep.index}: ${r.failedStep.remark}` : r.reason)}</td>
                    <td className="r num">{duration(r.duration)}</td><td className="r faint">{ago(r.startedAt)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
        <aside className="panel">
          <div className="panel-head"><h2>Guards</h2></div>
          <div className="panel-body">
            <p className="muted" style={{ marginTop: 0 }}>A change to any of these files re-runs this flow when the agent stops, on save, or on push.</p>
            {flow.covers.map((c) => <div key={c} className="mono" style={{ padding: '2px 0' }}>{c}</div>)}
          </div>
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)' }}><h2>Replay</h2></div>
          <div className="panel-body muted">{flow.recorded ? 'Recorded. Unchanged steps replay from the saved recording with no LLM cost.' : 'Not recorded yet. The first run authors each step; later runs replay.'}</div>
        </aside>
      </div>
    </div>
  );
}
