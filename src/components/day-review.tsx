import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useDayActivity } from '@/components/day-activity';
import { Button, Card, Field, Meter, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { today } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { nutritionTargets } from '@/lib/nutrition';
import { body } from '@/lib/profile';
import { dayBurn, dayIntake, liftVolume, reviewNotes } from '@/lib/review';
import { live, useData } from '@/store/store';

const n = (x: number) => Math.round(x).toLocaleString('ko-KR');

/** 하루 회고: what was done, what it cost, what was eaten, and a note. */
export function DayReview({ date }: { date: string }) {
  const c = usePalette();
  const now = useNow(60e3);
  const a = useDayActivity(date);
  const settings = useData((s) => s.settings);
  const logsT = useData((s) => s.logs);
  const sessionsT = useData((s) => s.sessions);
  const mealsT = useData((s) => s.meals);
  const bodyT = useData((s) => s.bodyComps);
  const check = useData((s) => s.checkins[date]);
  const setCheckin = useData((s) => s.setCheckin);
  const isToday = date === today();

  const r = useMemo(() => {
    const logs = live(logsT), sessions = live(sessionsT);
    const t = nutritionTargets(settings.profile, live(bodyT), logs, date);
    const weightKg = body(settings.profile, live(bodyT))?.weight || 70;
    const frac = isToday ? Math.min(1, (now.getHours() * 60 + now.getMinutes()) / 1440) : 1;
    const burn = dayBurn(t?.bmr ?? Math.round(weightKg * 22), a, settings.profile.act, frac);
    const intake = dayIntake(live(mealsT), date);
    const vol = liftVolume(logs, sessions, date);
    const targets = t ? { kcal: t.kcal, p: t.p, c: t.c, f: t.f, bmr: t.bmr } : null;
    return { burn, intake, vol, targets, notes: reviewNotes({ intake, targets, burn, isToday, weightKg }) };
  }, [logsT, sessionsT, mealsT, bodyT, settings.profile, date, a, isToday, now]);

  const [note, setNote] = useState(check?.note ?? '');
  const [prevKey, setPrevKey] = useState(date);
  if (prevKey !== date) { setPrevKey(date); setNote(check?.note ?? ''); }

  const { burn, intake, vol, targets } = r;
  const bal = intake.kcal - burn.total;
  const bar = (label: string, v: number, color: string) => (
    <View style={{ gap: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}><T v="small">{label}</T><T v="small">{n(v)}kcal</T></Row>
      <Meter pct={burn.total ? (v / burn.total) * 100 : 0} color={color} />
    </View>
  );
  const macro = (label: string, v: number, goal: number | undefined, color: string) => (
    <View style={{ gap: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}><T v="small">{label}</T><T v="small">{n(v)}{goal ? ` / ${n(goal)}` : ''}g</T></Row>
      <Meter pct={goal ? Math.min(100, (v / goal) * 100) : 0} color={color} />
    </View>
  );

  return (
    <View style={{ gap: Space.lg }}>
      <Card>
        <Row style={{ justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{n(burn.total)}</T><T v="small">소모{isToday ? ' (지금까지)' : ''}</T></View>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{n(intake.kcal)}</T><T v="small">섭취</T></View>
          <View style={{ alignItems: 'center' }}>
            <T v="num" style={{ fontSize: 24, color: intake.items ? c.ink : c.muted }}>{intake.items ? `${bal > 0 ? '+' : bal < 0 ? '−' : ''}${n(Math.abs(bal))}` : '–'}</T>
            <T v="small">섭취 − 소모</T>
          </View>
        </Row>
      </Card>

      <Card style={{ gap: Space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="title" style={{ fontSize: 15 }}>운동</T>
          <T v="small">{a.activeMin}분</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="muted">웨이트</T>
          <T>{a.lift.sets ? `${a.lift.sets}세트 · ${a.lift.minutes}분${vol.kg ? ` · ${n(vol.kg)}kg` : ''}` : '없음'}</T>
        </Row>
        {vol.perMuscle.length ? <T v="small">{vol.perMuscle.map((m) => `${MUSCLE_NAME[m.muscle]} ${m.sets}`).join(' · ')}</T> : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="muted">러닝</T>
          <T>{a.run.count ? `${a.run.km.toFixed(1)}km · ${a.run.minutes}분` : '없음'}</T>
        </Row>
        {a.outdoor.count ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="muted">걷기·등산</T>
            <T>{`${a.outdoor.km.toFixed(1)}km · ${a.outdoor.minutes}분${a.outdoor.gainM ? ` · ↑${a.outdoor.gainM}m` : ''}`}</T>
          </Row>
        ) : null}
        {a.cardio.count ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="muted">자전거·유산소</T>
            <T>{`${a.cardio.minutes}분${a.cardio.km ? ` · ${a.cardio.km.toFixed(1)}km` : ''} · ${a.cardio.kcal}kcal`}</T>
          </Row>
        ) : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="muted">걸음</T>
          <T>{a.walk?.steps != null ? `${n(a.walk.steps)}보 · ${a.walk.km.toFixed(1)}km` : a.walk ? `${a.walk.km.toFixed(1)}km` : '연결 안 됨'}</T>
        </Row>
      </Card>

      <Card style={{ gap: Space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="title" style={{ fontSize: 15 }}>소모 칼로리</T>
          <T v="num" style={{ fontSize: 15 }}>{n(burn.total)}kcal</T>
        </Row>
        {bar('기초대사', burn.bmr, c.rest)}
        {bar(burn.dailySource === 'steps' ? '일상 활동' : '일상 활동 (내 정보 활동량 기준)', burn.daily, c.band)}
        {burn.walk ? bar('걷기', burn.walk, c.ok) : null}
        {bar('운동', burn.exercise, c.accent)}
      </Card>

      <Card style={{ gap: Space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="title" style={{ fontSize: 15 }}>섭취 영양</T>
          <T v="num" style={{ fontSize: 15 }}>{n(intake.kcal)}{targets ? ` / ${n(targets.kcal)}` : ''}kcal</T>
        </Row>
        {targets ? <Meter pct={Math.min(100, (intake.kcal / targets.kcal) * 100)} color={c.accent} /> : null}
        {macro('단백질', intake.p, targets?.p, c.accent)}
        {macro('탄수화물', intake.c, targets?.c, c.ok)}
        {macro('지방', intake.f, targets?.f, c.warn)}
        <Button label={intake.items ? `음식 ${intake.items}개 · 영양 탭에서 보기` : '영양 탭에서 기록하기'} kind="ghost" onPress={() => router.push('/food')} style={{ alignSelf: 'flex-start' }} />
      </Card>

      {r.notes.length ? (
        <View style={{ gap: 4 }}>
          {r.notes.map((x) => <T key={x}>• {x}</T>)}
        </View>
      ) : null}

      <Field label="한 줄 회고" value={note} onChangeText={setNote} placeholder="예: 벤치 80kg 8회 성공, 저녁 과식"
        onBlur={() => { if (note !== (check?.note ?? '')) setCheckin(date, { note: note.trim() }); }} />
    </View>
  );
}
