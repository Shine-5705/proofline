import fs from 'node:fs';
import path from 'node:path';
import { readJSON } from './util.mjs';

export const CONFIG_FILE = 'proofline.config.json';

export const DEFAULTS = {
  // Where the app under test is reachable. Flows may reference it as {{baseUrl}}.
  baseUrl: 'http://localhost:4173',
  // Optional command that starts the app; Proofline waits for baseUrl before running flows.
  start: null,
  // Directory with Kane CLI test.md flows (files ending in _test.md).
  flowsDir: 'flows',
  // Which coding agent `proofline loop` drives. One of: claude, codex, cursor, gemini, custom.
  agent: 'claude',
  // For agent=custom: a command template. {brief} is replaced with the path of the repair brief.
  agentCommand: null,
  // Maximum agent ↔ Kane iterations before Proofline gives up and hands back to a human.
  maxIterations: 4,
  // Run Kane headless (set false to watch the browser).
  headless: true,
  // Per-flow hard timeout in seconds, passed to Kane CLI.
  timeout: 300,
  // Files whose change should re-run every flow (e.g. shared layout or API client).
  globalCovers: ['package.json'],
};

export function findRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

export function loadConfig(root = findRoot()) {
  const user = readJSON(path.join(root, CONFIG_FILE), {});
  const cfg = { ...DEFAULTS, ...user, root };
  cfg.dataDir = path.join(root, '.proofline');
  cfg.flowsPath = path.resolve(root, cfg.flowsDir);
  cfg.hasConfigFile = fs.existsSync(path.join(root, CONFIG_FILE));
  return cfg;
}
