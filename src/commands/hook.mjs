// Agent hooks. The agent stopping is the trigger; Kane's verdict decides whether it is allowed to stop.
//   Claude Code  Stop hook   → prints {"decision":"block","reason":<brief>} to keep Claude working.
//   Cursor       stop hook   → prints {"followup_message":<brief>} which Cursor auto-submits.
//   git          pre-push    → exit 1 blocks the push.
import { check } from './check.mjs';
import { greenNote } from '../brief.mjs';
import { id } from '../util.mjs';

async function readStdin() {
  if (process.stdin.isTTY) return {};
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data || '{}'); } catch { return {}; }
}

export async function hook(cfg, store, which) {
  const input = await readStdin();
  const session = input.session_id || input.conversation_id || 'default';
  const st = store.state('hook-state', {});
  const s = st[session] || { attempts: 0, loopId: null };
  // Each agent session that hits the hook becomes a loop record, so the console can show agent ↔ Kane turns.
  let loopRec = s.loopId ? store.getLoop(s.loopId) : null;
  if (!loopRec) {
    loopRec = { id: id('loop'), task: input.prompt || `${which} session ${String(session).slice(0, 8)}`, agent: which === 'cursor' ? 'cursor' : 'claude', via: `hook:${which}`, startedAt: new Date().toISOString(), status: 'running', iterations: [], maxIterations: cfg.maxIterations, source: 'kane-cli' };
    s.loopId = loopRec.id;
  }
  s.attempts += 1;
  const res = await check(cfg, store, { changed: true, quiet: true, trigger: `hook:${which}`, loopId: loopRec.id, iteration: s.attempts, maxIterations: cfg.maxIterations });
  loopRec.iterations.push({ n: s.attempts, startedAt: res.runs[0]?.startedAt || new Date().toISOString(), endedAt: new Date().toISOString(), runIds: res.runs.map((r) => r.id), verdict: res.verdict, brief: res.brief || null, prompt: s.attempts === 1 ? 'task' : 'repair-brief' });
  const out = {};
  if (res.verdict === 'green' || res.verdict === 'skipped') {
    loopRec.status = res.verdict === 'green' ? 'green' : 'skipped';
    loopRec.endedAt = new Date().toISOString();
    delete st[session];
    if (res.verdict === 'green') out.systemMessage = greenNote(res.runs);
  } else if (res.verdict === 'blocked') {
    loopRec.status = 'blocked'; loopRec.endedAt = new Date().toISOString();
    delete st[session];
    out.systemMessage = `Proofline: Kane CLI did not start (${res.runs[0]?.reason || 'unknown'}). Change not verified.`;
  } else if (s.attempts >= cfg.maxIterations) {
    loopRec.status = 'gave_up'; loopRec.endedAt = new Date().toISOString();
    delete st[session];
    out.systemMessage = `Proofline: still failing after ${s.attempts} attempts. Handing back to you. Brief: .proofline/brief.md`;
  } else {
    st[session] = s;
    if (which === 'claude') { out.decision = 'block'; out.reason = res.brief; }
    if (which === 'cursor') out.followup_message = res.brief;
  }
  // Nothing changed and nothing ran on the first stop: not worth a loop record.
  if (!(loopRec.status === 'skipped' && loopRec.iterations.length === 1)) store.saveLoop(loopRec);
  store.setState('hook-state', st);
  if (which === 'git') {
    if (res.verdict === 'red' || res.verdict === 'blocked') { console.error(res.brief); process.exitCode = 1; }
    return;
  }
  process.stdout.write(JSON.stringify(out));
}
