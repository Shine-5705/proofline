import type { Run } from '../types';

// Runs per day, stacked passed / failed / did-not-start. Computed from the run records, nothing invented.
export function RunsPerDay({ runs, days = 14 }: { runs: Run[]; days?: number }) {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(end); d.setDate(end.getDate() - (days - 1 - i));
    return { d, passed: 0, failed: 0, other: 0 };
  });
  for (const r of runs) {
    const t = new Date(r.startedAt); t.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.d.getTime() === t.getTime());
    if (!b) continue;
    if (r.status === 'passed') b.passed++; else if (r.status === 'failed') b.failed++; else b.other++;
  }
  const max = Math.max(4, ...buckets.map((b) => b.passed + b.failed + b.other));
  const W = 640, H = 150, padL = 24, padB = 20, padT = 8, bw = (W - padL) / days;
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kane CLI runs per day">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#eeeeec" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end">{t}</text>
        </g>
      ))}
      {buckets.map((b, i) => {
        const x = padL + i * bw + bw * 0.3; const w = bw * 0.4;
        let acc = 0;
        const seg = (v: number, color: string) => { if (!v) return null; const top = y(acc + v); const h = y(acc) - top; acc += v; return <rect x={x} y={top} width={w} height={Math.max(h, 1)} fill={color} rx={1.5} />; };
        return (
          <g key={i}>
            <title>{`${b.d.toDateString()}: ${b.passed} passed, ${b.failed} failed${b.other ? `, ${b.other} other` : ''}`}</title>
            {seg(b.passed, '#6fb592')}{seg(b.failed, '#e0867a')}{seg(b.other, '#ddb562')}
            {(i % 2 === days % 2 || days <= 7) && <text x={x + w / 2} y={H - 6} textAnchor="middle">{b.d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Duration per run for one flow, with fail markers. Shows replay speed-up after Kane caches a recording.
export function DurationLine({ runs }: { runs: Run[] }) {
  const pts = [...runs].reverse().filter((r) => r.duration != null);
  if (pts.length < 2) return <p className="faint">Not enough runs to chart yet.</p>;
  const W = 640, H = 140, padL = 34, padB = 18, padT = 8;
  const max = Math.max(...pts.map((r) => r.duration as number)) * 1.1;
  const x = (i: number) => padL + (i * (W - padL - 8)) / (pts.length - 1);
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const d = pts.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.duration as number).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Run duration over time">
      {[0, max / 2, max].map((t) => (
        <g key={t}><line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#eeeeec" /><text x={padL - 6} y={y(t) + 3} textAnchor="end">{Math.round(t)}s</text></g>
      ))}
      <path d={d} fill="none" stroke="#171717" strokeWidth={1.4} />
      {pts.map((r, i) => (
        <circle key={r.id} cx={x(i)} cy={y(r.duration as number)} r={r.status === 'passed' ? 2.4 : 3.6} fill={r.status === 'passed' ? '#171717' : '#dc6152'}>
          <title>{`${r.status} · ${(r.duration as number).toFixed(1)}s · ${new Date(r.startedAt).toLocaleString()}`}</title>
        </circle>
      ))}
    </svg>
  );
}
