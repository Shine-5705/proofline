// Thin, faithful wrapper around the real Kane CLI binary.
// Proofline never fakes a verdict: every result here comes from a kane-cli process and its NDJSON stream.
import { spawn, spawnSync } from 'node:child_process';
import readline from 'node:readline';

const KANE_BIN = process.env.PROOFLINE_KANE_BIN || 'kane-cli';
const USER_AGENT = process.env.KANE_CLI_USER_AGENT || 'proofline';

export function kaneAvailable() {
  const r = spawnSync(KANE_BIN, ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function kaneReadiness() {
  const version = kaneAvailable();
  if (!version) return { version: null, loggedIn: false, detail: 'kane-cli not found on PATH. Install: npm install -g @testmuai/kane-cli' };
  const who = spawnSync(KANE_BIN, ['whoami'], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  const text = `${who.stdout || ''}${who.stderr || ''}`;
  const loggedIn = who.status === 0 && !/not logged in/i.test(text);
  let balance = null;
  if (loggedIn) {
    const b = spawnSync(KANE_BIN, ['balance'], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
    const m = `${b.stdout}`.match(/([\d,]+)\s*credits?/i);
    balance = m ? Number(m[1].replace(/,/g, '')) : null;
  }
  return { version, loggedIn, balance, detail: loggedIn ? 'Signed in' : 'Not signed in. Run: kane-cli login --oauth' };
}

// Normalises one NDJSON event from Kane CLI into Proofline's step model.
export function foldEvent(state, ev) {
  if (!ev || typeof ev !== 'object') return state;
  if (ev.type === 'stream_start') { state.streamStart = ev; return state; }
  if (!ev.type && (ev.step != null || ev.remark)) {
    const key = String(ev.step ?? state.steps.length + 1);
    let s = state.steps.find((x) => x.key === key);
    if (!s) { s = { key, index: state.steps.length + 1, status: 'running', remark: '', startedAt: Date.now() }; state.steps.push(s); }
    if (ev.status) s.status = ev.status;
    if (ev.remark) s.remark = ev.remark;
    if (ev.status === 'done' || ev.status === 'failed') s.endedAt = Date.now();
    return state;
  }
  switch (ev.type) {
    case 'run_end': state.runEnds.push(ev); state.runEnd = ev; break;
    case 'test_md_done': state.testMdDone = ev; break;
    case 'error': state.errors.push(ev); break;
    case 'warning': state.warnings.push(ev); break;
    default: state.other.push(ev);
  }
  return state;
}

export function summarise(state, exitCode) {
  const end = state.runEnd || {};
  const done = state.testMdDone || {};
  let status;
  if (exitCode === 0) status = 'passed';
  else if (exitCode === 1) status = 'failed';
  else if (exitCode === 2) status = 'not_started';
  else if (exitCode === 3) status = 'timeout';
  else status = 'error';
  const failedStep = state.steps.find((s) => s.status === 'failed');
  return {
    status,
    exitCode,
    summary: end.summary || end.one_liner || done.overall_status || null,
    reason: end.reason || (failedStep && failedStep.remark) || (state.errors[0] && (state.errors[0].message || state.errors[0].error)) || null,
    duration: Number(done.duration_s ?? end.duration ?? 0) || null,
    credits: state.runEnds.reduce((a, e) => a + (Number(e.credits_consumed) || 0), 0) || null,
    testUrl: end.test_url || null,
    sessionDir: end.session_dir || null,
    sessionId: done.session_id || null,
    finalState: end.final_state || null,
    failedStep: failedStep ? { index: failedStep.index, remark: failedStep.remark } : null,
    steps: state.steps.map(({ key, index, status: st, remark, startedAt, endedAt }) => ({ key, index, status: st, remark, ms: endedAt ? endedAt - startedAt : null })),
    warnings: state.warnings,
  };
}

/**
 * Runs one Kane CLI test.md flow. Streams NDJSON, calls onEvent for live UIs.
 * Resolves with { result, raw } where raw is the untouched NDJSON transcript (kept as evidence).
 */
export function runFlow(file, { cwd, headless = true, timeout, variablesFile, onEvent } = {}) {
  const args = ['testmd', 'run', file, '--agent'];
  if (headless) args.push('--headless');
  if (timeout) args.push('--timeout', String(timeout));
  if (variablesFile) args.push('--variables-file', variablesFile);
  return spawnKane(args, { cwd, onEvent });
}

export function runObjective(objective, { cwd, url, headless = true, timeout, onEvent } = {}) {
  const args = ['run', objective, '--agent'];
  if (url) args.push('--url', url);
  if (headless) args.push('--headless');
  if (timeout) args.push('--timeout', String(timeout));
  return spawnKane(args, { cwd, onEvent });
}

function spawnKane(args, { cwd, onEvent }) {
  // CI: Kane CLI's documented basic-auth flags, read from the CI secret store. Never logged or recorded.
  const auth = process.env.LT_USERNAME && process.env.LT_ACCESS_KEY ? ['--username', process.env.LT_USERNAME, '--access-key', process.env.LT_ACCESS_KEY] : [];
  return new Promise((resolve) => {
    const started = Date.now();
    const state = { steps: [], runEnds: [], errors: [], warnings: [], other: [], runEnd: null, testMdDone: null };
    const raw = [];
    let stderr = '';
    const child = spawn(KANE_BIN, [...args, ...auth], {
      cwd,
      env: { ...process.env, KANE_CLI_USER_AGENT: USER_AGENT, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.on('error', (err) => {
      resolve({ result: { status: 'not_started', exitCode: 2, reason: `Could not start kane-cli: ${err.message}`, steps: [], warnings: [] }, raw: '', stderr: '', args });
    });
    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      raw.push(line);
      let ev; try { ev = JSON.parse(line); } catch { return; }
      foldEvent(state, ev);
      onEvent && onEvent(ev, state);
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      const result = summarise(state, code);
      result.wallSeconds = (Date.now() - started) / 1000;
      if (!result.duration) result.duration = result.wallSeconds;
      const ev = stderr.match(/(\S+\.evidence)\b/);
      if (ev) result.evidence = ev[1];
      if (result.status === 'not_started' && !result.reason) result.reason = startFailure(stderr);
      resolve({ result, raw: raw.join('\n'), stderr, args });
    });
  });
}

// Picks the human-readable cause out of kane-cli's stderr when a run is refused before it starts.
export function startFailure(stderr) {
  const lines = String(stderr).split('\n').map((l) => l.trim()).filter(Boolean).filter((l) => !/^Skill update available/i.test(l));
  const err = lines.find((l) => /^error:/i.test(l)) || lines.find((l) => /not (authenticated|logged in|signed in)|chrome|network/i.test(l));
  if (err && /not authenticated|not logged in/i.test(err)) return 'Not signed in to TestMu AI. Run: kane-cli login --oauth';
  return (err || lines.slice(-2).join(' ') || 'kane-cli did not start').replace(/^error:\s*/i, '');
}
