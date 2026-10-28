import { View } from 'react-native';

import { Chip, Row, Screen, T, fmtN } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useCoach } from '@/hooks/use-coach';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/dates';

export default function Week() {
  const c = usePalette();
  const now = useNow();
  const { input, result } = useCoach(now);
  const top = Math.max(result.max + 6, ...result.stats.map((s) => s.done + 2));
  const pct = (v: number) => Math.min(100, (v / top) * 100);

  return (
    <Screen title="주간" sub={`${fmt(result.W)} – ${fmt(result.E)}`}>
      <T v="muted">막대 = 이번 주 세트, 옅은 띠 = 목표 범위 {result.min}~{result.max}세트.</T>
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
      <Row>
        <T v="small">보조 부위는 {input.settings.sec ? `${input.settings.sec}세트로` : '계산하지 않고'} 집계해요. 예: 벤치프레스 4세트 = 가슴 4 + 삼두·어깨 각 {4 * input.settings.sec}.</T>
      </Row>
    </Screen>
  );
}
