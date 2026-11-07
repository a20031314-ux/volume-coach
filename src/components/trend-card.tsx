/** MY 탭 추세 카드: one number, one weekly line, one status line; tap for details. */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { Card, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';

export function Spark({ values, band, target, height = 52 }: {
  values: (number | null)[];
  /** shaded range, e.g. 12~18 sets */
  band?: [number, number];
  /** dashed line, e.g. protein goal */
  target?: number;
  height?: number;
}) {
  const c = usePalette();
  const [w, setW] = useState(0);
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  const ys = [...pts.map((p) => p[1]), ...(band ?? []), ...(target != null ? [target] : [])];
  if (!ys.length) return <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)} />;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.01, 0.5);
  lo -= pad; hi += pad;
  const n = Math.max(1, values.length - 1);
  const x = (i: number) => 4 + (i / n) * (w - 8);
  const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * (height - 8);
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Svg width={w} height={height}>
          {band ? <Rect x={0} width={w} y={y(band[1])} height={Math.max(1, y(band[0]) - y(band[1]))} fill={c.accentSoft} /> : null}
          {target != null ? <Line x1={0} x2={w} y1={y(target)} y2={y(target)} stroke={c.muted} strokeWidth={1} strokeDasharray="4 4" /> : null}
          {pts.length > 1 ? <Polyline points={pts.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={c.accent} strokeWidth={2} /> : null}
          {pts.length ? <Circle cx={x(pts[pts.length - 1][0])} cy={y(pts[pts.length - 1][1])} r={3.5} fill={c.accent} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

export function TrendCard({ label, value, unit, status, tone, spark, children }: {
  label: string;
  value: string | null;
  unit?: string;
  status: string;
  tone: Tone;
  spark: ReactNode;
  /** details shown when tapped */
  children?: ReactNode;
}) {
  const c = usePalette();
  const [open, setOpen] = useState(false);
  const color = { ok: c.ok, warn: c.warn, bad: c.bad, muted: c.muted }[tone];
  return (
    <Card style={{ gap: Space.xs }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label} 자세히`}
        onPress={() => setOpen(!open)} style={{ gap: Space.xs }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'nowrap' }}>
          <T v="small" style={{ flexShrink: 1 }}>{label}</T>
          <T v="num" style={{ fontSize: 20 }}>{value ?? '–'}{value && unit ? <T v="small"> {unit}</T> : null}</T>
        </Row>
        {spark}
        <T v="small" style={{ color, fontWeight: '600' }}>{status}</T>
      </Pressable>
      {open && children ? <View style={{ gap: 6, borderTopWidth: 1, borderColor: c.line, paddingTop: Space.sm, marginTop: 4 }}>{children}</View> : null}
    </Card>
  );
}

/** "label ……… value" line inside an opened card. */
export function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <T v="small" style={{ flexShrink: 1 }}>{label}</T>
      <T v="small" style={{ fontWeight: '600', color }}>{value}</T>
    </Row>
  );
}
