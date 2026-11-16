#!/usr/bin/env node
// Custom-agent adapter for agents that are not a local CLI (e.g. Grok Bot, a hosted coding agent).
// Proofline calls: node scripts/handoff-agent.mjs <brief>
// The brief is placed in .proofline/inbox/turn-N.md; the external agent reads it, edits the code, then writes
// .proofline/inbox/turn-N.done (optionally with a one-paragraph note). This script relays the note and exits,
// and Proofline re-runs Kane CLI. Nothing here edits code: the external agent does.
import fs from 'node:fs';
import path from 'node:path';

const brief = process.argv[2];
const inbox = path.join(process.cwd(), '.proofline', 'inbox');
fs.mkdirSync(inbox, { recursive: true });
const n = fs.readdirSync(inbox).filter((f) => /^turn-\d+\.md$/.test(f)).length + 1;
const md = path.join(inbox, `turn-${n}.md`);
const done = path.join(inbox, `turn-${n}.done`);
fs.copyFileSync(brief, md);
const agent = process.env.PROOFLINE_AGENT_NAME || 'external agent';
console.log(`handoff → ${agent}: repair brief at .proofline/inbox/turn-${n}.md, waiting for the agent's edit…`);
const timeoutMs = Number(process.env.PROOFLINE_HANDOFF_TIMEOUT || 1800) * 1000;
const t0 = Date.now();
const timer = setInterval(() => {
  if (fs.existsSync(done)) {
    clearInterval(timer);
    const note = fs.readFileSync(done, 'utf8').trim();
    console.log(`${agent} finished in ${Math.round((Date.now() - t0) / 1000)}s${note ? `: ${note}` : ''}`);
    process.exit(0);
  }
  if (Date.now() - t0 > timeoutMs) { clearInterval(timer); console.log(`${agent} did not respond`); process.exit(1); }
}, 500);
