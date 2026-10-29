import { View } from 'react-native';

import { usePalette } from '@/constants/theme';
import type { VolumeCheck } from '@/lib/routine';

import { Row, T, fmtN } from './ui';

/** Weekly sets per muscle a routine produces, flagged against the target range. */
export function VolumeCheckView({ checks, min, max }: { checks: VolumeCheck[]; min: number; max: number }) {
  const c = usePalette();
  const shown = checks.filter((x) => x.status !== 'off');
  const top = Math.max(max + 4, ...shown.map((x) => x.sets + 1));
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%` as const;
  const issues = shown.filter((x) => x.status !== 'ok');
  return (
    <View style={{ gap: 6 }}>
      <T v="small">
        주간 세트(보조 부위 포함) · 목표 {min}~{max}
        {issues.length ? ` · ${issues.map((x) => `${x.name} ${x.status === 'low' ? '부족' : '많음'}`).join(', ')}` : ' · 모든 부위가 범위 안이에요'}
      </T>
      {shown.map((x) => {
        const color = x.status === 'ok' ? c.ok : x.status === 'low' ? c.accent : c.warn;
        return (
          <Row key={x.muscle} style={{ flexWrap: 'nowrap' }}>
            <T v="small" style={{ width: 84 }} numberOfLines={1}>{x.name}</T>
            <View style={{ flex: 1, height: 10, borderRadius: 3, backgroundColor: c.restSoft, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 0, bottom: 0, left: pct(min), width: `${((max - min) / top) * 100}%`, backgroundColor: c.band }} />
              <View style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: pct(x.sets), borderRadius: 2, backgroundColor: color }} />
            </View>
            <T v="small" style={{ width: 34, textAlign: 'right', color }}>{fmtN(x.sets)}</T>
          </Row>
        );
      })}
    </View>
  );
}
