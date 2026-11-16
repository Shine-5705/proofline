import { discoverFlows, selectFlows } from '../flows.mjs';
import { changedFiles } from '../git.mjs';
import { verify, verdict, bus } from '../runner.mjs';
import { repairBrief } from '../brief.mjs';
import { c, fmtDuration } from '../util.mjs';
import fs from 'node:fs';
import path from 'node:path';

export function printRun(run) {
  const mark = run.status === 'passed' ? c.green('PASS') : run.status === 'failed' ? c.red('FAIL') : run.status === 'not_started' ? c.yellow('BLOCKED') : c.yellow(run.status.toUpperCase());
  console.log(`  ${mark}  ${run.flowTitle} ${c.gray(`${run.flowFile} · ${fmtDuration(run.duration)}${run.credits ? ` · ${Math.round(run.credits * 10) / 10} credits` : ''}`)}`);
  if (run.status !== 'passed') {
    if (run.failedStep) console.log(c.gray(`        step ${run.failedStep.index}: ${run.failedStep.remark}`));
    else if (run.reason) console.log(c.gray(`        ${run.reason}`));
  }
}

export async function check(cfg, store, opts = {}) {
  const flows = discoverFlows(cfg);
  if (flows.length === 0) {
    console.log(c.yellow(`No flows found in ${cfg.flowsDir}/. Add a *_test.md file or run \`proofline init\`.`));
    return { verdict: 'skipped', runs: [] };
  }
  let selected = flows;
  let changed = [];
  if (opts.flow) selected = flows.filter((f) => opts.flow.includes(f.id));
  else if (opts.changed) {
    changed = changedFiles(cfg.root, opts.since || 'HEAD');
    selected = selectFlows(flows, changed, cfg);
    if (opts.alsoFlows?.length) selected = flows.filter((f) => selected.includes(f) || opts.alsoFlows.includes(f.id));
  }
  if (!opts.quiet) {
    console.log(c.bold(`proofline · verifying ${selected.length}/${flows.length} flow(s) with Kane CLI`));
    if (changed.length) console.log(c.gray(`  changed: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ` +${changed.length - 6}` : ''}`));
    if (opts.alsoFlows?.length) console.log(c.gray(`  re-checking last turn's failures: ${opts.alsoFlows.join(', ')}`));
  }
  const onEnd = (r) => !opts.quiet && printRun(r);
  const onStart = (r) => !opts.quiet && opts.live !== false && console.log(c.gray(`  ▸ ${r.flowTitle}`));
  const onEv = ({ ev, steps }) => {
    if (opts.quiet || opts.live === false) return;
    if (ev?.type === 'test_md_summary' && ev.adaptive_heal?.triggered && ev.overall_status !== 'passed') console.log(c.gray('    (Kane re-ran the failing step with adaptive heal to confirm it was a real failure, not a stale recording)'));
    if (ev?.type !== 'test_md_step_end') return;
    const st = (steps || []).find((x) => x.key === `md-${ev.step_index}`);
    const ok = ev.status === 'passed';
    const text = ok ? (st?.heading || `step ${ev.step_index}`) : (st?.remark || `step ${ev.step_index} failed`);
    console.log(`    ${ok ? c.green('✓') : c.red('✗')} ${ok ? c.gray(text) : c.red(text.replace(/\s+/g, ' ').slice(0, 220))}${ev.duration_s != null ? c.gray(`  ${Math.round(ev.duration_s)}s`) : ''}`);
  };
  bus.on('run:start', onStart);
  bus.on('run:event', onEv);
  bus.on('run:end', onEnd);
  const runs = await verify(cfg, store, selected, { trigger: opts.trigger || 'manual', changedFiles: changed, loopId: opts.loopId, iteration: opts.iteration });
  bus.off('run:end', onEnd);
  bus.off('run:start', onStart);
  bus.off('run:event', onEv);
  const v = verdict(runs);
  if (v === 'red' || v === 'blocked') {
    const brief = repairBrief(runs, opts);
    const file = path.join(cfg.dataDir, 'brief.md');
    fs.writeFileSync(file, brief);
    if (!opts.quiet) console.log(c.gray(v === 'blocked' ? '  Kane CLI did not start: nothing was verified (not a pass, not a code failure).' : `  repair brief → ${path.relative(process.cwd(), file)}`));
    return { verdict: v, runs, brief, briefFile: file };
  }
  return { verdict: v, runs };
}
