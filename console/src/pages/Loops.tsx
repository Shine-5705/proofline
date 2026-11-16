import { useMemo } from 'react';
import type { Workspace, Loop, Run } from '../types';
import { href, useQueryState } from '../router';
import { Status, Iters, Empty } from '../components/ui';
import { ago, duration, seconds, agentLabel, dateTime, triggerLabel } from '../format';

export function Loops({ ws }: { ws: Workspace }) {
  const [status, setStatus] = useQueryState('status', 'all');
  const [q, setQ] = useQueryState('q', '');
  const rows = useMemo(() => ws.loops.filter((l) => (status === 'all' || l.status === status) && l.task.toLowerCase().includes(q.toLowerCase())), [ws.loops, status, q]);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Loops</h1><p>Every time an agent's change was checked by Kane CLI, and what happened next.</p></div></div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Search tasks" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg" role="group" aria-label="Filter by outcome">
          {['all', 'green', 'gave_up', 'blocked'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{{ all: 'All', green: 'Closed green', gave_up: 'Gave up', blocked: 'Blocked' }[s]}</button>)}
        </div>
        <span className="spacer" /><span className="faint">{rows.length} of {ws.loops.length}</span>
      </div>
      {ws.loops.length === 0 ? (
        <Empty title="No loops yet"><p>Wire Kane CLI into your agent: <code>npx proofline init --hooks claude,cursor</code>, or drive one directly with <code>npx proofline loop "add a dark mode toggle"</code>.</p></Empty>
      ) : rows.length === 0 ? (
        <Empty title="Nothing matches"><p>Try a different search or outcome filter.</p></Empty>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Task</th><th>Outcome</th><th>Turns</th><th className="hide-sm">Agent</th><th className="r hide-sm">Time to verdict</th><th className="r">Started</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="click" onClick={() => { location.hash = href('loops', l.id); }}>
                  <td><div className="title ellipsis">{l.task}</div><div className="sub">{l.via ? triggerLabel(l.via) : 'proofline loop'}</div></td>
                  <td><Status value={l.status} /></td>
                  <td><Iters verdicts={l.iterations.map((i) => i.verdict)} /> <span className="faint num">&nbsp;{l.iterations.length}</span></td>
                  <td className="hide-sm">{agentLabel(l.agent)}</td>
                  <td className="r num hide-sm">{duration(seconds(l.startedAt, l.endedAt))}</td>
                  <td className="r faint">{ago(l.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RunResult({ run }: { run: Run }) {
  const ok = run.status === 'passed';
  return (
    <div className={`callout ${ok ? 'ok' : ''}`} style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <a href={href('runs', run.id)} style={{ fontWeight: 500 }}>{run.flowTitle}</a>
        <span className="faint num">{duration(run.duration)}</span>
      </div>
      {!ok && run.failedStep && <div style={{ marginTop: 4 }}><span className="k">Step {run.failedStep.index} · </span>{run.failedStep.remark}</div>}
      {!ok && !run.failedStep && run.reason && <div style={{ marginTop: 4 }}>{run.reason}</div>}
    </div>
  );
}

export function LoopDetail({ ws, id }: { ws: Workspace; id: string }) {
  const loop: Loop | undefined = ws.loops.find((l) => l.id === id);
  if (!loop) return <div className="page"><Empty title="Loop not found"><p><a href={href('loops')}>Back to loops</a></p></Empty></div>;
  const runsById = new Map(ws.runs.map((r) => [r.id, r]));
  const total = seconds(loop.startedAt, loop.endedAt);
  const allRuns = loop.iterations.flatMap((i) => (i.runIds || []).map((rid) => runsById.get(rid)).filter(Boolean)) as Run[];
  const credits = allRuns.reduce((a, r) => a + (r.credits || 0), 0);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ maxWidth: 760 }}>{loop.task}</h1>
          <p><Status value={loop.status} label={loop.status === 'green' ? 'Loop closed green' : undefined} /> &nbsp;·&nbsp; {loop.iterations.length} turn{loop.iterations.length === 1 ? '' : 's'} &nbsp;·&nbsp; {duration(total)} &nbsp;·&nbsp; {agentLabel(loop.agent)} via {loop.via ? triggerLabel(loop.via) : 'proofline loop'}</p>
        </div>
      </div>
      <div className="split">
        <div>
          {loop.iterations.map((it) => {
            const runs = (it.runIds || []).map((rid) => runsById.get(rid)).filter(Boolean) as Run[];
            const failed = runs.filter((r) => r.status !== 'passed');
            return (
              <div key={it.n}>
                <div className="iter-label">Turn {it.n}</div>
                <ol className="timeline">
                  {(it.agent || (it.diff && it.diff.length > 0) || it.n === 1) && (
                    <li>
                      <span className="node agent" />
                      <div className="ev-head"><span className="who">{agentLabel(loop.agent)}</span><span className="muted">{it.prompt === 'task' ? 'worked on the task' : 'acted on the Kane CLI failure'}</span><span className="when">{dateTime(it.startedAt)}{it.agent ? ` · ${duration(it.agent.seconds)}` : ''}</span></div>
                      {it.diff && it.diff.length > 0 && (
                        <ul className="files">{it.diff.map((d) => <li key={d.file}><span style={{ minWidth: 0, flex: 1 }}>{d.file}</span><span className="add">+{d.added}</span><span className="del">−{d.removed}</span></li>)}</ul>
                      )}
                      {!it.agent && !it.diff && <div className="ev-body faint">Edits made inside the agent session; the hook fired when the agent tried to stop.</div>}
                    </li>
                  )}
                  <li>
                    <span className={`node ${it.verdict === 'green' ? 'passed' : it.verdict === 'blocked' ? 'blocked' : 'failed'}`} />
                    <div className="ev-head"><span className="who">Kane CLI</span><span className="muted">{runs.length} flow{runs.length === 1 ? '' : 's'} in a real browser · {it.verdict === 'green' ? 'all passed' : it.verdict === 'blocked' ? 'did not start' : `${failed.length} failed`}</span><span className="when">{dateTime(it.endedAt)}</span></div>
                    <div className="ev-body">{runs.map((r) => <RunResult key={r.id} run={r} />)}</div>
                  </li>
                  {it.brief && (
                    <li>
                      <span className="node brief" />
                      <div className="ev-head"><span className="who">Proofline</span><span className="muted">sent the failure back to {agentLabel(loop.agent)} as a repair brief</span></div>
                      <details className="ev-body"><summary>Repair brief</summary><pre className="code" style={{ marginTop: 8 }}>{it.brief}</pre></details>
                    </li>
                  )}
                </ol>
              </div>
            );
          })}
          {loop.status === 'green' && <div className="callout ok" style={{ marginLeft: 28 }}><strong>Loop closed.</strong> The agent was allowed to finish only after Kane CLI passed every affected flow.</div>}
          {loop.status === 'gave_up' && <div className="callout" style={{ marginLeft: 28 }}><strong>Handed back to a human</strong> after {loop.maxIterations} turns. The last repair brief is in <span className="mono">.proofline/brief.md</span>.</div>}
        </div>
        <aside className="panel">
          <div className="panel-head"><h2>Details</h2></div>
          <dl className="panel-body kv">
            <dt>Status</dt><dd><Status value={loop.status} /></dd>
            <dt>Agent</dt><dd>{agentLabel(loop.agent)}</dd>
            <dt>Trigger</dt><dd>{loop.via ? triggerLabel(loop.via) : 'proofline loop'}</dd>
            <dt>Started</dt><dd>{dateTime(loop.startedAt)}</dd>
            <dt>Time to verdict</dt><dd className="num">{duration(total)}</dd>
            <dt>Turns</dt><dd className="num">{loop.iterations.length} of max {loop.maxIterations}</dd>
            <dt>Kane runs</dt><dd className="num">{allRuns.length}</dd>
            <dt>Credits</dt><dd className="num">{credits ? credits.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</dd>
            <dt>Loop id</dt><dd className="mono faint">{loop.id}</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
