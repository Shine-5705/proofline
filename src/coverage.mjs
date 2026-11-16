// Learned coverage: which source files did the browser actually load while Kane CLI ran a flow?
// A dev server (scripts/serve-example.mjs) or `proofline proxy` appends every request to .proofline/requests.ndjson.
// After each Kane run, requests inside the run's time window are mapped back to files in the project.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, writeJSON } from './util.mjs';

export const REQUESTS = 'requests.ndjson';
export const LEARNED = 'learned-coverage.json';

export function logRequest(dataDir, urlPath) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(path.join(dataDir, REQUESTS), `${JSON.stringify({ t: Date.now(), path: urlPath })}\n`);
  } catch { /* never break the dev server */ }
}

// Map a request path to a file in the project, if one exists. Handles /, query strings, and Vite-style /src/... paths.
export function resolveRequest(root, urlPath) {
  let p = decodeURIComponent(String(urlPath).split('?')[0].split('#')[0]);
  if (p.startsWith('/@') || p.startsWith('/node_modules/') || p.startsWith('/api/')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const candidates = [path.join(root, p), path.join(root, 'public', p)];
  for (const c of candidates) {
    if (!c.startsWith(root)) continue;
    try { if (fs.statSync(c).isFile()) return path.relative(root, c).split(path.sep).join('/'); } catch { /* not a file */ }
  }
  return null;
}

export function filesLoadedBetween(cfg, startMs, endMs) {
  let text = '';
  try { text = fs.readFileSync(path.join(cfg.dataDir, REQUESTS), 'utf8'); } catch { return []; }
  const files = new Set();
  for (const line of text.split('\n')) {
    if (!line) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.t < startMs || ev.t > endMs) continue;
    const f = resolveRequest(cfg.root, ev.path);
    if (f) files.add(f);
  }
  return [...files].sort();
}

// Only passing runs teach coverage: a failed run may have stopped before loading the rest of the flow.
export function learnFromRun(cfg, run) {
  if (run.status !== 'passed') return null;
  const files = filesLoadedBetween(cfg, Date.parse(run.startedAt), Date.parse(run.endedAt) + 500);
  if (files.length === 0) return null;
  const file = path.join(cfg.dataDir, LEARNED);
  const all = readJSON(file, {});
  all[run.flowFile] = { files, runId: run.id, updatedAt: run.endedAt };
  writeJSON(file, all);
  return files;
}

export function learnedCoverage(cfg) {
  return readJSON(path.join(cfg.dataDir, LEARNED), {});
}
