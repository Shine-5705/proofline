#!/usr/bin/env node
// TEST DOUBLE ONLY. Emits NDJSON shaped like `kane-cli testmd run --agent` so Proofline's plumbing can be unit-tested
// without credits or a network. It is never used by the CLI unless PROOFLINE_KANE_BIN points at it.
// Verdict: fails when the file named in FAKE_KANE_FAIL_IF_FILE contains FAKE_KANE_FAIL_IF_TEXT.
import fs from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('0.0.0-test-double'); process.exit(0); }
if (args[0] === 'whoami') { console.log('Not logged in (test double)'); process.exit(0); }
const file = args[2];
const out = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
out({ type: 'stream_start', version: '0.0.0-test-double' });
out({ step: 1, status: 'running', remark: `Opening flow ${file}` });
out({ step: 1, status: 'done', remark: 'Opened the app' });
let fail = false;
const f = process.env.FAKE_KANE_FAIL_IF_FILE;
if (f && fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(process.env.FAKE_KANE_FAIL_IF_TEXT || '')) fail = true;
if (process.env.FAKE_KANE_NOT_STARTED) { process.stderr.write('Not logged in\n'); process.exit(2); }
out({ step: 2, status: fail ? 'failed' : 'done', remark: fail ? 'Expected GST ₹5,670 but the page shows ₹6,300' : 'Totals match' });
out({ type: 'run_end', status: fail ? 'failed' : 'passed', summary: fail ? 'GST mismatch' : 'All steps passed', duration: 1.2, credits_consumed: 0, session_dir: '/tmp/fake' });
out({ type: 'test_md_done', overall_status: fail ? 'failed' : 'passed', duration_s: 1.3, session_id: 'fake' });
process.exit(fail ? 1 : 0);
