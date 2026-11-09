/**
 * 시작하기 (MY 맨 위): 필수 3개(목적 · 운동 일정 · 몸 정보 → 오늘 운동 + 영양 목표)와
 * 더 정확하게 2개(할 수 있는 운동 · 운동 방식). 각각 시트, 미리 고른 값 없음.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, NumField, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { knownExercises } from '@/lib/ability';
import { latestBodyComp } from '@/lib/profile';
import { FocusPicker } from '@/components/focus-picker';
import { GearPicker } from '@/components/gear-picker';
import { budgetMin, dirOf, focusOf, legacyGoal, primary, type Focus, type WeightDir } from '@/lib/focus';
import { gearOf, type Gear } from '@/lib/gear';
import { applyGoal, applyMode, applySchedule, needsChoice, startRows, type StartKey } from '@/lib/start';
import type { Profile } from '@/lib/types';
import { live, newId, useData } from '@/store/store';


function GoalSheet({ onDone }: { onDone: () => void }) {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const p = s.profile;
  const [focus, setFocus] = useState<Focus>(focusOf(p));
  const [dir, setDir] = useState<WeightDir | null>(p.goal ? dirOf(p) : null);
  const [years, setYears] = useState<Profile['years']>(p.years ?? '');
  const goal = legacyGoal(focus, dir);
  const ok = !!primary(focus) && !!dir;
  return (
    <>
      <T v="small">챙기고 싶은 만큼 탭해서 채워요. 하나만 채워도 되고, 여러 개를 섞어도 돼요.</T>
      <FocusPicker focus={focus} dir={dir} budget={budgetMin(p)} onChange={(f, d) => { setFocus(f); setDir(d); }} />
      <View style={{ gap: 6 }}><T>웨이트 경력 <T v="small">(선택)</T></T>
        <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]} value={years || null} onChange={(v) => setYears((v ?? '') as Profile['years'])} />
      </View>
      <Button label={ok ? '저장' : !primary(focus) ? '하나 이상 채워 주세요' : '체중 방향을 골라 주세요'} kind="primary" disabled={!ok}
        onPress={() => { if (ok && goal) { update(applyGoal(s, { goal, years, focus, weightDir: dir })); onDone(); } }} />
    </>
  );
}

function ScheduleSheet({ onDone }: { onDone: () => void }) {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const p = s.profile;
  const [days, setDays] = useState<number | null>(p.days ?? null);
  const [min, setMin] = useState<number | null>(p.sessionMin ?? null);
  const [gear, setGear] = useState<Gear[] | null>(gearOf(p) ?? null);
  return (
    <>
      <View style={{ gap: 6 }}><T>주 몇 번 운동해요?</T>
        <Segmented options={[2, 3, 4, 5, 6].map((n) => ({ v: String(n), n: `${n}일` }))} value={days ? String(days) : null} onChange={(v) => setDays(v ? Number(v) : null)} />
      </View>
      <View style={{ gap: 6 }}><T>한 번에 몇 분? <T v="small">(선택)</T></T>
        <Segmented options={[45, 60, 75, 90].map((n) => ({ v: String(n), n: `${n}분` }))} value={min ? String(min) : null} onChange={(v) => setMin(v ? Number(v) : null)} />
      </View>
      <View style={{ gap: 6 }}><T>쓸 수 있는 장비</T>
        <GearPicker value={gear} onChange={setGear} />
      </View>
      <Button label="저장" kind="primary" disabled={days == null || gear == null} onPress={() => {
        update(applySchedule(s, { days, sessionMin: min, gear })); onDone();
      }} />
    </>
  );
}

/** 몸 정보: 나이 · 키 · 체중(필수) + 성별(선택) → 칼로리·단백질 목표 */
function BodySheet({ onDone, inbodyWeight }: { onDone: () => void; inbodyWeight: number | null }) {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const p = s.profile;
  const [age, setAge] = useState<number | null>(p.age ?? null);
  const [height, setHeight] = useState<number | null>(p.height ?? null);
  const [weight, setWeight] = useState<number | null>(p.weight ?? inbodyWeight ?? null);
  const [sex, setSex] = useState<Profile['sex']>(p.sex ?? '');
  const ok = !!age && !!height && !!weight;
  return (
    <>
      <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
        <NumField label="나이" value={age} onCommit={setAge} style={{ flex: 1 }} />
        <NumField label="키 cm" value={height} decimal onCommit={setHeight} style={{ flex: 1 }} />
        <NumField label="체중 kg" value={weight} decimal onCommit={setWeight} style={{ flex: 1 }} />
      </Row>
      {inbodyWeight && !p.weight ? <T v="small">체중은 최근 인바디 값이에요.</T> : null}
      <View style={{ gap: 6 }}><T>성별 <T v="small">(선택 · 기초대사 계산이 더 정확해져요)</T></T>
        <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={sex || null} onChange={(v) => setSex((v ?? '') as Profile['sex'])} />
      </View>
      <T v="small">체지방률이나 인바디는 MY → 신체 정보에서 더 넣을 수 있어요.</T>
      <Button label="저장" kind="primary" disabled={!ok} onPress={() => {
        update({ profile: { ...p, age, height, weight, sex } }); onDone();
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

const TITLE: Record<Exclude<StartKey, 'ability'>, string> = { goal: '목적', schedule: '운동 일정·장비', body: '몸 정보', mode: '운동 방식' };

export function StartCard() {
  const c = usePalette();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const bodyT = useData((x) => x.bodyComps);
  const update = useData((x) => x.updateSettings);
  const [open, setOpen] = useState<Exclude<StartKey, 'ability'> | null>(null);
  const inbodyWeight = latestBodyComp(live(bodyT))?.weight ?? null;
  const rows = startRows(s, inbodyWeight);
  const need = rows.filter((r) => r.required);
  const more = rows.filter((r) => !r.required);
  const needDone = need.filter((r) => r.done).length;
  const close = () => setOpen(null);
  const saved = () => { toast('저장했어요'); close(); };

  const row = (r: (typeof rows)[number]) => (
    <Pressable key={r.key} accessibilityRole="button" accessibilityLabel={`${r.title} ${r.done ? r.summary : '미입력'}`}
      onPress={() => (r.key === 'ability' ? router.push('/ability') : setOpen(r.key))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 10, borderTopWidth: 1, borderColor: c.line }}>
      <Text style={{ fontSize: 18, color: r.done ? c.ok : c.muted }}>{r.done ? '✓' : '○'}</Text>
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: r.done ? '400' : '600' }}>{r.title}</T>
        <T v="small" style={{ color: r.done ? c.muted : c.accent }}>→ {r.makes}</T>
      </View>
      <T v="small" style={{ color: r.done ? c.ink : c.muted, maxWidth: '45%' }} numberOfLines={1}>{r.done ? r.summary : '미입력'}</T>
      <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
    </Pressable>
  );

  return (
    <Card style={{ gap: 0, borderColor: c.accent, borderWidth: 1.5 }}>
      <Row style={{ justifyContent: 'space-between', paddingBottom: Space.sm }}>
        <T v="title" style={{ fontSize: 17 }}>시작하기</T>
        <T v="small">필수 {needDone}/{need.length}</T>
      </Row>
      <T v="small" style={{ paddingBottom: Space.sm }}>
        {needDone === need.length ? '기본 루틴이 만들어졌어요. 아래 둘은 고르면 추천이 더 잘 맞아요.'
          : '필수 3개를 고르면 오늘 운동과 영양 목표가 모두 만들어져요. 미리 정해 둔 기본값은 없어요.'}
      </T>
      {need.map(row)}
      <T v="label" style={{ paddingTop: Space.md, paddingBottom: 4 }}>더 정확하게 (선택)</T>
      {more.map(row)}
      {needsChoice(s) ? null : (
        <Row style={{ justifyContent: 'flex-end', paddingTop: Space.sm }}>
          <Button label="나중에 하기" kind="ghost" onPress={() => { update({ start: { ...(s.start ?? {}), skipped: true } }); router.navigate('/'); }} />
        </Row>
      )}
      <Sheet open={!!open} title={open ? TITLE[open] : ''} onClose={close}>
        {open === 'goal' ? <GoalSheet onDone={saved} /> : null}
        {open === 'schedule' ? <ScheduleSheet onDone={saved} /> : null}
        {open === 'body' ? <BodySheet onDone={saved} inbodyWeight={inbodyWeight} /> : null}
        {open === 'mode' ? <ModeSheet onDone={saved} /> : null}
      </Sheet>
    </Card>
  );
}
