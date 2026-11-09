/**
 * 목적 고르기: 훈련 성향 다각형(근비대 · 근력 · 체력 · 건강, 탭으로 0~3) + 체중 방향.
 * 선 = 고른 것, 채운 면 = 실제로 얻는 효과(다른 운동에서 따라오는 것 포함, 일정이 모자라면 줄어듦).
 */
import { Pressable, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import {
  DIR_NAME, effectLevel, FOCUS_KEYS, FOCUS_NAME, FULL_MIN, LEVEL_NOTE, planWork, WORK_NAME,
  type Focus, type FocusKey, type Level, type WeightDir, type WorkKey,
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

export function FocusRadar({ focus, effect, size = SIZE }: { focus: Focus; effect: Record<FocusKey, number>; size?: number }) {
  const c = usePalette();
  const lvl = (k: FocusKey) => (focus[k] / 3) * R;
  const got = (k: FocusKey) => (Math.min(3.3, effectLevel(k, effect[k])) / 3) * R;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {[1, 2, 3].map((n) => <Polygon key={n} points={poly(() => (n / 3) * R)} fill="none" stroke={c.line} strokeWidth={n === 3 ? 1.5 : 1} />)}
      {FOCUS_KEYS.map((k) => { const [x, y] = pt(k, R); return <Line key={k} x1={SIZE / 2} y1={SIZE / 2} x2={x} y2={y} stroke={c.line} strokeWidth={1} />; })}
      {/* 실제로 얻는 효과 (따라오는 것 포함) */}
      <Polygon points={poly(got)} fill={c.ok} fillOpacity={0.22} stroke={c.ok} strokeWidth={1} />
      {/* 고른 것 */}
      <Polygon points={poly(lvl)} fill="none" stroke={c.accent} strokeWidth={2.5} />
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

const WORK_ORDER: WorkKey[] = ['mod', 'heavy', 'cardio', 'mobility'];
const lv = (x: number) => (Math.round(x * 2) / 2).toString();

export function FocusPicker({ focus, dir, budget, onChange }: {
  focus: Focus; dir: WeightDir | null; budget: number | null;
  onChange: (f: Focus, dir: WeightDir | null) => void;
}) {
  const c = usePalette();
  const plan = planWork(focus, budget);
  const set = (k: FocusKey, v: Level) => onChange({ ...focus, [k]: v }, dir);
  const saved = plan.naive - plan.total;
  return (
    <View style={{ gap: Space.md }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <FocusRadar focus={focus} effect={plan.effect} />
        <Row gap={Space.md}>
          <T v="small"><T v="small" style={{ color: c.accent, fontWeight: '800' }}>━</T> 고른 것</T>
          <T v="small"><T v="small" style={{ color: c.ok, fontWeight: '800' }}>■</T> 실제로 얻는 것(따라오는 효과 포함)</T>
        </Row>
      </View>
      <View style={{ gap: 2 }}>
        {FOCUS_KEYS.map((k) => {
          const got = effectLevel(k, plan.effect[k]);
          const extra = got - focus[k];
          return (
            <Row key={k} style={{ flexWrap: 'nowrap', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderColor: c.line }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>{FOCUS_NAME[k]}</T>
                <T v="small">{focus[k] ? LEVEL_NOTE[k][focus[k] - 1] : '안 고름'}
                  {extra >= 0.5 ? <T v="small" style={{ color: c.ok }}>{`  · 다른 운동으로 ${lv(Math.min(3, got))}단계까지 따라와요`}</T> : null}
                  {extra <= -0.5 ? <T v="small" style={{ color: c.warn }}>{`  · 일정 안에선 ${lv(got)}단계`}</T> : null}
                </T>
              </View>
              <Dots value={focus[k]} label={FOCUS_NAME[k]} onChange={(v) => set(k, v)} />
            </Row>
          );
        })}
      </View>
      <View style={{ gap: 4, padding: Space.md, borderRadius: 10, backgroundColor: plan.scale < 1 ? c.warnSoft : c.accentSoft }}>
        <T style={{ fontWeight: '700', color: plan.scale < 1 ? c.warn : c.accent }}>
          필요한 시간 주 {plan.total}분{budget ? ` · 일정 주 ${budget}분` : ''}
        </T>
        {saved >= 5 ? <T v="small">따로 하면 {plan.naive}분인데, 겹치는 효과로 {saved}분 줄었어요.</T> : null}
        {plan.total ? <T v="small">{WORK_ORDER.filter((w) => plan.work[w] > 0).map((w) => `${WORK_NAME[w]} ${plan.work[w]}분`).join(' · ')}{plan.scale < 1 ? ' (일정에 맞춘 값)' : ''}</T> : null}
        <T v="small">
          {!budget ? `운동 일정을 고르면 그 시간에 맞춰요. 모든 축 3(꽉 찬 다각형) = 주 ${FULL_MIN}분.`
            : plan.scale < 1 ? `일정보다 많아서 ${Math.round(plan.scale * 100)}%로 줄여 짜요. 축을 낮추거나 일정을 늘리면 다 챙길 수 있어요.`
            : plan.total ? `일정 안에 들어가요${budget - plan.total >= 10 ? `. 남는 ${budget - plan.total}분만큼 운동이 짧아져요` : ''}.` : ''}
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <T>체중 방향 <T v="small">(칼로리 목표가 여기서 정해져요)</T></T>
        <Segmented options={(['cut', 'keep', 'gain'] as WeightDir[]).map((v) => ({ v, n: DIR_NAME[v] }))} value={dir} onChange={(v) => onChange(focus, v ?? null)} />
      </View>
    </View>
  );
}
