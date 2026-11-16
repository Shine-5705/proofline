// Small shared helpers. No dependencies on purpose: Proofline should install in a second.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  dim: wrap('2'), bold: wrap('1'), red: wrap('31'), green: wrap('32'),
  yellow: wrap('33'), cyan: wrap('36'), gray: wrap('90'),
};

export function id(prefix) {
  const t = Date.now().toString(36);
  return `${prefix}_${t}${crypto.randomBytes(3).toString('hex')}`;
}

export function readJSON(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// Minimal glob → RegExp (supports **, *, ?, {a,b}). Paths are matched with forward slashes.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else if (ch === '{') {
      const end = glob.indexOf('}', i);
      const alts = glob.slice(i + 1, end).split(',').map((a) => a.replace(/[.+^$()|[\]\\]/g, '\\$&'));
      re += `(?:${alts.join('|')})`;
      i = end;
    } else re += ch.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(file, globs) {
  const f = file.split(path.sep).join('/').replace(/^\.\//, '');
  return globs.some((g) => globToRegExp(g).test(f));
}

export function walk(dir, filter, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('output-')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}
