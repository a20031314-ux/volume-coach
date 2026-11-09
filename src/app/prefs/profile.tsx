import { useState } from 'react';
import { View } from 'react-native';

import { FocusPicker } from '@/components/focus-picker';
import { GearPicker } from '@/components/gear-picker';
import { budgetMin, dirOf, focusOf, legacyGoal } from '@/lib/focus';
import { SHORT } from '@/lib/strength';
import { LIFT_SESSION_MIN, floorFor } from '@/lib/target';
import { Disclosure } from '@/components/layout';
import { SavePage } from '@/components/save-bar';
import { useToast } from '@/components/toast';
import { Button, Card, NumField, Row, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { gearOf } from '@/lib/gear';
import { recommendedVolume, recoveryMultiplier, type VolumeRec } from '@/lib/profile';
import type { Profile } from '@/lib/types';

export default function ProfilePrefs() {
  const toast = useToast();
  const { s, update, dirty, save, reset } = useSettingsDraft();
  const [undo, setUndo] = useState<VolumeRec | null>(null);
  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const { rec, why } = recommendedVolume(p);
  const same = rec.min === s.min && rec.max === s.max && rec.cap === s.cap && rec.mcap === s.mcap;
  const m = recoveryMultiplier(p);

  return (
    <SavePage dirty={dirty} onSave={save} onReset={reset}>
      <Card>
        <Row gap={Space.md}>
          <NumField label="나이" value={p.age} onCommit={(age) => setP({ age })} />
        </Row>
        <View style={{ gap: 6 }}><T v="muted">성별</T>
          <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={p.sex || null} onChange={(v) => setP({ sex: (v ?? '') as Profile['sex'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">웨이트 경력</T>
          <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]} value={p.years || null} onChange={(v) => setP({ years: (v ?? '') as Profile['years'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">운동 외 활동량</T>
          <Segmented options={[{ v: '0', n: '앉아서' }, { v: '1', n: '자주 걸음' }, { v: '2', n: '서서 일함' }]} value={p.act ?? '1'} onChange={(v) => setP({ act: (v ?? '1') as Profile['act'] })} />
        </View>
      </Card>

      <Card>
        <T v="title" style={{ fontSize: 15 }}>목적</T>
        <FocusPicker focus={focusOf(p)} dir={dirOf(p)} budget={budgetMin(p)}
          floor={s.program ? floorFor(s.program.priority ?? 'balance') : undefined}
          reserved={s.program ? { min: s.program.perWeek * LIFT_SESSION_MIN, label: `${SHORT[s.program.lift]} ${s.program.target1rm}kg 목표 주 ${s.program.perWeek}회` } : null}
          onChange={(focus, weightDir) => setP({ focus, weightDir, goal: legacyGoal(focus, weightDir) })} />
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
              update(rec); toast('규칙에 반영 · 저장을 눌러 주세요');
            }} />
          )}
          {undo ? <Button label="되돌리기" onPress={() => { update(undo); setUndo(null); }} /> : null}
        </Row>
      </Card>

      <Disclosure title="루틴 추천 조건">
        <Card>
          <Row gap={Space.md}>
            <NumField label="주 운동 일수" value={p.days ?? null} onCommit={(v) => v != null && setP({ days: Math.max(2, Math.min(6, Math.round(v))) })} />
            <NumField label="1회 운동 (분)" value={p.sessionMin ?? null} onCommit={(v) => v != null && setP({ sessionMin: v })} />
          </Row>
          <GearPicker value={gearOf(p)} onChange={(gear) => setP({ gear })} />
        </Card>
      </Disclosure>
    </SavePage>
  );
}
