import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { globToRegExp, matchesAny } from '../src/util.mjs';
import { parseTestMd, selectFlows } from '../src/flows.mjs';
import { foldEvent, summarise } from '../src/kane.mjs';
import { repairBrief } from '../src/brief.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const FAKE = path.join(here, 'fixtures', 'fake-kane.mjs');
const BIN = path.join(root, 'bin', 'proofline.mjs');

test('glob matching', () => {
  assert.ok(globToRegExp('src/**/*.js').test('src/a/b/c.js'));
  assert.ok(globToRegExp('src/**/*.js').test('src/c.js'));
  assert.ok(!globToRegExp('src/*.js').test('src/a/c.js'));
  assert.ok(matchesAny('./totals.js', ['*.{js,ts}']));
  assert.ok(matchesAny('anything/at/all.txt', ['**']));
});

test('parses Kane test.md flows', () => {
  const p = parseTestMd('---\nmode: testing\ntags: [smoke, billing]\n---\n\n# Title\n\n## Step one\nDo a thing.\n\n## Step two\nVerify it.\n');
  assert.deepEqual(p.frontmatter.tags, ['smoke', 'billing']);
  assert.equal(p.title, 'Title');
  assert.equal(p.steps.length, 2);
  assert.equal(p.steps[1].text, 'Verify it.');
});

test('selects only flows that cover changed files', () => {
  const flows = [{ id: 'a', file: 'flows/a_test.md', covers: ['totals.js'] }, { id: 'b', file: 'flows/b_test.md', covers: ['data.js'] }];
  const cfg = { globalCovers: ['index.html'] };
  assert.deepEqual(selectFlows(flows, ['totals.js'], cfg).map((f) => f.id), ['a']);
  assert.deepEqual(selectFlows(flows, ['index.html'], cfg).map((f) => f.id), ['a', 'b']);
  assert.deepEqual(selectFlows(flows, ['flows/b_test.md'], cfg).map((f) => f.id), ['b']);
  assert.deepEqual(selectFlows(flows, ['README.md'], cfg).map((f) => f.id), []);
});

test('folds the NDJSON stream and maps exit codes', () => {
  const st = { steps: [], runEnds: [], errors: [], warnings: [], other: [] };
  foldEvent(st, { type: 'stream_start' });
  foldEvent(st, { step: 1, status: 'running', remark: 'Open' });
  foldEvent(st, { step: 1, status: 'done', remark: 'Opened' });
  foldEvent(st, { step: 2, status: 'failed', remark: 'Total wrong' });
  foldEvent(st, { type: 'run_end', summary: 'nope', credits_consumed: 12, test_url: 'https://x' });
  const r = summarise(st, 1);
  assert.equal(r.status, 'failed');
  assert.equal(r.steps.length, 2);
  assert.equal(r.failedStep.remark, 'Total wrong');
  assert.equal(r.credits, 12);
  assert.equal(summarise(st, 2).status, 'not_started');
  assert.equal(summarise(st, 3).status, 'timeout');
});

test('repair brief names the failing step', () => {
  const b = repairBrief([{ status: 'failed', flowTitle: 'Create', flowFile: 'flows/c_test.md', failedStep: { index: 5, remark: 'GST shows ₹6,300' }, steps: [] }], { iteration: 1, maxIterations: 4 });
  assert.match(b, /Failing step 5: GST shows ₹6,300/);
  assert.match(b, /Attempt 1 of 4/);
});

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-'));
  fs.cpSync(path.join(root, 'examples', 'invoice-app'), dir, { recursive: true });
  fs.rmSync(path.join(dir, '.proofline'), { recursive: true, force: true });
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  return dir;
}
const env = (dir, extra = {}) => ({ ...process.env, NO_COLOR: '1', PROOFLINE_KANE_BIN: FAKE, FAKE_KANE_FAIL_IF_FILE: path.join(dir, 'totals.js'), FAKE_KANE_FAIL_IF_TEXT: 'subtotal * GST_RATE', ...extra });
const BAD = (dir) => fs.writeFileSync(path.join(dir, 'totals.js'), fs.readFileSync(path.join(dir, 'totals.js'), 'utf8').replace('taxable * GST_RATE', 'subtotal * GST_RATE'));

test('check --changed runs only the affected flow and records it', () => {
  const dir = sandbox(); BAD(dir);
  const r = spawnSync('node', [BIN, 'check', '--changed'], { cwd: dir, env: env(dir), encoding: 'utf8' });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /verifying 1\/3 flow/);
  assert.match(r.stdout, /FAIL/);
  const runs = fs.readdirSync(path.join(dir, '.proofline', 'runs')).filter((f) => f.endsWith('.json'));
  assert.equal(runs.length, 1);
  assert.ok(fs.readFileSync(path.join(dir, '.proofline', 'brief.md'), 'utf8').includes('₹6,300'));
});

