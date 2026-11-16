import { useEffect, useState } from 'react';
import type { Workspace, Readiness } from '../types';
import { Copy } from '../components/ui';
import { fetchReadiness } from '../data';
import { agentLabel } from '../format';

const CLAUDE = `{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "npx --no-install proofline hook claude", "timeout": 900 }] }
    ]
  }
}`;
const CURSOR = `{
  "version": 1,
  "hooks": {
    "stop": [{ "command": "npx --no-install proofline hook cursor" }]
  }
}`;

function Row({ ok, title, detail, fix }: { ok: boolean | null; title: string; detail?: string; fix?: string }) {
  return (
    <li>
      <span className={`tick ${ok === true ? 'ok' : ok === false ? 'no' : ''}`} aria-label={ok ? 'done' : 'not done'} />
      <span><div style={{ fontWeight: 500 }}>{title}</div>{detail && <div className="muted">{detail}</div>}{fix && !ok && <div className="mono" style={{ marginTop: 4 }}>{fix}</div>}</span>
      {fix && !ok ? <Copy text={fix} /> : <span />}
    </li>
  );
}

export function Setup({ ws }: { ws: Workspace }) {
  const [r, setR] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(ws.mode === 'local');
  useEffect(() => { if (ws.mode === 'local') fetchReadiness().then((x) => { setR(x); setLoading(false); }); }, [ws.mode]);
  const local = ws.mode === 'local';
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head"><div><h1>Setup</h1><p>Three commands to put Kane CLI between your agent and “done”.</p></div></div>

      <div className="section-head"><h2>{local ? 'This machine' : 'Checklist'}</h2>{loading && <span className="hint">checking…</span>}</div>
      <div className="panel">
        <ul className="checklist">
          <Row ok={local ? !!r?.kane.version : null} title="Install Kane CLI" detail={r?.kane.version ? `kane-cli ${r.kane.version}` : 'Node 18+. Chrome for local browser runs.'} fix="npm install -g @testmuai/kane-cli" />
          <Row ok={local ? !!r?.kane.loggedIn : null} title="Sign in to TestMu AI" detail={r?.kane.loggedIn ? (r.kane.balance != null ? `${r.kane.balance.toLocaleString()} credits left` : 'Signed in') : 'New accounts get 10,000 free credits for a month.'} fix="kane-cli login --oauth" />
          <Row ok={local ? !!r?.config : null} title="Add Proofline to the repo" detail="Writes proofline.config.json, a starter flow, and the agent hooks. Never overwrites files." fix="npx proofline init --hooks claude,cursor" />
          <Row ok={local ? (r?.hooks.claude || r?.hooks.cursor) ?? false : null} title="Agent hook installed" detail={r ? `Claude Code: ${r.hooks.claude ? 'on' : 'off'} · Cursor: ${r.hooks.cursor ? 'on' : 'off'}` : 'Your agent tries to stop → Kane CLI runs the affected flows → a failure is handed back as the next prompt.'} fix="npx proofline init --hooks claude,cursor" />
          <Row ok={local ? (r?.flows ?? 0) > 0 : null} title="At least one flow" detail={r ? `${r.flows} flow(s) in ${ws.project.flowsDir}/` : 'Plain-English *_test.md files. Kane can design them from a PRD.'} fix="npx proofline check" />
        </ul>
      </div>

      <div className="section">
        <div className="section-head"><h2>How the loop closes</h2></div>
        <div className="panel panel-body muted" style={{ lineHeight: 1.7 }}>
          <div><strong style={{ color: 'var(--text)' }}>1.</strong> Your agent edits code and tries to stop.</div>
          <div><strong style={{ color: 'var(--text)' }}>2.</strong> The Stop hook runs <span className="mono">proofline hook</span>: it reads <span className="mono">git diff</span>, picks only the flows that guard those files, and runs them with <span className="mono">kane-cli testmd run --agent</span>.</div>
          <div><strong style={{ color: 'var(--text)' }}>3.</strong> Green: the agent may stop. Red: Proofline turns Kane's failing step into a repair brief and returns it as the agent's next instruction (<span className="mono">decision: block</span> in Claude Code, <span className="mono">followup_message</span> in Cursor).</div>
          <div><strong style={{ color: 'var(--text)' }}>4.</strong> After {ws.project.maxIterations} red turns Proofline stops and hands back to you. Every turn is recorded here.</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head"><h2>Claude Code · <span className="mono">.claude/settings.json</span></h2><Copy text={CLAUDE} /></div>
        <pre className="code">{CLAUDE}</pre>
      </div>
      <div className="section">
        <div className="section-head"><h2>Cursor · <span className="mono">.cursor/hooks.json</span></h2><Copy text={CURSOR} /></div>
        <pre className="code">{CURSOR}</pre>
      </div>
      <div className="section">
        <div className="section-head"><h2>Any other agent</h2></div>
        <pre className="code">{`# Codex CLI, Gemini CLI, or any command that edits files and exits
npx proofline loop "add a duplicate-invoice button" --agent codex

# On every save, or as a git pre-push gate
npx proofline watch
npx proofline init --hooks git`}</pre>
      </div>
      <div className="section">
        <div className="section-head"><h2>Project config</h2><span className="hint">proofline.config.json</span></div>
        <pre className="code">{JSON.stringify({ baseUrl: ws.project.baseUrl, flowsDir: ws.project.flowsDir, agent: ws.project.agent, maxIterations: ws.project.maxIterations }, null, 2)}</pre>
        <p className="faint">Default agent: {agentLabel(ws.project.agent)}.</p>
      </div>
    </div>
  );
}
