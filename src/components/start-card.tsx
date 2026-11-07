/** 시작하기 (MY 맨 위): four choices, each in a sheet, nothing pre-selected. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { knownExercises } from '@/lib/ability';
import { recommendedVolume } from '@/lib/profile';
import { GOAL_NAME, applyGoal, applyMode, applySchedule, needsChoice, startRows, type StartKey } from '@/lib/start';
import type { Goal, Profile } from '@/lib/types';
import { live, newId, useData } from '@/store/store';

const GOALS = (Object.keys(GOAL_NAME) as Goal[]).map((k) => ({ k, n: GOAL_NAME[k] }));

function GoalSheet({ onDone }: { onDone: () => void }) {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const p = s.profile;
  const [goal, setGoal] = useState<Goal | ''>(p.goal);
  const [years, setYears] = useState<Profile['years']>(p.years ?? '');
  const [sex, setSex] = useState<Profile['sex']>(p.sex ?? '');
  const [age, setAge] = useState<number | null>(p.age ?? null);
  const rec = goal ? recommendedVolume({ ...p, goal, years, sex, age }).rec : null;
  return (
    <>
      <View style={{ gap: 6 }}><T>목적</T><Pills options={GOALS} value={goal || null} onToggle={setGoal} /></View>
      <View style={{ gap: 6 }}><T>웨이트 경력 <T v="small">(선택)</T></T>
        <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]} value={years || null} onChange={(v) => setYears((v ?? '') as Profile['years'])} />
      </View>
      <View style={{ gap: 6 }}><T>성별 <T v="small">(선택)</T></T>
        <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={sex || null} onChange={(v) => setSex((v ?? '') as Profile['sex'])} />
      </View>
      <NumField label="나이 (선택)" value={age} onCommit={setAge} />
      {rec ? <T v="small">이 목적이면 부위당 주 {rec.min}~{rec.max}세트로 시작해요. 운동 규칙에서 언제든 바꿀 수 있어요.</T> : null}
      <Button label="저장" kind="primary" disabled={!goal} onPress={() => { if (goal) { update(applyGoal(s, { goal, years, sex, age })); onDone(); } }} />
    </>
  );
}

function ScheduleSheet({ onDone }: { onDone: () => void }) {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const p = s.profile;
  const [days, setDays] = useState<number | null>(p.days ?? null);
  const [min, setMin] = useState<number | null>(p.sessionMin ?? null);
  const [eq, setEq] = useState<Profile['equipment'] | null>(p.equipment ?? null);
  return (
    <>
      <View style={{ gap: 6 }}><T>주 몇 번 운동해요?</T>
        <Segmented options={[2, 3, 4, 5, 6].map((n) => ({ v: String(n), n: `${n}일` }))} value={days ? String(days) : null} onChange={(v) => setDays(v ? Number(v) : null)} />
      </View>
      <View style={{ gap: 6 }}><T>한 번에 몇 분? <T v="small">(선택)</T></T>
        <Segmented options={[45, 60, 75, 90].map((n) => ({ v: String(n), n: `${n}분` }))} value={min ? String(min) : null} onChange={(v) => setMin(v ? Number(v) : null)} />
      </View>
      <View style={{ gap: 6 }}><T>어디서 운동해요? <T v="small">(선택)</T></T>
        <Segmented options={[{ v: 'gym', n: '헬스장' }, { v: 'dumbbell', n: '덤벨만' }, { v: 'bodyweight', n: '맨몸' }]} value={eq ?? null} onChange={(v) => setEq(v ?? null)} />
      </View>
      <Button label="저장" kind="primary" disabled={days == null} onPress={() => {
        update(applySchedule(s, { days, sessionMin: min, ...(eq ? { equipment: eq } : {}) })); onDone();
      }} />
    </>
  );
}

function ModeSheet({ onDone }: { onDone: () => void }) {
  const s = useData((x) => x.settings);
  const logsT = useData((x) => x.logs);
  const routinesT = useData((x) => x.routines);
  const update = useData((x) => x.updateSettings);
  const putRoutine = useData((x) => x.putRoutine);
  const known = useMemo(() => knownExercises(live(logsT)), [logsT]);
  const [mode, setMode] = useState<'auto' | 'routine' | null>(s.start?.mode ? s.planMode : null);
  const hasRoutine = !!s.activeRoutineId && !!routinesT[s.activeRoutineId] && !routinesT[s.activeRoutineId].deleted;
  return (
    <>
      <Segmented options={[{ v: 'auto' as const, n: '자율형' }, { v: 'routine' as const, n: '루틴' }]} value={mode} onChange={(v) => setMode(v ?? null)} />
      {mode ? (
        <T v="small">{mode === 'auto'
          ? '정해진 루틴 없이, 부위별 주간 세트·회복 상태를 보고 그날 할 운동을 골라 줘요.'
          : `요일마다 정해진 운동을 해요. ${hasRoutine ? '지금 루틴을 그대로 써요.' : '일정·목적에 맞는 추천 루틴을 만들어 드려요(나중에 수정 가능).'}`}</T>
      ) : null}
      <Button label="저장" kind="primary" disabled={!mode} onPress={() => {
        if (!mode) return;
        const { patch, routine } = applyMode(s, mode, known, hasRoutine);
        if (routine) { const id = newId(); putRoutine({ ...routine, id }); patch.activeRoutineId = id; }
        update(patch); onDone();
      }} />
    </>
  );
}

const TITLE: Record<Exclude<StartKey, 'ability'>, string> = { goal: '목적', schedule: '운동 일정·장비', mode: '운동 방식' };

export function StartCard() {
  const c = usePalette();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const [open, setOpen] = useState<Exclude<StartKey, 'ability'> | null>(null);
  const rows = startRows(s);
  const done = rows.filter((r) => r.done).length;
  const close = () => setOpen(null);
  const saved = () => { toast('저장했어요'); close(); };

  return (
    <Card style={{ gap: 0, borderColor: c.accent, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'space-between', paddingBottom: Space.sm }}>
        <T v="title" style={{ fontSize: 17 }}>시작하기</T>
        <T v="small">{done}/{rows.length}</T>
      </Row>
      <T v="small" style={{ paddingBottom: Space.sm }}>{needsChoice(s) ? '목적과 운동 일정을 고르면 추천을 시작해요. 미리 정해 둔 기본값은 없어요.' : '나머지 둘은 고르면 추천이 더 잘 맞아요.'}</T>
      {rows.map((r) => (
        <Pressable key={r.key} accessibilityRole="button" accessibilityLabel={`${r.title} ${r.done ? r.summary : '미입력'}`}
          onPress={() => (r.key === 'ability' ? router.push('/ability') : setOpen(r.key))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 12, borderTopWidth: 1, borderColor: c.line }}>
          <Text style={{ fontSize: 18, color: r.done ? c.ok : c.muted }}>{r.done ? '✓' : '○'}</Text>
          <T style={{ flex: 1, fontWeight: r.done ? '400' : '600' }}>{r.title}</T>
          <T v="small" style={{ color: r.done ? c.ink : c.muted }} numberOfLines={1}>{r.done ? r.summary : '미입력'}</T>
          <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
        </Pressable>
      ))}
      {needsChoice(s) ? null : (
        <Row style={{ justifyContent: 'flex-end', paddingTop: Space.sm }}>
          <Button label="나중에 하기" kind="ghost" onPress={() => { update({ start: { ...(s.start ?? {}), skipped: true } }); router.navigate('/'); }} />
        </Row>
      )}
      <Sheet open={!!open} title={open ? TITLE[open] : ''} onClose={close}>
        {open === 'goal' ? <GoalSheet onDone={saved} /> : null}
        {open === 'schedule' ? <ScheduleSheet onDone={saved} /> : null}
        {open === 'mode' ? <ModeSheet onDone={saved} /> : null}
      </Sheet>
    </Card>
  );
}
