import type { Workspace } from '../types';
import { href } from '../router';
import { Status, HistoryStrip, Iters, Empty } from '../components/ui';
import { RunsPerDay } from '../components/charts';
import { ago, duration, median, seconds, pct, agentLabel } from '../format';

export function Overview({ ws }: { ws: Workspace }) {
  const { flows, runs, loops } = ws;
  if (runs.length === 0) {
    return (
      <div className="page">
        <div className="page-head"><div><h1>Overview</h1><p>{ws.project.name} · {ws.project.baseUrl}</p></div></div>
        <Empty title="No Kane CLI runs yet">
          <p>Run every flow once to establish a baseline, then let your agent's hook take over.</p>
          <p><code>npx proofline check</code></p>
        </Empty>
      </div>
    );
  }
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!latest.has(r.flowId) && r.status !== 'running') latest.set(r.flowId, r);
  const passingNow = flows.filter((f) => latest.get(f.id)?.status === 'passed').length;
  const closed = loops.filter((l) => l.status === 'green');
  const caught = loops.filter((l) => l.iterations.some((i) => i.verdict === 'red'));
  const healed = caught.filter((l) => l.status === 'green');
  const ttg = median(closed.map((l) => seconds(l.startedAt, l.endedAt)).filter((x): x is number => x != null));
  const weekAgo = Date.now() - 7 * 86400e3;
  const week = runs.filter((r) => new Date(r.startedAt).getTime() > weekAgo);
  const credits = week.reduce((a, r) => a + (r.credits || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Overview</h1><p>{ws.project.name} · verified against <span className="mono">{ws.project.baseUrl}</span> · agent: {agentLabel(ws.project.agent)}</p></div>
        <a className="btn" href={href('loops')}>View loops</a>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Flows passing now</div><div className="value">{passingNow}<small>/ {flows.length}</small></div><div className="sub">latest Kane CLI verdict per flow</div></div>
        <div className="stat"><div className="label">Regressions caught</div><div className="value">{caught.length}</div><div className="sub">{healed.length} healed by the agent · {pct(healed.length, caught.length)}</div></div>
        <div className="stat"><div className="label">Median time to green</div><div className="value">{duration(ttg)}</div><div className="sub">agent start → all flows pass</div></div>
        <div className="stat"><div className="label">Kane runs, 7 days</div><div className="value">{week.length}</div><div className="sub">{credits ? `${credits.toLocaleString()} credits used` : 'credits not reported'}</div></div>
      </div>

      <div className="section split">
        <div>
          <div className="section-head"><h2>Flow health</h2><span className="hint">last 20 runs, newest right</span></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Flow</th><th>Latest</th><th className="hide-sm">History</th><th className="r">Pass rate</th><th className="r hide-sm">Last run</th></tr></thead>
              <tbody>
                {flows.map((f) => {
                  const fr = runs.filter((r) => r.flowId === f.id && r.status !== 'running');
                  const last = fr[0];
                  return (
                    <tr key={f.id} className="click" onClick={() => { location.hash = href('flows', f.id); }}>
                      <td><div className="title">{f.title}</div><div className="sub mono">{f.file}</div></td>
                      <td>{last ? <Status value={last.status} /> : <span className="faint">never run</span>}</td>
                      <td className="hide-sm"><HistoryStrip runs={fr} /></td>
                      <td className="r num">{pct(fr.filter((r) => r.status === 'passed').length, fr.length)}</td>
                      <td className="r faint hide-sm">{ago(last?.startedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            <h2>Kane CLI runs per day</h2>
            <div className="legend"><span style={{ ['--c' as string]: '#6fb592' }}>passed</span><span style={{ ['--c' as string]: '#e0867a' }}>failed</span><span style={{ ['--c' as string]: '#ddb562' }}>did not start</span></div>
          </div>
          <div className="panel" style={{ padding: '12px 12px 4px' }}><RunsPerDay runs={runs} /></div>
        </div>

        <div>
          <div className="section-head"><h2>Recent loops</h2><a className="hint" href={href('loops')}>All →</a></div>
          <div className="panel">
            {loops.length === 0 && <div className="panel-body faint">No agent loops yet. Install the Claude Code or Cursor hook, or run <code>proofline loop</code>.</div>}
            {loops.slice(0, 6).map((l) => (
              <a key={l.id} href={href('loops', l.id)} style={{ display: 'block', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="ellipsis" style={{ fontWeight: 500, maxWidth: 210 }}>{l.task}</span>
                  <Status value={l.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }} className="faint">
                  <span><Iters verdicts={l.iterations.map((i) => i.verdict)} /> &nbsp;{l.iterations.length} turn{l.iterations.length === 1 ? '' : 's'} · {agentLabel(l.agent)}</span>
                  <span>{ago(l.startedAt)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
