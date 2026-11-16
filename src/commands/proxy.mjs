// proofline proxy: a tiny reverse proxy in front of your dev server that records which files the browser loads,
// so Proofline can learn which flows depend on which source files. Point your flows at the proxy port.
import http from 'node:http';
import { logRequest } from '../coverage.mjs';
import { c } from '../util.mjs';

export function proxy(cfg, { target, port = 4174 }) {
  const t = new URL(target || cfg.baseUrl);
  http.createServer((req, res) => {
    logRequest(cfg.dataDir, req.url);
    const up = http.request({ hostname: t.hostname, port: t.port || 80, path: req.url, method: req.method, headers: { ...req.headers, host: t.host } }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    up.on('error', (e) => { res.writeHead(502); res.end(`proofline proxy: upstream ${t.origin} unreachable (${e.message})`); });
    req.pipe(up);
  }).listen(port, () => console.log(`proofline proxy · http://localhost:${port} → ${t.origin} · learning coverage into .proofline/`));
  return c;
}
