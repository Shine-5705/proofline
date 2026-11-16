// Discovers Kane CLI test.md flows and maps changed files to the flows that cover them.
import fs from 'node:fs';
import path from 'node:path';
import { walk, matchesAny } from './util.mjs';

export function parseTestMd(text) {
  const out = { frontmatter: {}, title: null, steps: [] };
  let body = text;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      out.frontmatter[m[1]] = v;
    }
  }
  let cur = null;
  for (const line of body.split('\n')) {
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { cur = { title: h2[1].trim(), text: '' }; out.steps.push(cur); }
    else if (h1 && !out.title) out.title = h1[1].trim();
    else if (cur) cur.text += (cur.text ? '\n' : '') + line;
  }
  for (const s of out.steps) s.text = s.text.trim();
  return out;
}

export function discoverFlows(cfg) {
  const files = walk(cfg.flowsPath, (p) => p.endsWith('_test.md')).sort();
  return files.map((file) => {
    const rel = path.relative(cfg.root, file).split(path.sep).join('/');
    const parsed = parseTestMd(fs.readFileSync(file, 'utf8'));
    const covers = (cfg.coverage && cfg.coverage[rel]) || ['**'];
    return {
      id: path.basename(file).replace(/_test\.md$/, ''),
      file: rel,
      title: parsed.title || path.basename(file),
      tags: Array.isArray(parsed.frontmatter.tags) ? parsed.frontmatter.tags : [],
      steps: parsed.steps,
      covers,
      recorded: fs.existsSync(path.join(path.dirname(file), `output-${path.basename(file).replace(/_test\.md$/, '')}`)),
    };
  });
}

// Given the files an agent just touched, return the flows that need re-verification.
export function selectFlows(flows, changedFiles, cfg) {
  if (!changedFiles || changedFiles.length === 0) return flows;
  const changed = changedFiles.map((f) => f.split(path.sep).join('/'));
  if (changed.some((f) => matchesAny(f, cfg.globalCovers || []))) return flows;
  // A change to a flow file itself always re-runs that flow.
  return flows.filter((fl) => changed.includes(fl.file) || changed.some((f) => matchesAny(f, fl.covers)));
}
