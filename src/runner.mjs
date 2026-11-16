// Runs a set of flows through Kane CLI and records every result. Shared by check, watch, hook, loop and the console API.
import { EventEmitter } from 'node:events';
import { runFlow, kaneAvailable } from './kane.mjs';
import { gitInfo } from './git.mjs';
import { id } from './util.mjs';

export const bus = new EventEmitter();

export async function verify(cfg, store, flows, meta = {}) {
  const kaneVersion = kaneAvailable();
  const git = gitInfo(cfg.root);
  const results = [];
  for (const flow of flows) {
    const run = {
      id: id('run'),
      flowId: flow.id,
      flowFile: flow.file,
      flowTitle: flow.title,
      trigger: meta.trigger || 'manual',
      loopId: meta.loopId || null,
      iteration: meta.iteration ?? null,
      changedFiles: meta.changedFiles || [],
      git,
      kaneVersion,
      startedAt: new Date().toISOString(),
      status: 'running',
      source: 'kane-cli',
    };
    bus.emit('run:start', run);
    const { result, raw, args } = await runFlow(flow.file, {
      cwd: cfg.root,
      headless: cfg.headless,
      timeout: cfg.timeout,
      variablesFile: cfg.variablesFile,
      onEvent: (ev, state) => bus.emit('run:event', { runId: run.id, ev, steps: state.steps }),
    });
    Object.assign(run, result, { endedAt: new Date().toISOString(), kaneArgs: args });
    store.saveRun(run, raw);
    bus.emit('run:end', run);
    results.push(run);
    // A run that never started (not signed in, no Chrome) will not start for the next flow either.
    if (run.status === 'not_started') break;
  }
  return results;
}

export function verdict(runs) {
  if (runs.length === 0) return 'skipped';
  if (runs.some((r) => r.status === 'not_started' || r.status === 'error')) return 'blocked';
  if (runs.every((r) => r.status === 'passed')) return 'green';
  return 'red';
}
