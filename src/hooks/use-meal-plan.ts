/** 식단 추천 for the next meal, plus the per-day "없음" list. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useNow } from '@/hooks/use-now';
import { useDietReport } from '@/hooks/use-diet-report';
import { addDays, today } from '@/lib/dates';
import type { Macros } from '@/lib/foods';
import { slotOf, type Slot } from '@/lib/diet-report';
import { mealName, mealTarget, nextMeal, recommendMeal, type MealRec } from '@/lib/meal-plan';
import { dayTarget } from '@/lib/day-target';
import type { BodyComp, Meal, Settings, WorkoutLog } from '@/lib/types';
import { live, useData } from '@/store/store';

/** foods the user said they don't have today (reset each day) */
interface MissingState { date: string; foods: string[] }
export const useMissing = create<MissingState>()(
  persist((): MissingState => ({ date: '', foods: [] }), { name: 'volume-coach-missing', storage: createJSONStorage(() => AsyncStorage) }),
);
export function markMissing(food: string, on = true) {
  const d = today();
  const cur = useMissing.getState();
  const foods = cur.date === d ? cur.foods : [];
  useMissing.setState({ date: d, foods: on ? [...new Set([...foods, food])] : foods.filter((f) => f !== food) });
}
function missingToday(): string[] {
  const s = useMissing.getState();
  return s.date === today() ? s.foods : [];
}

/** used when there's no body profile yet */
const FALLBACK = { kcal: 2200, p: 120, c: 260, f: 65 };

export interface PlannedMeal { date: string; min: number; name: string; rec: MealRec; target: Macros }

/**
 * Meals from `now` over the next `days` days. Today's meals share what's left after what was
 * eaten; later days split the full target.
 */
export function planMeals(input: { settings: Settings; meals: Meal[]; logs: WorkoutLog[]; comps: BodyComp[]; prefer: string[]; preferBySlot?: Record<Slot, string[]>; missing: string[]; now: Date; days?: number; grace?: boolean }): PlannedMeal[] {
  const { settings, now } = input;
  const times = [...settings.mealPlan.times].sort((a, b) => a - b);
  if (!times.length) return [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const d0 = today(now);
  const out: PlannedMeal[] = [];
  for (let i = 0; i < (input.days ?? 1); i++) {
    const date = addDays(d0, i);
    const t = dayTarget({ settings, comps: input.comps, logs: input.logs, meals: input.meals }, date, d0);
    const day = t ? { kcal: t.kcal, p: t.p, c: t.c, f: t.f } : FALLBACK;
    const eaten = i === 0
      ? input.meals.filter((m) => m.date === date).reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 })
      : { k: 0, p: 0, c: 0, f: 0 };
    const start = i === 0 ? (input.grace ? nextMeal(times, nowMin) : times.findIndex((m) => m > nowMin)) : 0;
    if (start == null || start < 0) continue;
    let first: number = start;
    if (i === 0 && input.grace) {
      // a meal already logged around this time means it's been eaten: move on
      const mins = input.meals.filter((m) => m.date === date).map((m) => { const d = new Date(m.at); return d.getHours() * 60 + d.getMinutes(); });
      while (first < times.length && times[first] <= nowMin + 60 && mins.some((x) => x >= times[first] - 60 && x <= nowMin)) first++;
      if (first >= times.length) continue;
    }
    for (let j = first; j < times.length; j++) {
      // later meals today assume the earlier ones get eaten as planned: same per-meal share
      const target = mealTarget(day, eaten, times.length - first);
      if (!target) break;
      const at = new Date(now); at.setHours(Math.floor(times[j] / 60), times[j] % 60, 0, 0);
      // what's usually eaten at this time first, then everything else
      const prefer = [...new Set([...(input.preferBySlot?.[slotOf(at.getTime())] ?? []), ...input.prefer])];
      out.push({ date, min: times[j], name: mealName(times[j]), target, rec: recommendMeal(target, { prefer, unavailable: i === 0 ? input.missing : [] }) });
    }
  }
  return out;
}

/** The meal to show on the food tab right now (null when off, or the day is done). */
export function useNextMeal(): PlannedMeal | null {
  const now = useNow(60e3);
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const mDate = useMissing((s) => s.date);
  const mFoods = useMissing((s) => s.foods);
  const report = useDietReport(28);
  return useMemo(() => {
    if (!settings.mealPlan.on) return null;
    const missing = mDate === today(now) ? mFoods : [];
    return planMeals({ settings, meals: live(mealsT), logs: live(logsT), comps: live(bodyT), prefer: report.prefer, preferBySlot: report.preferBySlot, missing, now, grace: true })[0] ?? null;
  }, [settings, mealsT, logsT, bodyT, report, mDate, mFoods, now]);
}

export { missingToday };
