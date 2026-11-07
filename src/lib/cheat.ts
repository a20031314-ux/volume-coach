/**
 * 치팅데이 저금통과 상쇄.
 * - 저금: on the days before a cheat day, what's left under the target goes into a bank (capped per
 *   day; a day eaten below BMR counts as zero so the gauge never rewards not eating).
 *   On the cheat day the target rises by what was banked (up to the chosen budget).
 * - 상쇄: a day well over target can be paid back over the next few days, part food (a capped cut that
 *   never takes the target under 1.1×BMR) and part movement (walking / running minutes).
 */
import { addDays, diffDays, parse } from './dates';
import type { CheatSettings, Offset } from './types';

export type { CheatSettings, Offset };

export const DEFAULT_CHEAT: CheatSettings = {
  on: false, mode: 'weekly', dow: 6, date: null, since: null, budget: 1000, save: 0,
  offsetDays: 3, offsetMix: 'mix', offsets: [], dismissed: [],
};

/** the most a single day can add to the bank or take off the target */
export const dayCap = (target: number) => Math.min(400, Math.round(target * 0.2));
export const cutCap = (target: number, bmr: number) => Math.max(0, Math.min(300, Math.round(target * 0.15), Math.round(target - bmr * 1.1)));

/** The next cheat day on or after `from` (null when date mode has none set, or it's past). */
export function nextCheatDay(c: CheatSettings, from: string): string | null {
  if (c.mode === 'date') return c.date && c.date >= from ? c.date : null;
  const dow = parse(from).getDay();
  return addDays(from, (c.dow - dow + 7) % 7);
}

/** First day that counts toward the next cheat day. */
export function bankStart(c: CheatSettings, cheatDay: string): string {
  if (c.mode === 'weekly') return addDays(cheatDay, -6);
  const since = c.since ?? addDays(cheatDay, -13);
  return since < addDays(cheatDay, -13) ? addDays(cheatDay, -13) : since;
}

export interface DayIntake { date: string; target: number; bmr: number; intake: number; logged: boolean }
export interface BankDay { date: string; saved: number; low: boolean }

/** What one day adds to the bank. `target` is the day's target before any saving goal or payback. */
export function bankDay(d: DayIntake, offsetCut = 0): BankDay {
  if (!d.logged) return { date: d.date, saved: 0, low: false };
  if (d.intake < d.bmr) return { date: d.date, saved: 0, low: true };
  const saved = Math.max(0, Math.min(dayCap(d.target), d.target - offsetCut - d.intake));
  return { date: d.date, saved: Math.round(saved), low: false };
}

export interface Bank { cheatDay: string; daysLeft: number; days: BankDay[]; banked: number; budget: number; pct: number; lowDays: number }

/** The gauge toward the next cheat day: days from the bank start up to yesterday. */
export function bank(c: CheatSettings, today: string, intake: (date: string) => DayIntake): Bank | null {
  const cheatDay = nextCheatDay(c, today);
  if (!cheatDay) return null;
  const start = bankStart(c, cheatDay);
  const days: BankDay[] = [];
  for (let d = start; d < today && d < cheatDay; d = addDays(d, 1)) days.push(bankDay(intake(d), offsetCutOn(c.offsets, d)));
  const banked = Math.min(c.budget, days.reduce((a, x) => a + x.saved, 0));
  return { cheatDay, daysLeft: diffDays(cheatDay, today), days, banked, budget: c.budget, pct: c.budget ? (banked / c.budget) * 100 : 0, lowDays: days.filter((x) => x.low).length };
}

/** kcal taken off on `date` by one plan (per-day schedule; older plans saved a flat `cut`) */
export function cutOn(o: Offset, date: string): number {
  const i = diffDays(date, o.from);
  if (i < 0) return 0;
  if (o.cuts) return o.cuts[i] ?? 0;
  return i < o.days ? o.cut : 0;
}

/** kcal/day taken off by payback plans running on `date` */
export function offsetCutOn(offsets: Offset[], date: string): number {
  return offsets.reduce((a, o) => a + cutOn(o, date), 0);
}

/** last day a plan still cuts */
export const offsetEnd = (o: Offset) => addDays(o.from, (o.cuts?.length ?? o.days) - 1);

export interface Adjust { kcal: number; label: string | null }

/**
 * Change to the day's calorie target: + banked on the cheat day, − saving goal on the days
 * before it, − payback cut while a plan runs. Never below 1.1×BMR.
 */
