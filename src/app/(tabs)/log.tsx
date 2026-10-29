import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ExName } from '@/components/exercise-menu';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, DayNav, Field, NumField, Pills, Row, Screen, Segmented, Stepper, T } from '@/components/ui';
import { WeekView } from '@/components/week-view';
import { Space, usePalette } from '@/constants/theme';
import { addDays, fmt, today } from '@/lib/dates';
import { MUSCLES, MUSCLE_NAME, library } from '@/lib/exercises';
import { knownExercises, pickable } from '@/lib/ability';
import { repRange } from '@/lib/profile';
import type { MuscleKey } from '@/lib/types';
import { live, useData } from '@/store/store';

export default function Log() {
  const c = usePalette();
  const toast = useToast();
  const params = useLocalSearchParams<{ muscle?: string }>();
  const settings = useData((s) => s.settings);
  const logsT = useData((s) => s.logs);
  const addLog = useData((s) => s.addLog);
  const removeLog = useData((s) => s.removeLog);
  const updateSettings = useData((s) => s.updateSettings);

  const [view, setView] = useState<'log' | 'week'>('log');
  const [date, setDate] = useState(today());
  const [muscle, setMuscle] = useState<MuscleKey>('chest');
  const [exercise, setExercise] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const [sets, setSets] = useState(3);
  const [kg, setKg] = useState<number | null>(null);
  const [reps, setReps] = useState('');

  // jump to a muscle when opened from 오늘 > 시간 남으면
  const [prevParam, setPrevParam] = useState<string | undefined>(undefined);
  if (params.muscle !== prevParam) {
    setPrevParam(params.muscle);
    const m = params.muscle as MuscleKey | undefined;
    if (m && MUSCLE_NAME[m]) { setMuscle(m); setExercise(null); setDate(today()); setView('log'); }
  }

  const logs = useMemo(() => live(logsT), [logsT]);
  const options = pickable(muscle, { ...settings, known: knownExercises(logs) });
  const days = useMemo(() => {
    const by: Record<string, typeof logs> = {};
    for (const l of logs) (by[l.date] ??= []).push(l);
    return Object.keys(by).sort().reverse().slice(0, 21).map((d) => ({ d, rows: by[d].sort((a, b) => a.at - b.at) }));
  }, [logs]);

  const save = () => {
    let name = exercise;
    if (adding) {
      name = custom.trim();
      if (!name) return toast('새 운동 이름을 입력하세요');
      if (!library(settings.customExercises).some((e) => e.n === name)) {
        updateSettings({ customExercises: [...settings.customExercises, { n: name, m: muscle }] });
      }
    }
    if (!name) return toast('운동을 고르세요');
    addLog({ date, exercise: name, muscle, sets, kg, reps: reps.trim(), at: Date.now() });
    toast(`${name} ${sets}세트 저장됨`);
    setKg(null); setReps(''); setCustom(''); setAdding(false); setExercise(name);
  };

  return (
    <Screen title="기록">
      <Segmented options={[{ v: 'log', n: '운동 기록' }, { v: 'week', n: '주간 볼륨' }]} value={view} onChange={(v) => v && setView(v)} />
      {view === 'week' ? <WeekView /> : (<>
      <Card>
        <DayNav date={date} label={date === today() ? `오늘 · ${fmt(date)}` : fmt(date)}
          onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />
        <View style={{ gap: 6 }}>
          <T v="muted">부위</T>
          <Pills options={MUSCLES} value={muscle} onToggle={(k) => { setMuscle(k); setExercise(null); setAdding(false); }} />
        </View>
        <View style={{ gap: 6 }}>
          <T v="muted">운동</T>
          <Pills
            options={[...options.map((o) => ({ k: o.n, n: o.n })), { k: '__new', n: '+ 새 운동' }]}
            value={adding ? '__new' : exercise}
            onToggle={(k) => { if (k === '__new') { setAdding(true); setExercise(null); } else { setAdding(false); setExercise(k); } }}
          />
          {exercise ? <T v="small">권장 {repRange(exercise, settings.profile)}</T> : null}
        </View>
        {adding ? <Field label="새 운동 이름" value={custom} onChangeText={setCustom} placeholder="예: 스미스 인클라인 프레스" /> : null}
        <Row gap={Space.md}>
          <Stepper label="세트" value={sets} onChange={setSets} />
        </Row>
        <Row gap={Space.md}>
          <NumField label="중량 kg (선택)" value={kg} onCommit={setKg} decimal />
          <Field label="반복 (선택)" value={reps} onChangeText={setReps} placeholder="예: 10 / 8~10" />
        </Row>
        <Button label="기록 저장" kind="primary" onPress={save} style={{ paddingVertical: 13 }} />
      </Card>

      <T v="label">기록</T>
      {!days.length ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.xl }}>아직 기록이 없어요. 위에서 첫 운동을 저장하거나 오늘 탭의 기록을 누르세요.</T> : null}
      {days.map(({ d, rows }) => (
        <View key={d}>
          <Row style={{ justifyContent: 'space-between', borderBottomWidth: 2, borderColor: c.ink, paddingBottom: 4, paddingTop: Space.md }}>
            <T v="title" style={{ fontSize: 15 }}>{fmt(d)}</T>
            <T v="num" style={{ fontSize: 16 }}>{rows.reduce((a, l) => a + l.sets, 0)}세트</T>
          </Row>
          {rows.map((l) => (
            <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <ExName name={l.exercise} />
                <T v="small">{MUSCLE_NAME[l.muscle]}{l.kg ? ` · ${l.kg}kg` : ''}{l.reps ? ` × ${l.reps}` : ''}</T>
              </View>
              <T v="num" style={{ fontSize: 17 }}>{l.sets}세트</T>
              <ConfirmButton label="삭제" onConfirm={() => { removeLog(l.id); toast('삭제됨'); }} />
            </View>
          ))}
        </View>
      ))}
      </>)}
    </Screen>
  );
}
