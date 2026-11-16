// Builds console/public/demo-workspace.json: SAMPLE DATA for the hosted demo, clearly labelled mode:"demo".
// Flows are the real example flows; runs and loops are illustrative, not real Kane CLI output.
// Replace with real history any time: `cd examples/invoice-app && npx proofline export ../../console/public/demo-workspace.json`.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.mjs';
import { discoverFlows } from '../src/flows.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const exRoot = path.resolve(here, '..', 'examples', 'invoice-app');
const cfg = loadConfig(exRoot);
const flows = discoverFlows(cfg).map((f) => ({ ...f, recorded: true }));
const F = Object.fromEntries(flows.map((f) => [f.id, f]));

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => a + (b - a) * rnd();
const NOW = Date.parse('2026-11-16T14:00:00Z');
const runs = []; const loops = [];
let n = 0;
const rid = () => `run_demo${String(++n).padStart(3, '0')}`;
const shas = ['3f9a1c2', '8b04de7', 'c71e5a0', '0d2f9b4', 'a64c3e1', '5e8817f', 'e19b0c6', '7aa2d53'];

function steps(flow, failAt, failRemark, replay) {
  const out = [];
  flow.steps.forEach((s, i) => {
    const idx = i + 1;
    if (failAt && idx > failAt) return;
    const failed = failAt === idx;
    out.push({ key: String(idx), index: idx, status: failed ? 'failed' : 'done', remark: failed ? failRemark : passRemark(flow.id, idx, s), ms: Math.round((replay ? between(0.9, 3.2) : between(6, 18)) * 1000) });
  });
  return out;
}
function passRemark(fid, i, s) {
  const map = {
    create_invoice: ['Opened /#/reset; the Invoices heading is visible', 'Clicked New invoice and typed "Acme Robotics" into Client', 'Filled two line items: Design sprint 2 × 15000, QA pass 1 × 5000', 'Set Discount (%) to 10', 'Summary shows Subtotal ₹35,000, Discount − ₹3,500, GST ₹5,670, Total ₹37,170', 'Saved; page shows Acme Robotics · Draft · ₹37,170'],
    mark_paid: ['Opened the list; the Invoices heading is visible', 'Opened INV-0003 Kestrel Logistics; status is Sent', 'Clicked Mark as paid; badge reads Paid and the button is gone', 'Filtered by Paid; Kestrel Logistics is listed'],
    search_filter: ['Opened the list; 4 invoices are listed', 'Typed "northwind"; 2 rows, both Northwind Traders', 'Chose Draft; 1 row: INV-0004', 'Typed "zzz"; "No invoices match" is visible'],
  };
  return (map[fid] && map[fid][i - 1]) || s.title;
}

function run(flowId, t, { trigger = 'watch', status = 'passed', failAt, failRemark, replay = true, loopId = null, iteration = null, changed = [], sha } = {}) {
  const flow = F[flowId];
  const st = status === 'not_started' ? [] : steps(flow, status === 'failed' ? failAt : null, failRemark, replay && status === 'passed');
  const duration = status === 'not_started' ? 0.8 : st.reduce((a, s) => a + s.ms, 0) / 1000 + between(3, 6);
  const r = {
    id: rid(), flowId, flowFile: flow.file, flowTitle: flow.title, trigger, loopId, iteration, changedFiles: changed,
    git: { sha: sha || shas[Math.floor(rnd() * shas.length)], dirty: trigger.startsWith('hook') || trigger === 'loop' || trigger === 'watch' },
    kaneVersion: '0.10.4', startedAt: new Date(t).toISOString(), endedAt: new Date(t + duration * 1000).toISOString(),
    status, exitCode: { passed: 0, failed: 1, not_started: 2 }[status],
    summary: status === 'passed' ? 'All steps passed' : status === 'failed' ? 'Assertion failed' : null,
    reason: status === 'not_started' ? 'Not logged in. Run: kane-cli login --oauth' : status === 'failed' ? failRemark : null,
    duration, credits: status === 'not_started' ? 0 : replay && status === 'passed' ? 0 : Math.round(between(38, 64)),
    testUrl: null, failedStep: status === 'failed' ? { index: failAt, remark: failRemark } : null,
    steps: st, source: 'demo',
  };
  runs.push(r);
  return r;
}

