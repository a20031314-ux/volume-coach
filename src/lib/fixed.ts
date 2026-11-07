/**
 * 고정식단: foods and supplements eaten on a schedule (오메가3 every morning, 견과류 at 3pm…).
 * Logged meals carry `fixed: item.id`, so the day's checklist knows what's done.
 */
import { parse } from './dates';
import { FOOD_DB, foodLabel, macrosOf, type FoodDef, type Macros } from './foods';
import type { FixedItem, FixedSettings, Meal } from './types';

export type { FixedItem, FixedSettings };

export const DEFAULT_FIXED: FixedSettings = { items: [], mode: 'check' };

export const fixedOf = (f: FixedSettings | undefined): FixedSettings => ({ ...DEFAULT_FIXED, ...(f ?? {}) });

const defOf = (n: string, extra: FoodDef[] = []): FoodDef | undefined => FOOD_DB.find((d) => d.n === n) ?? extra.find((d) => d.n === n);

/** Items scheduled on `date`, in time order. */
export function fixedFor(f: FixedSettings, date: string): FixedItem[] {
  const dow = parse(date).getDay();
  return f.items.filter((x) => !x.dows.length || x.dows.includes(dow)).sort((a, b) => a.time - b.time);
}

export interface FixedRow { item: FixedItem; food: FoodDef | undefined; macros: Macros; logged: Meal | undefined }

export function fixedRows(f: FixedSettings, date: string, meals: Meal[], extra: FoodDef[] = []): FixedRow[] {
  return fixedFor(f, date).map((item) => {
    const food = defOf(item.n, extra);
    return {
      item, food,
      macros: food ? macrosOf(food, item.amt) : { k: 0, p: 0, c: 0, f: 0 },
      logged: meals.find((m) => m.date === date && m.fixed === item.id && !m.deleted),
    };
  });
}

/** What's still to come today, for sizing the next meal recommendation. */
export function plannedLeft(rows: FixedRow[]): Macros {
  return rows.filter((r) => !r.logged).reduce((a, r) => ({ k: a.k + r.macros.k, p: a.p + r.macros.p, c: a.c + r.macros.c, f: a.f + r.macros.f }), { k: 0, p: 0, c: 0, f: 0 });
}

/** The meal record for one item on `date`, timed at its scheduled time. */
export function fixedMeal(r: FixedRow, date: string): Omit<Meal, 'id' | 'updatedAt' | 'deleted'> | null {
  if (!r.food) return null;
  const at = parse(date);
  at.setHours(Math.floor(r.item.time / 60), r.item.time % 60, 0, 0);
  const round = (x: number) => Math.round(x * 10) / 10;
  return {
    date, name: foodLabel(r.food, r.item.amt), qty: 1,
    kcal: round(r.macros.k), p: round(r.macros.p), c: round(r.macros.c), f: round(r.macros.f),
    at: at.getTime(), fixed: r.item.id,
  };
}

/** auto mode: items whose time has passed, not logged and not skipped today */
export function dueAuto(rows: FixedRow[], nowMin: number, skipped: string[]): FixedRow[] {
  return rows.filter((r) => !r.logged && r.food && r.item.time <= nowMin && !skipped.includes(r.item.id));
}
