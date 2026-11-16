// Plants a known, realistic regression in the example app so the agent ↔ Kane loop has something real to catch.
//   node scripts/scenario.mjs break     → GST is computed on the pre-discount subtotal (a classic invoicing bug)
//   node scripts/scenario.mjs restore   → puts totals.js back
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'examples', 'invoice-app', 'totals.js');
const GOOD = 'const gst = Math.round(taxable * GST_RATE);';
const BAD = 'const gst = Math.round(subtotal * GST_RATE);';
const src = fs.readFileSync(file, 'utf8');
const mode = process.argv[2];
if (mode === 'break') {
  if (!src.includes(GOOD)) { console.log('totals.js is already changed; nothing to plant.'); process.exit(0); }
  fs.writeFileSync(file, src.replace(GOOD, BAD));
  console.log('Planted: GST now ignores the discount. Expected Kane failure in create_invoice_test.md (GST shows ₹6,300, not ₹5,670).');
} else if (mode === 'restore') {
  fs.writeFileSync(file, src.replace(BAD, GOOD));
  console.log('Restored totals.js.');
} else {
  console.log('Usage: node scripts/scenario.mjs break|restore');
  process.exit(2);
}
