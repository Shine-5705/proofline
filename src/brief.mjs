// Turns failed Kane CLI runs into a repair brief a coding agent can act on.
export function repairBrief(runs, { task, iteration, maxIterations } = {}) {
  const failed = runs.filter((r) => r.status !== 'passed');
  const lines = [];
  lines.push('# Proofline: Kane CLI rejected this change');
  lines.push('');
  if (task) lines.push(`Original task: ${task}`, '');
  if (iteration) lines.push(`Attempt ${iteration} of ${maxIterations}.`, '');
  lines.push(`Kane CLI ran ${runs.length} flow(s) against the app in a real browser. ${failed.length} did not pass.`, '');
  for (const r of failed) {
    lines.push(`## ${r.flowTitle} (${r.flowFile})`);
    lines.push(`- Verdict: ${r.status}${r.exitCode != null ? ` (exit ${r.exitCode})` : ''}`);
    if (r.failedStep) lines.push(`- Failing step ${r.failedStep.index}: ${r.failedStep.remark}`);
    if (r.summary && r.summary !== r.failedStep?.remark) lines.push(`- Kane summary: ${r.summary.replace(/\n/g, '\n  ')}`);
    if (r.reason) lines.push(`- Reason: ${r.reason}`);
    if (r.evidence) lines.push(`- Evidence pack (screenshots, console, network): ${r.evidence}`);
    if (r.testUrl) lines.push(`- Test Manager: ${r.testUrl}`);
    const tail = (r.steps || []).slice(-4).map((s) => `  ${s.index}. [${s.status}] ${s.remark}`);
    if (tail.length) lines.push('- Last steps Kane took:', ...tail);
    lines.push('');
  }
  lines.push('## What to do');
  lines.push('1. Read the failing step and fix the application code so the flow passes. The flow describes intended behaviour.');
  lines.push('2. Only edit a *_test.md flow if the requirement itself changed; say so explicitly if you do.');
  lines.push('3. Stop when you are done editing. Proofline re-runs Kane CLI on the affected flows automatically.');
  return lines.join('\n');
}

export function greenNote(runs) {
  const secs = runs.reduce((a, r) => a + (r.duration || 0), 0);
  return `Proofline: Kane CLI verified ${runs.length} flow(s) in a real browser (${secs.toFixed(0)}s). All passed.`;
}
