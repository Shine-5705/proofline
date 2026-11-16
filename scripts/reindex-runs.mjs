#!/usr/bin/env node
// Re-derives each stored run's steps/summary from its own raw Kane CLI NDJSON transcript (.proofline/runs/<id>.ndjson).
// Use after upgrading Proofline's NDJSON parser. Never invents data: everything comes from the saved transcript.
//   node scripts/reindex-runs.mjs [project-dir]
import fs from 'node:fs';
import path from 'node:path';
import { foldEvent, summarise } from '../src/kane.mjs';

const dir = path.join(path.resolve(process.argv[2] || '.'), '.proofline', 'runs');
let n = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const run = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const nd = path.join(dir, f.replace(/\.json$/, '.ndjson'));
  if (!fs.existsSync(nd) || run.source !== 'kane-cli') continue;
  const state = { steps: [], runEnds: [], errors: [], warnings: [], other: [], runEnd: null, testMdDone: null };
  for (const line of fs.readFileSync(nd, 'utf8').split('\n')) { try { foldEvent(state, JSON.parse(line)); } catch {} }
  const r = summarise(state, run.exitCode);
  for (const k of ['summary', 'steps', 'failedStep', 'testUrl', 'replay', 'sessionId', 'finalState']) if (r[k] != null) run[k] = r[k];
  if (r.credits != null) run.credits = r.credits;
  fs.writeFileSync(path.join(dir, f), JSON.stringify(run, null, 2));
  n++;
}
console.log(`reindexed ${n} run(s) in ${dir}`);
