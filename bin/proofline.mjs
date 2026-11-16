#!/usr/bin/env node
// Proofline CLI entry. Usage: proofline <command> [options]
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, findRoot } from '../src/config.mjs';
import { Store } from '../src/store.mjs';
import { check } from '../src/commands/check.mjs';
import { loop } from '../src/commands/loop.mjs';
import { hook } from '../src/commands/hook.mjs';
import { watch } from '../src/commands/watch.mjs';
import { init } from '../src/commands/init.mjs';
import { doctor } from '../src/commands/doctor.mjs';
import { serve, workspace } from '../src/server.mjs';
import { c } from '../src/util.mjs';

const HELP = `${c.bold('proofline')} — your coding agent doesn't get to say "done" until Kane CLI says "pass".

Usage
  proofline init [--url <baseUrl>] [--agent claude|codex|cursor|gemini] [--hooks claude,cursor,git]
  proofline check [--changed] [--since <ref>] [--flow <id,...>]   run flows through Kane CLI
  proofline loop "<task>" [--max <n>] [--verify-first]           agent edits → Kane verifies → repeat until green
  proofline watch                                               re-verify affected flows on every save
  proofline hook claude|cursor|git                              entry point for agent / git hooks
  proofline ui [--port 4317]                                    local console over your run history
  proofline export [file]                                       write the workspace JSON (for sharing / the hosted demo)
  proofline doctor                                              check kane-cli, sign-in, flows and hooks

Docs: https://github.com/Shine-5705/proofline`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true; else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parse(rest);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(HELP); return; }
  if (cmd === '--version' || cmd === '-V') { console.log(JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).version); return; }
  if (cmd === 'init') return init(findRoot(), { url: args.url, agent: args.agent, hooks: args.hooks ? String(args.hooks).split(',') : undefined });

  // Agent hooks may start in another directory; both Cursor and Claude Code export the project root.
  if (cmd === 'hook') { const dir = process.env.CURSOR_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR; if (dir && fs.existsSync(dir)) process.chdir(dir); }
  const cfg = loadConfig();
  if (args.agent) cfg.agent = args.agent;
  if (args.headed) cfg.headless = false;
  const store = new Store(cfg.dataDir);

  switch (cmd) {
    case 'check': {
      const res = await check(cfg, store, { changed: !!args.changed, since: args.since, flow: args.flow ? String(args.flow).split(',') : null });
      process.exitCode = res.verdict === 'green' || res.verdict === 'skipped' ? 0 : res.verdict === 'blocked' ? 2 : 1;
      break;
    }
    case 'loop': {
      const task = args._.join(' ');
      if (!task) { console.error('Usage: proofline loop "<task>"'); process.exitCode = 2; return; }
      const rec = await loop(cfg, store, task, { max: args.max, skipAgentFirst: !!args['verify-first'] });
      process.exitCode = rec.status === 'green' ? 0 : 1;
      break;
    }
    case 'watch': watch(cfg, store); break;
    case 'hook': await hook(cfg, store, args._[0] || 'claude'); break;
    case 'ui': {
      const port = Number(args.port || 4317);
      serve(cfg, store, { port });
      console.log(`proofline console → ${c.cyan(`http://localhost:${port}`)}`);
      break;
    }
    case 'export': {
      const data = workspace(cfg, store);
      data.mode = 'export';
      const out = JSON.stringify(data, null, 2);
      if (args._[0]) { fs.writeFileSync(path.resolve(args._[0]), out); console.log(`wrote ${args._[0]}`); } else process.stdout.write(out);
      break;
    }
    case 'doctor': doctor(cfg); break;
    default: console.error(`Unknown command "${cmd}".\n\n${HELP}`); process.exitCode = 2;
  }
}

main().catch((err) => { console.error(c.red(err.stack || err.message)); process.exitCode = 1; });
