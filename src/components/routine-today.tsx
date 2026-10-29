import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Space, usePalette } from '@/constants/theme';
import type { CoachResult } from '@/lib/coach';
import { DOW, parse } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import { betterDay, todayDay, underRecovered } from '@/lib/routine';
import type { MuscleKey, Routine, Session } from '@/lib/types';
import { startSession } from '@/store/session-actions';
import { live, useData } from '@/store/store';

import { ExName } from './exercise-menu';
import { Banner, Button, Card, Chip, Pills, Row, T, toneColor } from './ui';

/** 루틴형 today: the routine day that's up, with a recovery check and a way to pick another day. */
export function RoutineToday({ routine, result, running }: { routine: Routine; result: CoachResult; running: Session | null }) {
  const c = usePalette();
  const settings = useData((s) => s.settings);
  const sessionsT = useData((s) => s.sessions);
  const [override, setOverride] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);

  const weekday = parse(result.T).getDay();
  const up = useMemo(() => todayDay(routine, live(sessionsT), result.T, weekday), [routine, sessionsT, result.T, weekday]);
  const recovery = useMemo(
    () => Object.fromEntries(result.stats.map((s) => [s.k, s.recPre])) as Partial<Record<MuscleKey, number>>,
    [result.stats],
  );
  const index = override ?? up.index;
  const day = index >= 0 ? routine.days[index] : null;
  const tired = day ? underRecovered(day, recovery, settings.ready) : [];
  const alt = day && tired.length ? betterDay(routine, index, recovery, settings.ready) : null;
  const total = day ? day.exercises.reduce((a, e) => a + e.sets, 0) : 0;
  // a bad check-in trims every exercise the same way the auto mode trims its plan
  const factor = result.readiness.factor;
  const adj = (sets: number) => (factor < 1 ? Math.max(1, Math.round(sets * Math.max(factor, 0.7))) : sets);

  const label =
    override != null ? '직접 고른 날'
    : up.reason === 'weekday' ? `${DOW[weekday]}요일 루틴`
    : up.reason === 'next' ? '순서상 오늘'
    : up.reason === 'first' ? '첫 운동'
    : up.reason === 'done' ? '오늘 이미 했어요'
    : '오늘은 쉬는 날';

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <T v="small">{routine.name} · {label}</T>
            <T v="title" style={{ fontSize: 20 }}>{day ? `${day.name}` : '휴식'}</T>
          </View>
          {day ? <Chip label={`${day.exercises.length}개 · ${factor < 1 ? `${day.exercises.reduce((a, e) => a + adj(e.sets), 0)}/` : ''}${total}세트`} /> : null}
        </Row>

        {day && tired.length ? (
          <Banner text={`${tired.map((m) => `${MUSCLE_NAME[m]} ${recovery[m]}%`).join(', ')}로 회복이 덜 됐어요.${alt != null ? ` 오늘은 '${routine.days[alt].name}'을 먼저 하는 건 어때요?` : ' 세트를 줄이거나 하루 쉬는 걸 권해요.'}`} />
        ) : null}
        {day && tired.length && alt != null ? (
          <Button label={`${routine.days[alt].name}으로 바꾸기`} onPress={() => setOverride(alt)} style={{ alignSelf: 'flex-start' }} />
        ) : null}
        {factor < 1 && day ? <T v="small">오늘 컨디션을 반영해 세트를 {Math.round((1 - Math.max(factor, 0.7)) * 100)}% 줄였어요.</T> : null}

        {day?.exercises.map((e, i) => (
          <Row key={`${e.name}-${i}`} style={{ flexWrap: 'nowrap', borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.line, paddingTop: Space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <ExName name={e.name} />
              <T v="small">
                {MUSCLE_NAME[e.muscle]} · 회복 <T v="small" style={{ color: toneColor(c, recovery[e.muscle] ?? 100, settings.ready) }}>{recovery[e.muscle] ?? 100}%</T> · {repRange(e.name, settings.profile)}
              </T>
            </View>
            <T v="num">{adj(e.sets)}<T v="small">세트</T></T>
          </Row>
        ))}
        {!day ? <T v="muted">오늘은 루틴상 쉬는 날이에요. 운동하고 싶으면 다른 날을 골라서 시작할 수 있어요.</T> : null}

        {choosing ? (
          <View style={{ gap: 6 }}>
            <T v="muted">어떤 날을 할까요?</T>
            <Pills options={routine.days.map((d, i) => ({ k: String(i), n: d.name }))} value={index >= 0 ? String(index) : null}
              onToggle={(k) => { setOverride(Number(k)); setChoosing(false); }} />
          </View>
        ) : null}

        {running ? (
          <Button label="진행 중인 운동 이어서 하기" kind="primary" style={{ paddingVertical: 13 }}
            onPress={() => router.push({ pathname: '/session', params: { id: running.id } })} />
        ) : (
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button label={choosing ? '닫기' : '다른 날 하기'} onPress={() => setChoosing(!choosing)} style={{ flex: 1 }} />
            <Button label={day ? `${day.name} 시작` : '빈 운동 시작'} kind="primary" style={{ flex: 2, paddingVertical: 13 }}
              onPress={() => {
                const list = day ? day.exercises.map((e) => ({ name: e.name, muscle: e.muscle, sets: adj(e.sets) })) : [];
                const sid = startSession(list, settings.session.detail, day ? { routineId: routine.id, dayKey: day.key } : undefined);
                setOverride(null);
                router.push({ pathname: '/session', params: { id: sid } });
              }} />
          </Row>
        )}
      </Card>
      <Row>
        {routine.days.map((d, i) => (
          <Chip key={d.key} tone={i === index ? 'accent' : 'rest'}
            label={`${d.name}${routine.schedule === 'weekday' && d.weekdays.length ? ` ${d.weekdays.map((w) => DOW[w]).join('')}` : ''}`} />
        ))}
      </Row>
    </>
  );
}
