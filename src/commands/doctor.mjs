import fs from 'node:fs';
import path from 'node:path';
import { kaneReadiness } from '../kane.mjs';
import { discoverFlows } from '../flows.mjs';
import { c } from '../util.mjs';
import { spawnSync } from 'node:child_process';

export function readiness(cfg) {
  const kane = kaneReadiness();
  const flows = discoverFlows(cfg);
  const has = (bin) => spawnSync(bin, ['--version'], { encoding: 'utf8' }).status === 0;
  const claudeHook = fs.existsSync(path.join(cfg.root, '.claude', 'settings.json')) && fs.readFileSync(path.join(cfg.root, '.claude', 'settings.json'), 'utf8').includes('proofline hook');
  const cursorHook = fs.existsSync(path.join(cfg.root, '.cursor', 'hooks.json')) && fs.readFileSync(path.join(cfg.root, '.cursor', 'hooks.json'), 'utf8').includes('proofline hook');
  return {
    kane,
    config: cfg.hasConfigFile,
    flows: flows.length,
    agents: { claude: has('claude'), codex: has('codex'), cursor: has('cursor-agent'), gemini: has('gemini') },
    hooks: { claude: claudeHook, cursor: cursorHook },
  };
}

export function doctor(cfg) {
  const r = readiness(cfg);
  const row = (ok, label, detail) => console.log(`  ${ok ? c.green('✓') : c.red('✗')} ${label}${detail ? c.gray(`  ${detail}`) : ''}`);
  console.log(c.bold('proofline doctor'));
  row(!!r.kane.version, 'kane-cli installed', r.kane.version || 'npm install -g @testmuai/kane-cli');
  row(r.kane.loggedIn, 'kane-cli signed in', r.kane.loggedIn ? (r.kane.balance != null ? `${r.kane.balance} credits` : '') : 'kane-cli login --oauth');
  row(r.config, 'proofline.config.json', r.config ? '' : 'npx proofline init');
  row(r.flows > 0, `${r.flows} flow(s) in ${cfg.flowsDir}/`);
  row(r.hooks.claude, 'Claude Code Stop hook', r.hooks.claude ? '' : 'npx proofline init --hooks claude');
  row(r.hooks.cursor, 'Cursor stop hook', r.hooks.cursor ? '' : 'npx proofline init --hooks cursor');
  const agents = Object.entries(r.agents).filter(([, v]) => v).map(([k]) => k);
  row(agents.length > 0, 'headless agent for `proofline loop`', agents.join(', ') || 'install claude, codex, cursor-agent or gemini');
  return r;
}
