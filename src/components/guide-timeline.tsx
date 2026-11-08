/**
 * 가이드 타임라인: 왼쪽 운동명 · 가운데 세로 타임라인(순서·시작 시각) · 오른쪽 가로 템포(한 번 반복의 모양).
 * 설계 화면에선 탭해서 고치고, 진행 중엔 지금 종목이 커지고 템포 블록이 실시간으로 채워진다.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { fmtDuration } from '@/lib/run';
import { rhythmKind, tempoBlocks, type RunItem } from '@/lib/guide';

const NAME_W = 104;
const RAIL_W = 26;

/** one rep: ▭내리고 3 ▭밀어 1 — widths by seconds; `fill` = 0–1 of the active block */
export function TempoStrip({ it, rhythm, active, fill = 0, big }: { it: RunItem; rhythm: boolean; active?: string | null; fill?: number; big?: boolean }) {
  const c = usePalette();
  const kind = rhythmKind({ n: it.name });
  const h = big ? 44 : 30;
  if (kind === 'hold' || kind === 'explosive' || !rhythm) {
    const word = kind === 'hold' ? `${it.hold}초 버티기` : kind === 'explosive' ? '빠르게 · 3초마다 하나' : '박자 안내 없음';
    return (
      <View style={{ height: h, borderRadius: 6, backgroundColor: c.accentSoft, justifyContent: 'center', paddingHorizontal: 8, overflow: 'hidden' }}>
        {big && kind === 'hold' ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, fill * 100)}%`, backgroundColor: c.band }} /> : null}
        <T v="small" style={{ color: c.accent, fontWeight: '700' }}>{word}</T>
      </View>
    );
  }
  const blocks = tempoBlocks(it.tempo, it);
  return (
    <View style={{ flexDirection: 'row', height: h, gap: 2 }}>
      {blocks.map((b, i) => {
        const on = active === b.k;
        const move = b.k === 'down' || b.k === 'up';
        const bg = b.k === 'up' ? c.accent : b.k === 'down' ? c.band : c.restSoft;
        const ink = b.k === 'up' ? c.accentInk : b.k === 'down' ? c.accent : c.muted;
        return (
          <View key={i} style={{ flex: Math.max(b.s, 1.6), borderRadius: 6, backgroundColor: bg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
            borderWidth: on ? 2 : 0, borderColor: c.ink, opacity: active && !on ? 0.45 : 1 }}>
            {on ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, fill * 100)}%`, backgroundColor: c.ink, opacity: 0.18 }} /> : null}
            <T numberOfLines={1} style={{ fontSize: big ? 15 : 11, fontWeight: move ? '700' : '500', color: ink }}>
              {b.word} {b.s === 0.8 ? 'X' : b.s}
            </T>
          </View>
        );
      })}
    </View>
  );
}

export type RowState = 'plan' | 'done' | 'now' | 'next' | 'off';

export function TimelineRow({ it, start, state, rhythm, last, onPress, onToggle, children, live }: {
  it: RunItem; start: number | null; state: RowState; rhythm: boolean; last?: boolean;
  onPress?: () => void; onToggle?: () => void; children?: ReactNode;
  /** while running: the active block and how far into it */
  live?: { block: string | null; fill: number; line: string };
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
        <TempoStrip it={it} rhythm={rhythm} big={state === 'now'} active={live?.block} fill={live?.fill} />
        <T v="small" style={{ fontSize: 11 }}>
          {live?.line ?? `${start != null ? `${fmtDuration(Math.round(start))} 시작 · ` : ''}휴식 ${it.rest}초 · 자세 ${it.setup}초`}
        </T>
        {children}
      </Pressable>
    </View>
  );
}

