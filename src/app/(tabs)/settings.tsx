/**
 * MY: the big picture on top (goal, weekly trends — tap a card for details), settings below.
 * Trends are weekly so day-to-day noise doesn't hide the direction (docs/coach-plan.md 5절).
 */
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Group, ListRow, Sheet } from '@/components/layout';
import { DetailRow, Spark, TrendCard, type Tone } from '@/components/trend-card';
import { Button, Card, Row, Screen, Segmented, T } from '@/components/ui';
import { WeekView } from '@/components/week-view';
import { Space, usePalette } from '@/constants/theme';
import { HEALTH_NAME } from '@/health/steps';
import { useHealth } from '@/health/use-steps';
import { DOW, today } from '@/lib/dates';
import { dayTarget } from '@/lib/day-target';
import { MUSCLE_NAME } from '@/lib/exercises';
import { hhmm } from '@/lib/meal-plan';
import { bodySource, latestBodyComp } from '@/lib/profile';
import { SHORT } from '@/lib/strength';
import { slope, weeklyTrends } from '@/lib/trends';
import type { Goal } from '@/lib/types';
import { StartCard } from '@/components/start-card';
import { useToast } from '@/components/toast';
import { restart, startVisible } from '@/lib/start';
import { useAuth } from '@/store/auth';
import { live, useData } from '@/store/store';

