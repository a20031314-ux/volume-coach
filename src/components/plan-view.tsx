import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space, usePalette } from '@/constants/theme';
import { MUSCLE_NAME } from '@/lib/exercises';
import type { MuscleKey } from '@/lib/types';

import { ExName } from './exercise-menu';
import { Button, T, toneColor } from './ui';

export interface PlanItem {
  key: string;
  name: string;
  muscle: MuscleKey;
  sets: number;
  recovery: number;
  /** short tag shown next to the name, e.g. 가볍게 */
  tag?: string;
  detail: string;
  onSwap?: () => void;
  onLog?: () => void;
}

/** Today's workout: one hero card (what + start), then the exercise list. Details open per row. */
export function PlanView({ title, meta, notice, start, items, ready, empty }: {
  title: string;
  meta: string;
  /** one short line that needs attention, optionally tappable */
  notice?: { text: string; action?: string; onPress?: () => void } | null;
  start: { label: string; onPress: () => void };
  items: PlanItem[];
  ready: number;
  empty?: string;
}) {
  const c = usePalette();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <View style={{ backgroundColor: c.surface, borderRadius: Radius.md * 1.4, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.line, padding: Space.lg, gap: Space.md }}>
        <View style={{ gap: 2 }}>
          <T v="title" style={{ fontSize: 24 }}>{title}</T>
          <T v="muted">{meta}</T>
        </View>
        {notice ? (
          <Pressable disabled={!notice.onPress} onPress={notice.onPress}
            style={{ backgroundColor: c.warnSoft, borderRadius: Radius.sm, paddingHorizontal: Space.md, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
            <Text style={{ flex: 1, color: c.warn, fontSize: 13 }}>{notice.text}</Text>
            {notice.action ? <Text style={{ color: c.warn, fontSize: 13, fontWeight: '700' }}>{notice.action} ›</Text> : null}
          </Pressable>
        ) : null}
        <Button label={start.label} kind="primary" onPress={start.onPress} style={{ paddingVertical: 15 }} />
      </View>

      {items.length ? (
        <View style={{ backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.line, overflow: 'hidden' }}>
          {items.map((it, i) => {
            const expanded = open === it.key;
            return (
              <View key={it.key} style={{ borderBottomWidth: i === items.length - 1 ? 0 : StyleSheet.hairlineWidth * 2, borderColor: c.line }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setOpen(expanded ? null : it.key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: 13 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor(c, it.recovery, ready) }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ExName name={it.name} />
                    {expanded ? null : <T v="small">{MUSCLE_NAME[it.muscle]}{it.tag ? ` · ${it.tag}` : ''}</T>}
                  </View>
                  <T v="num" style={{ fontSize: 17 }}>{it.sets}<T v="small">세트</T></T>
                </Pressable>
                {expanded ? (
                  <View style={{ paddingHorizontal: Space.lg, paddingBottom: Space.md, gap: Space.sm }}>
                    <T v="small">{MUSCLE_NAME[it.muscle]} · 회복 {it.recovery}% · {it.detail}</T>
                    <View style={{ flexDirection: 'row', gap: Space.sm }}>
                      {it.onSwap ? <Button label="다른 운동으로" onPress={it.onSwap} /> : null}
                      {it.onLog ? <Button label="바로 기록" onPress={it.onLog} /> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : empty ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>{empty}</T> : null}
    </>
  );
}

/** A single compact suggestion with up to two actions. */
export function HintRow({ text, action, onAction, onDismiss }: { text: string; action: string; onAction: () => void; onDismiss: () => void }) {
  const c = usePalette();
  return (
    <View style={{ backgroundColor: c.accentSoft, borderRadius: Radius.md, padding: Space.md, gap: Space.sm }}>
      <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      <View style={{ flexDirection: 'row', gap: Space.lg }}>
        <Pressable onPress={onAction} hitSlop={8}><Text style={{ color: c.accent, fontWeight: '700', fontSize: 14 }}>{action}</Text></Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}><Text style={{ color: c.muted, fontSize: 14 }}>닫기</Text></Pressable>
      </View>
    </View>
  );
}

export const minutesFor = (sets: number) => Math.round((sets * 2.8) / 5) * 5;
