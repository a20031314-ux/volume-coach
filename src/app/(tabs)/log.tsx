import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import { useNow } from '@/hooks/use-now';
import { Platform, View } from 'react-native';

import { useCardioTimer } from '@/components/cardio-panel';
import { useDayActivity } from '@/components/day-activity';
import { DayReview } from '@/components/day-review';
import { Sheet } from '@/components/layout';
import { NowSpeed } from '@/components/now-speed';
import { StepsChart } from '@/components/steps-chart';
import { DayStrip, TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { Button, Card, DayNav, Field, NumField, Pills, Row, Screen, Segmented, Stepper, T } from '@/components/ui';
import { WeekView } from '@/components/week-view';
import { Space, usePalette } from '@/constants/theme';
import { useDayBuckets, useHealth } from '@/health/use-steps';
import { knownExercises, pickable } from '@/lib/ability';
import { activityLine } from '@/lib/activity';
import { cardioType } from '@/lib/cardio';
import { addDays, fmt, parse, today } from '@/lib/dates';
import { KIND_NAME } from '@/lib/elevation';
import { MUSCLES, MUSCLE_NAME, library } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import { dayTimeline, span, type TimelineItem, type TimelineKind } from '@/lib/timeline';
import type { MuscleKey } from '@/lib/types';
import { useDayMove } from '@/move/use-move';
import { useRun } from '@/run/tracker';
import { live, useData } from '@/store/store';

/** 기록: the whole day as one timeline; each item opens its own (workout → sets, run → pace). */
export default function Log() {
  const c = usePalette();
  const params = useLocalSearchParams<{ muscle?: string }>();
  const [view, setView] = useState<'day' | 'review' | 'week'>('day');
  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<MuscleKey | null>(null);

  // opened from 오늘 > 시간 남으면 with a muscle: go straight to logging it
  const [prevParam, setPrevParam] = useState<string | undefined>(undefined);
  if (params.muscle !== prevParam) {
    setPrevParam(params.muscle);
    const m = params.muscle as MuscleKey | undefined;
    if (m && MUSCLE_NAME[m]) { setDate(today()); setView('day'); setAdding(m); }
  }

  const logsT = useData((s) => s.logs);
  const sessionsT = useData((s) => s.sessions);
  const runsT = useData((s) => s.runs);
  const move = useDayMove(date);
  const activity = useDayActivity(date);
  const run = useRun();
  const health = useHealth((s) => s.enabled);
  const clockNow = useNow(60e3);
  const buckets = useDayBuckets(date, clockNow.getTime());

  const items = useMemo(() => dayTimeline(date, {
    logs: live(logsT), sessions: live(sessionsT), runs: live(runsT), walks: move.segments,
  }), [date, logsT, sessionsT, runsT, move.segments]);

  const color: Record<TimelineKind, string> = { lift: c.accent, run: c.warn, ride: c.warn, other: c.warn, walk: c.ok, hike: c.ok, move: c.ok };
  const isToday = date === today();
  const liveRun = isToday && run.status !== 'idle' && run.startedAt;
  const cardioStart = useCardioTimer((t) => t.startedAt);
  const cardioName = cardioType(useData((s) => s.settings.run.cardio)).name;
  const liveCardio = isToday && cardioStart != null;
  const dayStart = parse(date).getTime();
  const now = clockNow.getTime();
  const blocks = [
    ...items.map((i) => ({ startMs: i.startMs, endMs: i.endMs ?? now, color: color[i.kind] })),
    ...(liveRun ? [{ startMs: run.startedAt!, endMs: now, color: c.warn }] : []),
    ...(liveCardio ? [{ startMs: cardioStart!, endMs: now, color: c.warn }] : []),
  ];
  const line = activityLine(activity);

  const open = (i: TimelineItem) => {
    const t = i.target;
    if (t.type === 'session') router.push({ pathname: '/activity/session', params: { id: t.id } });
    else if (t.type === 'run') router.push({ pathname: '/activity/run', params: { id: t.id } });
    else if (t.type === 'lifts') router.push({ pathname: '/activity/lifts', params: { date: t.date } });
    else router.push({ pathname: '/activity/move', params: { date: t.date, index: String(t.index) } });
  };

  return (
    <Screen title="기록">
      <Segmented options={[{ v: 'day', n: '타임라인' }, { v: 'review', n: '하루 회고' }, { v: 'week', n: '주간 볼륨' }]} value={view} onChange={(v) => v && setView(v)} />
      {view === 'week' ? <WeekView /> : view === 'review' ? (<>
        <DayNav date={date} label={date === today() ? `오늘 · ${fmt(date)}` : fmt(date)}
          onPrev={() => setDate(addDays(date, -1))} onNext={() => { if (date !== today()) setDate(addDays(date, 1)); }} />
        <DayReview date={date} />
      </>) : (<>
        <DayNav date={date} label={isToday ? `오늘 · ${fmt(date)}` : fmt(date)}
          onPrev={() => setDate(addDays(date, -1))} onNext={() => { if (!isToday) setDate(addDays(date, 1)); }} />

        <Card style={{ gap: Space.sm }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T style={{ flexShrink: 1 }} numberOfLines={1}>{line || '활동 없음'}</T>
            {activity.kcal ? <T v="num" style={{ fontSize: 15 }}>{activity.activeMin}분 · {activity.kcal}kcal</T> : null}
          </Row>
          <DayStrip blocks={blocks} startMs={dayStart} />
          {buckets && buckets.length ? (
            <StepsChart buckets={buckets} dayStart={dayStart}
              tracked={live(runsT).filter((r) => r.date === date).map((r) => [r.startedAt, r.endedAt] as [number, number])} />
          ) : null}
          {isToday ? <NowSpeed /> : null}
        </Card>

        <View>
          {liveRun ? (
            <TlNode time={span({ startMs: run.startedAt!, endMs: null })} title={`${KIND_NAME[run.kind ?? 'run']} 진행 중`}
              sub={`${(run.distanceM / 1000).toFixed(2)}km`} color={c.warn} onPress={() => router.push('/run')} last={!items.length} />
          ) : null}
          {liveCardio ? (
            <TlNode time={span({ startMs: cardioStart!, endMs: null })} title={`${cardioName} 진행 중`}
              sub="타이머" color={c.warn} onPress={() => router.push('/run')} last={!items.length} />
          ) : null}
          {items.map((i, n) => (
            <TlNode key={i.key} time={span(i)} title={i.title} sub={i.sub} color={color[i.kind]} onPress={() => open(i)} last={n === items.length - 1} />
          ))}
          {!items.length && !liveRun && !liveCardio ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>이 날은 기록이 없어요.</T> : null}
        </View>

        <Button label="+ 웨이트 기록" onPress={() => setAdding('chest')} />
        {!health && Platform.OS !== 'web' ? (
          <Button label="걸음 수 연결하기" kind="ghost" onPress={() => router.push('/prefs/health')} style={{ alignSelf: 'center' }} />
        ) : null}
      </>)}

      <AddLift open={adding != null} initialMuscle={adding ?? 'chest'} date={date} onClose={() => setAdding(null)} />
    </Screen>
  );
}

/** Manual lifting entry without a workout session. */
function AddLift({ open, initialMuscle, date, onClose }: { open: boolean; initialMuscle: MuscleKey; date: string; onClose: () => void }) {
  const toast = useToast();
  const settings = useData((s) => s.settings);
  const logsT = useData((s) => s.logs);
  const addLog = useData((s) => s.addLog);
  const updateSettings = useData((s) => s.updateSettings);
  const [muscle, setMuscle] = useState<MuscleKey>(initialMuscle);
  const [exercise, setExercise] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [sets, setSets] = useState(3);
  const [kg, setKg] = useState<number | null>(null);
  const [reps, setReps] = useState('');

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setMuscle(initialMuscle); setExercise(null); setIsNew(false); }
  }

  const options = pickable(muscle, { ...settings, known: knownExercises(live(logsT)) });
  const save = () => {
    let name = exercise;
    if (isNew) {
      name = custom.trim();
      if (!name) return toast('새 운동 이름을 입력하세요');
      if (!library(settings.customExercises).some((e) => e.n === name)) {
        updateSettings({ customExercises: [...settings.customExercises, { n: name, m: muscle }] });
      }
    }
    if (!name) return toast('운동을 고르세요');
    // a past day gets a time at noon so it sorts sensibly in that day's timeline
    const at = date === today() ? Date.now() : parse(date).getTime() + 12 * 3600e3;
    addLog({ date, exercise: name, muscle, sets, kg, reps: reps.trim(), at });
    toast(`${name} ${sets}세트 저장됨`);
    setKg(null); setReps(''); setCustom(''); setIsNew(false); setExercise(name);
  };

  return (
    <Sheet open={open} title={`웨이트 기록 · ${fmt(date)}`} onClose={onClose}>
      <Pills options={MUSCLES} value={muscle} onToggle={(k) => { setMuscle(k); setExercise(null); setIsNew(false); }} />
      <Pills
        options={[...options.map((o) => ({ k: o.n, n: o.n })), { k: '__new', n: '+ 새 운동' }]}
        value={isNew ? '__new' : exercise}
        onToggle={(k) => { if (k === '__new') { setIsNew(true); setExercise(null); } else { setIsNew(false); setExercise(k); } }}
      />
      {exercise ? <T v="small">권장 {repRange(exercise, settings.profile)}</T> : null}
      {isNew ? <Field label="새 운동 이름" value={custom} onChangeText={setCustom} placeholder="예: 스미스 인클라인 프레스" /> : null}
      <Row gap={Space.md}>
        <Stepper label="세트" value={sets} onChange={setSets} />
        <NumField label="kg" value={kg} onCommit={setKg} decimal />
        <Field label="반복" value={reps} onChangeText={setReps} placeholder="10" />
      </Row>
      <Button label="저장" kind="primary" onPress={save} style={{ paddingVertical: 13 }} />
    </Sheet>
  );
}
