import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Radius, Space, usePalette, type Palette } from '@/constants/theme';
import { ASPECT, frame, timeline, type Demo, type Prim, type Tone } from '@/lib/motion/engine';

import { T } from './ui';

const tones = (c: Palette): Record<Tone, string> => ({
  ink: c.ink, far: c.rest, equip: c.muted, plate: c.line, floor: c.line, hi: c.bad, guide: c.accent, bg: c.surface,
});

function Shape({ p, col }: { p: Prim; col: Record<Tone, string> }) {
  const o = 'o' in p && p.o !== undefined ? p.o : 1;
  switch (p.k) {
    case 'line':
    case 'capsule':
      return (
        <Line x1={p.a[0]} y1={-p.a[1]} x2={p.b[0]} y2={-p.b[1]} stroke={col[p.tone]} strokeWidth={p.w}
          strokeLinecap="round" strokeDasharray={p.k === 'line' && p.dash ? '3 3' : undefined} opacity={o} />
      );
    case 'circle':
      return p.fill
        ? <Circle cx={p.c[0]} cy={-p.c[1]} r={p.r} fill={col[p.tone]} opacity={o} />
        : <Circle cx={p.c[0]} cy={-p.c[1]} r={p.r} fill="none" stroke={col[p.tone]} strokeWidth={p.w ?? 2} opacity={o} />;
    case 'arc': {
      const r = (d: number) => (d * Math.PI) / 180;
      const ax = p.c[0] + p.r * Math.cos(r(p.from)), ay = -(p.c[1] + p.r * Math.sin(r(p.from)));
      const bx = p.c[0] + p.r * Math.cos(r(p.to)), by = -(p.c[1] + p.r * Math.sin(r(p.to)));
      const span = p.to - p.from;
      return <Path d={`M${ax},${ay} A${p.r},${p.r} 0 ${Math.abs(span) > 180 ? 1 : 0} ${span > 0 ? 0 : 1} ${bx},${by}`} fill="none" stroke={col[p.tone]} strokeWidth={p.w} />;
    }
    case 'text':
      return (
        <SvgText x={p.at[0]} y={-p.at[1]} fontSize={p.size} fill={col[p.tone]} fontWeight="700" textAnchor="middle" alignmentBaseline="middle">
          {p.s}
        </SvgText>
      );
  }
}

/** Plays a demo: the whole movement, then each key point zoomed with a short cue. Tap a step to jump to it. */
export function ExerciseDemo({ demo, muscles }: { demo: Demo; muscles?: string }) {
  const c = usePalette();
  const col = tones(c);
  const [t, setT] = useState(0);
  const origin = useRef(0);
  /** a step the user tapped; applied on the next frame */
  const jumpTo = useRef<number | null>(null);

  useEffect(() => {
    origin.current = Date.now();
    let raf = 0;
    const tick = () => {
      if (jumpTo.current != null) { origin.current = Date.now() - (jumpTo.current + 0.01) * 1000; jumpTo.current = null; }
      setT((Date.now() - origin.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demo]);

  const { segments } = timeline(demo);
  const f = frame(demo, t);
  const b = f.box;
  const jump = (start: number) => { jumpTo.current = start; };

  return (
    <View style={{ gap: Space.md }}>
      <View style={{ width: '100%', aspectRatio: ASPECT, backgroundColor: c.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
        <Svg width="100%" height="100%" viewBox={`${b.x} ${-(b.y + b.h)} ${b.w} ${b.h}`}>
          <Rect x={b.x} y={-(b.y + b.h)} width={b.w} height={b.h} fill={c.surface} />
          {f.prims.map((p, i) => <Shape key={i} p={p} col={col} />)}
        </Svg>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.xs }}>
        {segments.map((s) => {
          const on = s === f.segment;
          return (
            <Pressable key={s.start} onPress={() => jump(s.start)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: Space.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: on ? c.accent : c.restSoft }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? c.accentInk : c.muted }}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ minHeight: 64, gap: 2 }}>
        {f.focus ? (
          <View style={{ opacity: f.caption, gap: 2 }}>
            <T v="title">{f.focus.title}</T>
            <T v="muted">{f.focus.text}</T>
          </View>
        ) : muscles ? (
          <T v="muted">{muscles}</T>
        ) : null}
      </View>
    </View>
  );
}