function loop({ task, agent, via, start, turns }) {
  const id = `loop_demo${String(loops.length + 1).padStart(2, '0')}`;
  let t = start;
  const iterations = turns.map((turn, i) => {
    const it = { n: i + 1, startedAt: new Date(t).toISOString(), prompt: i === 0 ? 'task' : 'repair-brief' };
    const agentSecs = turn.agentSecs ?? between(40, 160);
    if (via === 'loop') it.agent = { exitCode: 0, seconds: agentSecs };
    it.diff = turn.diff;
    t += agentSecs * 1000;
    const rs = turn.runs.map((spec) => { const r = run(spec.flow, t, { trigger: via, loopId: id, iteration: i + 1, changed: turn.diff.map((d) => d.file), replay: spec.status === 'passed' && i > 0, ...spec }); t += r.duration * 1000 + 1500; return r; });
    it.runIds = rs.map((r) => r.id);
    it.verdict = rs.some((r) => r.status === 'not_started') ? 'blocked' : rs.every((r) => r.status === 'passed') ? 'green' : 'red';
    it.endedAt = new Date(t).toISOString();
    if (it.verdict === 'red') {
      const f = rs.filter((r) => r.status !== 'passed');
      it.brief = ['# Proofline: Kane CLI rejected this change', '', `Original task: ${task}`, '', `Attempt ${i + 1} of 4.`, '', `Kane CLI ran ${rs.length} flow(s) against the app in a real browser. ${f.length} did not pass.`, '',
        ...f.flatMap((r) => [`## ${r.flowTitle} (${r.flowFile})`, `- Verdict: failed (exit 1)`, `- Failing step ${r.failedStep.index}: ${r.failedStep.remark}`, '- Evidence pack (screenshots, console, network): .testmuai/evidence/…', '']),
        '## What to do', '1. Read the failing step and fix the application code so the flow passes. The flow describes intended behaviour.', '2. Only edit a *_test.md flow if the requirement itself changed; say so explicitly if you do.', '3. Stop when you are done editing. Proofline re-runs Kane CLI on the affected flows automatically.'].join('\n');
    }
    t += 4000;
    return it;
  });
  const last = iterations[iterations.length - 1].verdict;
  const status = last === 'green' ? 'green' : last === 'blocked' ? 'blocked' : 'gave_up';
  loops.push({ id, task, agent, via, startedAt: new Date(start).toISOString(), endedAt: new Date(t).toISOString(), status, iterations, maxIterations: 4, source: 'demo' });
}

