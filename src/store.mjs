// Plain-file run store under .proofline/. Human-readable, diffable, easy to export to the console.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, writeJSON } from './util.mjs';

export class Store {
  constructor(dataDir) {
    this.dir = dataDir;
    this.runsDir = path.join(dataDir, 'runs');
    this.loopsDir = path.join(dataDir, 'loops');
    fs.mkdirSync(this.runsDir, { recursive: true });
    fs.mkdirSync(this.loopsDir, { recursive: true });
    const gi = path.join(dataDir, '.gitignore');
    if (!fs.existsSync(gi)) fs.writeFileSync(gi, '# Proofline local run history\n*.ndjson\nhook-state.json\n');
  }
  saveRun(run, raw) {
    writeJSON(path.join(this.runsDir, `${run.id}.json`), run);
    if (raw != null) fs.writeFileSync(path.join(this.runsDir, `${run.id}.ndjson`), raw);
    return run;
  }
  getRun(id) { return readJSON(path.join(this.runsDir, `${id}.json`)); }
  getRaw(id) { try { return fs.readFileSync(path.join(this.runsDir, `${id}.ndjson`), 'utf8'); } catch { return null; } }
  listRuns() { return list(this.runsDir).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')); }
  saveLoop(loop) { writeJSON(path.join(this.loopsDir, `${loop.id}.json`), loop); return loop; }
  getLoop(id) { return readJSON(path.join(this.loopsDir, `${id}.json`)); }
  listLoops() { return list(this.loopsDir).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')); }
  state(name, fallback) { return readJSON(path.join(this.dir, `${name}.json`), fallback); }
  setState(name, value) { writeJSON(path.join(this.dir, `${name}.json`), value); }
}

function list(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.json')); } catch { return []; }
  return names.map((n) => readJSON(path.join(dir, n))).filter(Boolean);
}
