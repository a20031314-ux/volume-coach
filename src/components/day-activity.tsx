import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { Button, DayNav, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { HEALTH_NAME } from '@/health/steps';
import { useDaySteps, useHealth } from '@/health/use-steps';
import { walkTotals } from '@/lib/movement';
import { useMove } from '@/move/tracker';
import { useDayMove } from '@/move/use-move';
import { useNow } from '@/hooks/use-now';
import { activityLine, dayActivity, type DayActivity } from '@/lib/activity';
import { addDays, fmt, today } from '@/lib/dates';
import { body } from '@/lib/profile';
import { live, useData } from '@/store/store';

export function useDayActivity(date: string): DayActivity & { stepsState: 'off' | 'loading' | 'denied' | 'ok' } {
  const now = useNow(60e3);
  const steps = useDaySteps(date, now.getTime());
  const enabled = useHealth((s) => s.enabled);
  const logs = useData((s) => s.logs);
  const sessions = useData((s) => s.sessions);
  const runs = useData((s) => s.runs);
  const profile = useData((s) => s.settings.profile);
  const comps = useData((s) => s.bodyComps);
  const move = useDayMove(date);
  const walkedM = walkTotals(move.segments).m;
  return useMemo(() => {
    const weightKg = body(profile, live(comps))?.weight || 70;
    const a = dayActivity(date, { logs: live(logs), sessions: live(sessions), runs: live(runs), steps: steps ?? null, weightKg, now: now.getTime(), walkedM });
    const stepsState = !enabled ? 'off' : steps === undefined ? 'loading' : steps === null ? 'denied' : 'ok';
    return { ...a, stepsState } as const;
  }, [date, logs, sessions, runs, profile, comps, steps, enabled, now, walkedM]);
}

/** One tappable line on 오늘 with the day's total; details live in a sheet. */
export function ActivityRow() {
  const c = usePalette();
  const [open, setOpen] = useState(false);
  const a = useDayActivity(today());
  const line = activityLine(a);
  const moving = useMove((s) => s.enabled);
  if (!line && a.stepsState === 'off' && !moving) return null;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 12, paddingHorizontal: Space.md,
          borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: pressed ? c.bg : c.surface })}>
        <T v="muted">오늘 활동</T>
        <T style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>{line || (a.stepsState === 'loading' ? '…' : '0보')}</T>
        {a.kcal ? <T v="small">{a.kcal}kcal</T> : null}
        <T v="muted">›</T>
      </Pressable>
      <ActivitySheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Line({ name, main, sub, kcal }: { name: string; main: string; sub?: string; kcal?: number }) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: Space.md, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
      <T v="muted" style={{ width: 64 }}>{name}</T>
      <View style={{ flex: 1 }}>
        <T v="num" style={{ fontSize: 17 }}>{main}</T>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      {kcal != null ? <T v="small">{kcal}kcal</T> : null}
    </View>
  );
}

export function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const a = useDayActivity(date);
  const isToday = date === today();
  const steps = a.walk
    ? a.walk.steps != null
      ? <Line name="걸음" main={`${a.walk.steps.toLocaleString('ko-KR')}보`} sub={`${a.walk.km.toFixed(1)}km${a.outdoor.count ? ' (기록 제외)' : ''}`} kcal={a.walk.kcal} />
      : <Line name="걷기" main={`${a.walk.km.toFixed(1)}km`} sub="이동 기록" kcal={a.walk.kcal} />
    : a.stepsState === 'denied'
      ? <Line name="걸음" main="읽을 수 없음" sub={`${HEALTH_NAME}에서 권한을 확인하세요`} />
      : a.stepsState === 'loading' ? <Line name="걸음" main="…" /> : null;

  return (
    <Sheet open={open} title="하루 활동" onClose={() => { onClose(); setDate(today()); }}>
      <DayNav date={date} label={isToday ? `오늘 · ${fmt(date)}` : fmt(date)}
        onPrev={() => setDate(addDays(date, -1))} onNext={() => { if (!isToday) setDate(addDays(date, 1)); }} />
      <View>
        {steps}
        <Line name="웨이트" main={a.lift.sets ? `${a.lift.sets}세트` : '없음'} sub={a.lift.minutes ? `${a.lift.minutes}분` : undefined} kcal={a.lift.sets ? a.lift.kcal : undefined} />
        <Line name="러닝" main={a.run.count ? `${a.run.km.toFixed(1)}km` : '없음'} sub={a.run.count ? `${a.run.minutes}분` : undefined} kcal={a.run.count ? a.run.kcal : undefined} />
        {a.outdoor.count ? (
          <Line name="걷기·등산" main={`${a.outdoor.km.toFixed(1)}km`} sub={[`${a.outdoor.minutes}분`, a.outdoor.gainM ? `↑${a.outdoor.gainM}m` : null].filter(Boolean).join(' · ')} kcal={a.outdoor.kcal} />
        ) : null}
        {a.cardio.count ? (
          <Line name="자전거·유산소" main={`${a.cardio.minutes}분`} sub={a.cardio.km ? `${a.cardio.km.toFixed(1)}km` : `${a.cardio.count}회`} kcal={a.cardio.kcal} />
        ) : null}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="title" style={{ fontSize: 15 }}>합계</T>
        <T v="num" style={{ fontSize: 17 }}>{a.activeMin}분 · {a.kcal}kcal</T>
      </Row>
      {a.stepsState === 'off' && Platform.OS !== 'web' ? (
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <T v="muted" style={{ flexShrink: 1 }}>걸음 수 미연결</T>
          <Button label="연결" onPress={() => { onClose(); router.push('/prefs/health'); }} />
        </Row>
      ) : null}
    </Sheet>
  );
}
