/**
 * 식단 추천: at each meal time the user set, one meal built from the protein and staple carb
 * this person eats most (식습관 리포트), sized to what's left of the day's target. A food they
 * don't have right now is swapped for something equivalent (대체 식단).
 */
import { FOOD_DB, macrosOf, type FoodDef, type Macros } from './foods';
import { dominant, sensible, swaps, total, type SwapPart } from './swap';

export type { MealPlanSettings } from './types';

export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function mealName(m: number): string {
  const h = m / 60;
  if (h >= 4 && h < 11) return '아침';
  if (h >= 11 && h < 15) return '점심';
  if (h >= 15 && h < 17) return '간식';
  if (h >= 17 && h < 21) return '저녁';
  return '야식';
}

/** a meal stays "current" this long after its time, so at 12:50 lunch is still the one shown */
const GRACE = 90;

/** Which of the day's meals is next at `nowMin` (minutes after midnight); null when all are past. */
export function nextMeal(times: number[], nowMin: number): number | null {
  const i = times.findIndex((t) => t + GRACE > nowMin);
  return i < 0 ? null : i;
}

export interface DayTarget { kcal: number; p: number; c: number; f: number }

/**
 * This meal's share of what's left: remaining ÷ meals left (this one included).
 * Null when the day is basically done.
 */
export function mealTarget(day: DayTarget, eaten: Macros, mealsLeft: number): Macros | null {
  const n = Math.max(1, mealsLeft);
  const k = day.kcal - eaten.k;
  if (k < 150) return null;
  const share = (x: number) => Math.max(0, x) / n;
  return {
    k: Math.min(1000, Math.max(250, share(k))),
    p: Math.min(60, Math.max(20, share(day.p - eaten.p))),
    c: Math.min(130, share(day.c - eaten.c)),
    f: Math.min(35, share(day.f - eaten.f)),
  };
}

const byName = (n: string) => FOOD_DB.find((d) => d.n === n);
const DEFAULT_PROTEIN = ['닭가슴살', '계란', '소고기 우둔', '두부'];
const DEFAULT_CARB = ['흰쌀밥', '현미밥', '고구마'];
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** The person's usual protein and staple, most eaten first; plain defaults without history. */
export function staples(prefer: string[]): { protein: FoodDef[]; carb: FoodDef[] } {
  const defs = prefer.map(byName).filter((d): d is FoodDef => !!d);
  const protein = defs.filter((d) => (d.g === 'protein' || d.g === 'dairy') && dominant(d) === 'p' && d.n !== '단백질 보충제' && d.n !== '프로틴 음료');
  const carb = defs.filter((d) => d.g === 'carb');
  const add = (list: FoodDef[], names: string[]) => [...list, ...names.map(byName).filter((d): d is FoodDef => !!d && !list.includes(d))];
  return { protein: add(protein, DEFAULT_PROTEIN), carb: add(carb, DEFAULT_CARB) };
}

/** biggest sensible amount at or under `amt` */
function fit(d: FoodDef, amt: number): number {
  let a = Math.max(d.step, roundTo(amt, d.step));
  while (a > d.step && !sensible(d, a)) a -= d.step;
  return sensible(d, a) ? a : 0;
}

export interface MealRec {
  parts: SwapPart[];
  total: Macros;
  /** foods that were swapped because the user doesn't have them */
  swapped: string[];
}

/**
 * Staple carb sized to ~85% of the meal's carbs, the usual protein for the rest of the protein,
 * then each food in `unavailable` replaced by its 대체 식단 (same macros, preferred foods first).
 */
export function recommendMeal(target: Macros, opts: { prefer: string[]; unavailable?: string[] }): MealRec {
  const { protein, carb } = staples(opts.prefer);
  const C = carb[0];
  const parts: SwapPart[] = [];
  const cAmt = target.c >= 15 ? fit(C, (target.c * 0.85) / (C.c / C.base)) : 0;
  if (cAmt) parts.push({ food: C, amt: cAmt });
  const pLeft = target.p - (cAmt ? macrosOf(C, cAmt).p : 0);
  // the usual protein, unless it can't cover the meal in a normal amount (6 eggs isn't lunch)
  for (const P of protein) {
    const amt = fit(P, pLeft / (P.p / P.base));
    const reasonable = P.unit !== '개' || amt <= 4;
    if (amt && reasonable && macrosOf(P, amt).p >= pLeft * 0.75) { parts.unshift({ food: P, amt }); break; }
  }

  const unavailable = opts.unavailable ?? [];
  const swapped: string[] = [];
  let out = parts;
  for (const part of parts) {
    if (!unavailable.includes(part.food.n)) continue;
    const others = out.filter((x) => x !== part).map((x) => x.food.n);
    const alt = swaps(macrosOf(part.food, part.amt), {
      group: part.food.g, exclude: [...unavailable, ...others], prefer: opts.prefer, limit: 1, loose: true,
      primary: part.food.g === 'carb' ? 'c' : 'p',
    })[0];
    if (!alt) continue;
    swapped.push(part.food.n);
    out = out.flatMap((x) => (x === part ? alt.parts : [x]));
  }
  // a filler a swap brought in can duplicate a food already there: merge
  const merged: SwapPart[] = [];
  for (const x of out) {
    const same = merged.find((m) => m.food.n === x.food.n);
    if (same) same.amt += x.amt; else merged.push({ ...x });
  }
  return { parts: merged, total: total(merged), swapped };
}

/** "닭가슴살 150g + 흰쌀밥 1공기 (210g)" without the gram note, for a notification line */
export function shortLabel(parts: SwapPart[]): string {
  return parts.map((p) => {
    const n = Number.isInteger(p.amt) ? String(p.amt) : p.amt.toFixed(1);
    return `${p.food.n} ${n}${p.food.unit}`;
  }).join(' + ');
}