export function adjustFor(c: CheatSettings, date: string, base: number, bmr: number, banked: number | null): Adjust {
  if (!c.on) return { kcal: 0, label: null };
  const cheatDay = nextCheatDay(c, date);
  const parts: string[] = [];
  let k = 0;
  if (cheatDay === date && banked != null) { k += banked; parts.push(`치팅데이 +${banked}`); }
  else if (cheatDay && c.save > 0 && date >= bankStart(c, cheatDay)) { k -= c.save; parts.push(`치팅 저금 −${c.save}`); }
  const cut = offsetCutOn(c.offsets, date);
  if (cut) { k -= cut; parts.push(`상쇄 −${cut}`); }
  const floor = Math.round(bmr * 1.1);
  if (base + k < floor) k = floor - base;
  return { kcal: Math.round(k), label: parts.length ? parts.join(' · ') : null };
}

export interface OffsetPlan {
  over: number;
  /** days the food cut runs (may stretch past the chosen length when other plans already use the room) */
  days: number;
  /** kcal off each day from the first day */
  cuts: number[];
  /** the largest daily cut */
  cut: number;
  foodKcal: number; moveKcal: number; walkMin: number; runMin: number;
}

const MIX_FOOD = { diet: 1, mix: 0.6, move: 0 } as const;
const WALK_MET = 3.5, RUN_MET = 8.3;
export const MIN_DAYS = 2, MAX_DAYS = 7;

/** Shortest plan (2–7 days) that pays the food part back within the daily cap. */
export function autoDays(over: number, mix: CheatSettings['offsetMix'], target: number, bmr: number): number {
  const cap = cutCap(target, bmr);
  if (!cap) return MIN_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.ceil((over * MIX_FOOD[mix]) / cap)));
}

/**
 * Spread `over` kcal: the food part evenly over `days` (rounded to 10kcal), never more than the daily
 * cap together with plans already running — what doesn't fit moves to later days (up to 14), and
 * whatever still doesn't fit becomes walking / running.
 */
export function offsetPlan(over: number, o: { days: number; mix: CheatSettings['offsetMix']; target: number; bmr: number; weightKg: number; from?: string; existing?: Offset[] }): OffsetPlan {
  const days = Math.max(1, o.days);
  const cap = cutCap(o.target, o.bmr);
  const food = over * MIX_FOOD[o.mix];
  const per = Math.min(cap, Math.round(food / days / 10) * 10);
  const cuts: number[] = [];
  let left = Math.min(food, per * days);
  for (let i = 0; left > 0 && i < 14; i++) {
    const used = o.from && o.existing ? offsetCutOn(o.existing, addDays(o.from, i)) : 0;
    const c = Math.max(0, Math.min(per, cap - used, Math.round(left / 10) * 10));
    cuts.push(c);
    left -= c;
  }
  while (cuts.length && cuts[cuts.length - 1] === 0) cuts.pop();
  const foodKcal = cuts.reduce((a, b) => a + b, 0);
  const moveKcal = Math.max(0, Math.round(over - foodKcal));
  // MET × kg × hours = kcal; count only the part above resting (MET − 1)
  const perMin = (met: number) => ((met - 1) * o.weightKg) / 60;
  return {
    over: Math.round(over), days: Math.max(days, cuts.length), cuts, cut: Math.max(0, ...cuts), foodKcal, moveKcal,
    walkMin: Math.round(moveKcal / perMin(WALK_MET) / 5) * 5,
    runMin: Math.round(moveKcal / perMin(RUN_MET) / 5) * 5,
  };
}

/** The two choices shown: the shortest that fits, and 7 days (when that's different). */
export function offsetChoices(over: number, o: Omit<Parameters<typeof offsetPlan>[1], 'days'>): { label: string; plan: OffsetPlan }[] {
  const fast = autoDays(over, o.mix, o.target, o.bmr);
  const out = [{ label: fast === MAX_DAYS ? '7일' : `빠르게 ${fast}일`, plan: offsetPlan(over, { ...o, days: fast }) }];
  if (fast < MAX_DAYS && o.mix !== 'move') out.push({ label: '여유 있게 7일', plan: offsetPlan(over, { ...o, days: MAX_DAYS }) });
  return out;
}

/** a day counts as overeating past this */
export const overLine = (target: number) => Math.max(300, Math.round(target * 0.12));

/** Recent finished days (up to 3 back) that went well over and have no plan or dismissal yet. */
export function overDays(c: CheatSettings, today: string, intake: (date: string) => DayIntake, targetOf: (date: string) => number): { date: string; over: number }[] {
  const out: { date: string; over: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = addDays(today, -i);
    const x = intake(d);
    if (!x.logged || c.dismissed.includes(d) || c.offsets.some((o) => o.src === d)) continue;
    const over = x.intake - targetOf(d);
    if (over > overLine(x.target)) out.push({ date: d, over: Math.round(over) });
  }
  return out;
}

