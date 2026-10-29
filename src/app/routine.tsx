import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { Button, Card, Chip, ConfirmButton, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { VolumeCheckView } from '@/components/volume-check';
import { Space, usePalette } from '@/constants/theme';
import { DOW } from '@/lib/dates';
import { MUSCLES } from '@/lib/exercises';
import { defaultWeekdays, recommendRoutine, weeklyVolume } from '@/lib/routine';
import type { Profile, Routine } from '@/lib/types';
import { live, newId, useData } from '@/store/store';

const SOURCE = { recommended: '추천', edited: '추천+수정', custom: '직접 짠 루틴' } as const;

export default function RoutineHub() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const routinesT = useData((x) => x.routines);
  const putRoutine = useData((x) => x.putRoutine);
  const removeRoutine = useData((x) => x.removeRoutine);
  const [schedule, setSchedule] = useState<Routine['schedule']>(() => (s.activeRoutineId && routinesT[s.activeRoutineId]?.schedule) || 'rotation');
  const [peek, setPeek] = useState(false);

  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const rec = useMemo(() => recommendRoutine({ profile: p, settings: s, schedule }), [p, s, schedule]);
  const recVol = useMemo(() => weeklyVolume(rec, s, p.days), [rec, s, p.days]);
  const routines = useMemo(() => live(routinesT).sort((a, b) => b.updatedAt - a.updatedAt), [routinesT]);

  const save = (r: Omit<Routine, 'id' | 'updatedAt'>, activate = true) => {
    const id = newId();
    putRoutine({ ...r, id });
    if (activate) update({ planMode: 'routine', activeRoutineId: id });
    return id;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + Space.xl, gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
      <T v="label" style={{ marginTop: 0 }}>운동 방식</T>
      <Card>
        <Segmented options={[{ v: 'auto', n: '자율형' }, { v: 'routine', n: '루틴형' }]} value={s.planMode}
          onChange={(v) => v && update({ planMode: v })} />
        <T v="small">
          {s.planMode === 'auto'
            ? '규칙(부위당 주간 세트 범위, 운동 종류, 휴식일)만 정해두면 그날 회복도와 컨디션에 맞춰 매일 운동을 짜줘요.'
            : '정해둔 루틴을 따라가요. 회복이 덜 된 날에는 다른 날 루틴을 먼저 하자고 제안해요.'}
        </T>
        {s.planMode === 'auto' ? <Button label="규칙 바꾸기" onPress={() => router.navigate('/settings')} style={{ alignSelf: 'flex-start' }} /> : null}
      </Card>

      {s.planMode === 'routine' ? (
        <>
          <T v="label">일정 방식</T>
          <Card>
            <Segmented options={[{ v: 'rotation', n: '순서대로 반복' }, { v: 'weekday', n: '요일 고정' }]} value={schedule}
              onChange={(v) => {
                if (!v) return;
                setSchedule(v);
                const act = s.activeRoutineId ? routinesT[s.activeRoutineId] : null;
                if (act && act.schedule !== v) {
                  const wd = defaultWeekdays(act.days.length);
                  putRoutine({ ...act, schedule: v, days: act.days.map((d, i) => ({ ...d, weekdays: d.weekdays.length ? d.weekdays : wd[i] })) });
                }
              }} />
            <T v="small">{schedule === 'rotation' ? 'Day 1 → 2 → 3 … 순서로 이어가요. 하루 쉬면 다음 날 이어서 해요.' : '정해둔 요일에 정해둔 루틴을 해요. 그 외 요일은 쉬는 날이에요.'}</T>
          </Card>

          <T v="label">추천 루틴</T>
          <Card>
            <Row gap={Space.md}>
              <Stepper label="주 운동 일수" value={p.days ?? 4} min={2} max={6} onChange={(days) => setP({ days })} />
              <Stepper label="1회 운동 (분)" value={p.sessionMin ?? 60} step={15} min={30} max={120} onChange={(sessionMin) => setP({ sessionMin })} />
            </Row>
            <View style={{ gap: 6 }}><T v="muted">장소·장비</T>
              <Segmented options={[{ v: 'gym', n: '헬스장' }, { v: 'dumbbell', n: '덤벨만' }, { v: 'bodyweight', n: '맨몸' }]} value={p.equipment ?? 'gym'}
                onChange={(v) => v && setP({ equipment: v })} />
            </View>
            <View style={{ gap: 6 }}><T v="muted">빼고 싶은 부위 (부상 등)</T>
              <Pills danger options={MUSCLES} value={p.avoid ?? []}
                onToggle={(k) => setP({ avoid: (p.avoid ?? []).includes(k) ? (p.avoid ?? []).filter((x) => x !== k) : [...(p.avoid ?? []), k] })} />
            </View>

            <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: Space.md, gap: Space.sm }}>
              <T v="title">{rec.name}</T>
              <T v="small">설정 탭의 목표·경력·나이로 세트 수를, 장비로 운동을 골랐어요.</T>
              {rec.days.map((d) => (
                <View key={d.key} style={{ gap: 2 }}>
                  <T style={{ fontWeight: '700' }}>{d.name}{schedule === 'weekday' && d.weekdays.length ? ` · ${d.weekdays.map((w) => DOW[w]).join('')}` : ''} <T v="small">{d.exercises.reduce((a, e) => a + e.sets, 0)}세트</T></T>
                  {peek ? <T v="small">{d.exercises.map((e) => `${e.name} ${e.sets}`).join(' · ')}</T> : null}
                </View>
              ))}
              <Button label={peek ? '운동 접기' : '운동 보기'} kind="ghost" onPress={() => setPeek(!peek)} style={{ alignSelf: 'flex-start' }} />
              <VolumeCheckView checks={recVol} min={s.min} max={s.max} />
              {recVol.some((v) => v.status === 'low') ? (
                <T v="small">1회 운동 시간에 맞추느라 일부 부위가 범위보다 적어요. 시간을 늘리거나 &apos;수정해서 쓰기&apos;로 세트를 더할 수 있어요.</T>
              ) : null}
            </View>
            <Row style={{ flexWrap: 'nowrap' }}>
              <Button label="수정해서 쓰기" style={{ flex: 1 }} onPress={() => {
                const id = save({ ...rec, source: 'edited' });
                router.push({ pathname: '/routine-edit', params: { id } });
              }} />
              <Button label="이대로 쓰기" kind="primary" style={{ flex: 1 }} onPress={() => { save(rec); toast('추천 루틴을 시작해요'); router.back(); }} />
            </Row>
          </Card>

          <Button label="+ 직접 짜기" onPress={() => {
            const id = save({ name: '내 루틴', source: 'custom', schedule, days: [{ key: newId(), name: 'Day 1', weekdays: schedule === 'weekday' ? [1] : [], exercises: [] }] });
            router.push({ pathname: '/routine-edit', params: { id } });
          }} />

          {routines.length ? <T v="label">내 루틴</T> : null}
          {routines.map((r) => {
            const active = r.id === s.activeRoutineId;
            return (
              <Card key={r.id} style={active ? { borderColor: c.accent, borderWidth: 2 } : undefined}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flexShrink: 1 }}>
                    <T v="title">{r.name}</T>
                    <T v="small">{SOURCE[r.source]} · {r.days.length}일 · {r.schedule === 'rotation' ? '순서대로 반복' : '요일 고정'}</T>
                  </View>
                  {active ? <Chip label="사용 중" tone="accent" /> : null}
                </Row>
                <Row>
                  {!active ? <Button label="이 루틴 쓰기" kind="primary" onPress={() => { update({ planMode: 'routine', activeRoutineId: r.id }); setSchedule(r.schedule); toast(`${r.name}으로 바꿨어요`); }} /> : null}
                  <Button label="편집" onPress={() => router.push({ pathname: '/routine-edit', params: { id: r.id } })} />
                  <ConfirmButton label="삭제" onConfirm={() => {
                    removeRoutine(r.id);
                    if (active) update({ activeRoutineId: null });
                    toast('루틴을 삭제했어요');
                  }} />
                </Row>
              </Card>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}
