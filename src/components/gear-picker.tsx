/** 장비 체크: a preset fills it in one tap, then add or remove single items. */
import { View } from 'react-native';

import { Button, Pills, Row, T } from '@/components/ui';
import { ALL_GEAR, GEAR, GEAR_PRESETS, type Gear } from '@/lib/gear';

export function GearPicker({ value, onChange }: { value: Gear[] | null | undefined; onChange: (g: Gear[]) => void }) {
  const cur = value ?? [];
  const preset = value ? GEAR_PRESETS.find((p) => p.gear.length === cur.length && p.gear.every((g) => cur.includes(g)))?.n ?? null : null;
  return (
    <View style={{ gap: 8 }}>
      <Pills options={GEAR_PRESETS.map((p) => ({ k: p.n, n: p.n }))} value={preset}
        onToggle={(n) => onChange([...(GEAR_PRESETS.find((p) => p.n === n)?.gear ?? [])])} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T v="small" style={{ flexShrink: 1 }}>있는 것만 체크 (맨몸 운동은 항상 가능)</T>
        <Row gap={4} style={{ flexWrap: 'nowrap' }}>
          <Button label="전체 선택" kind="ghost" onPress={() => onChange([...ALL_GEAR])} />
          <Button label="모두 해제" kind="ghost" onPress={() => onChange([])} />
        </Row>
      </Row>
      <Pills options={GEAR.map((g) => ({ k: g.k, n: g.n }))} value={cur}
        onToggle={(k) => onChange(cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])} />
    </View>
  );
}
