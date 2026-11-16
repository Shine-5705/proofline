// `proofline ui`: serves the console and a small JSON API over the local run store.
// The console can also trigger real Kane CLI runs (POST /api/check) and stream them live (GET /api/events).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverFlows } from './flows.mjs';
import { verify, bus } from './runner.mjs';
import { readiness } from './commands/doctor.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONSOLE_DIR = path.resolve(here, '..', 'console', 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function workspace(cfg, store) {
  return {
    mode: 'local',
    generatedAt: new Date().toISOString(),
    project: { name: path.basename(cfg.root), root: cfg.root, baseUrl: cfg.baseUrl, agent: cfg.agent, maxIterations: cfg.maxIterations, flowsDir: cfg.flowsDir },
    flows: discoverFlows(cfg),
    runs: store.listRuns(),
    loops: store.listLoops(),
  };
}

export function serve(cfg, store, { port = 4317 } = {}) {
  let busy = false;
  const clients = new Set();
  const send = (type, data) => { for (const res of clients) res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); };
  bus.on('run:start', (r) => send('run:start', r));
  bus.on('run:event', (e) => send('run:event', { runId: e.runId, steps: e.steps }));
  bus.on('run:end', (r) => send('run:end', r));

  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/workspace') return json(res, 200, workspace(cfg, store));
      if (url.pathname === '/api/readiness') return json(res, 200, readiness(cfg));
      if (url.pathname.startsWith('/api/runs/')) {
        const rid = decodeURIComponent(url.pathname.slice('/api/runs/'.length));
        const run = store.getRun(rid);
        return run ? json(res, 200, { ...run, raw: store.getRaw(rid) }) : json(res, 404, { error: 'run not found' });
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(': connected\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (url.pathname === '/api/check' && req.method === 'POST') {
        if (busy) return json(res, 409, { error: 'A verification is already running' });
        let body = '';
        for await (const ch of req) body += ch;
        const { flowIds } = JSON.parse(body || '{}');
        const flows = discoverFlows(cfg).filter((f) => !flowIds || flowIds.includes(f.id));
        if (flows.length === 0) return json(res, 400, { error: 'No matching flows' });
        busy = true;
        json(res, 202, { accepted: flows.map((f) => f.id) });
        verify(cfg, store, flows, { trigger: 'console' }).finally(() => { busy = false; send('check:done', {}); });
        return;
      }
      // Static console with SPA fallback.
      let file = path.join(CONSOLE_DIR, decodeURIComponent(url.pathname));
      if (!file.startsWith(CONSOLE_DIR)) return json(res, 403, { error: 'forbidden' });
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CONSOLE_DIR, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(500); return res.end('Console not built. Run: npm run console:build'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (err) {
      json(res, 500, { error: err.message });
    }
  });
  server.listen(port, '127.0.0.1');
  return server;
}
