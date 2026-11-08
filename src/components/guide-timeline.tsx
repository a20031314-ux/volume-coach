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
export function SetLine({ span, at, big, first = 1, flagged = [] }: { span: ItemSpan; at?: number; big?: boolean; first?: number; flagged?: number[] }) {
  const c = usePalette();
  const len = Math.max(1, span.end - span.start);
  const x = (t: number) => (t - span.start) / len;
  const h = big ? 22 : 16;
  const d = big ? 12 : 9;
  const q = big ? 18 : 14; // 세트 = 번호 붙은 네모
  const live = at != null && at >= span.start && at <= span.end + 0.5;
  // in a set, the set's square itself shows "now"; the dot is for rests
  const inSet = at != null && span.sets.some((st) => at >= st.s && at < st.e);
  return (
    <View style={{ height: Math.max(h, q + 2), justifyContent: 'center', marginHorizontal: q / 2 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: c.line }} />
      {live ? <View style={{ position: 'absolute', left: 0, width: pct(x(at)), height: 2, backgroundColor: c.accent }} /> : null}
      {span.sets.map((st, i) => {
        const done = at != null && at >= st.e;
        const now = at != null && at >= st.s && at < st.e;
        const flag = flagged.includes(first + i);
        return (
          <View key={i}>
            <View style={{ position: 'absolute', left: pct(x(st.go)), width: pct(x(st.e) - x(st.go)), top: -2, height: 4, borderRadius: 2, backgroundColor: done ? c.accent : c.band }} />
            <View style={{ position: 'absolute', left: pct(x(st.s)), top: -(now ? q + 6 : q) / 2, marginLeft: -(now ? q + 6 : q) / 2, width: now ? q + 6 : q, height: now ? q + 6 : q, borderRadius: 5,
              backgroundColor: flag ? c.warn : done || now ? c.accent : c.surface, borderWidth: now ? 3 : 1.5, borderColor: now ? c.ink : flag ? c.warn : c.accent, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontSize: now ? 12 : big ? 10 : 8, lineHeight: now ? 14 : big ? 12 : 10, fontWeight: '800', color: flag || done || now ? c.accentInk : c.accent }}>{first + i}</T>
            </View>
          </View>
        );
      })}
      {live && !inSet ? (
        <View style={{ position: 'absolute', left: pct(x(at)), marginLeft: -(d + 4) / 2, width: d + 4, height: d + 4, borderRadius: (d + 4) / 2,
          backgroundColor: c.ink, borderWidth: 2, borderColor: c.surface }} />
      ) : null}
    </View>
  );
}

/** 지금 세트의 반복: 연한 상자 안 눈금(반복) 위를 파란 점이 템포 속도로 간다 — 세트(번호 네모)와 모양·배경으로 구분 */
export function RepLine({ count, progress, hold, counted }: { count: number; progress: number; hold?: boolean; counted?: number }) {
  const c = usePalette();
  const n = Math.max(1, Math.min(count, 30));
  const done = Math.min(n, counted ?? Math.floor(progress * n + 1e-6));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accentSoft, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 }}>
      <T style={{ fontSize: 11, fontWeight: '700', color: c.accent, width: 28 }}>{hold ? '버티기' : '반복'}</T>
      <View style={{ flex: 1, height: 22, justifyContent: 'center', marginHorizontal: 6 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: c.band }} />
        <View style={{ position: 'absolute', left: 0, width: pct(progress), height: 2, backgroundColor: c.accent }} />
        {hold ? null : Array.from({ length: n }, (_, i) => {
          const hit = i < done;
          return <View key={i} style={{ position: 'absolute', left: pct((i + 1) / n), marginLeft: -1, top: 5, width: 2, height: 12, borderRadius: 1, backgroundColor: hit ? c.accent : c.band }} />;
        })}
        <View style={{ position: 'absolute', left: pct(progress), marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: c.accent, borderWidth: 3, borderColor: c.surface }} />
      </View>
      <T style={{ fontSize: 12, fontWeight: '800', color: c.accent, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{hold ? `${Math.round(progress * 100)}%` : `${done}/${n}`}</T>
    </View>
  );
}

export type RowState = 'plan' | 'done' | 'now' | 'next' | 'off';

export function TimelineRow({ it, span, state, rhythm, last, onPress, onToggle, children, at, live, drop = 0, flagged }: {
  it: RunItem; span: ItemSpan | null; state: RowState; rhythm: boolean; last?: boolean;
  onPress?: () => void; onToggle?: () => void; children?: ReactNode;
  /** running: timeline seconds now */
  at?: number;
  /** running, this row: the moving dot in the set (null = not in a set) and the caption */
  live?: { rep: number | null; line: string; counted?: number };
  /** running: how far the move to the next exercise has come down the rail (0–1) */
  drop?: number;
  /** set numbers checked to fix later (노란 네모) */
  flagged?: number[];
}) {
  const c = usePalette();
  const kind = rhythmKind({ n: it.name });
  const dim = state === 'off' || state === 'done';
  // 세로(종목 → 다음 종목)는 초록, 가로(세트·반복)는 파랑
  const dot = state === 'now' ? c.accent : state === 'done' ? c.ok : state === 'off' ? c.line : c.surface;
  const ring = state === 'off' ? c.line : state === 'done' ? c.ok : state === 'next' ? c.line : c.accent;
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
        <View style={{ width: state === 'now' ? 18 : 14, height: state === 'now' ? 18 : 14, borderRadius: 9, marginTop: 3, backgroundColor: dot, borderWidth: 2, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}>
          {state === 'done' ? <T style={{ color: '#fff', fontSize: 9, lineHeight: 11, fontWeight: '800' }}>✓</T> : null}
        </View>
        {!last ? (
          <View style={{ flex: 1, width: 4, borderRadius: 2, backgroundColor: c.line, marginTop: 2, marginBottom: -3 }}>
            <View style={{ height: pct(drop), width: 4, borderRadius: 2, backgroundColor: c.ok }} />
            {drop > 0 && drop < 1 ? (
              <View style={{ position: 'absolute', top: pct(drop), marginTop: -7, left: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: c.ok, borderWidth: 2, borderColor: c.surface }} />
            ) : null}
          </View>
        ) : null}
      </View>
      {/* 가로 템포 */}
      <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress}
        style={{ flex: 1, paddingLeft: 6, paddingBottom: 14, gap: 4, opacity: dim ? 0.5 : 1 }}>
        {span && state !== 'off' ? <SetLine span={span} at={at} big={state === 'now'} first={it.first} flagged={flagged} /> : <View style={{ height: 16, justifyContent: 'center' }}><View style={{ height: 2, backgroundColor: c.line }} /></View>}
        {live && live.rep != null ? <RepLine count={kind === 'hold' ? 1 : it.reps} progress={live.rep} hold={kind === 'hold'} counted={live.counted} /> : null}
        <T v="small" style={{ fontSize: 11 }}>
          {live?.line ?? `${span && state !== 'off' ? `${fmtDuration(Math.round(span.start))}부터 · ` : ''}휴식 ${it.rest}초 · 자세 ${it.setup}초${kind === 'rhythm' && rhythm ? ` · ${it.tempo.replace(/-0$/, '')}` : ''}`}
        </T>
        {children}
      </Pressable>
    </View>
  );
}

