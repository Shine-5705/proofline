import { useCallback, useEffect, useState } from 'react';
import type { Readiness, Run, Workspace } from './types';

// Local mode: `proofline ui` serves /api. Hosted mode: falls back to the bundled, clearly-labelled demo workspace.
async function fetchWorkspace(): Promise<Workspace> {
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (!forceDemo) {
    try {
      const r = await fetch('api/workspace', { headers: { accept: 'application/json' } });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) return (await r.json()) as Workspace;
    } catch { /* not running under proofline ui */ }
  }
  const r = await fetch(`${import.meta.env.BASE_URL}demo-workspace.json`);
  if (!r.ok) throw new Error(`Could not load workspace (HTTP ${r.status})`);
  const ws = (await r.json()) as Workspace;
  return ws.mode === 'demo' ? shiftToNow(ws) : ws;
}

// Sample data is anchored to when it was generated; slide it so relative times read naturally. Demo mode only.
function shiftToNow(ws: Workspace): Workspace {
  const delta = Date.now() - 20 * 60e3 - new Date(ws.generatedAt).getTime();
  if (delta <= 0) return ws;
  const sh = (iso?: string) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : iso);
  return {
    ...ws,
    runs: ws.runs.map((r) => ({ ...r, startedAt: sh(r.startedAt) as string, endedAt: sh(r.endedAt) })),
    loops: ws.loops.map((l) => ({ ...l, startedAt: sh(l.startedAt) as string, endedAt: sh(l.endedAt), iterations: l.iterations.map((i) => ({ ...i, startedAt: sh(i.startedAt) as string, endedAt: sh(i.endedAt) })) })),
  };
}

export function useWorkspace() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    fetchWorkspace().then((w) => { setWs(w); setError(null); }).catch((e) => setError(String(e.message || e))).finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload]);
  return { ws, error, loading, reload };
}

export async function fetchRun(id: string): Promise<Run | null> {
  try {
    const r = await fetch(`api/runs/${encodeURIComponent(id)}`);
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return (await r.json()) as Run;
  } catch { /* hosted */ }
  return null;
}

export async function fetchReadiness(): Promise<Readiness | null> {
  try {
    const r = await fetch('api/readiness');
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return (await r.json()) as Readiness;
  } catch { /* hosted */ }
  return null;
}

export async function startCheck(flowIds?: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ flowIds }) });
    const body = await r.json();
    return r.ok ? { ok: true } : { ok: false, error: body.error };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function subscribe(onEvent: (type: string, data: unknown) => void): () => void {
  if (typeof EventSource === 'undefined') return () => {};
  const es = new EventSource('api/events');
  for (const t of ['run:start', 'run:event', 'run:end', 'check:done']) es.addEventListener(t, (e) => onEvent(t, JSON.parse((e as MessageEvent).data)));
  return () => es.close();
}
