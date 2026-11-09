/**
 * 목적 고르기: 훈련 성향 다각형(근비대 · 근력 · 체력 · 건강, 탭으로 0~3) + 체중 방향.
 * 바깥 선 = 원하는 양, 채운 면 = 운동 일정 안에서 실제로 하는 양(넘치면 비율대로 줄임).
 */
import { Pressable, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import {
  allotMin, demandMin, DIR_NAME, FOCUS_KEYS, FOCUS_NAME, FULL_MIN, LEVEL_MIN, LEVEL_NOTE,
  type Focus, type FocusKey, type Level, type WeightDir,
} from '@/lib/focus';

const SIZE = 220;
const R = 78;
// top, right, bottom, left
const ANGLE: Record<FocusKey, number> = { hyp: -90, str: 0, health: 90, fit: 180 };
const pt = (k: FocusKey, r: number) => {
  const a = (ANGLE[k] * Math.PI) / 180;
  return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)] as const;
};
// around the circle, so the shape doesn't cross itself
const RING: FocusKey[] = ['hyp', 'str', 'health', 'fit'];
const poly = (r: (k: FocusKey) => number) => RING.map((k) => pt(k, r(k)).join(',')).join(' ');

export function FocusRadar({ focus, scale = 1, size = SIZE }: { focus: Focus; scale?: number; size?: number }) {
  const c = usePalette();
  const lvl = (k: FocusKey) => (focus[k] / 3) * R;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {[1, 2, 3].map((n) => <Polygon key={n} points={poly(() => (n / 3) * R)} fill="none" stroke={c.line} strokeWidth={n === 3 ? 1.5 : 1} />)}
      {FOCUS_KEYS.map((k) => { const [x, y] = pt(k, R); return <Line key={k} x1={SIZE / 2} y1={SIZE / 2} x2={x} y2={y} stroke={c.line} strokeWidth={1} />; })}
      {/* 원하는 양 */}
      <Polygon points={poly(lvl)} fill="none" stroke={c.accent} strokeWidth={2} strokeDasharray={scale < 1 ? '5,4' : undefined} />
      {/* 일정 안에서 하는 양 */}
      <Polygon points={poly((k) => lvl(k) * scale)} fill={c.accent} fillOpacity={0.28} stroke={scale < 1 ? c.accent : 'none'} strokeWidth={scale < 1 ? 1 : 0} />
      {FOCUS_KEYS.map((k) => {
        const [x, y] = pt(k, R + 20);
        return <SvgText key={k} x={x} y={y + 4} fontSize={13} fontWeight="700" fill={focus[k] ? c.accent : c.muted} textAnchor="middle">{FOCUS_NAME[k]}</SvgText>;
      })}
    </Svg>
  );
}

function Dots({ value, onChange, label }: { value: Level; onChange: (v: Level) => void; label: string }) {
  const c = usePalette();
  return (
    <Row gap={6} style={{ flexWrap: 'nowrap' }}>
      {([1, 2, 3] as Level[]).map((n) => (
        <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${label} ${n}단계`} accessibilityState={{ selected: value >= n }}
          onPress={() => onChange(value === n ? ((n - 1) as Level) : n)} hitSlop={6}
          style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.accent, backgroundColor: value >= n ? c.accent : 'transparent' }} />
      ))}
    </Row>
  );
}

export function FocusPicker({ focus, dir, budget, onChange }: {
  focus: Focus; dir: WeightDir | null; budget: number | null;
  onChange: (f: Focus, dir: WeightDir | null) => void;
}) {
  const c = usePalette();
  const want = demandMin(focus);
  const allot = allotMin(focus, budget);
  const set = (k: FocusKey, v: Level) => onChange({ ...focus, [k]: v }, dir);
  return (
    <View style={{ gap: Space.md }}>
      <View style={{ alignItems: 'center' }}>
        <FocusRadar focus={focus} scale={allot.scale} />
      </View>
      <View style={{ gap: 2 }}>
        {FOCUS_KEYS.map((k) => (
          <Row key={k} style={{ flexWrap: 'nowrap', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderColor: c.line }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }}>{FOCUS_NAME[k]}</T>
              <T v="small">{focus[k] ? `${LEVEL_NOTE[k][focus[k] - 1]} · 주 ${LEVEL_MIN[k][focus[k]]}분` : '안 챙김'}</T>
            </View>
            <Dots value={focus[k]} label={FOCUS_NAME[k]} onChange={(v) => set(k, v)} />
          </Row>
        ))}
      </View>
      <View style={{ gap: 4, padding: Space.md, borderRadius: 10, backgroundColor: allot.scale < 1 ? c.warnSoft : c.accentSoft }}>
        <T style={{ fontWeight: '700', color: allot.scale < 1 ? c.warn : c.accent }}>
          원하는 양 주 {want}분{budget ? ` · 일정 주 ${budget}분` : ''}
        </T>
        <T v="small">
          {!budget ? `운동 일정을 고르면 그 시간에 맞춰 나눠요. 다각형이 꽉 차면(모든 축 3) 주 ${FULL_MIN}분 ≈ 주 6일 × 70분이에요.`
            : allot.scale < 1 ? `일정보다 많아서 비율대로 ${Math.round(allot.scale * 100)}%로 줄여 짜요(점선 = 원하는 양, 채운 면 = 실제). 축을 낮추거나 일정을 늘리면 다 챙길 수 있어요.`
            : `일정 안에 다 들어가요. 남는 ${budget - want}분은 운동을 짧게 끝내는 데 써요.`}
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <T>체중 방향 <T v="small">(칼로리 목표가 여기서 정해져요)</T></T>
        <Segmented options={(['cut', 'keep', 'gain'] as WeightDir[]).map((v) => ({ v, n: DIR_NAME[v] }))} value={dir} onChange={(v) => onChange(focus, v ?? null)} />
      </View>
    </View>
  );
}