const GOAL: Record<Goal | '', string> = { hyp: '근비대', str: '근력', cut: '감량', fit: '건강', '': '목적 미입력' };
const PERIODS = [{ v: '4', n: '4주' }, { v: '12', n: '12주' }, { v: '26', n: '6개월' }];
type CardKey = 'body' | 'lift' | 'vol' | 'food';
/** which card leads, by goal */
const ORDER: Record<Goal, CardKey[]> = {
  cut: ['body', 'food', 'lift', 'vol'],
  str: ['lift', 'vol', 'body', 'food'],
  hyp: ['vol', 'lift', 'body', 'food'],
  fit: ['vol', 'body', 'food', 'lift'],
};
const sign = (n: number, d = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(d)}`;

export default function MyScreen() {
  const c = usePalette();
  const auth = useAuth();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const toast = useToast();
  const bodyT = useData((x) => x.bodyComps);
  const logsT = useData((x) => x.logs);
  const sessionsT = useData((x) => x.sessions);
  const mealsT = useData((x) => x.meals);
  const routine = useData((x) => (x.settings.activeRoutineId ? x.routines[x.settings.activeRoutineId] : undefined));
  const health = useHealth((x) => x.enabled);
  const [weeks, setWeeks] = useState(12);
  const [weekSheet, setWeekSheet] = useState(false);
  const p = s.profile;
  const d0 = today();

  const bodyValue = useMemo(() => {
    const comps = live(bodyT);
    const src = bodySource(p, comps);
    const latest = latestBodyComp(comps);
    if (src === 'inbody') return latest ? `인바디 · ${latest.weight}kg` : '인바디 · 기록 없음';
    return p.weight ? `직접 입력 · ${p.weight}kg` : '직접 입력';
  }, [bodyT, p]);
  const marks = Object.keys(s.exercisePrefs).length;
  const mode = s.planMode === 'routine' && routine && !routine.deleted ? routine.name : '자율형';

  const t = useMemo(() => dayTarget({ settings: s, comps: live(bodyT), logs: live(logsT), meals: live(mealsT) }, d0, d0), [s, bodyT, logsT, mealsT, d0]);
  const tr = useMemo(() => weeklyTrends({
    logs: live(logsT), sessions: live(sessionsT), meals: live(mealsT), comps: live(bodyT), off: s.off, min: s.min, max: s.max,
  }, d0, weeks), [logsT, sessionsT, mealsT, bodyT, s.off, s.min, s.max, d0, weeks]);

  /** the latest week that's over (this week is still going) */
  const lastFull = <T,>(v: T[]) => (v.length > 1 ? v[v.length - 2] : v[0]);

  const cards: Record<CardKey, React.ReactNode> = {
    body: (() => {
      const sl = slope(tr.weight);
      const w = [...tr.weight].reverse().find((v) => v != null) ?? p.weight ?? null;
      const pct = sl && w ? (sl.perWeek / w) * 100 : null;
      let status = '체중을 2주 이상 기록하면 추세가 보여요', tone: Tone = 'muted';
      if (pct != null) {
        const per = `주 ${sign(sl!.perWeek, 1)}kg`;
        if (p.goal === 'cut') [status, tone] = pct < -1 ? [`${per} · 너무 빨라요 (근손실 주의)`, 'warn'] : pct <= -0.2 ? [`${per} · 적정 속도`, 'ok'] : [`${per} · 거의 그대로`, 'warn'];
        else if (p.goal === 'hyp' || p.goal === 'str') [status, tone] = pct > 0.6 ? [`${per} · 빠르게 늘어요 (지방 주의)`, 'warn'] : [`${per}`, 'ok'];
        else [status, tone] = [per, Math.abs(pct) > 0.5 ? 'warn' : 'ok'];
      }
      const ffm = slope(tr.ffm);
      return (
        <TrendCard key="body" label="몸 · 체중" value={w != null ? String(w) : null} unit="kg" status={status} tone={tone} spark={<Spark values={tr.weight} />}>
          {sl ? <DetailRow label={`${weeks}주 변화`} value={`${sl.first} → ${sl.last}kg (${sign(sl.change, 1)})`} /> : null}
          {ffm ? <DetailRow label="제지방량 (인바디)" value={`${ffm.first} → ${ffm.last}kg (${sign(ffm.change, 1)})`} color={ffm.change < -0.5 ? c.warn : undefined} />
            : <DetailRow label="제지방량" value="인바디를 기록하면 보여요" />}
          <Button label="신체 정보 기록" onPress={() => router.push('/prefs/body')} style={{ alignSelf: 'flex-start' }} />
        </TrendCard>
      );
    })(),
    lift: (() => {
      const l = tr.lift;
      const sl = l ? slope(l.values) : null;
      const [status, tone]: [string, Tone] = !l ? ['주요 리프트(벤치·스쿼트·데드·오버헤드)를 kg×횟수로 기록하면 보여요', 'muted']
        : !sl ? ['한 주 더 기록하면 추세가 보여요', 'muted']
          : sl.change > 0 ? [`${weeks}주 ${sign(sl.change)}kg · 올라가는 중`, 'ok']
            : sl.change === 0 ? ['유지 중', p.goal === 'cut' ? 'ok' : 'muted']
              : [`${weeks}주 ${sign(sl.change)}kg${p.goal === 'cut' ? ' · 감량 중 하락, 단백질·적자 확인' : ' · 떨어지는 중'}`, 'warn'];
      return (
        <TrendCard key="lift" label={l ? `근력 · ${SHORT[l.name]} 추정 1RM` : '근력 · 추정 1RM'} value={sl ? String(sl.last) : null} unit="kg"
          status={status} tone={tone} spark={<Spark values={l?.values ?? []} />}>
          {tr.lifts.length ? tr.lifts.map((x) => (
            <DetailRow key={x.name} label={SHORT[x.name]} value={`${x.now}kg${x.change != null ? ` (${sign(x.change)})` : ''}`}
              color={x.change != null && x.change < 0 ? c.warn : undefined} />
          )) : <T v="small">세트별 기록이나 kg·횟수를 넣은 운동에서 계산해요.</T>}
          <Button label="중량 프로그램" onPress={() => router.push('/program')} style={{ alignSelf: 'flex-start' }} />
        </TrendCard>
      );
    })(),
    vol: (() => {
      const v = lastFull(tr.sets);
      const low = tr.lowMuscles, high = tr.highMuscles;
      const [status, tone]: [string, Tone] = v == null ? ['운동을 기록하면 보여요', 'muted']
        : low.length ? [`지난주 부족: ${low.slice(0, 3).map((m) => `${MUSCLE_NAME[m.k]} ${m.sets}`).join(' · ')}${low.length > 3 ? ` 외 ${low.length - 3}` : ''}`, 'warn']
          : ['지난주 모든 부위 범위 안', 'ok'];
      return (
        <TrendCard key="vol" label="운동량 · 부위당 주 세트 (평균)" value={v != null ? String(v) : null} unit="세트"
          status={status} tone={tone} spark={<Spark values={tr.sets} band={[s.min, s.max]} />}>
          <DetailRow label="목표 범위" value={`주 ${s.min}~${s.max}세트`} />
          {high.length ? <DetailRow label="많은 부위" value={high.map((m) => `${MUSCLE_NAME[m.k]} ${m.sets}`).join(' · ')} color={c.warn} /> : null}
          <Button label="이번 주 부위별 볼륨" onPress={() => setWeekSheet(true)} style={{ alignSelf: 'flex-start' }} />
        </TrendCard>
      );
    })(),
    food: (() => {
      const pr = lastFull(tr.protein), kc = lastFull(tr.kcal), days = lastFull(tr.mealDays);
      const pct = pr != null && t ? Math.round((pr / t.p) * 100) : null;
      const [status, tone]: [string, Tone] = pr == null ? ['음식을 기록하면 보여요', 'muted']
        : !t ? ['내 정보를 입력하면 목표와 비교해요', 'muted']
          : pct! >= 90 ? [`지난주 목표 ${t.p}g의 ${pct}%`, 'ok'] : [`지난주 목표 ${t.p}g의 ${pct}%`, 'warn'];
      return (
        <TrendCard key="food" label="영양 · 하루 단백질 (기록한 날 평균)" value={pr != null ? String(pr) : null} unit="g"
          status={status} tone={tone} spark={<Spark values={tr.protein} target={t?.p} />}>
          {kc != null ? <DetailRow label="칼로리 평균" value={`${kc.toLocaleString('ko-KR')}${t ? ` / ${t.kcal.toLocaleString('ko-KR')}` : ''}kcal`} /> : null}
          <DetailRow label="기록한 날" value={`지난주 ${days}일`} color={days < 4 ? c.warn : undefined} />
          <Button label="식습관 리포트" onPress={() => router.push('/diet-report')} style={{ alignSelf: 'flex-start' }} />
        </TrendCard>
      );
    })(),
  };

  return (
    <Screen title="MY">
      {!s.dismissed.includes('guide') ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/guide')}>
          <Card style={{ backgroundColor: c.accentSoft, borderColor: c.accentSoft, gap: 2 }}>
            <T v="title" style={{ fontSize: 15, color: c.accent }}>핵심 기능 둘러보기 ›</T>
            <T v="small">추천 · 기록 · 유산소 · 영양을 3분 안에</T>
          </Card>
        </Pressable>
      ) : null}

      {startVisible(s) ? <StartCard /> : null}

      {/* 목적 */}
      {startVisible(s) ? null : <Pressable accessibilityRole="button" accessibilityLabel="목표 바꾸기" onPress={() => router.push('/prefs/profile')}>
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="title" style={{ fontSize: 17 }}>{GOAL[p.goal]}{p.days ? ` · 주 ${p.days}일` : ''} · {mode}</T>
            <Text style={{ color: c.muted, fontSize: 18 }}>›</Text>
          </Row>
          <T v="small">주 {s.min}~{s.max}세트{t ? ` · ${t.base.toLocaleString('ko-KR')}kcal · 단백질 ${t.p}g` : ''}</T>
        </Card>
      </Pressable>}

      {/* 추세 */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: Space.sm }}>
        <T v="label">추세</T>
        <Segmented options={PERIODS} value={String(weeks)} onChange={(v) => v && setWeeks(Number(v))} />
      </Row>
      {ORDER[p.goal || 'hyp'].map((k) => cards[k])}

      {/* 설정 */}
      <Group title="운동">
        <ListRow label="운동 방식" value={mode} onPress={() => router.push('/routine')} />
        <ListRow label="중량 프로그램" value={s.program ? `${SHORT[s.program.lift]} → ${s.program.target1rm}kg` : '꺼짐'} onPress={() => router.push('/program')} />
        <ListRow label="할 수 있는 운동" value={s.ability.checked ? '체크 완료' : '체크 전'} onPress={() => router.push('/ability')} />
        <ListRow label="운동 목록" value={marks ? `표시 ${marks}개` : undefined} onPress={() => router.push('/exercises')} />
        <ListRow label="운동 규칙" value={`주 ${s.min}~${s.max}세트${s.deload ? ' · 디로드' : ''}`} onPress={() => router.push('/prefs/rules')} />
        <ListRow label="기록 방식" value={s.session.detail === 'set' ? '세트별' : '운동별'} onPress={() => router.push('/prefs/workout')} />
        <ListRow label="가이드 모드" value={s.guide?.on ? `켜짐${s.guide.only.length ? ` · ${s.guide.only.length}종목` : ''}${s.guide.rest ? '' : ' · 휴식 안내 끔'}` : '꺼짐'} onPress={() => router.push('/prefs/guide')} />
        <ListRow label="걸음 수" value={health ? HEALTH_NAME : '꺼짐'} onPress={() => router.push('/prefs/health')} last />
      </Group>

      <Group title="나">
        <ListRow label="내 정보" value={[p.age ? `${p.age}세` : null, GOAL[p.goal]].filter(Boolean).join(' · ')} onPress={() => router.push('/prefs/profile')} />
        <ListRow label="신체 정보" value={bodyValue} onPress={() => router.push('/prefs/body')} />
        <ListRow label="고정식단" value={s.fixed?.items.length ? `${s.fixed.items.length}개` : '없음'} onPress={() => router.push('/prefs/fixed')} />
        <ListRow label="치팅데이" value={s.cheat?.on ? (s.cheat.mode === 'weekly' ? `매주 ${DOW[s.cheat.dow]}요일` : s.cheat.date ?? '날짜 지정') : '꺼짐'} onPress={() => router.push('/prefs/cheat')} />
        <ListRow label="식단 추천" value={s.mealPlan.on ? s.mealPlan.times.map(hhmm).join(' · ') : '꺼짐'} onPress={() => router.push('/prefs/meal-plan')} last />
      </Group>

      <Group title="계정">
        {!auth.configured
          ? <ListRow label="이 기기에만 저장 중" last />
          : <ListRow label={auth.session ? auth.email ?? '계정' : '로그인 / 회원가입'} value={auth.session ? (auth.syncing ? '동기화 중' : '동기화됨') : undefined}
              onPress={() => router.push(auth.session ? '/prefs/account' : '/account')} last />}
      </Group>

      <Group title="앱">
        <ListRow label="기능 설명" onPress={() => router.push('/guide')} />
        <ListRow label="목적·일정 다시 고르기" onPress={() => { update(restart(s)); toast('맨 위 시작하기에서 다시 골라 주세요'); }} />
        <ListRow label="앱 정보" value={Constants.expoConfig?.version} onPress={() => router.push('/prefs/app')} last />
      </Group>

      <T v="small">추천은 일반적인 운동·영양 가이드에 기반한 참고용이에요. 부상이나 질환이 있다면 전문가와 먼저 상의하세요.</T>

      <Sheet open={weekSheet} title="이번 주 부위별 볼륨" onClose={() => setWeekSheet(false)}>
        <WeekView />
      </Sheet>
    </Screen>
  );
}
