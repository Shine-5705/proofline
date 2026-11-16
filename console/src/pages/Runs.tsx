import { useEffect, useMemo, useState } from 'react';
import type { Workspace, Run } from '../types';
import { href, useQueryState } from '../router';
import { Status, Empty, Copy } from '../components/ui';
import { ago, duration, dateTime, triggerLabel } from '../format';
import { fetchRun } from '../data';

const PAGE = 40;

export function Runs({ ws }: { ws: Workspace }) {
  const [status, setStatus] = useQueryState('status', 'all');
  const [flow, setFlow] = useQueryState('flow', 'all');
  const [trigger, setTrigger] = useQueryState('trigger', 'all');
  const [q, setQ] = useQueryState('q', '');
  const [limit, setLimit] = useState(PAGE);
  const triggers = useMemo(() => [...new Set(ws.runs.map((r) => r.trigger))], [ws.runs]);
  const rows = useMemo(() => ws.runs.filter((r) =>
    (status === 'all' || (status === 'other' ? !['passed', 'failed'].includes(r.status) : r.status === status)) &&
    (flow === 'all' || r.flowId === flow) && (trigger === 'all' || r.trigger === trigger) &&
    (!q || `${r.flowTitle} ${r.failedStep?.remark || ''} ${r.reason || ''} ${r.git?.sha || ''}`.toLowerCase().includes(q.toLowerCase()))), [ws.runs, status, flow, trigger, q]);
  const counts = { all: ws.runs.length, passed: ws.runs.filter((r) => r.status === 'passed').length, failed: ws.runs.filter((r) => r.status === 'failed').length };
  return (
    <div className="page">
      <div className="page-head"><div><h1>Runs</h1><p>Every Kane CLI verdict, with the step that decided it.</p></div></div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Search flow, failure or commit" aria-label="Search runs" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        <div className="seg" role="group" aria-label="Filter by status">
          {(['all', 'passed', 'failed', 'other'] as const).map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => { setStatus(s); setLimit(PAGE); }}>{{ all: `All ${counts.all}`, passed: `Passed ${counts.passed}`, failed: `Failed ${counts.failed}`, other: 'Other' }[s]}</button>)}
        </div>
        <select className="select" aria-label="Flow" value={flow} onChange={(e) => setFlow(e.target.value)}>
          <option value="all">All flows</option>
          {ws.flows.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <select className="select" aria-label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="all">All triggers</option>
          {triggers.map((t) => <option key={t} value={t}>{triggerLabel(t)}</option>)}
        </select>
      </div>
      {ws.runs.length === 0 ? <Empty title="No runs yet"><p>Run <code>npx proofline check</code> to verify every flow once.</p></Empty>
        : rows.length === 0 ? <Empty title="No runs match these filters"><p><button className="btn sm" onClick={() => { setStatus('all'); setFlow('all'); setTrigger('all'); setQ(''); }}>Clear filters</button></p></Empty>
        : (
          <>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Status</th><th>Flow</th><th className="hide-sm">Trigger</th><th className="hide-sm">Commit</th><th className="r">Duration</th><th className="r">Started</th></tr></thead>
                <tbody>
                  {rows.slice(0, limit).map((r) => (
                    <tr key={r.id} className="click" onClick={() => { location.hash = href('runs', r.id); }}>
                      <td><Status value={r.status} /></td>
                      <td><div className="title">{r.flowTitle}</div>{r.status !== 'passed' && (r.failedStep || r.reason) && <div className="sub ellipsis">{r.failedStep ? `Step ${r.failedStep.index}: ${r.failedStep.remark}` : r.reason}</div>}</td>
                      <td className="hide-sm">{triggerLabel(r.trigger)}{r.loopId && <> · <a href={href('loops', r.loopId)} onClick={(e) => e.stopPropagation()} className="faint">turn {r.iteration}</a></>}</td>
                      <td className="hide-sm mono faint">{r.git?.sha || '—'}{r.git?.dirty ? '*' : ''}</td>
                      <td className="r num">{duration(r.duration)}</td>
                      <td className="r faint">{ago(r.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > limit && <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn" onClick={() => setLimit(limit + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more</button></div>}
          </>
        )}
    </div>
  );
}

export function RunDetail({ ws, id }: { ws: Workspace; id: string }) {
  const base = ws.runs.find((r) => r.id === id);
  const [full, setFull] = useState<Run | null>(null);
  useEffect(() => { if (ws.mode === 'local') fetchRun(id).then(setFull); }, [id, ws.mode]);
  const run = full || base;
  if (!run) return <div className="page"><Empty title="Run not found"><p><a href={href('runs')}>Back to runs</a></p></Empty></div>;
  const loop = run.loopId ? ws.loops.find((l) => l.id === run.loopId) : null;
  const flowArg = run.flowFile;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{run.flowTitle}</h1><p><Status value={run.status} /> &nbsp;·&nbsp; {duration(run.duration)} &nbsp;·&nbsp; {dateTime(run.startedAt)}</p></div>
        <Copy text={`kane-cli testmd run ${flowArg} --agent`} label="Copy rerun command" />
      </div>
      <div className="split">
        <div>
          {run.status !== 'passed' && (run.failedStep || run.reason) && (
            <div className="callout" style={{ marginTop: 0, marginBottom: 16 }}>
              <div className="k">{run.failedStep ? `Failed at step ${run.failedStep.index}` : 'Reason'}</div>
              <div style={{ marginTop: 2, fontWeight: 500 }}>{run.failedStep?.remark || run.reason}</div>
              {run.summary && <div className="muted" style={{ marginTop: 4 }}>{run.summary}</div>}
            </div>
          )}
          <div className="section-head"><h2>Steps Kane CLI took</h2><span className="hint">{run.steps.length} steps</span></div>
          {run.steps.length === 0 ? <Empty title="No steps recorded"><p>{run.status === 'not_started' ? 'Kane CLI refused to start, so nothing ran and no credits were used.' : 'This run produced no step events.'}</p></Empty> : (
            <div className="panel">
              <ol className="steps">
                {run.steps.map((s) => (
                  <li key={s.key} className={s.status}>
                    <span className="idx">{s.index}</span>
                    <span className="remark">{s.remark || <span className="faint">(no remark)</span>}</span>
                    <span className="faint num">{s.ms != null ? duration(s.ms / 1000) : ''}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {run.raw && (
            <details className="section"><summary>Raw NDJSON from <span className="mono">kane-cli --agent</span></summary><pre className="code" style={{ marginTop: 8 }}>{run.raw}</pre></details>
          )}
        </div>
        <aside className="panel">
          <div className="panel-head"><h2>Run</h2></div>
          <dl className="panel-body kv">
            <dt>Flow</dt><dd><a href={href('flows', run.flowId)} className="mono">{run.flowFile}</a></dd>
            <dt>Trigger</dt><dd>{triggerLabel(run.trigger)}</dd>
            {loop && <><dt>Loop</dt><dd><a href={href('loops', loop.id)}>Turn {run.iteration} of “{loop.task.slice(0, 40)}{loop.task.length > 40 ? '…' : ''}”</a></dd></>}
            <dt>Commit</dt><dd className="mono">{run.git?.sha || '—'}{run.git?.dirty ? ' (uncommitted changes)' : ''}</dd>
            {run.changedFiles?.length > 0 && <><dt>Changed</dt><dd className="mono" style={{ fontSize: 12 }}>{run.changedFiles.join(', ')}</dd></>}
            <dt>Exit code</dt><dd className="num">{run.exitCode ?? '—'}</dd>
            <dt>Credits</dt><dd className="num">{run.credits != null ? run.credits : '—'}</dd>
            <dt>kane-cli</dt><dd className="mono">{run.kaneVersion || '—'}</dd>
            {run.testUrl && <><dt>Test Manager</dt><dd><a href={run.testUrl} target="_blank" rel="noreferrer">Open test case ↗</a></dd></>}
            {run.evidence && <><dt>Evidence</dt><dd className="mono" style={{ fontSize: 12 }}>{run.evidence}<div className="faint">kane-cli evidence serve {run.evidence}</div></dd></>}
            <dt>Run id</dt><dd className="mono faint">{run.id}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
