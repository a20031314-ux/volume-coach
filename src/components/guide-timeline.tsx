/**
 * 가이드 타임라인: 왼쪽 운동명 · 가운데 세로 타임라인(순서·시작 시각) · 오른쪽 가로 시간선.
 * 오른쪽은 가로선 위 점(세트)들, 진행 중엔 점이 시간에 따라 오른쪽으로 움직이고 지금 세트는 반복 점 위를 템포 속도로 간다.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { fmtDuration } from '@/lib/run';
import { rhythmKind, type ItemSpan, type RunItem } from '@/lib/guide';

const NAME_W = 104;
const RAIL_W = 26;

const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%` as const;

/**
 * 가로선 위의 점: 이 종목의 세트들이 시간 순서대로 (점 = 세트 시작, 굵은 선 = 세트, 가는 선 = 휴식).
 * 진행 중엔 지금 위치 점이 시간에 따라 오른쪽으로 움직인다.
 */
export function SetLine({ span, at, big }: { span: ItemSpan; at?: number; big?: boolean }) {
  const c = usePalette();
  const len = Math.max(1, span.end - span.start);
  const x = (t: number) => (t - span.start) / len;
  const h = big ? 22 : 16;
  const d = big ? 12 : 9;
  const live = at != null && at >= span.start && at <= span.end + 0.5;
  return (
    <View style={{ height: h, justifyContent: 'center', marginHorizontal: d / 2 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: c.line }} />
      {live ? <View style={{ position: 'absolute', left: 0, width: pct(x(at)), height: 2, backgroundColor: c.accent }} /> : null}
      {span.sets.map((st, i) => {
        const done = at != null && at >= st.e;
        return (
          <View key={i}>
            <View style={{ position: 'absolute', left: pct(x(st.go)), width: pct(x(st.e) - x(st.go)), top: -2, height: 4, borderRadius: 2, backgroundColor: done ? c.accent : c.band }} />
            <View style={{ position: 'absolute', left: pct(x(st.s)), top: -d / 2, marginLeft: -d / 2, width: d, height: d, borderRadius: d / 2,
              backgroundColor: done ? c.accent : c.surface, borderWidth: 2, borderColor: c.accent }} />
          </View>
        );
      })}
      {live ? (
        <View style={{ position: 'absolute', left: pct(x(at)), marginLeft: -(d + 4) / 2, width: d + 4, height: d + 4, borderRadius: (d + 4) / 2,
          backgroundColor: c.ink, borderWidth: 2, borderColor: c.surface }} />
      ) : null}
    </View>
  );
}

/** 지금 세트: 반복마다 점, 움직이는 점이 템포 속도로 다음 점까지 간다 */
export function RepLine({ count, progress, label }: { count: number; progress: number; label?: string }) {
  const c = usePalette();
  const n = Math.max(1, Math.min(count, 30));
  return (
    <View style={{ gap: 2 }}>
      <View style={{ height: 26, justifyContent: 'center', marginHorizontal: 8 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: c.restSoft }} />
        <View style={{ position: 'absolute', left: 0, width: pct(progress), height: 3, borderRadius: 2, backgroundColor: c.accent }} />
        {Array.from({ length: n }, (_, i) => {
          const at = (i + 1) / n;
          const hit = progress >= at - 1e-3;
          return <View key={i} style={{ position: 'absolute', left: pct(at), marginLeft: -4, top: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: hit ? c.accent : c.surface, borderWidth: 2, borderColor: hit ? c.accent : c.line }} />;
        })}
        <View style={{ position: 'absolute', left: pct(progress), marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: c.accent, borderWidth: 3, borderColor: c.surface }} />
      </View>
      {label ? <T v="small" style={{ fontSize: 11 }}>{label}</T> : null}
    </View>
  );
}

export type RowState = 'plan' | 'done' | 'now' | 'next' | 'off';

export function TimelineRow({ it, span, state, rhythm, last, onPress, onToggle, children, at, live }: {
  it: RunItem; span: ItemSpan | null; state: RowState; rhythm: boolean; last?: boolean;
  onPress?: () => void; onToggle?: () => void; children?: ReactNode;
  /** running: timeline seconds now */
  at?: number;
  /** running, this row: the moving dot in the set (null = not in a set) and the caption */
  live?: { rep: number | null; line: string };
}) {
  const c = usePalette();
  const kind = rhythmKind({ n: it.name });
  const dim = state === 'off' || state === 'done';
  const dot = state === 'now' ? c.accent : state === 'done' ? c.accent : state === 'off' ? c.line : c.surface;
  const amount = kind === 'hold' ? `${it.sets}×${it.hold}초` : `${it.sets}×${it.reps}${it.kg ? ` · ${it.kg}kg` : ''}`;
  return (
    <View style={{ flexDirection: 'row' }}>
      {/* 운동명 */}
      <Pressable accessibilityRole={onToggle ? 'checkbox' : undefined} accessibilityState={onToggle ? { checked: state !== 'off' } : undefined}
        accessibilityLabel={onToggle ? `${it.name} 가이드에 넣기` : undefined} onPress={onToggle} disabled={!onToggle}
        style={{ width: NAME_W, paddingTop: 2, paddingRight: 6, paddingBottom: 14, opacity: dim ? 0.5 : 1 }}>
        <T numberOfLines={2} style={{ fontWeight: '700', fontSize: state === 'now' ? 15 : 13, textDecorationLine: state === 'off' ? 'line-through' : 'none' }}>{it.name}</T>
        <T v="small" style={{ fontSize: 11 }}>{state === 'off' ? '빼기' : amount}</T>
      </Pressable>
      {/* 세로 타임라인 */}
      <View style={{ width: RAIL_W, alignItems: 'center' }}>
        <View style={{ width: state === 'now' ? 16 : 12, height: state === 'now' ? 16 : 12, borderRadius: 8, marginTop: 4, backgroundColor: dot, borderWidth: 2, borderColor: state === 'off' ? c.line : c.accent }}>
          {state === 'done' ? <T style={{ color: c.accentInk, fontSize: 8, lineHeight: 9, textAlign: 'center', fontWeight: '800' }}>✓</T> : null}
        </View>
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: state === 'done' ? c.accent : c.line, marginTop: 2 }} /> : null}
      </View>
      {/* 가로 템포 */}
      <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
        style={{ flex: 1, paddingLeft: 6, paddingBottom: 14, gap: 4, opacity: dim ? 0.5 : 1 }}>
        {span && state !== 'off' ? <SetLine span={span} at={at} big={state === 'now'} /> : <View style={{ height: 16, justifyContent: 'center' }}><View style={{ height: 2, backgroundColor: c.line }} /></View>}
        {live && live.rep != null ? <RepLine count={kind === 'hold' ? 1 : it.reps} progress={live.rep} /> : null}
        <T v="small" style={{ fontSize: 11 }}>
          {live?.line ?? `${span && state !== 'off' ? `${fmtDuration(Math.round(span.start))}부터 · ` : ''}휴식 ${it.rest}초 · 자세 ${it.setup}초${kind === 'rhythm' && rhythm ? ` · ${it.tempo.replace(/-0$/, '')}` : ''}`}
        </T>
        {children}
      </Pressable>
    </View>
  );
}

