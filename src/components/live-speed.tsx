import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/constants/theme';
import type { SpeedSample } from '@/lib/interval';
import { liveSeries, paceStatus, targetBand } from '@/lib/live';
import { fmtPace, type RateUnit } from '@/lib/run';

/**
 * The last minute(s) of the run at one-second detail: where you are against the target band,
 * so you can speed up or ease off while running. Up = faster.
 */
export function LiveSpeedChart({ samples, nowS, windowS, targetPaceS, unit, height = 150 }: {
  samples: SpeedSample[]; nowS: number; windowS: number; targetPaceS: number | null; unit: RateUnit; height?: number;
}) {
  const c = usePalette();
  const series = liveSeries(samples, nowS, windowS);
  const W = 340, H = height, L = 40, R = 14, T = 8, B = 18;
  const band = targetPaceS ? targetBand(targetPaceS) : null;
  const vs = series.map(([, v]) => v);
  if (band) vs.push(band.lo, band.hi);
  if (!vs.length) vs.push(2.5, 3.5);
  const lo = Math.max(0.3, Math.min(...vs) * 0.92), hi = Math.max(...vs) * 1.06;
  const from = nowS - windowS;
  const x = (t: number) => L + ((t - from) / windowS) * (W - L - R);
  const y = (v: number) => T + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (H - T - B);
  const last = series[series.length - 1];
  const status = paceStatus(last?.[1] ?? null, band);
  const dot = status === 'slow' ? c.bad : status === 'fast' ? c.warn : status === 'ok' ? c.ok : c.accent;
  const label = (v: number) => (unit === 'speed' ? (v * 3.6).toFixed(1) : fmtPace(1000 / v));
  const ticks = [0.25, 0.75].map((f) => lo + (hi - lo) * f);
  const mins = windowS / 60;

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="실시간 속도 그래프">
      {band ? <Rect x={L} width={W - L - R} y={y(band.hi)} height={Math.max(2, y(band.lo) - y(band.hi))} fill={c.okSoft} /> : null}
      {ticks.map((v, i) => <Line key={i} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} />)}
      {ticks.map((v, i) => <SvgText key={`l${i}`} x={L - 4} y={y(v) + 4} fontSize={10} fill={c.muted} textAnchor="end">{label(v)}</SvgText>)}
      {band ? <SvgText x={W - R - 2} y={y(band.hi) - 3} fontSize={10} fill={c.ok} textAnchor="end">목표</SvgText> : null}
      <SvgText x={L} y={H - 4} fontSize={10} fill={c.muted}>{mins >= 1 ? `${mins}분 전` : `${windowS}초 전`}</SvgText>
      <SvgText x={W - R} y={H - 4} fontSize={10} fill={c.muted} textAnchor="end">지금</SvgText>
      {series.length > 1 ? (
        <Polyline points={series.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
      {last ? <Circle cx={x(last[0])} cy={y(last[1])} r={6} fill={dot} stroke="#fff" strokeWidth={2} /> : null}
    </Svg>
  );
}
