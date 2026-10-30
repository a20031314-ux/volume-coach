import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Disclosure, Sheet } from '@/components/layout';
import { LogSheet, type LogDraft } from '@/components/log-sheet';
import { HintRow, PlanView, minutesFor, type PlanItem } from '@/components/plan-view';
import { tiredText, useRoutinePlan } from '@/components/routine-today';
import { useToast } from '@/components/toast';
import { Button, Meter, Pills, Row, Screen, Segmented, T, toneColor } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useCoach } from '@/hooks/use-coach';
import { useNow } from '@/hooks/use-now';
import { abilityHints, knownExercises } from '@/lib/ability';
import { buildPlan, deloadHint, suggestExercises } from '@/lib/coach';
import { dow, fmt } from '@/lib/dates';
import { MUSCLES } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import { selectActiveSession, startSession } from '@/store/session-actions';
import { live, useData } from '@/store/store';

/** short body-region names for the title */
const GROUP: Record<(typeof MUSCLES)[number]['k'], string> = {
  chest: '가슴', back: '등', shoulder: '어깨', quad: '하체', ham: '하체', calf: '하체', bi: '팔', tri: '팔', abs: '복근',
};

export default function Today() {
  const c = usePalette();
  const toast = useToast();
  const now = useNow();
  const { input, result } = useCoach(now);
  const settings = input.settings;
  const logs = useData((s) => s.logs);
  const sessionsT = useData((s) => s.sessions);
  const checkin = useData((s) => s.checkins[result.T]);
  const setCheckin = useData((s) => s.setCheckin);
  const updateSettings = useData((s) => s.updateSettings);
  const running = useData(selectActiveSession);
  const routineRec = useData((s) => (s.settings.activeRoutineId ? s.routines[s.settings.activeRoutineId] : undefined));
  const routine = settings.planMode === 'routine' && routineRec && !routineRec.deleted ? routineRec : null;

  const [swaps, setSwaps] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<LogDraft | null>(null);
  const [sheet, setSheet] = useState(false);
  const [dayOverride, setDayOverride] = useState<number | null>(null);

  const ck = settings.checkin;
  const rd = result.readiness;
  const plan = useMemo(() => buildPlan(result, live(logs)), [result, logs]);
  const known = useMemo(() => knownExercises(live(logs)), [logs]);
  const rp = useRoutinePlan(routine, result, dayOverride);
  const hints = useMemo(() => abilityHints(settings, live(sessionsT), now.getTime()), [settings, sessionsT, now]);
  const deload = useMemo(() => deloadHint(result, input), [result, input]);
  const doneToday = live(logs).filter((l) => l.date === result.T).reduce((a, l) => a + l.sets, 0);
  const sore = checkin?.sore ?? [];
  const adjusted = rd.factor < 1 || sore.length > 0;

  /* ---------- what to do today ---------- */
  let title: string, items: PlanItem[], notice: Parameters<typeof PlanView>[0]['notice'] = null;
  let startList: { name: string; muscle: (typeof MUSCLES)[number]['k']; sets: number }[];
  if (routine) {
    const d = rp.day;
    title = d ? d.name : '쉬는 날';
    items = (d?.exercises ?? []).map((e, i) => ({
      key: `${e.name}-${i}`, name: e.name, muscle: e.muscle, sets: rp.adj(e.sets), recovery: rp.recovery[e.muscle] ?? 100,
      detail: repRange(e.name, settings.profile),
      onLog: () => setDraft({ exercise: e.name, muscle: e.muscle, sets: rp.adj(e.sets) }),
    }));
    startList = items.map((it) => ({ name: it.name, muscle: it.muscle, sets: it.sets }));
    if (d && rp.tired.length) {
      notice = rp.alt != null
        ? { text: `${tiredText(rp.tired)} 회복 중`, action: `${routine.days[rp.alt].name} 먼저`, onPress: () => setDayOverride(rp.alt) }
        : { text: `${tiredText(rp.tired)} 회복 중 · 세트를 줄여도 좋아요` };
    }
  } else {
    const groups = [...new Set(plan.plan.map((s) => GROUP[s.k]))];
    title = groups.length ? groups.join(' · ') : '오늘은 쉬어도 돼요';
    items = plan.plan.flatMap((s) => suggestExercises(s, result, settings, swaps, known).map((e) => ({
      key: `${s.k}:${e.slot}`, name: e.name, muscle: s.k, sets: e.sets, recovery: s.recPre,
      tag: s.mode === 'light' ? '가볍게' : undefined,
      detail: `${repRange(e.name, settings.profile)} · 이번 주 ${Math.round(s.done)}/${result.min}세트`,
      onSwap: () => setSwaps((w) => ({ ...w, [`${s.k}:${e.slot}`]: (w[`${s.k}:${e.slot}`] || 0) + 1 })),
      onLog: () => setDraft({ exercise: e.name, muscle: s.k, sets: e.sets }),
    })));
    startList = items.map((it) => ({ name: it.name, muscle: it.muscle, sets: it.sets }));
  }
  const totalSets = items.reduce((a, it) => a + it.sets, 0);
  const meta = [
    routine ? rp.label : null,
    items.length ? `${items.length}개 · ${totalSets}세트 · 약 ${minutesFor(totalSets)}분` : null,
    doneToday ? `오늘 ${doneToday}세트 완료` : null,
    adjusted && !notice ? '컨디션 반영' : null,
  ].filter(Boolean).join(' · ');

  const start = running
    ? { label: '이어서 하기', onPress: () => router.push({ pathname: '/session', params: { id: running.id } }) }
    : {
        label: items.length ? '운동 시작' : '빈 운동으로 시작',
        onPress: () => {
          const sid = startSession(startList, settings.session.detail, routine && rp.day ? { routineId: routine.id, dayKey: rp.day.key } : undefined);
          setDayOverride(null);
          router.push({ pathname: '/session', params: { id: sid } });
        },
      };

  const hint = deload
    ? { key: `deload:${result.W}`, text: deload, action: '디로드 켜기', run: () => updateSettings({ deload: true }) }
    : hints[0]
      ? { key: hints[0].key, text: hints[0].text, action: hints[0].action.label, run: () => {
          const a = hints[0].action;
          if ('route' in a) router.push(a.route as '/ability');
          else { updateSettings({ ...a.patch, dismissed: [...settings.dismissed, hints[0].key] }); toast('반영했어요'); }
        } }
      : null;
  const showHint = hint && !settings.dismissed.includes(hint.key);

  return (
    <Screen title="오늘" sub={fmt(result.T)}
      right={<Button label={adjusted ? '조정 •' : '조정'} kind="ghost" onPress={() => setSheet(true)} accessibilityLabel="오늘 조정" />}>
      <PlanView title={title} meta={meta} notice={notice} start={start} items={items} ready={settings.ready}
        empty={routine ? undefined : '이번 주 목표를 채웠거나 남은 부위가 회복 중이에요.'} />

      {showHint && hint ? (
        <HintRow text={hint.text} action={hint.action} onAction={hint.run}
          onDismiss={() => updateSettings({ dismissed: [...settings.dismissed, hint.key] })} />
      ) : null}

      <Disclosure title="부위별 회복도">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {result.stats.map((s) => (
            <View key={s.k} style={{ flexBasis: '31%', flexGrow: 1, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 8, gap: 3 }}>
              <T v="small" numberOfLines={1}>{s.n}</T>
              <T v="num">{s.recNow}%</T>
              <Meter pct={s.recNow} color={toneColor(c, s.recNow, settings.ready)} height={4} />
              {s.mode === 'rest' && s.nextOK && s.nextOK !== result.T ? <T v="small">{dow(s.nextOK)}부터</T> : null}
            </View>
          ))}
        </View>
      </Disclosure>

      <Sheet open={sheet} title="오늘 조정" onClose={() => setSheet(false)}>
        {ck.sleep || ck.energy || ck.sore ? (
          <View style={{ gap: Space.md }}>
            {ck.sleep ? (
              <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
                <T v="muted" style={{ width: 52 }}>수면</T>
                <Segmented options={[{ v: 0, n: '부족' }, { v: 1, n: '보통' }, { v: 2, n: '충분' }]} value={checkin?.sleep ?? null}
                  onChange={(v) => setCheckin(result.T, { sleep: v as 0 | 1 | 2 | null })} />
              </Row>
            ) : null}
            {ck.energy ? (
              <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
                <T v="muted" style={{ width: 52 }}>컨디션</T>
                <Segmented options={[{ v: 0, n: '처짐' }, { v: 1, n: '보통' }, { v: 2, n: '좋음' }]} value={checkin?.energy ?? null}
                  onChange={(v) => setCheckin(result.T, { energy: v as 0 | 1 | 2 | null })} />
              </Row>
            ) : null}
            {ck.sore ? (
              <View style={{ gap: 6 }}>
                <T v="muted">근육통</T>
                <Pills danger options={MUSCLES.filter((m) => !settings.off.includes(m.k))} value={sore}
                  onToggle={(k) => setCheckin(result.T, { sore: sore.includes(k) ? sore.filter((x) => x !== k) : [...sore, k] })} />
              </View>
            ) : null}
            {rd.why.length ? <T v="small">{rd.why.join(' · ')} → 오늘 최대 {rd.cap}세트</T> : null}
          </View>
        ) : null}

        {routine ? (
          <View style={{ gap: 6 }}>
            <T v="muted">다른 날 하기</T>
            <Pills options={routine.days.map((d, i) => ({ k: String(i), n: d.name }))} value={rp.index >= 0 ? String(rp.index) : null}
              onToggle={(k) => { setDayOverride(Number(k)); setSheet(false); }} />
          </View>
        ) : plan.later.length ? (
          <View style={{ gap: 6 }}>
            <T v="muted">더 하고 싶다면</T>
            <Pills options={plan.later.map((s) => ({ k: s.k, n: `${s.n} +${s.remaining}` }))} value={null}
              onToggle={(k) => { setSheet(false); router.navigate({ pathname: '/log', params: { muscle: k } }); }} />
          </View>
        ) : null}

        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <T v="muted" style={{ flexShrink: 1 }}>{routine ? `루틴 · ${routine.name}` : '자율형 추천'}</T>
          <Button label="운동 방식" onPress={() => { setSheet(false); router.push('/routine'); }} />
        </Row>
      </Sheet>

      <LogSheet draft={draft} onClose={() => setDraft(null)} onSaved={toast} />
    </Screen>
  );
}
