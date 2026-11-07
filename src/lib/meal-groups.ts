/**
 * 끼니별 기록: the day's food grouped into meals, each with how much of the daily target it
 * filled, and warnings when one meal is very large or pushes the day over its target.
 */
import { slotOf, SLOT_NAME, SLOTS, type Slot } from './diet-report';
import { mealName } from './meal-plan';
import type { Meal } from './types';

export interface DayGoal { kcal: number; p: number; c: number; f: number }
export interface Sum { k: number; p: number; c: number; f: number }

export type Warn =
  | { kind: 'big'; pct: number }
  | { kind: 'over'; what: 'kcal' | 'c' | 'f'; by: number };

export interface MealGroup {
  key: string;
  name: string;
  /** sort position among the day's meals */
  order: number;
  items: Meal[];
  sum: Sum;
  /** share of the daily goal this meal filled, in % (null without a goal) */
  pct: { k: number; p: number; c: number; f: number } | null;
  /** day total after this meal */
  running: Sum;
  warns: Warn[];
}

const ZERO: Sum = { k: 0, p: 0, c: 0, f: 0 };
const add = (a: Sum, m: Meal): Sum => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f });
const minuteOf = (at: number) => { const d = new Date(at); return d.getHours() * 60 + d.getMinutes(); };

/** one meal is "big" past this share of the day's calories */
export const BIG_MEAL = 45;
/** going over by less than this isn't worth a warning */
const SLACK = { kcal: 0.03, c: 0.1, f: 0.1 };

/**
 * Group by the user's meal times when set (nearest time), else by time of day.
 * Groups come out in time order.
 */
/** Which meal a minute of the day belongs to: the nearest meal time when set, else the time-of-day slot. */
export function mealKey(min: number, times?: number[]): { key: string; name: string; order: number } {
  if (times?.length) {
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - min) < Math.abs(times[best] - min)) best = i;
    return { key: `t${best}`, name: mealName(times[best]), order: best };
  }
  const d = new Date(2000, 0, 1, Math.floor(min / 60), min % 60);
  const s: Slot = slotOf(d.getTime());
  return { key: s, name: SLOT_NAME[s], order: SLOTS.indexOf(s) };
}

/**
 * Group by the user's meal times when set (nearest time), else by time of day.
 * Groups come out in time order.
 */
export function groupMeals(meals: Meal[], goal: DayGoal | null, times?: number[]): MealGroup[] {
  const sorted = [...meals].sort((a, b) => a.at - b.at);
  const groups = new Map<string, { key: string; name: string; order: number; items: Meal[] }>();
  for (const m of sorted) {
    const { key, name, order } = mealKey(minuteOf(m.at), times);
    const g = groups.get(key) ?? { key, name, order, items: [] };
    g.items.push(m);
    groups.set(key, g);
  }

  let running = ZERO;
  return [...groups.values()].sort((a, b) => a.order - b.order).map((g) => {
    const before = running;
    const sum = g.items.reduce(add, ZERO);
    running = { k: running.k + sum.k, p: running.p + sum.p, c: running.c + sum.c, f: running.f + sum.f };
    const warns: Warn[] = [];
    let pct: MealGroup['pct'] = null;
    if (goal && goal.kcal > 0) {
      pct = { k: (sum.k / goal.kcal) * 100, p: goal.p ? (sum.p / goal.p) * 100 : 0, c: goal.c ? (sum.c / goal.c) * 100 : 0, f: goal.f ? (sum.f / goal.f) * 100 : 0 };
      if (pct.k >= BIG_MEAL) warns.push({ kind: 'big', pct: pct.k });
      // the meal where the day crosses its goal gets the warning
      const crossed = (what: 'kcal' | 'c' | 'f', g0: number, b: number, a: number) => {
        const line = g0 * (1 + SLACK[what]);
        if (g0 > 0 && b <= line && a > line) warns.push({ kind: 'over', what, by: a - g0 });
      };
      crossed('kcal', goal.kcal, before.k, running.k);
      crossed('c', goal.c, before.c, running.c);
      crossed('f', goal.f, before.f, running.f);
    }
    return { key: g.key, name: g.name, order: g.order, items: g.items, sum, pct, running, warns };
  });
}

const r = Math.round;
export function warnText(w: Warn): string {
  if (w.kind === 'big') return `한 끼에 하루 칼로리의 ${r(w.pct)}%`;
  const what = { kcal: '칼로리', c: '탄수화물', f: '지방' }[w.what];
  return `이 끼니에서 하루 ${what} 목표 초과 (+${r(w.by)}${w.what === 'kcal' ? 'kcal' : 'g'})`;
}

/** One meal on the day's timeline: what was eaten, plus what is still planned for it. */
export interface TimelineMeal<P, R> {
  key: string;
  name: string;
  order: number;
  /** a representative minute of the day, for adding food to this meal */
  min: number;
  group: MealGroup | null;
  /** planned items (e.g. 고정식단) not logged yet */
  pending: P[];
  /** the recommended next meal, if it falls here */
  rec: R | null;
}

const SLOT_MIN: Record<Slot, number> = { morning: 8 * 60, lunch: 12 * 60 + 30, afternoon: 16 * 60, dinner: 19 * 60, night: 22 * 60 };

/**
 * The day's meals in time order: eaten groups, with not-yet-logged planned items and the next-meal
 * recommendation placed in the meal they belong to (creating that meal when nothing was eaten yet).
 */
export function mealTimeline<P extends { min: number }, R extends { min: number }>(
  groups: MealGroup[], pending: P[], rec: R | null, times?: number[],
): TimelineMeal<P, R>[] {
  const out = new Map<string, TimelineMeal<P, R>>();
  const slot = (min: number) => {
    const k = mealKey(min, times);
    const rep = times?.length ? times[k.order] : SLOT_MIN[k.key as Slot];
    if (!out.has(k.key)) out.set(k.key, { ...k, min: rep, group: null, pending: [], rec: null });
    return out.get(k.key)!;
  };
  for (const g of groups) {
    const rep = times?.length ? times[g.order] : SLOT_MIN[g.key as Slot];
    out.set(g.key, { key: g.key, name: g.name, order: g.order, min: rep, group: g, pending: [], rec: null });
  }
  for (const p of [...pending].sort((a, b) => a.min - b.min)) slot(p.min).pending.push(p);
  if (rec) slot(rec.min).rec = rec;
  return [...out.values()].sort((a, b) => a.order - b.order);
}
