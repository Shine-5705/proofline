// proofline init: config, an example flow, and agent hook wiring. Never overwrites existing files.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, DEFAULTS } from '../config.mjs';
import { c } from '../util.mjs';

const EXAMPLE_FLOW = (url) => `---
mode: testing
tags: [smoke]
---

# Home page smoke test

## Open the app
Open ${url}.

## Check the main screen
Verify the main heading of the page is visible.
`;

function writeOnce(file, content, note) {
  if (fs.existsSync(file)) { console.log(c.gray(`  skip   ${file} (exists)`)); return false; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log(`  ${c.green('create')} ${file}${note ? c.gray(`  ${note}`) : ''}`);
  return true;
}

function mergeJSON(file, mutate) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new file */ }
  const before = JSON.stringify(data);
  mutate(data);
  if (JSON.stringify(data) === before) { console.log(c.gray(`  skip   ${file} (already wired)`)); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  ${c.green('update')} ${file}`);
}

export function init(root, opts = {}) {
  const url = opts.url || DEFAULTS.baseUrl;
  console.log(c.bold('proofline init'));
  writeOnce(path.join(root, CONFIG_FILE), `${JSON.stringify({ baseUrl: url, flowsDir: 'flows', agent: opts.agent || 'claude', maxIterations: 4, headless: true, coverage: { 'flows/home_test.md': ['**'] } }, null, 2)}\n`);
  writeOnce(path.join(root, 'flows', 'home_test.md'), EXAMPLE_FLOW(url), 'edit this, or let Kane design flows from your PRD');

  const hooks = opts.hooks || ['claude', 'cursor'];
  if (hooks.includes('claude')) {
    mergeJSON(path.join(root, '.claude', 'settings.json'), (d) => {
      d.hooks = d.hooks || {};
      d.hooks.Stop = d.hooks.Stop || [];
      if (!JSON.stringify(d.hooks.Stop).includes('proofline hook')) {
        d.hooks.Stop.push({ hooks: [{ type: 'command', command: 'npx --no-install proofline hook claude', timeout: 900 }] });
      }
    });
  }
  if (hooks.includes('cursor')) {
    mergeJSON(path.join(root, '.cursor', 'hooks.json'), (d) => {
      d.version = d.version || 1;
      d.hooks = d.hooks || {};
      d.hooks.stop = d.hooks.stop || [];
      if (!JSON.stringify(d.hooks.stop).includes('proofline hook')) d.hooks.stop.push({ command: 'npx --no-install proofline hook cursor' });
    });
  }
  if (hooks.includes('git')) {
    const gitHook = path.join(root, '.git', 'hooks', 'pre-push');
    if (fs.existsSync(path.join(root, '.git')) && writeOnce(gitHook, '#!/bin/sh\nexec npx --no-install proofline hook git\n')) fs.chmodSync(gitHook, 0o755);
  }
  const gi = path.join(root, '.gitignore');
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const add = ['.proofline/runs/*.ndjson', '.proofline/hook-state.json', '.testmuai/evidence/', 'secrets/'].filter((l) => !giText.includes(l));
  if (add.length) { fs.appendFileSync(gi, `${giText && !giText.endsWith('\n') ? '\n' : ''}# proofline\n${add.join('\n')}\n`); console.log(`  ${c.green('update')} .gitignore`); }
  console.log(`\nNext:\n  ${c.cyan('kane-cli login --oauth')}   sign in to TestMu AI (10,000 free credits)\n  ${c.cyan('npx proofline check')}      run every flow once\n  ${c.cyan('npx proofline ui')}         open the console`);
}
