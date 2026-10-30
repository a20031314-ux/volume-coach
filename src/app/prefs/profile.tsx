import { useState } from 'react';
import { View } from 'react-native';

import { Disclosure, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { recommendedVolume, recoveryMultiplier, type VolumeRec } from '@/lib/profile';
import type { Goal, Profile } from '@/lib/types';
import { useData } from '@/store/store';

export default function ProfilePrefs() {
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const [undo, setUndo] = useState<VolumeRec | null>(null);
  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const { rec, why } = recommendedVolume(p);
  const same = rec.min === s.min && rec.max === s.max && rec.cap === s.cap && rec.mcap === s.mcap;
  const m = recoveryMultiplier(p);

  return (
    <Page>
      <Card>
        <Row gap={Space.md}>
          <NumField label="나이" value={p.age} onCommit={(age) => setP({ age })} />
          <NumField label="키 cm" value={p.height} onCommit={(height) => setP({ height })} decimal />
          <NumField label="체중 kg" value={p.weight} onCommit={(weight) => setP({ weight })} decimal />
        </Row>
        <View style={{ gap: 6 }}><T v="muted">성별</T>
          <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={p.sex || null} onChange={(v) => setP({ sex: (v ?? '') as Profile['sex'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">웨이트 경력</T>
          <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]} value={p.years || null} onChange={(v) => setP({ years: (v ?? '') as Profile['years'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">목표</T>
          <Pills options={[{ k: 'hyp', n: '근비대' }, { k: 'str', n: '근력' }, { k: 'cut', n: '체지방 감량' }, { k: 'fit', n: '건강·체력' }] as { k: Goal; n: string }[]}
            value={p.goal} onToggle={(goal) => setP({ goal })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">운동 외 활동량</T>
          <Segmented options={[{ v: '0', n: '앉아서' }, { v: '1', n: '자주 걸음' }, { v: '2', n: '서서 일함' }]} value={p.act ?? '1'} onChange={(v) => setP({ act: (v ?? '1') as Profile['act'] })} />
        </View>
      </Card>

      <Card>
        <T v="title" style={{ fontSize: 15 }}>내게 맞는 볼륨</T>
        <Row gap={Space.xl}>
          <View><T v="small">주간</T><T v="num">{rec.min}~{rec.max}<T v="small">세트</T></T></View>
          <View><T v="small">하루 최대</T><T v="num">{rec.cap}<T v="small">세트</T></T></View>
          <View><T v="small">회복</T><T v="num">{m === 1 ? '기본' : m < 1 ? '빠름' : `×${m.toFixed(2)}`}</T></View>
        </Row>
        {why.length ? <T v="small">{why.join(' · ')}</T> : null}
        <Row>
          {same ? <T v="small">지금 규칙과 같아요</T> : (
            <Button kind="primary" label={`규칙에 적용 (지금 ${s.min}~${s.max})`} onPress={() => {
              setUndo({ min: s.min, max: s.max, cap: s.cap, mcap: s.mcap, minEx: s.minEx });
              update(rec); toast('규칙에 적용했어요');
            }} />
          )}
          {undo ? <Button label="되돌리기" onPress={() => { update(undo); setUndo(null); }} /> : null}
        </Row>
      </Card>

      <Disclosure title="루틴 추천 조건">
        <Card>
          <Row gap={Space.md}>
            <NumField label="주 운동 일수" value={p.days ?? 4} onCommit={(v) => v != null && setP({ days: Math.max(2, Math.min(6, Math.round(v))) })} />
            <NumField label="1회 운동 (분)" value={p.sessionMin ?? 60} onCommit={(v) => v != null && setP({ sessionMin: v })} />
          </Row>
          <Segmented options={[{ v: 'gym', n: '헬스장' }, { v: 'dumbbell', n: '덤벨만' }, { v: 'bodyweight', n: '맨몸' }]} value={p.equipment ?? 'gym'}
            onChange={(v) => v && setP({ equipment: v })} />
        </Card>
      </Disclosure>
    </Page>
  );
}
