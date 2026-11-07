/**
 * MY 탭 추세: one point per week (Monday-start) for body weight, a main lift's e1RM, sets per muscle
 * and protein. The same weekly numbers will feed the coach engine later (docs/coach-plan.md).
 */
import { weekMonday } from './cardio-week';
import { addDays } from './dates';
import { MUSCLES } from './exercises';
import { MAIN_LIFTS, e1rm, type MainLift } from './strength';
import type { BodyComp, Meal, MuscleKey, Session, WorkoutLog } from './types';

export interface Trends {
  /** Mondays, oldest first */
  weeks: string[];
  /** latest body weight known in each week (InBody or 체중 기록) */
  weight: (number | null)[];
  /** fat-free mass when measured */
  ffm: (number | null)[];
  /** the lift with the most weeks of data, best e1RM per week */
  lift: { name: MainLift; values: (number | null)[] } | null;
  /** all main lifts' latest e1RM and the change over the period */
  lifts: { name: MainLift; now: number; change: number | null }[];
  /** average sets per trained muscle (muscles that are on) */
  sets: (number | null)[];
  /** muscles below `min` sets in the latest full week */
  lowMuscles: { k: MuscleKey; sets: number }[];
  /** muscles above `max` in the latest full week */
  highMuscles: { k: MuscleKey; sets: number }[];
  /** average protein / kcal per logged day */
  protein: (number | null)[];
  kcal: (number | null)[];
  /** logged days per week */
  mealDays: number[];
}

export interface TrendInput {
  logs: WorkoutLog[];
  sessions: Session[];
  meals: Meal[];
  comps: BodyComp[];
  /** muscles turned off in settings */
  off: MuscleKey[];
  min: number;
  max: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weeklyTrends(x: TrendInput, today: string, weeks: number): Trends {
  const last = weekMonday(today);
  const mondays = Array.from({ length: weeks }, (_, i) => addDays(last, -7 * (weeks - 1 - i)));
  const idx = (date: string) => {
    const i = mondays.indexOf(weekMonday(date));
    return i;
  };
  const from = mondays[0];

  // body
  const weight: (number | null)[] = mondays.map(() => null);
  const ffm: (number | null)[] = mondays.map(() => null);
  for (const b of [...x.comps].filter((b) => !b.deleted && b.date >= from).sort((a, b) => a.date.localeCompare(b.date))) {
    const i = idx(b.date);
    if (i < 0) continue;
    weight[i] = b.weight;
    if (b.ffm) ffm[i] = b.ffm;
  }

  // strength: best e1RM per week per main lift (sessions' sets, else the log's kg × reps)
  const best = new Map<MainLift, (number | null)[]>(MAIN_LIFTS.map((l) => [l, mondays.map(() => null)]));
  const put = (name: string, kg: number | null | undefined, reps: number, date: string) => {
    const row = best.get(name as MainLift);
    const i = idx(date);
    const v = kg && reps ? e1rm(kg, reps) : null;
    if (!row || i < 0 || v == null) return;
    row[i] = Math.max(row[i] ?? 0, v);
  };
  const detailed = new Set<string>();
  for (const s of x.sessions) {
    if (s.deleted || s.date < from) continue;
    for (const ex of s.exercises) {
      if (ex.sets.length) detailed.add(ex.logId);
      for (const st of ex.sets) put(ex.name, st.kg, st.reps ?? 0, s.date);
    }
  }
  const logs = x.logs.filter((l) => !l.deleted && l.date >= from);
  for (const l of logs) if (!detailed.has(l.id)) put(l.exercise, l.kg, parseInt(l.reps ?? '', 10) || 0, l.date);
  const filled = (v: (number | null)[]) => v.filter((n) => n != null).length;
  const ranked = [...best.entries()].filter(([, v]) => filled(v) > 0).sort((a, b) => filled(b[1]) - filled(a[1]));
  const lift = ranked.length ? { name: ranked[0][0], values: ranked[0][1].map((v) => (v == null ? null : Math.round(v))) } : null;
  const lifts = ranked.map(([name, v]) => {
    const pts = v.filter((n): n is number => n != null);
    return { name, now: Math.round(pts[pts.length - 1]), change: pts.length > 1 ? Math.round(pts[pts.length - 1] - pts[0]) : null };
  });

  // volume
  const on = MUSCLES.map((m) => m.k).filter((k) => !x.off.includes(k));
  const perWeek = mondays.map(() => new Map<MuscleKey, number>());
  for (const l of logs) {
    const i = idx(l.date);
    if (i >= 0) perWeek[i].set(l.muscle, (perWeek[i].get(l.muscle) ?? 0) + l.sets);
  }
  const sets = perWeek.map((m) => {
    const total = on.reduce((a, k) => a + (m.get(k) ?? 0), 0);
    return total ? Math.round((total / on.length) * 10) / 10 : null;
  });
  // the latest week that's over: last week (this week is still going)
  const ref = perWeek.length > 1 ? perWeek[perWeek.length - 2] : perWeek[0];
  const lowMuscles = on.map((k) => ({ k, sets: ref.get(k) ?? 0 })).filter((m) => m.sets < x.min).sort((a, b) => a.sets - b.sets);
  const highMuscles = on.map((k) => ({ k, sets: ref.get(k) ?? 0 })).filter((m) => m.sets > x.max).sort((a, b) => b.sets - a.sets);

  // nutrition: per logged day
  const days = mondays.map(() => new Map<string, { p: number; k: number }>());
  for (const m of x.meals) {
    if (m.deleted || m.date < from) continue;
    const i = idx(m.date);
    if (i < 0) continue;
    const d = days[i].get(m.date) ?? { p: 0, k: 0 };
    d.p += m.p; d.k += m.kcal;
    days[i].set(m.date, d);
  }
  const protein = days.map((d) => { const v = avg([...d.values()].map((x) => x.p)); return v == null ? null : Math.round(v); });
  const kcal = days.map((d) => { const v = avg([...d.values()].map((x) => x.k)); return v == null ? null : Math.round(v); });

  return { weeks: mondays, weight, ffm, lift, lifts, sets, lowMuscles, highMuscles, protein, kcal, mealDays: days.map((d) => d.size) };
}

/** Change from the first to the last known value, and per week. */
export function slope(v: (number | null)[]): { first: number; last: number; change: number; perWeek: number } | null {
  const pts = v.map((y, i) => [i, y] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const [i0, first] = pts[0];
  const [i1, last] = pts[pts.length - 1];
  return { first, last, change: last - first, perWeek: (last - first) / (i1 - i0) };
}
