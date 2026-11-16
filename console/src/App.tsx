import { useCallback, useEffect, useState } from 'react';
import { useWorkspace, subscribe } from './data';
import { useRoute, href } from './router';
import { Logo, Skeleton, Toast } from './components/ui';
import { Overview } from './pages/Overview';
import { Loops, LoopDetail } from './pages/Loops';
import { Runs, RunDetail } from './pages/Runs';
import { Flows, FlowDetail } from './pages/Flows';
import { Setup } from './pages/Setup';

const NAV = [
  { key: '', label: 'Overview' },
  { key: 'loops', label: 'Loops' },
  { key: 'runs', label: 'Runs' },
  { key: 'flows', label: 'Flows' },
];

export default function App() {
  const { ws, error, loading, reload } = useWorkspace();
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  useEffect(() => setMenu(false), [route.join('/')]);
  useEffect(() => {
    if (ws?.mode !== 'local') return;
    return subscribe((type, data) => {
      if (type === 'run:end') { const d = data as { flowTitle: string; status: string }; setToast(`Kane CLI · ${d.flowTitle}: ${d.status}`); reload(); }
    });
  }, [ws?.mode, reload]);

  if (loading && !ws) return <div className="app"><aside className="sidebar"><div className="brand"><Logo /> Proofline</div></aside><main className="main"><Skeleton /></main></div>;
  if (error || !ws) {
    return (
      <div className="page" style={{ maxWidth: 640, margin: '60px auto' }}>
        <div className="brand"><Logo /> Proofline</div>
        <div className="error-box" role="alert"><strong>Could not load the workspace.</strong><div style={{ marginTop: 4 }}>{error}</div></div>
        <p className="muted">If you are running locally, start the console with <span className="mono">npx proofline ui</span> from your project root.</p>
        <button className="btn" onClick={reload}>Try again</button>
      </div>
    );
  }

  const [section, sub] = route;
  const counts: Record<string, number> = { loops: ws.loops.length, runs: ws.runs.length, flows: ws.flows.length };
  const crumbs: [string, string][] = [];
  if (section) crumbs.push([href(section), NAV.find((n) => n.key === section)?.label || 'Setup']);
  let page;
  switch (section) {
    case 'loops': page = sub ? <LoopDetail ws={ws} id={sub} /> : <Loops ws={ws} />; if (sub) crumbs.push(['', ws.loops.find((l) => l.id === sub)?.task || sub]); break;
    case 'runs': page = sub ? <RunDetail ws={ws} id={sub} /> : <Runs ws={ws} />; if (sub) crumbs.push(['', ws.runs.find((r) => r.id === sub)?.flowTitle || sub]); break;
    case 'flows': page = sub ? <FlowDetail ws={ws} id={sub} onChanged={reload} /> : <Flows ws={ws} />; if (sub) crumbs.push(['', ws.flows.find((f) => f.id === sub)?.title || sub]); break;
    case 'setup': page = <Setup ws={ws} />; break;
    default: page = <Overview ws={ws} />;
  }

  return (
    <>
      <div className="app">
        <aside className={`sidebar ${menu ? 'open' : ''}`}>
          <a className="brand" href={href()}><Logo /> Proofline</a>
          <div className="project"><div className="name">{ws.project.name}</div><div className="meta mono">{ws.project.baseUrl}</div></div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => <a key={n.key} href={href(...(n.key ? [n.key] : []))} className={(section || '') === n.key ? 'on' : ''}>{n.label}{counts[n.key] != null && <span className="count">{counts[n.key]}</span>}</a>)}
            <div className="nav-label">Project</div>
            <a href={href('setup')} className={section === 'setup' ? 'on' : ''}>Setup</a>
            <a href="https://github.com/Shine-5705/proofline" target="_blank" rel="noreferrer">Docs ↗</a>
          </nav>
          <div className="sidebar-foot">{ws.mode === 'local' ? 'Live · reading .proofline/' : ws.mode === 'demo' ? 'Demo data' : 'Snapshot'}<br />Verified by Kane CLI · TestMu AI</div>
        </aside>
        <main className="main">
          {ws.mode !== 'local' && (
        <div className="banner" role="note">
          {ws.mode === 'demo'
            ? <>Demo workspace with sample data, for illustration. These are <strong>not real Kane CLI runs</strong>. Install Proofline to see your own: <a href={href('setup')}>setup</a></>
            : <>Exported workspace (read-only snapshot of real Kane CLI runs, {new Date(ws.generatedAt).toLocaleDateString()}).</>}
        </div>
      )}
          <div className="topbar">
            <div className="crumbs">
              <button className="btn sm menu-btn" onClick={() => setMenu(!menu)} aria-label="Open navigation">Menu</button>
              <a href={href()}>{ws.project.name}</a>
              {crumbs.map(([h, label], i) => <span key={i} style={{ display: 'contents' }}><span>/</span>{h && i < crumbs.length - 1 ? <a href={h}>{label}</a> : <span className="cur">{label}</span>}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {ws.mode === 'local' && <button className="btn sm" onClick={reload}>Refresh</button>}
            </div>
          </div>
          {page}
        </main>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
