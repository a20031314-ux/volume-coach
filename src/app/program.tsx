import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Disclosure, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Meter, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { today } from '@/lib/dates';
import { SESSION_NAME, buildProgram, feasibility, type StrengthProgram } from '@/lib/progression';
import { MAIN_LIFTS, RATIOS, SHORT, estimateFor, roundFor, type MainLift } from '@/lib/strength';
import { library } from '@/lib/exercises';
import { useData } from '@/store/store';
import { useProgram, useStrengthTable } from '@/store/strength';

const r25 = (x: number) => Math.round(x / 2.5) * 2.5;

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
  const [weeks, setWeeks] = useState(8);
  const [perWeek, setPerWeek] = useState<1 | 2 | 3>(2);
  const start1rm = cur ?? (est ? r25(est.e1rm) : null);
  const goal = target ?? (start1rm ? r25(start1rm * 1.05) : null);

  const draft: StrengthProgram | null = start1rm && goal && goal > start1rm
    ? { lift, start: today(), start1rm, target1rm: goal, weeks, perWeek } : null;
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
            <T v="small">{SHORT[state.program.lift]} · {state.program.weeks}주 · 주 {state.program.perWeek}회</T>
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
            <Segmented options={[6, 8, 12, 16].map((w) => ({ v: String(w), n: `${w}주` }))} value={String(weeks)} onChange={(v) => v && setWeeks(Number(v))} />
            <Segmented options={[1, 2, 3].map((n) => ({ v: String(n), n: `주 ${n}회` }))} value={String(perWeek)} onChange={(v) => v && setPerWeek(Number(v) as 1 | 2 | 3)} />
            {feas ? (
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <T v="small" style={{ flexShrink: 1, color: feas.level === 'ok' ? c.ok : feas.level === 'hard' ? c.warn : c.bad }}>
                  월 +{feas.perMonthPct.toFixed(1)}% · {feas.level === 'ok' ? '현실적인 목표' : feas.level === 'hard' ? '빠듯해요' : '이 기간엔 어려워요'}
                </T>
                {feas.level !== 'ok' ? <Button label={`${Math.min(24, feas.weeksFor(2.5))}주로`} kind="ghost" onPress={() => setWeeks(Math.min(24, feas.weeksFor(2.5)))} /> : null}
              </Row>
            ) : null}
            <Button label="프로그램 시작" kind="primary" disabled={!draft} onPress={() => {
              if (!draft) return;
              update({ program: { ...draft, startAt: Date.now() } });
              toast('오늘 할 일에 프로그램 운동이 들어가요');
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
