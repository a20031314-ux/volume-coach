import { useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/constants/theme';
import type { Range } from '@/lib/range';
import { fmtPace, type RateUnit } from '@/lib/run';
import type { Run } from '@/lib/types';

const W = 340, L = 40, R = 8, T = 10, B = 22;
// web: dragging across the chart shouldn't select the axis labels
const NO_SELECT = { userSelect: 'none' } as object;

/**
 * Speed over the run's moving time. Up = faster either way; the axis is labelled in pace (min/km)
 * or speed (km/h). Interval work phases are shaded. With `onSelect`, drag across the chart to
 * zoom into that stretch; `range` shows only that stretch.
 */
export function PaceTimeline({ run, height = 170, unit = 'pace', range, onSelect, cursor, onCursor }: {
  run: Pick<Run, 'timeline' | 'phases' | 'movingS' | 'paceSecPerKm'>;
  height?: number;
  unit?: RateUnit;
  range?: Range | null;
  onSelect?: (r: Range) => void;
  /** a moment to mark (moving second) */
  cursor?: number | null;
  /** tap on the chart → that moment */
  onCursor?: (t: number) => void;
}) {
  const c = usePalette();
  const H = height;
  const all = useMemo(() => (run.timeline ?? []).filter(([, v]) => v > 0.3), [run.timeline]);
  const total = Math.max(run.movingS, all.length ? all[all.length - 1][0] : 0);
  const [from, to] = range ?? [0, total];
  const span = Math.max(1, to - from);
  const tl = all.filter(([t]) => t >= from - 15 && t <= to + 15);

  // drag to select: positions in viewBox units
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [widthPx, setWidthPx] = useState(W);
  const toVb = (px: number) => (px / widthPx) * W;
  const timeAt = (vb: number) => from + Math.max(0, Math.min(1, (vb - L) / (W - L - R))) * span;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !!onCursor,
    onMoveShouldSetPanResponder: (_, g) => !!onSelect && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    // let the page scroll take over unless this is clearly a sideways drag
    onPanResponderTerminationRequest: (_, g) => Math.abs(g.dx) < 8,
    onPanResponderGrant: (e, g) => { const x0 = toVb(e.nativeEvent.locationX - g.dx); setDrag([x0, x0 + toVb(g.dx)]); },
    onPanResponderMove: (_, g) => setDrag((d) => (d ? [d[0], d[0] + toVb(g.dx)] : d)),
    onPanResponderRelease: () => setDrag((d) => {
      if (d && onSelect && Math.abs(d[1] - d[0]) > 12) {
        const a = timeAt(Math.min(d[0], d[1])), b = timeAt(Math.max(d[0], d[1]));
        if (b - a >= 10) onSelect([Math.round(a), Math.round(b)]);
      } else if (d && onCursor) onCursor(Math.round(timeAt(d[0])));
      return null;
    }),
    onPanResponderTerminate: () => setDrag(null),
  // the responder reads the latest range through timeAt's closure on each render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [onSelect, onCursor, from, span, widthPx]);

  if (tl.length < 2) return null;
  const vs = tl.map(([, v]) => v).sort((a, b) => a - b);
  // trim outliers so one GPS spike doesn't flatten the chart
  const lo = Math.max(0.5, vs[Math.floor(vs.length * 0.03)] * 0.9);
  const hi = vs[Math.ceil(vs.length * 0.97) - 1] * 1.08;
  const x = (t: number) => L + ((t - from) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (H - T - B);
  const clipX = (t: number) => Math.max(L, Math.min(W - R, x(t)));
  const pts = tl.map(([t, v]) => `${clipX(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const ticks = [0.2, 0.5, 0.8].map((f) => lo + (hi - lo) * f);
  const avgV = run.paceSecPerKm ? 1000 / run.paceSecPerKm : null;
  // time labels: whole minutes, or 30/15 s steps when zoomed in
  const stepS = span > 3600 ? 900 : span > 1800 ? 600 : span > 600 ? 300 : span > 240 ? 60 : span > 90 ? 30 : 15;
  const xTicks: number[] = [];
  for (let t = Math.ceil(from / stepS) * stepS; t < to; t += stepS) if (t > from) xTicks.push(t);
  const tLabel = (t: number) => (stepS >= 60 ? `${Math.round(t / 60)}분` : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`);
  const label = (v: number) => (unit === 'speed' ? (v * 3.6).toFixed(1) : fmtPace(1000 / v));

  const work = (run.phases ?? []).reduce<{ t: number; out: { s: number; e: number }[] }>((a, p) => {
    if (p.kind === 'work') a.out.push({ s: a.t, e: a.t + p.durS });
    a.t += p.durS;
    return a;
  }, { t: 0, out: [] }).out.filter((r) => r.e > from && r.s < to);

  return (
    <View style={NO_SELECT} onLayout={(e) => setWidthPx(e.nativeEvent.layout.width || W)} {...(onSelect || onCursor ? pan.panHandlers : {})}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={unit === 'speed' ? '시간대별 속도 그래프' : '시간대별 페이스 그래프'}>
        {work.map((r, i) => (
          <Rect key={i} x={clipX(r.s)} y={T} width={Math.max(1, clipX(r.e) - clipX(r.s))} height={H - T - B} fill={c.accentSoft} />
        ))}
        {ticks.map((v, i) => <Line key={i} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line} strokeWidth={1} />)}
        {ticks.map((v, i) => (
          <SvgText key={`t${i}`} x={L - 4} y={y(v) + 4} fontSize={10} fill={c.muted} textAnchor="end">{label(v)}</SvgText>
        ))}
        {xTicks.map((t) => <SvgText key={t} x={x(t)} y={H - 6} fontSize={10} fill={c.muted} textAnchor="middle">{tLabel(t)}</SvgText>)}
        {avgV ? <Line x1={L} x2={W - R} y1={y(avgV)} y2={y(avgV)} stroke={c.muted} strokeDasharray="4 4" strokeWidth={1} /> : null}
        <Polyline points={pts} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {cursor != null && cursor >= from && cursor <= to ? (() => {
          let near = tl[0];
          for (const p of tl) if (Math.abs(p[0] - cursor) < Math.abs(near[0] - cursor)) near = p;
          return (
            <>
              <Line x1={x(cursor)} x2={x(cursor)} y1={T} y2={H - B} stroke={c.ink} strokeWidth={1.5} />
              <Circle cx={x(cursor)} cy={y(near[1])} r={5.5} fill={c.ink} stroke="#fff" strokeWidth={2} />
            </>
          );
        })() : null}
        {drag ? (
          <Rect x={Math.max(L, Math.min(drag[0], drag[1]))} width={Math.abs(drag[1] - drag[0])} y={T} height={H - T - B} fill={c.accent} opacity={0.15} />
        ) : null}
      </Svg>
    </View>
  );
}
