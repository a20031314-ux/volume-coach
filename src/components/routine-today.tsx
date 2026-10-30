import { useMemo } from 'react';

import type { CoachResult } from '@/lib/coach';
import { DOW, parse } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { betterDay, todayDay, underRecovered } from '@/lib/routine';
import type { MuscleKey, Routine, RoutineDay } from '@/lib/types';
import { live, useData } from '@/store/store';

export interface RoutinePlan {
  day: RoutineDay | null;
  index: number;
  /** why this day: 화요일 루틴, 순서상 오늘, 직접 고른 날 … */
  label: string;
  /** under-recovered muscles of the day, and a better day to do instead */
  tired: { muscle: MuscleKey; pct: number }[];
  alt: number | null;
  /** sets after today's readiness adjustment */
  adj: (sets: number) => number;
  recovery: Partial<Record<MuscleKey, number>>;
}

/** Which routine day to show today, with recovery checks. `override` is a day the user picked. */
export function useRoutinePlan(routine: Routine | null, result: CoachResult, override: number | null): RoutinePlan {
  const ready = useData((s) => s.settings.ready);
  const sessionsT = useData((s) => s.sessions);
  const weekday = parse(result.T).getDay();
  const up = useMemo(
    () => (routine ? todayDay(routine, live(sessionsT), result.T, weekday) : { day: null, index: -1, reason: 'rest' as const }),
    [routine, sessionsT, result.T, weekday],
  );
  const recovery = useMemo(
    () => Object.fromEntries(result.stats.map((s) => [s.k, s.recPre])) as Partial<Record<MuscleKey, number>>,
    [result.stats],
  );
  const index = override ?? up.index;
  const day = routine && index >= 0 ? routine.days[index] ?? null : null;
  const tiredKeys = day ? underRecovered(day, recovery, ready) : [];
  const alt = routine && day && tiredKeys.length ? betterDay(routine, index, recovery, ready) : null;
  const factor = result.readiness.factor;
  const adj = (sets: number) => (factor < 1 ? Math.max(1, Math.round(sets * Math.max(factor, 0.7))) : sets);
  const label =
    override != null ? '직접 고른 날'
    : up.reason === 'weekday' ? `${DOW[weekday]}요일`
    : up.reason === 'next' ? '순서상 오늘'
    : up.reason === 'first' ? '첫 운동'
    : up.reason === 'done' ? '오늘 완료'
    : '쉬는 날';
  return { day, index, label, tired: tiredKeys.map((m) => ({ muscle: m, pct: recovery[m] ?? 0 })), alt, adj, recovery };
}

export const tiredText = (t: RoutinePlan['tired']) => t.map((x) => `${MUSCLE_NAME[x.muscle]} ${x.pct}%`).join(', ');
