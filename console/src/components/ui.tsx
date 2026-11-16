import { useEffect, useState, type ReactNode } from 'react';
import type { Run } from '../types';

const LABEL: Record<string, string> = {
  passed: 'Passed', failed: 'Failed', not_started: 'Did not start', timeout: 'Timed out', error: 'Error', running: 'Running',
  green: 'Green', red: 'Red', blocked: 'Blocked', gave_up: 'Gave up', skipped: 'Skipped', cancelled: 'Cancelled',
};

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`status ${value}`}><span className="dot" />{label ?? LABEL[value] ?? value}</span>;
}

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#171717" />
      <path d="M8 11h16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8 20.5h6.5l2.5 2.5 7-7" fill="none" stroke="#3ecf8e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HistoryStrip({ runs, max = 20 }: { runs: Run[]; max?: number }) {
  const slice = runs.slice(0, max).reverse();
  const pad = Array.from({ length: Math.max(0, max - slice.length) });
  return (
    <span className="strip" aria-label={`Last ${slice.length} runs`}>
      {pad.map((_, i) => <i key={`p${i}`} />)}
      {slice.map((r) => <i key={r.id} className={r.status} title={`${r.status} · ${new Date(r.startedAt).toLocaleString()}`} />)}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children}</div>;
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div className="sk" style={{ width: 180, height: 18, marginBottom: 10 }} />
      <div className="sk" style={{ width: 320, marginBottom: 28 }} />
      <div className="table-wrap" style={{ padding: 16, display: 'grid', gap: 14 }}>
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="sk" style={{ width: `${90 - (i % 3) * 15}%` }} />)}
      </div>
    </div>
  );
}

export function Copy({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
      {done ? 'Copied' : label}
    </button>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => { if (!message) return; const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [message, onDone]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}

export function Iters({ verdicts }: { verdicts: (string | undefined)[] }) {
  return <span className="iters" aria-label={verdicts.join(', ')}>{verdicts.map((v, i) => <i key={i} className={v || ''} />)}</span>;
}
