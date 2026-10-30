import { View } from 'react-native';

import { Disclosure, Page } from '@/components/layout';
import { Card, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { MUSCLES } from '@/lib/exercises';
import type { Settings } from '@/lib/types';
import { useData } from '@/store/store';

export default function RulesPrefs() {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);

  const num = (k: keyof Settings, label: string) => (
    <NumField label={label} value={s[k] as number}
      onCommit={(v) => {
        if (v == null) return;
        const patch: Partial<Settings> = { [k]: k === 'ready' ? Math.min(100, v) : v };
        if (k === 'min' && v > s.max) patch.max = v;
        if (k === 'max' && v < s.min) patch.min = v;
        update(patch);
      }} />
  );

  return (
    <Page>
      <Card>
        <Row gap={Space.md}>{num('min', '주간 최소 세트')}{num('max', '주간 최대 세트')}</Row>
        <Row gap={Space.md}>{num('minEx', '최소 운동 종류')}{num('gap', '휴식일')}</Row>
        <T v="small">부위마다 적용돼요.</T>
      </Card>

      <Card>
        <View style={{ gap: 6 }}><T v="muted">디로드 (범위 절반)</T>
          <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: '켬' }]} value={s.deload ? 'on' : 'off'} onChange={(v) => update({ deload: v === 'on' })} />
        </View>
      </Card>

      <Disclosure title="오늘 추천에 반영할 것">
        <Card>
          <Pills
            options={[{ k: 'sleep', n: '수면' }, { k: 'energy', n: '컨디션' }, { k: 'sore', n: '근육통' }, { k: 'systemic', n: '최근 전신 피로' }] as { k: keyof Settings['checkin']; n: string }[]}
            value={(['sleep', 'energy', 'sore', 'systemic'] as const).filter((k) => s.checkin[k])}
            onToggle={(k) => update({ checkin: { ...s.checkin, [k]: !s.checkin[k] } })} />
        </Card>
      </Disclosure>

      <Disclosure title="세부 설정">
        <Card>
          <Row gap={Space.md}>{num('cap', '하루 최대 세트')}{num('mcap', '부위당 하루 최대')}</Row>
          <Row gap={Space.md}>{num('ready', '운동 가능 회복도 %')}</Row>
          <View style={{ gap: 6 }}><T v="muted">주 시작</T>
            <Segmented options={[{ v: 1, n: '월요일' }, { v: 0, n: '일요일' }]} value={s.weekStart} onChange={(v) => v != null && update({ weekStart: v as 0 | 1 })} />
          </View>
          <View style={{ gap: 6 }}><T v="muted">보조 부위 반영</T>
            <Segmented options={[{ v: 0.5, n: '0.5세트' }, { v: 0, n: '안 함' }]} value={s.sec} onChange={(v) => v != null && update({ sec: v as number })} />
          </View>
          <View style={{ gap: 6 }}><T v="muted">관리할 부위</T>
            <Pills options={MUSCLES} value={MUSCLES.filter((x) => !s.off.includes(x.k)).map((x) => x.k)}
              onToggle={(k) => update({ off: s.off.includes(k) ? s.off.filter((x) => x !== k) : [...s.off, k] })} />
          </View>
        </Card>
      </Disclosure>
    </Page>
  );
}
