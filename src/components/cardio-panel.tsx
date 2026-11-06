/**
 * Cardio that GPS can't measure (swimming, stairs, kettlebell, spinning, …): pick the activity and
 * how hard it felt, then either run a stopwatch or enter it afterwards. Calories come from
 * time × MET (or the machine's number when given).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { Sheet } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, ConfirmButton, Field, NumField, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { CARDIO, INTENSITY_NAME, cardioKcal, cardioLegKm, cardioType, type Intensity } from '@/lib/cardio';
import { iso } from '@/lib/dates';
import { fmtDuration } from '@/lib/run';
import { useData } from '@/store/store';

interface CardioTimer {
  startedAt: number | null;
  /** set while paused */
  pausedAt: number | null;
  pausedMs: number;
}

export const useCardioTimer = create<CardioTimer>()(
  persist((): CardioTimer => ({ startedAt: null, pausedAt: null, pausedMs: 0 }), {
    name: 'volume-coach-cardio-timer',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export function timerSecs(t: CardioTimer, now: number): number {
  if (!t.startedAt) return 0;
  return Math.max(0, Math.floor(((t.pausedAt ?? now) - t.startedAt - t.pausedMs) / 1000));
}

const INTENSITY_HINT: Record<Intensity, string> = {
  1: '문장으로 대화 가능',
  2: '짧게 말할 수 있음',
  3: '말하기 힘듦',
};

export function CardioPanel({ weightKg }: { weightKg: number }) {
  const c = usePalette();
  const toast = useToast();
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const addRun = useData((s) => s.addRun);
  const timer = useCardioTimer();
  const [now, setNow] = useState(() => Date.now());
  /** when the manual-entry sheet was opened; null when closed */
  const [manual, setManual] = useState<number | null>(null);

  const opts = settings.run;
  const activity = opts.cardio ?? 'indoor_cycle';
  const intensity: Intensity = opts.cardioIntensity ?? 2;
  const setOpts = (p: Partial<typeof opts>) => update({ run: { ...opts, ...p } });
  const type = cardioType(activity);

  const running = timer.startedAt != null;
  useEffect(() => {
    if (!running || timer.pausedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running, timer.pausedAt]);
  const secs = timerSecs(timer, now);

  const save = (x: { startedAt: number; movingS: number; distanceM: number; machineKcal: number | null; manual: boolean }) => {
    const minutes = x.movingS / 60;
    addRun({
      date: iso(new Date(x.startedAt)),
      startedAt: x.startedAt,
      endedAt: x.startedAt + x.movingS * 1000,
      distanceM: x.distanceM,
      movingS: x.movingS,
      paceSecPerKm: null,
      kcal: cardioKcal(activity, intensity, minutes, weightKg, x.machineKcal),
      splits: [],
      route: [],
      kind: 'other',
      activity,
      intensity,
      manual: x.manual,
      legKmEq: cardioLegKm(activity, intensity, minutes),
    });
    toast(`${type.name} ${Math.round(minutes)}분 저장됨`);
  };

  const finish = () => {
    const s = timerSecs(useCardioTimer.getState(), Date.now());
    const startedAt = timer.startedAt!;
    useCardioTimer.setState({ startedAt: null, pausedAt: null, pausedMs: 0 });
    if (s < 60) { toast('1분 미만이라 저장하지 않았어요'); return; }
    save({ startedAt, movingS: s, distanceM: 0, machineKcal: null, manual: false });
  };

  if (running) {
    const paused = timer.pausedAt != null;
    return (
      <View style={{ gap: Space.lg }}>
        <View style={{ alignItems: 'center', gap: Space.xs }}>
          <T v="small">{type.name} · {INTENSITY_NAME[intensity]}</T>
          <T v="big" style={{ fontSize: 56, lineHeight: 64, color: paused ? c.muted : c.accent }}>{fmtDuration(secs)}</T>
          <T v="small">약 {cardioKcal(activity, intensity, secs / 60, weightKg)}kcal{paused ? ' · 일시정지' : ''}</T>
        </View>
        <Segmented options={([1, 2, 3] as Intensity[]).map((v) => ({ v, n: INTENSITY_NAME[v] }))} value={intensity}
          onChange={(v) => v && setOpts({ cardioIntensity: v })} />
        <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
          <Button label={paused ? '계속' : '일시정지'} style={{ flex: 1 }} onPress={() => {
            const t = useCardioTimer.getState();
            if (t.pausedAt) useCardioTimer.setState({ pausedAt: null, pausedMs: t.pausedMs + Date.now() - t.pausedAt });
            else useCardioTimer.setState({ pausedAt: Date.now() });
          }} />
          <Button label="끝내고 저장" kind="primary" style={{ flex: 1 }} onPress={finish} />
        </Row>
        <ConfirmButton label="기록 버리기" confirmLabel="정말 버릴까요?" onConfirm={() => useCardioTimer.setState({ startedAt: null, pausedAt: null, pausedMs: 0 })} />
      </View>
    );
  }

  return (
    <View style={{ gap: Space.lg }}>
      <Pills options={CARDIO.map((t) => ({ k: t.key, n: t.name }))} value={activity} onToggle={(k) => setOpts({ cardio: k })} />
      <View style={{ gap: Space.xs }}>
        <Segmented options={([1, 2, 3] as Intensity[]).map((v) => ({ v, n: INTENSITY_NAME[v] }))} value={intensity}
          onChange={(v) => v && setOpts({ cardioIntensity: v })} />
        <T v="small" style={{ textAlign: 'center' }}>{INTENSITY_HINT[intensity]} · 30분이면 약 {cardioKcal(activity, intensity, 30, weightKg)}kcal</T>
      </View>
      <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
        <Button label="직접 입력" style={{ flex: 1, paddingVertical: 16 }} onPress={() => setManual(Date.now())} />
        <Button label="타이머 시작" kind="primary" style={{ flex: 1, paddingVertical: 16 }}
          onPress={() => { setNow(Date.now()); useCardioTimer.setState({ startedAt: Date.now(), pausedAt: null, pausedMs: 0 }); }} />
      </Row>
      <T v="small" style={{ textAlign: 'center' }}>거리를 잴 수 없는 운동은 시간과 강도로 칼로리를 계산해요. 기계에 표시된 칼로리가 있으면 그 값을 써요.</T>
      <ManualCardio openedAt={manual} onClose={() => setManual(null)} distance={!!type.distance} title={`${type.name} · ${INTENSITY_NAME[intensity]}`}
        onSave={(x) => { save({ ...x, manual: true }); setManual(null); }} />
    </View>
  );
}

function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Entered afterwards: how long, when it started (today), and what the machine said. */
function ManualCardio({ openedAt, onClose, onSave, distance, title }: {
  openedAt: number | null; onClose: () => void; distance: boolean; title: string;
  onSave: (x: { startedAt: number; movingS: number; distanceM: number; machineKcal: number | null }) => void;
}) {
  const toast = useToast();
  const [minutes, setMinutes] = useState(30);
  const [start, setStart] = useState('');
  const [km, setKm] = useState<number | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [prevOpen, setPrevOpen] = useState<number | null>(null);
  if (openedAt !== prevOpen) {
    setPrevOpen(openedAt);
    if (openedAt) { setStart(hhmm(openedAt - minutes * 60e3)); setKm(null); setKcal(null); }
  }
  const submit = () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(start.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return toast('시작 시각을 13:30처럼 입력하세요');
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    // a time later than now means it was yesterday evening
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    onSave({ startedAt: d.getTime(), movingS: minutes * 60, distanceM: km ? Math.round(km * 1000) : 0, machineKcal: kcal });
  };
  return (
    <Sheet open={openedAt != null} title={title} onClose={onClose}>
      <Row gap={Space.md}>
        <Stepper label="시간(분)" value={minutes} onChange={setMinutes} step={5} min={5} max={240} />
        <Field label="시작 시각" value={start} onChangeText={setStart} placeholder="13:30" keyboardType="numbers-and-punctuation" />
      </Row>
      <Row gap={Space.md}>
        {distance ? <NumField label="거리 km (선택)" value={km} onCommit={setKm} decimal /> : null}
        <NumField label="기계 칼로리 (선택)" value={kcal} onCommit={setKcal} />
      </Row>
      <Button label="저장" kind="primary" onPress={submit} style={{ paddingVertical: 13 }} />
    </Sheet>
  );
}
