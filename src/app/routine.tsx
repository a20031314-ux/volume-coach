import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Disclosure, Group, ListRow, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, Chip, ConfirmButton, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { VolumeCheckView } from '@/components/volume-check';
import { Space, usePalette } from '@/constants/theme';
import { knownExercises } from '@/lib/ability';
import { MUSCLES } from '@/lib/exercises';
import { recommendRoutine, weeklyVolume } from '@/lib/routine';
import type { Profile, Routine } from '@/lib/types';
import { live, newId, useData } from '@/store/store';

const SOURCE = { recommended: '추천', edited: '추천 수정', custom: '직접' } as const;

export default function RoutineHub() {
  const c = usePalette();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const routinesT = useData((x) => x.routines);
  const putRoutine = useData((x) => x.putRoutine);
  const removeRoutine = useData((x) => x.removeRoutine);
  const logsT = useData((x) => x.logs);
  const [peek, setPeek] = useState(false);

  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const known = useMemo(() => knownExercises(live(logsT)), [logsT]);
  const rec = useMemo(() => recommendRoutine({ profile: p, settings: s, known }), [p, s, known]);
  const recVol = useMemo(() => weeklyVolume(rec, s, p.days), [rec, s, p.days]);
  const routines = useMemo(
    () => live(routinesT).sort((a, b) => Number(b.id === s.activeRoutineId) - Number(a.id === s.activeRoutineId) || b.updatedAt - a.updatedAt),
    [routinesT, s.activeRoutineId],
  );
  const low = recVol.filter((v) => v.status === 'low');

  const save = (r: Omit<Routine, 'id' | 'updatedAt'>) => {
    const id = newId();
    putRoutine({ ...r, id });
    update({ planMode: 'routine', activeRoutineId: id });
    return id;
  };

  return (
    <Page>
      <Segmented options={[{ v: 'auto', n: '자율형' }, { v: 'routine', n: '루틴형' }]} value={s.planMode}
        onChange={(v) => v && update({ planMode: v })} />

      {s.planMode === 'auto' ? (
        <Group>
          <ListRow label="운동 규칙" value={`주 ${s.min}~${s.max}세트`} onPress={() => router.push('/prefs/rules')} last />
        </Group>
      ) : (
        <>
          {routines.length ? (
            <View style={{ gap: Space.sm }}>
              <T v="label">내 루틴</T>
              {routines.map((r) => {
                const active = r.id === s.activeRoutineId;
                return (
                  <Card key={r.id} style={active ? { borderColor: c.accent, borderWidth: 2 } : undefined}>
                    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <View style={{ flexShrink: 1 }}>
                        <T v="title">{r.name}</T>
                        <T v="small">{r.days.map((d) => d.name).join(' · ')}</T>
                      </View>
                      {active ? <Chip label="사용 중" tone="accent" /> : <Chip label={SOURCE[r.source]} tone="rest" />}
                    </Row>
                    <Row>
                      {!active ? <Button label="이 루틴 쓰기" kind="primary" onPress={() => { update({ planMode: 'routine', activeRoutineId: r.id }); toast(`${r.name}으로 바꿨어요`); }} /> : null}
                      <Button label="편집" onPress={() => router.push({ pathname: '/routine-edit', params: { id: r.id } })} />
                      <View style={{ flex: 1 }} />
                      <ConfirmButton label="삭제" onConfirm={() => { removeRoutine(r.id); if (active) update({ activeRoutineId: null }); }} />
                    </Row>
                  </Card>
                );
              })}
            </View>
          ) : null}

          <View style={{ gap: Space.sm }}>
            <T v="label">{routines.length ? '새 루틴' : '루틴 고르기'}</T>
            <Card>
              <View>
                <T v="small">추천</T>
                <T v="title">{rec.name}</T>
              </View>
              {rec.days.map((d) => (
                <View key={d.key} style={{ gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T style={{ fontWeight: '600' }}>{d.name}</T>
                    <T v="small">{d.exercises.length}개 · {d.exercises.reduce((a, e) => a + e.sets, 0)}세트</T>
                  </Row>
                  {peek ? <T v="small">{d.exercises.map((e) => `${e.name} ${e.sets}`).join(' · ')}</T> : null}
                </View>
              ))}
              <Button label={peek ? '접기' : '운동 보기'} kind="ghost" onPress={() => setPeek(!peek)} style={{ alignSelf: 'flex-start' }} />
              <Row style={{ flexWrap: 'nowrap' }}>
                <Button label="수정해서 쓰기" style={{ flex: 1 }} onPress={() => {
                  const id = save({ ...rec, source: 'edited' });
                  router.push({ pathname: '/routine-edit', params: { id } });
                }} />
                <Button label="이대로 쓰기" kind="primary" style={{ flex: 1 }} onPress={() => { save(rec); toast('루틴을 시작해요'); router.back(); }} />
              </Row>
            </Card>

            <Disclosure title="추천 조건" meta={`주 ${p.days ?? 4}일 · ${p.sessionMin ?? 60}분`}>
              <Card>
                <Row gap={Space.md}>
                  <Stepper label="주 운동 일수" value={p.days ?? 4} min={2} max={6} onChange={(days) => setP({ days })} />
                  <Stepper label="1회 (분)" value={p.sessionMin ?? 60} step={15} min={30} max={120} onChange={(sessionMin) => setP({ sessionMin })} />
                </Row>
                <Segmented options={[{ v: 'gym', n: '헬스장' }, { v: 'dumbbell', n: '덤벨만' }, { v: 'bodyweight', n: '맨몸' }]} value={p.equipment ?? 'gym'}
                  onChange={(v) => v && setP({ equipment: v })} />
                <View style={{ gap: 6 }}><T v="muted">뺄 부위</T>
                  <Pills danger options={MUSCLES} value={p.avoid ?? []}
                    onToggle={(k) => setP({ avoid: (p.avoid ?? []).includes(k) ? (p.avoid ?? []).filter((x) => x !== k) : [...(p.avoid ?? []), k] })} />
                </View>
                {!s.ability.checked ? <Button label="할 수 있는 운동 체크" onPress={() => router.push('/ability')} style={{ alignSelf: 'flex-start' }} /> : null}
              </Card>
            </Disclosure>

            <Disclosure title="주간 볼륨" meta={low.length ? `${low.map((v) => v.name).join(', ')} 부족` : '범위 안'}>
              <Card><VolumeCheckView checks={recVol} min={s.min} max={s.max} /></Card>
            </Disclosure>

            <Button label="직접 짜기" onPress={() => {
              const id = save({ name: '내 루틴', source: 'custom', schedule: 'rotation', days: [{ key: newId(), name: 'Day 1', weekdays: [], exercises: [] }] });
              router.push({ pathname: '/routine-edit', params: { id } });
            }} />
          </View>
        </>
      )}
    </Page>
  );
}