const H = 3600e3; const D = 24 * H;
// Baseline: first authoring runs (cost credits), then everyday replays from saves and pushes.
let t0 = NOW - 9 * D;
for (const f of flows) { run(f.id, t0, { trigger: 'manual', replay: false }); t0 += 3 * 60e3; }
for (let d = 8; d >= 0; d--) {
  const k = 3 + Math.floor(rnd() * 5);
  for (let i = 0; i < k; i++) {
    const f = flows[Math.floor(rnd() * flows.length)];
    run(f.id, NOW - d * D - between(1, 9) * H, { trigger: rnd() < 0.7 ? 'watch' : 'hook:git' });
  }
}
const totalsDiff = [{ file: 'totals.js', added: 2, removed: 1 }, { file: 'app.js', added: 18, removed: 3 }];
loop({ task: 'Add a percentage discount to the invoice editor', agent: 'claude', via: 'hook:claude', start: NOW - 8 * D + 3 * H, turns: [
  { diff: totalsDiff, runs: [{ flow: 'create_invoice', status: 'failed', failAt: 5, failRemark: 'Expected GST 18% ₹5,670 but the summary shows ₹6,300. GST appears to be computed before the discount.', replay: false }] },
  { diff: [{ file: 'totals.js', added: 1, removed: 1 }], runs: [{ flow: 'create_invoice', status: 'passed', replay: false }] },
] });
loop({ task: 'Typing in a line item should update totals live', agent: 'cursor', via: 'hook:cursor', start: NOW - 6 * D + 5 * H, turns: [
  { diff: [{ file: 'app.js', added: 9, removed: 4 }], runs: [{ flow: 'create_invoice', status: 'failed', failAt: 3, failRemark: 'Line 1 quantity reset to 1 after typing the rate; subtotal shows ₹20,000 instead of ₹35,000. The form re-renders on every change and drops focus.' }] },
  { diff: [{ file: 'app.js', added: 14, removed: 6 }], runs: [{ flow: 'create_invoice', status: 'passed' }] },
] });
loop({ task: 'Mark as paid should update the list badge', agent: 'claude', via: 'hook:claude', start: NOW - 5 * D + 2 * H, turns: [
  { diff: [{ file: 'app.js', added: 6, removed: 1 }], runs: [{ flow: 'mark_paid', status: 'passed' }, { flow: 'search_filter', status: 'passed' }] },
] });
loop({ task: 'Filter the invoice list as the user types', agent: 'codex', via: 'loop', start: NOW - 4 * D + 6 * H, turns: [
  { diff: [{ file: 'app.js', added: 11, removed: 2 }], runs: [{ flow: 'search_filter', status: 'failed', failAt: 2, failRemark: 'After typing "northwind" the box contains only "n": the list re-rendered and the search box lost focus.' }, { flow: 'mark_paid', status: 'passed' }] },
  { diff: [{ file: 'app.js', added: 4, removed: 0 }], runs: [{ flow: 'search_filter', status: 'passed' }, { flow: 'mark_paid', status: 'passed' }] },
] });
loop({ task: 'Show an empty state when no invoices match', agent: 'claude', via: 'hook:claude', start: NOW - 3 * D + 4 * H, turns: [
  { diff: [{ file: 'app.js', added: 5, removed: 1 }], runs: [{ flow: 'search_filter', status: 'failed', failAt: 4, failRemark: 'Typed "zzz": the table header is still shown with zero rows and no "No invoices match" message.' }] },
  { diff: [{ file: 'app.js', added: 3, removed: 2 }], runs: [{ flow: 'search_filter', status: 'failed', failAt: 4, failRemark: 'Message reads "No results" instead of "No invoices match".' }] },
  { diff: [{ file: 'app.js', added: 1, removed: 1 }], runs: [{ flow: 'search_filter', status: 'passed' }] },
] });
loop({ task: 'Move invoice storage to a v2 schema', agent: 'claude', via: 'hook:claude', start: NOW - 2 * D + 3 * H, turns: [1, 2, 3, 4].map((i) => ({ diff: [{ file: 'app.js', added: 8 + i, removed: 3 }, { file: 'data.js', added: 4, removed: 4 }], runs: [{ flow: 'mark_paid', status: 'failed', failAt: 4, failRemark: i < 3 ? 'After marking INV-0003 paid and returning to the list, the Paid filter shows no rows: status is written to the old storage key.' : 'Paid filter still empty after reload; the v1 → v2 migration runs on every load and overwrites the saved status.' }] })) });
loop({ task: 'Add a "Duplicate invoice" action', agent: 'cursor', via: 'hook:cursor', start: NOW - 1 * D + 2 * H, turns: [
  { diff: [{ file: 'app.js', added: 22, removed: 0 }], runs: [{ flow: 'create_invoice', status: 'not_started' }] },
] });
loop({ task: 'Add a "Duplicate invoice" action', agent: 'cursor', via: 'hook:cursor', start: NOW - 1 * D + 3 * H, turns: [
  { diff: [{ file: 'app.js', added: 22, removed: 0 }], runs: [{ flow: 'create_invoice', status: 'passed' }, { flow: 'mark_paid', status: 'passed' }, { flow: 'search_filter', status: 'passed' }] },
] });

runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
loops.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
const ws = { mode: 'demo', generatedAt: new Date(NOW).toISOString(), project: { name: 'tally-invoices', baseUrl: cfg.baseUrl, agent: 'claude', maxIterations: 4, flowsDir: 'flows' }, flows, runs, loops };
const out = path.resolve(here, '..', 'console', 'public', 'demo-workspace.json');
fs.writeFileSync(out, JSON.stringify(ws, null, 2));
console.log(`demo workspace: ${flows.length} flows, ${runs.length} runs, ${loops.length} loops → ${path.relative(process.cwd(), out)}`);
