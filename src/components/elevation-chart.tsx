import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/constants/theme';
import type { Elevation } from '@/lib/elevation';
import { GRADE_COLORS } from '@/lib/route-geo';

/** Altitude over distance, with climbs shaded. */
export function ElevationChart({ elev, height = 140 }: { elev: Elevation; height?: number }) {
  const c = usePalette();
  const p = elev.profile;
  if (p.length < 2) return null;
  const W = 340, H = height, L = 34, R = 8, T = 8, B = 20;
  const total = p[p.length - 1][0] || 1;
  const span = Math.max(10, elev.maxM - elev.minM);
  const lo = elev.minM - span * 0.15, hi = elev.maxM + span * 0.15;
  const x = (d: number) => L + (d / total) * (W - L - R);
  const y = (a: number) => T + (1 - (a - lo) / (hi - lo)) * (H - T - B);
  const line = p.map(([d, a], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(a).toFixed(1)}`).join(' ');
  const area = `${line} L${x(total).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  const kmStep = total > 20000 ? 5000 : total > 8000 ? 2000 : 1000;
  const ticks: number[] = [];
  for (let d = kmStep; d < total; d += kmStep) ticks.push(d);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="고도 그래프">
      {elev.climbs.map((cl, i) => (
        <Rect key={i} x={x(cl.startM)} y={T} width={Math.max(2, x(cl.startM + cl.lengthM) - x(cl.startM))} height={H - T - B}
          fill={cl.gradePct >= 8 ? GRADE_COLORS.steep : GRADE_COLORS.mild} opacity={0.14} />
      ))}
      <Path d={area} fill={c.accent} opacity={0.15} />
      <Path d={line} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" />
      <Line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={c.line} />
      <SvgText x={L - 4} y={y(elev.maxM) + 4} fontSize={10} fill={c.muted} textAnchor="end">{elev.maxM}m</SvgText>
      <SvgText x={L - 4} y={y(elev.minM) + 4} fontSize={10} fill={c.muted} textAnchor="end">{elev.minM}m</SvgText>
      {ticks.map((d) => (
        <SvgText key={d} x={x(d)} y={H - 6} fontSize={10} fill={c.muted} textAnchor="middle">{d / 1000}km</SvgText>
      ))}
    </Svg>
  );
}
