import Svg, { Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/constants/theme';
import { fmtPace } from '@/lib/run';
import type { Run } from '@/lib/types';

/**
 * Speed over the run's moving time. Up = faster; the axis is labelled in pace (min/km) because
 * that's how runners read it. Interval work phases are shaded.
 */
export function PaceTimeline({ run, height = 170 }: { run: Pick<Run, 'timeline' | 'phases' | 'movingS' | 'paceSecPerKm'>; height?: number }) {
  const c = usePalette();
  const tl = (run.timeline ?? []).filter(([, v]) => v > 0.3);
  if (tl.length < 2) return null;
  const W = 340, H = height, L = 40, R = 8, T = 10, B = 22;
  const total = Math.max(run.movingS, tl[tl.length - 1][0]);
  const vs = tl.map(([, v]) => v).sort((a, b) => a - b);
  // trim outliers so one GPS spike doesn't flatten the chart
  const lo = Math.max(0.5, vs[Math.floor(vs.length * 0.03)] * 0.9);
  const hi = vs[Math.ceil(vs.length * 0.97) - 1] * 1.08;
  const x = (t: number) => L + (t / total) * (W - L - R);
  const y = (v: number) => T + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (H - T - B);
  const pts = tl.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  // 3 pace gridlines spread over the range, plus the average
  const ticks = [0.2, 0.5, 0.8].map((f) => lo + (hi - lo) * f);
  const avgV = run.paceSecPerKm ? 1000 / run.paceSecPerKm : null;
  const minuteStep = total > 3600 ? 15 : total > 1800 ? 10 : 5;
  const xTicks: number[] = [];
  for (let m = minuteStep; m * 60 < total; m += minuteStep) xTicks.push(m * 60);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="시간대별 페이스 그래프">
      {(run.phases ?? []).reduce<{ start: number; rects: { s: number; e: number }[] }>((acc, p) => {
        const s = acc.start, e = acc.start + p.durS;
        if (p.kind === 'work') acc.rects.push({ s, e });
        acc.start = e;
        return acc;
      }, { start: 0, rects: [] }).rects.map((r, i) => (
        <Rect key={i} x={x(r.s)} y={T} width={Math.max(1, x(Math.min(r.e, total)) - x(r.s))} height={H - T - B} fill={c.accentSoft} />
      ))}
      {ticks.map((v, i) => (
        <Line key={i} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} strokeWidth={1} />
      ))}
      {ticks.map((v, i) => (
        <SvgText key={`t${i}`} x={L - 4} y={y(v) + 4} fontSize={10} fill={c.muted} textAnchor="end">{fmtPace(1000 / v)}</SvgText>
      ))}
      {xTicks.map((t) => (
        <SvgText key={t} x={x(t)} y={H - 6} fontSize={10} fill={c.muted} textAnchor="middle">{t / 60}분</SvgText>
      ))}
      {avgV ? <Line x1={L} x2={W - R} y1={y(avgV)} y2={y(avgV)} stroke={c.muted} strokeDasharray="4 4" strokeWidth={1} /> : null}
      <Polyline points={pts} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
