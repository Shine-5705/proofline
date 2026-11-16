// One command for judges: serves the example app (the thing Kane CLI verifies) and the Proofline console over it.
//   npm run demo      → app on :4173, console on :4317
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ex = path.join(root, 'examples', 'invoice-app');
if (!fs.existsSync(path.join(root, 'console', 'dist', 'index.html'))) {
  console.error('Console is not built. Run: npm --prefix console install && npm run console:build');
  process.exit(1);
}
const kids = [
  spawn(process.execPath, [path.join(root, 'scripts', 'serve-example.mjs')], { stdio: 'inherit' }),
  spawn(process.execPath, [path.join(root, 'bin', 'proofline.mjs'), 'ui'], { cwd: ex, stdio: 'inherit' }),
];
console.log(`
  Example app      http://localhost:4173
  Proofline UI     http://localhost:4317
  Verify with Kane cd examples/invoice-app && node ../../bin/proofline.mjs check
  Hosted demo      https://shine-5705.github.io/proofline/   (sample data, labelled)
`);
const stop = () => { kids.forEach((k) => k.kill()); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