test('Claude Code Stop hook blocks with the brief, then lets the agent stop once green', () => {
  const dir = sandbox(); BAD(dir);
  const input = JSON.stringify({ session_id: 's1', stop_hook_active: false });
  const r1 = spawnSync('node', [BIN, 'hook', 'claude'], { cwd: dir, env: env(dir), input, encoding: 'utf8' });
  const o1 = JSON.parse(r1.stdout);
  assert.equal(o1.decision, 'block');
  assert.match(o1.reason, /Kane CLI rejected this change/);
  fs.writeFileSync(path.join(dir, 'totals.js'), fs.readFileSync(path.join(dir, 'totals.js'), 'utf8').replace('subtotal * GST_RATE', 'taxable * GST_RATE'));
  fs.appendFileSync(path.join(dir, 'app.js'), '\n// touched\n');
  const r2 = spawnSync('node', [BIN, 'hook', 'claude'], { cwd: dir, env: env(dir), input, encoding: 'utf8' });
  const o2 = JSON.parse(r2.stdout);
  assert.equal(o2.decision, undefined);
  assert.match(o2.systemMessage, /All passed/);
  const loops = fs.readdirSync(path.join(dir, '.proofline', 'loops'));
  assert.equal(loops.length, 1);
  const loop = JSON.parse(fs.readFileSync(path.join(dir, '.proofline', 'loops', loops[0]), 'utf8'));
  assert.equal(loop.status, 'green');
  assert.deepEqual(loop.iterations.map((i) => i.verdict), ['red', 'green']);
});

test('Cursor stop hook returns a followup_message', () => {
  const dir = sandbox(); BAD(dir);
  const r = spawnSync('node', [BIN, 'hook', 'cursor'], { cwd: dir, env: env(dir), input: '{"conversation_id":"c1","loop_count":0}', encoding: 'utf8' });
  assert.match(JSON.parse(r.stdout).followup_message, /Failing step/);
});

test('loop: Kane failure is fed to the agent, which fixes it, then Kane passes', () => {
  const dir = sandbox(); BAD(dir);
  // A scripted stand-in agent that applies the fix it is told about (the real loop drives claude/codex/cursor).
  const cfgPath = path.join(dir, 'proofline.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.agent = 'custom';
  cfg.agentCommand = `grep -q 'GST' {brief} && sed -i 's/subtotal \\* GST_RATE/taxable * GST_RATE/' totals.js`;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  const r = spawnSync('node', [BIN, 'loop', 'Fix what Kane finds', '--verify-first'], { cwd: dir, env: env(dir), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /GREEN · loop closed after 2 iteration/);
});

test('blocked when kane-cli cannot start (e.g. not signed in)', () => {
  const dir = sandbox(); BAD(dir);
  const r = spawnSync('node', [BIN, 'check'], { cwd: dir, env: env(dir, { FAKE_KANE_NOT_STARTED: '1' }), encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /BLOCKED/);
});

test('turns kane-cli stderr into a readable start failure', async () => {
  const { startFailure } = await import('../src/kane.mjs');
  const stderr = "Skill update available: not installed → 0.1.4\n\nerror: Not authenticated. Choose one:\n  • Pass credentials inline\n";
  assert.equal(startFailure(stderr), 'Not signed in to TestMu AI. Run: kane-cli login --oauth');
  assert.equal(startFailure('error: Chrome not found\n'), 'Chrome not found');
});

test('changed files are relative to the project even inside a larger repo', () => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'proofline-outer-'));
  const dir = path.join(outer, 'apps', 'web');
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(root, 'examples', 'invoice-app'), dir, { recursive: true });
  const g = (...a) => spawnSync('git', a, { cwd: outer, encoding: 'utf8' });
  g('init', '-q'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  BAD(dir);
  const r = spawnSync('node', [BIN, 'check', '--changed'], { cwd: dir, env: env(dir), encoding: 'utf8' });
  assert.match(r.stdout, /verifying 1\/3 flow/);
  assert.match(r.stdout, /changed: totals\.js/);
});

test('learns which files a flow loaded from the dev-server request log', async () => {
  const { resolveRequest, learnFromRun, logRequest } = await import('../src/coverage.mjs');
  const { discoverFlows, selectFlows } = await import('../src/flows.mjs');
  const { loadConfig } = await import('../src/config.mjs');
  const dir = sandbox();
  const cfgPath = path.join(dir, 'proofline.config.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); delete raw.coverage; fs.writeFileSync(cfgPath, JSON.stringify(raw));
  const cfg = loadConfig(dir);
  assert.equal(resolveRequest(dir, '/'), 'index.html');
  assert.equal(resolveRequest(dir, '/totals.js?v=2'), 'totals.js');
  assert.equal(resolveRequest(dir, '/nope.js'), null);
  const start = Date.now();
  for (const p of ['/', '/app.js', '/totals.js', '/styles.css', '/favicon.ico']) logRequest(cfg.dataDir, p);
  const run = { id: 'r1', status: 'passed', flowFile: 'flows/create_invoice_test.md', startedAt: new Date(start - 10).toISOString(), endedAt: new Date(Date.now() + 10).toISOString() };
  assert.deepEqual(learnFromRun(cfg, run), ['app.js', 'index.html', 'styles.css', 'totals.js']);
  const flows = discoverFlows(cfg);
  const ci = flows.find((f) => f.id === 'create_invoice');
  assert.deepEqual(ci.learned, ['app.js', 'index.html', 'styles.css', 'totals.js']);
  // data.js was never loaded by that flow, so a data.js change selects only flows that still guard everything.
  assert.ok(!selectFlows([ci], ['data.js'], { globalCovers: [] }).length);
  assert.equal(selectFlows([ci], ['totals.js'], { globalCovers: [] }).length, 1);
});
