import { spawnSync } from 'node:child_process';

const git = (args, cwd) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
};

export function gitInfo(cwd) {
  const sha = git(['rev-parse', '--short', 'HEAD'], cwd);
  const dirty = git(['status', '--porcelain'], cwd);
  return { sha: sha ? sha.trim() : null, dirty: dirty ? dirty.trim().length > 0 : false };
}

// Files changed in the working tree relative to HEAD, plus untracked files.
export function changedFiles(cwd, since = 'HEAD') {
  const tracked = git(['diff', '--name-only', '--relative', since], cwd) || '';
  const untracked = git(['ls-files', '--others', '--exclude-standard'], cwd) || '';
  return [...new Set(`${tracked}\n${untracked}`.split('\n').map((s) => s.trim()).filter(Boolean))]
    .filter((f) => !f.startsWith('.proofline/'));
}

export function diffStat(cwd, since = 'HEAD') {
  const out = git(['diff', '--numstat', '--relative', since], cwd) || '';
  return out.split('\n').filter(Boolean).map((l) => {
    const [a, r, file] = l.split('\t');
    return { file, added: Number(a) || 0, removed: Number(r) || 0 };
  }).filter((d) => !d.file.startsWith('.proofline/'));
}

export function snapshotDiff(cwd) {
  return git(['diff', 'HEAD'], cwd) || '';
}
