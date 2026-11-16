export function duration(sec?: number | null): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  if (sec < 1) return `${Math.round(sec * 1000)}ms`;
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)}s`;
  const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
  if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function ago(iso?: string, now = Date.now()): string {
  if (!iso) return '—';
  const d = (now - new Date(iso).getTime()) / 1000;
  if (d < 45) return 'just now';
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

export function dateTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const seconds = (a?: string, b?: string) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 1000 : null);

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—');

export function triggerLabel(t: string): string {
  return ({ 'hook:claude': 'Claude Code hook', 'hook:cursor': 'Cursor hook', 'hook:git': 'pre-push', loop: 'proofline loop', watch: 'on save', manual: 'manual', console: 'console' } as Record<string, string>)[t] || t;
}

export function agentLabel(a: string): string {
  return ({ claude: 'Claude Code', codex: 'Codex CLI', cursor: 'Cursor', gemini: 'Gemini CLI', custom: 'Custom agent' } as Record<string, string>)[a] || a;
}
