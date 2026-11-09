import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Disclosure, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Meter, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { addDays, today } from '@/lib/dates';
import { budgetMin, dirOf, focusOf, legacyGoal } from '@/lib/focus';
import { PRIORITY_NAME, PRIORITY_NOTE, defaultPriority, floorFor, leadText, priorityOptions, programFor, withFloor, type Priority } from '@/lib/target';
import { SESSION_NAME, buildProgram, feasibility, type StrengthProgram } from '@/lib/progression';
import { MAIN_LIFTS, RATIOS, SHORT, estimateFor, roundFor, type MainLift } from '@/lib/strength';
import { library } from '@/lib/exercises';
import { useData } from '@/store/store';
import { useProgram, useStrengthTable } from '@/store/strength';

const r25 = (x: number) => Math.round(x / 2.5) * 2.5;
const fmtDate = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

/** 중량 프로그램: one main lift toward a target 1RM, plus what each lift implies for related exercises. */
export default function Program() {
  const c = usePalette();
  const toast = useToast();
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const table = useStrengthTable();
  const state = useProgram();
  const overrides = settings.oneRm ?? {};

  const [lift, setLift] = useState<MainLift>('바벨 벤치프레스');
  const est = estimateFor(lift, table, overrides);
  const [cur, setCur] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  // 기한 (weeks from today) and how the goal shares the week with the polygon
  const [weeks, setWeeks] = useState(12);
  const [pick, setPick] = useState<Priority | null>(null);
  const priority = pick ?? defaultPriority(weeks);
  const start1rm = cur ?? (est ? r25(est.e1rm) : null);
  const goal = target ?? (start1rm ? r25(start1rm * 1.05) : null);
  const p = settings.profile;
  const deadline = addDays(today(), weeks * 7);
  const opts = start1rm && goal && goal > start1rm
    ? priorityOptions({ focus: focusOf(p), budget: budgetMin(p), years: p.years, start1rm, target1rm: goal, deadlineWeeks: weeks }) : null;
  const chosen = opts?.find((o) => o.priority === priority) ?? null;
  // plenty of time: the three ways come out the same, so there's nothing to choose
  const same = !!opts && opts.every((o) => o.perWeek === opts[0].perWeek && o.focusMin === opts[0].focusMin);

  const draft: StrengthProgram | null = start1rm && goal && chosen
    ? programFor(chosen, { lift, start: today(), start1rm, target1rm: goal }, deadline, weeks) : null;
  const plan = useMemo(() => (draft ? buildProgram(draft) : []), [draft?.lift, draft?.start1rm, draft?.target1rm, draft?.weeks, draft?.perWeek]); // eslint-disable-line react-hooks/exhaustive-deps
  const feas = draft ? feasibility(draft) : null;

  const setOneRm = (name: string, v: number | null) => {
    const next = { ...overrides };
    if (v) next[name] = v; else delete next[name];
    update({ oneRm: next });
  };

  const weekRows = (p: StrengthProgram, sessions = buildProgram(p)) => {
    const byWeek = new Map<number, typeof sessions>();
    for (const s of sessions) byWeek.set(s.week, [...(byWeek.get(s.week) ?? []), s]);
    return [...byWeek.entries()].map(([w, ss]) => (
      <Row key={w} style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderColor: c.line, flexWrap: 'nowrap' }}>
        <T v="muted" style={{ width: 44 }}>{w}주</T>
        <T style={{ flex: 1, textAlign: 'right' }}>
          {ss.map((s) => (s.kind === 'test' ? `테스트 ${r25(s.expected1rm)}kg` : `${SESSION_NAME[s.kind]} ${s.sets}×${s.reps} ${r25(s.expected1rm * s.pct)}kg`)).join(' · ')}
        </T>
      </Row>
    ));
  };

  return (
    <Page>
      {state ? (
        <>
          <Card style={{ gap: Space.sm }}>
            <T v="small">{SHORT[state.program.lift]} · {state.program.weeks}주 · 주 {state.program.perWeek}회{state.program.priority ? ` · ${PRIORITY_NAME[state.program.priority]}` : ''}{state.program.deadline ? ` · 기한 ${fmtDate(state.program.deadline)}` : ''}</T>
            <T v="big" style={{ fontSize: 30, lineHeight: 36 }}>{state.program.start1rm} → {state.program.target1rm}kg</T>
            <Meter pct={state.next ? (state.next.doneCount / state.next.total) * 100 : 100} color={c.accent} />
            <T v="small">{state.next ? `${state.next.doneCount}/${state.next.total}회 완료 · ${state.next.session.week}주차` : '프로그램 완료'}</T>
          </Card>
          {state.next ? (
            <Card style={{ gap: 4 }}>
              <T v="muted">다음 {state.due ? '· 회복되면 오늘 할 일에 들어가요' : state.doneToday ? '· 오늘은 했어요' : '· 쉬고 다음에'}</T>
              <T v="title">{SESSION_NAME[state.next.session.kind]} {state.next.sets}×{state.next.reps} · {state.next.kg}kg</T>
              {state.next.session.note ? <T v="small">{state.next.session.note}</T> : null}
            </Card>
          ) : null}
          {state.done.length ? (
            <View>
              <T v="label">한 날</T>
              {state.done.slice(-6).reverse().map((d) => (
                <Row key={d.date} style={{ justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: c.line }}>
                  <T v="muted">{d.date.slice(5).replace('-', '/')}</T>
                  <T>{d.hit ? '목표 달성' : '못 채움'}</T>
                  <T v="num" style={{ fontSize: 15 }}>{d.best1rm ? `추정 1RM ${Math.round(d.best1rm)}kg` : '–'}</T>
                </Row>
              ))}
            </View>
          ) : null}
          <Disclosure title="주차별 계획" meta={`${state.program.weeks}주`}>{weekRows(state.program)}</Disclosure>
          <ConfirmButton label="프로그램 그만두기" onConfirm={() => { update({ program: null }); toast('프로그램을 껐어요'); }} style={{ alignSelf: 'center' }} />
        </>
      ) : (
        <>
          <Card style={{ gap: Space.md }}>
            <Pills options={MAIN_LIFTS.map((k) => ({ k, n: SHORT[k] }))} value={lift} onToggle={(k) => { setLift(k); setCur(null); setTarget(null); }} />
            <T v="small">{est ? (est.source === 'own'
              ? `기록 기준 추정 1RM ${Math.round(est.e1rm)}kg${table.get(lift) ? ` (${table.get(lift)!.date.slice(5).replace('-', '/')} ${table.get(lift)!.kg}kg×${table.get(lift)!.reps})` : ''}`
              : `${SHORT[est.from!]} 기준 추정 ${Math.round(est.e1rm)}kg`) : '기록이 없어요. 현재 1RM을 입력하세요'}</T>
            <Row gap={Space.md}>
              <NumField label="현재 1RM (kg)" value={start1rm} onCommit={setCur} decimal />
              <NumField label="목표 (kg)" value={goal} onCommit={setTarget} decimal />
            </Row>
            <View style={{ gap: 6 }}>
              <T v="muted">기한 · {fmtDate(deadline)}까지</T>
              <Segmented options={[6, 8, 12, 16, 24].map((w) => ({ v: String(w), n: `${w}주` }))} value={String(weeks)} onChange={(v) => v && setWeeks(Number(v))} />
            </View>
            {feas ? (
              <T v="small" style={{ color: feas.level === 'ok' ? c.ok : feas.level === 'hard' ? c.warn : c.bad }}>
                월 +{feas.perMonthPct.toFixed(1)}% · {feas.level === 'ok' ? '현실적인 목표' : feas.level === 'hard' ? '빠듯해요' : '이 기간엔 어려워요'}
              </T>
            ) : null}
            {opts ? (
              <View style={{ gap: 6 }}>
                <T v="muted">목표와 평소 운동(다각형) 중 먼저 챙길 것</T>
                {same ? (
                  <View style={{ padding: Space.md, borderRadius: 10, backgroundColor: c.okSoft, gap: 2 }}>
                    <T style={{ fontWeight: '700', color: c.ok }}>일정에 둘 다 들어가요 · {opts[0].onTime ? '기한 안에' : `약 ${opts[0].weeks}주`}</T>
                    <T v="small">주 {opts[0].perWeek}회 ({opts[0].goalMin}분){opts[0].lead ? ` · 평소 운동 ${opts[0].focusMin}분 → ${leadText(opts[0])}` : ''}. 시간이 부족해지면 {PRIORITY_NAME[priority]}으로 나눠요.</T>
                  </View>
                ) : opts.filter((o, i) => !opts.slice(0, i).some((e) => e.perWeek === o.perWeek && e.focusMin === o.focusMin)).map((o) => {
                  // identical outcomes are shown once, under both names
                  const twins = opts.filter((e) => e !== o && e.perWeek === o.perWeek && e.focusMin === o.focusMin);
                  const sel = o.priority === priority || twins.some((t) => t.priority === priority);
                  return (
                    <Pressable key={o.priority} accessibilityRole="radio" accessibilityState={{ checked: sel }} onPress={() => setPick(o.priority)}
                      style={{ padding: Space.md, borderRadius: 10, borderWidth: sel ? 2 : 1, borderColor: sel ? c.accent : c.line, backgroundColor: sel ? c.accentSoft : c.surface, gap: 2 }}>
                      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                        <T style={{ fontWeight: '800', color: sel ? c.accent : c.ink }}>{[o, ...twins].map((x) => PRIORITY_NAME[x.priority]).join(' = ')}{[o, ...twins].some((x) => x.priority === defaultPriority(weeks)) ? ' · 추천' : ''}</T>
                        <T v="small" style={{ fontWeight: '700', color: o.onTime ? c.ok : c.warn }}>{o.onTime ? '기한 안에' : `약 ${o.weeks}주`}</T>
                      </Row>
                      <T v="small">주 {o.perWeek}회 ({o.goalMin}분){o.lead ? ` · 평소 운동 ${o.focusMin}분 → ${leadText(o)}` : ''}</T>
                      {sel ? <T v="small">{PRIORITY_NOTE[o.priority]}</T> : null}
                      {o.tooTight ? <T v="small" style={{ color: c.bad }}>유지량만으로도 일정이 넘쳐요. 운동 일정을 늘리거나 다각형 축을 줄여 주세요.</T> : null}
                    </Pressable>
                  );
                })}
                {opts[0] && !opts[0].onTime ? (
                  <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <T v="small" style={{ color: c.warn, flexShrink: 1 }}>주 3회로도 {weeks}주 안엔 어려워요 (약 {opts[0].weeks}주).</T>
                    {opts[0].weeks <= 24 ? <Button label={`기한 ${[16, 24].find((w) => w >= opts[0].weeks) ?? 24}주로`} kind="ghost" onPress={() => setWeeks([16, 24].find((w) => w >= opts[0].weeks) ?? 24)} /> : null}
                  </Row>
                ) : null}
                <T v="small">어느 쪽이든 유지량은 지켜요: 다각형에서 고른 축은 최소 1단계, 목표는 최소 주 1회. 근력 축은 {priority === 'focus' ? '1' : '2'}단계 아래로 안 내려가요.</T>
              </View>
            ) : null}
            <Button label="목표 시작" kind="primary" disabled={!draft} onPress={() => {
              if (!draft) return;
              const focus = withFloor(focusOf(p), floorFor(priority));
              update({ program: draft, profile: { ...p, focus, goal: legacyGoal(focus, dirOf(p)) || p.goal } });
              toast('오늘 할 일에 목표 운동이 들어가요');
              router.back();
            }} />
          </Card>
          {draft ? <Disclosure title="주차별 계획 미리보기" meta={`${plan.length}회`}>{weekRows(draft, plan)}</Disclosure> : null}
        </>
      )}

      <Disclosure title="내 1RM과 연관 운동">
        <View style={{ gap: Space.md }}>
          {MAIN_LIFTS.map((m) => {
            const e = estimateFor(m, table, overrides);
            const related = Object.entries(RATIOS).filter(([, v]) => v.from === m).slice(0, 5);
            return (
              <View key={m} style={{ gap: 4 }}>
                <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
                  <NumField label={`${SHORT[m]} 1RM${overrides[m] ? ' (직접 입력)' : e?.source === 'derived' ? ' (추정)' : ''}`} value={e ? Math.round(e.e1rm) : null}
                    onCommit={(v) => setOneRm(m, v)} decimal />
                </Row>
                {e ? (
                  <T v="small">{related.map(([n, v]) => `${n} ${roundFor(library(settings.customExercises).find((x) => x.n === n), e.e1rm * v.r)}kg`).join(' · ')}</T>
                ) : null}
              </View>
            );
          })}
          <T v="small">연관 운동은 1RM 기준 비율(덤벨은 한 손)이에요. 그 운동을 직접 기록하면 기록 값을 써요.</T>
        </View>
      </Disclosure>
    </Page>
  );
}
