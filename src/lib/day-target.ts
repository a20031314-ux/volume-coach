/** The day's nutrition target with 치팅데이 / 상쇄 adjustments applied. */
import { adjustFor, bank, DEFAULT_CHEAT, type Adjust, type Bank, type DayIntake } from './cheat';
import { nutritionTargets, type NutritionTargets } from './nutrition';
import type { BodyComp, CheatSettings, Meal, Settings, WorkoutLog } from './types';

export interface DayTarget extends NutritionTargets { base: number; cheat: Adjust }

export const cheatOf = (s: Settings): CheatSettings => ({ ...DEFAULT_CHEAT, ...(s.cheat ?? {}) });

/** Move the calorie change into carbs and fat (protein stays); fat never drops under 70%. */
export function applyKcal(t: NutritionTargets, dk: number): NutritionTargets {
  if (!dk) return t;
  const fat = Math.max(Math.round(t.f * 0.7), Math.round(t.f + (dk * 0.3) / 9));
  const carb = Math.max(0, Math.round(t.c + (dk - (fat - t.f) * 9) / 4));
  return { ...t, kcal: t.kcal + dk, f: fat, c: carb };
}

export interface DayInputs { settings: Settings; comps: BodyComp[]; logs: WorkoutLog[]; meals: Meal[] }

export function intakeOn(meals: Meal[], date: string) {
  const day = meals.filter((m) => m.date === date);
  return { k: day.reduce((a, m) => a + m.kcal, 0), logged: day.length > 0 };
}

/** what bank()/overDays() need for one day */
export function dayIntake(x: DayInputs, date: string): DayIntake {
  const t = nutritionTargets(x.settings.profile, x.comps, x.logs, date);
  const i = intakeOn(x.meals, date);
  return { date, target: t?.kcal ?? 0, bmr: t?.bmr ?? 0, intake: i.k, logged: i.logged && !!t };
}

export function cheatBank(x: DayInputs, today: string): Bank | null {
  const c = cheatOf(x.settings);
  return c.on ? bank(c, today, (d) => dayIntake(x, d)) : null;
}

export function dayTarget(x: DayInputs, date: string, today: string): DayTarget | null {
  const t = nutritionTargets(x.settings.profile, x.comps, x.logs, date);
  if (!t) return null;
  const c = cheatOf(x.settings);
  // the bank only matters on the cheat day itself, measured up to the day before
  const b = c.on ? bank(c, date <= today ? date : today, (d) => dayIntake(x, d)) : null;
  const adj = adjustFor(c, date, t.kcal, t.bmr, b && b.cheatDay === date ? b.banked : null);
  return { ...applyKcal(t, adj.kcal), base: t.kcal, cheat: adj };
}
