import fs from 'node:fs';
import path from 'node:path';
import { check } from './check.mjs';
import { c } from '../util.mjs';

const IGNORE = /(^|\/)(\.git|node_modules|\.proofline|\.testmuai|dist|output-[^/]+)(\/|$)/;

export function watch(cfg, store) {
  console.log(c.bold(`proofline watch · re-verifying affected flows on save (${cfg.root})`));
  let timer = null; let running = false; let pending = false;
  const trigger = async () => {
    if (running) { pending = true; return; }
    running = true;
    try { await check(cfg, store, { changed: true, trigger: 'watch' }); } finally { running = false; }
    if (pending) { pending = false; trigger(); }
  };
  fs.watch(cfg.root, { recursive: true }, (_e, file) => {
    if (!file || IGNORE.test(file.split(path.sep).join('/'))) return;
    clearTimeout(timer);
    timer = setTimeout(trigger, 700);
  });
}
