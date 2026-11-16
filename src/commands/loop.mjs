// proofline loop "<task>": agent edits → Kane verifies → failure becomes the next prompt → repeat until green.
import fs from 'node:fs';
import path from 'node:path';
import { check } from './check.mjs';
import { runAgent } from '../agents.mjs';
import { diffStat } from '../git.mjs';
import { id, c, fmtDuration } from '../util.mjs';

const PREAMBLE = `You are working in a repository guarded by Proofline. After you finish editing, Proofline runs Kane CLI flows (plain-English end-to-end tests in a real browser) against the app. If they fail you will get the failure back. Make the smallest correct change.`;

export async function loop(cfg, store, task, opts = {}) {
  const max = Number(opts.max || cfg.maxIterations);
  const agentName = process.env.PROOFLINE_AGENT_NAME || cfg.agentName || cfg.agent;
  const loopRec = { id: id('loop'), task, agent: agentName, startedAt: new Date().toISOString(), status: 'running', iterations: [], maxIterations: max, source: 'kane-cli' };
  store.saveLoop(loopRec);
  console.log(c.bold(`proofline loop · ${agentName} ↔ Kane CLI · up to ${max} iterations`));
  let prompt = `${PREAMBLE}\n\nTask: ${task}`;
  for (let n = 1; n <= max; n++) {
    const it = { n, startedAt: new Date().toISOString(), prompt: n === 1 ? 'task' : 'repair-brief' };
    loopRec.iterations.push(it);
    store.saveLoop(loopRec);
    const skip = opts.skipAgentFirst && n === 1;
    console.log(c.cyan(skip ? `\n[${n}/${max}] verifying the current tree first (no agent turn)` : `\n[${n}/${max}] ${agentName} is editing…`));
    const briefFile = path.join(cfg.dataDir, 'brief.md');
    const agent = skip ? { exitCode: 0, output: '(skipped: verifying current tree first)', seconds: 0 } : await runAgent(cfg, prompt, briefFile, { onOutput: (s) => process.stdout.write(c.gray(s.replace(/^/gm, '  '))) });
    it.agent = { exitCode: agent.exitCode, seconds: agent.seconds, outputTail: agent.output.slice(-4000) };
    it.diff = diffStat(cfg.root);
    console.log(c.gray(skip ? `  ${it.diff.length} file(s) changed vs HEAD: ${it.diff.map((d) => d.file).join(', ')}` : `  ${agentName} exited ${agent.exitCode} in ${fmtDuration(agent.seconds)} · ${it.diff.length} file(s) changed vs HEAD`));
    if (agent.exitCode === 127) { loopRec.status = 'error'; it.verdict = 'agent_missing'; break; }
    console.log(c.cyan(`[${n}/${max}] Kane CLI is verifying…`));
    const res = await check(cfg, store, { changed: true, trigger: 'loop', loopId: loopRec.id, iteration: n, task, maxIterations: max });
    it.runIds = res.runs.map((r) => r.id);
    it.verdict = res.verdict;
    it.endedAt = new Date().toISOString();
    store.saveLoop(loopRec);
    if (res.verdict === 'green' || res.verdict === 'skipped') { loopRec.status = 'green'; break; }
    if (res.verdict === 'blocked') { loopRec.status = 'blocked'; break; }
    it.brief = res.brief;
    prompt = `${PREAMBLE}\n\n${res.brief}`;
    if (n === max) loopRec.status = 'gave_up';
  }
  loopRec.endedAt = new Date().toISOString();
  store.saveLoop(loopRec);
  const label = { green: c.green('GREEN · loop closed'), gave_up: c.red('GAVE UP · needs a human'), blocked: c.yellow('BLOCKED · Kane CLI did not start'), error: c.red('ERROR') }[loopRec.status] || loopRec.status;
  console.log(`\n${label} after ${loopRec.iterations.length} iteration(s). Open \`proofline ui\` to review.`);
  return loopRec;
}
