import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { usePalette } from '@/constants/theme';
import { movingSpeed, type StepBucket } from '@/lib/day-steps';
import { clock } from '@/lib/timeline';

import { T } from './ui';

/**
 * Steps across the day in 15-minute bars, from the phone's health store. Bars during a recorded
 * run or hike take its colour. Tap a bar for that slice's steps, distance and walking speed.
 */
export function StepsChart({ buckets, dayStart, tracked, height = 90 }: {
  buckets: StepBucket[]; dayStart: number; tracked: [number, number][]; height?: number;
}) {
  const c = usePalette();
  const [sel, setSel] = useState<StepBucket | null>(null);
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
  const W = 340, H = height, T0 = 6, B = 16;
  const day = 864e5;
  const max = Math.max(200, ...buckets.map((b) => b.steps));
  const x = (ms: number) => ((ms - dayStart) / day) * W;
  const bw = Math.max(1.5, (15 * 60e3 / day) * W - 0.6);
  const inRun = (b: StepBucket) => tracked.some(([s, e]) => b.startMs + b.minutes * 30e3 >= s && b.startMs + b.minutes * 30e3 <= e);

  const pick = (px: number, width: number) => {
    const t = dayStart + (px / width) * day;
    let best: StepBucket | null = null;
    for (const b of buckets) if (t >= b.startMs - 10 * 60e3 && t <= b.startMs + b.minutes * 60e3 + 10 * 60e3 && (!best || Math.abs(b.startMs - t) < Math.abs(best.startMs - t))) best = b;
    setSel(best);
  };
  const v = sel ? movingSpeed(sel) : null;

  return (
    <View style={{ gap: 4 }}>
      <Pressable ref={ref} accessibilityLabel="시간대별 걸음 수"
        onPress={(e) => { const { pageX } = e.nativeEvent; ref.current?.measure((_x, _y, w, _h, px) => pick(pageX - px, w)); }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          {[6, 12, 18].map((h) => <Line key={h} x1={(h / 24) * W} x2={(h / 24) * W} y1={T0} y2={H - B} stroke={c.line} strokeDasharray="2 3" />)}
          {buckets.map((b) => {
            const h = Math.max(1.5, (b.steps / max) * (H - T0 - B));
            const on = sel?.startMs === b.startMs;
            return <Rect key={b.startMs} x={x(b.startMs)} y={H - B - h} width={bw} height={h} rx={1}
              fill={inRun(b) ? c.warn : c.ok} opacity={sel && !on ? 0.45 : 1} />;
          })}
          {['0', '6', '12', '18', '24'].map((h, i) => (
            <SvgText key={h} x={i === 0 ? 2 : i === 4 ? W - 2 : (Number(h) / 24) * W} y={H - 3} fontSize={10} fill={c.muted} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{h}</SvgText>
          ))}
        </Svg>
      </Pressable>
      <T v="small">
        {sel
          ? `${clock(sel.startMs)}–${clock(sel.startMs + sel.minutes * 60e3)} · ${Math.round(sel.steps).toLocaleString('ko-KR')}보 · ${(sel.meters / 1000).toFixed(2)}km${v ? ` · 걷는 속도 ${(v * 3.6).toFixed(1)}km/h` : ''}`
          : '막대를 누르면 그 15분의 걸음과 속도를 보여줘요'}
      </T>
    </View>
  );
}
