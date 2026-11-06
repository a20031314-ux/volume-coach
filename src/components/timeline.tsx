import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Space, usePalette } from '@/constants/theme';

import { T } from './ui';

/**
 * One point on a vertical timeline: time on the left, a dot on the rail, content on the right.
 * Used at every level — the day, a workout (exercise → set), a run.
 */
export function TlNode({ time, title, sub, color, onPress, last, small, right, children }: {
  time?: string;
  title: string;
  sub?: string;
  color?: string;
  onPress?: () => void;
  last?: boolean;
  /** a minor point (a set, start/end marker) */
  small?: boolean;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const c = usePalette();
  const dot = small ? 8 : 12;
  const body = (
    <View style={{ flexDirection: 'row', gap: Space.md }}>
      <T v="small" style={{ width: 44, textAlign: 'right', paddingTop: small ? 0 : 2 }}>{time ?? ''}</T>
      <View style={{ width: 14, alignItems: 'center' }}>
        <View style={{ width: dot, height: dot, borderRadius: dot / 2, marginTop: small ? 4 : 5, backgroundColor: color ?? c.accent, opacity: small ? 0.7 : 1 }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.line, marginTop: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : small ? Space.sm : Space.lg, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v={small ? 'body' : 'title'} style={small ? undefined : { fontSize: 16 }}>{title}</T>
            {sub ? <T v="small">{sub}</T> : null}
          </View>
          {right}
          {onPress ? <T v="muted">›</T> : null}
        </View>
        {children}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {body}
    </Pressable>
  );
}

/** A 24-hour strip with coloured blocks for each activity, so the whole day reads at a glance. */
export function DayStrip({ blocks, startMs }: { blocks: { startMs: number; endMs: number; color: string }[]; startMs: number }) {
  const c = usePalette();
  const day = 864e5;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 14, borderRadius: 7, backgroundColor: c.line, overflow: 'hidden' }}>
        {blocks.map((b, i) => {
          const l = Math.max(0, (b.startMs - startMs) / day);
          const w = Math.max(0.006, Math.min(1 - l, (b.endMs - b.startMs) / day));
          return <View key={i} style={{ position: 'absolute', left: `${l * 100}%`, width: `${w * 100}%`, top: 0, bottom: 0, backgroundColor: b.color }} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {['0', '6', '12', '18', '24'].map((h) => <T key={h} v="small">{h}</T>)}
      </View>
    </View>
  );
}
