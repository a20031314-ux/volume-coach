import { View } from 'react-native';

import { Chip, T, fmtN } from './ui';
import { Space, usePalette } from '@/constants/theme';
import { useCoach } from '@/hooks/use-coach';
import { useNow } from '@/hooks/use-now';

/** Weekly sets per muscle against the target range. */
export function WeekView() {
  const c = usePalette();
  const now = useNow();
  const { input, result } = useCoach(now);
  const top = Math.max(result.max + 6, ...result.stats.map((s) => s.done + 2));
  const pct = (v: number) => Math.min(100, (v / top) * 100);

  return (
    <>
      <T v="small">목표 {result.min}~{result.max}세트</T>
      <View>
        {result.stats.map((s) => (
          <View key={s.k} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
            <View style={{ width: 96 }}>
              <T style={{ fontWeight: '600', fontSize: 14 }}>{s.n}</T>
              <T v="small">{s.names.length}/{input.settings.minEx}종 · 회복 {s.recNow}%</T>
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ height: 14, borderRadius: 4, backgroundColor: c.restSoft, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(result.min)}%`, width: `${pct(result.max) - pct(result.min)}%`, backgroundColor: c.band }} />
                <View style={{ position: 'absolute', left: 0, top: 3, bottom: 3, borderRadius: 3, width: `${pct(s.done)}%`, backgroundColor: s.done > result.max ? c.warn : c.accent }} />
              </View>
              <Chip label={s.status.label} tone={s.status.tone} />
            </View>
            <View style={{ width: 52, alignItems: 'flex-end' }}>
              <T v="num" style={{ fontSize: 18 }}>{fmtN(s.done)}</T>
              <T v="small">세트</T>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}
