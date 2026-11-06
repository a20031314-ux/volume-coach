/** One day put together: what was done, what it cost, what was eaten. */
import type { DayActivity } from './activity';
import type { MuscleKey, Profile, Session, WorkoutLog } from './types';

export interface Intake { kcal: number; p: number; c: number; f: number; items: number }
export interface Targets { kcal: number; p: number; c: number; f: number; bmr: number }

export interface Burn {
  bmr: number;
  /** everyday living on top of BMR (digestion, standing, moving around) */
  daily: number;
  walk: number;
  exercise: number;
  total: number;
  /** where everyday movement came from */
  dailySource: 'steps' | 'profile';
}

/**
 * Daily burn = BMR + everyday living + walking + exercise. With measured steps, everyday living is
 * small (digestion and general moving) and walking is counted from steps; without them it comes
 * from the profile's activity level. Exercise is counted net of the BMR already running during it.
 */
export function dayBurn(bmr: number, a: DayActivity, act: Profile['act'], dayFraction = 1): Burn {
  const perMin = bmr / 1440;
  const exMin = a.activeMin;
  const exercise = Math.max(0, Math.round(a.lift.kcal + a.run.kcal + a.outdoor.kcal - perMin * exMin));
  const hasSteps = a.walk?.steps != null || (a.walk != null && a.walk.km > 0);
  const dailyRate = hasSteps ? 0.15 : ([0.25, 0.35, 0.45][Number(act ?? 1)] ?? 0.35);
  const b = Math.round(bmr * dayFraction);
  const daily = Math.round(bmr * dailyRate * dayFraction);
  const walk = hasSteps ? a.walk?.kcal ?? 0 : 0;
  return { bmr: b, daily, walk, exercise, total: b + daily + walk + exercise, dailySource: hasSteps ? 'steps' : 'profile' };
}

export function dayIntake(meals: { date: string; kcal: number; p: number; c: number; f: number }[], date: string): Intake {
  const m = meals.filter((x) => x.date === date);
  const r = (k: 'kcal' | 'p' | 'c' | 'f') => Math.round(m.reduce((a, x) => a + x[k], 0));
  return { kcal: r('kcal'), p: r('p'), c: r('c'), f: r('f'), items: m.length };
}

/** kg × reps over the day's sets (session sets, plus logged sets with a single weight/reps) */
export function liftVolume(logs: WorkoutLog[], sessions: Session[], date: string): { kg: number; perMuscle: { muscle: MuscleKey; sets: number }[] } {
  let kg = 0;
  const per = new Map<MuscleKey, number>();
  const inSession = new Set<string>();
  for (const s of sessions.filter((x) => x.date === date)) {
    for (const e of s.exercises) {
      if (e.sets.length) { inSession.add(e.logId); for (const st of e.sets) kg += (st.kg ?? 0) * (st.reps ?? 0); }
    }
  }
  for (const l of logs.filter((x) => x.date === date)) {
    per.set(l.muscle, (per.get(l.muscle) ?? 0) + l.sets);
    if (inSession.has(l.id)) continue;
    const reps = parseInt(l.reps ?? '', 10);
    if (l.kg && reps) kg += l.kg * reps * l.sets;
  }
  return { kg: Math.round(kg), perMuscle: [...per.entries()].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets) };
}

/** A few plain facts worth noticing, most important first. No advice beyond the numbers. */
export function reviewNotes(x: { intake: Intake; targets: Targets | null; burn: Burn; isToday: boolean; weightKg: number }): string[] {
  const out: string[] = [];
  const { intake: i, targets: t, burn } = x;
  if (!i.items) out.push(x.isToday ? '아직 먹은 음식 기록이 없어요' : '먹은 음식 기록이 없어요');
  if (t && i.items) {
    const dp = t.p - i.p;
    if (dp > 10) out.push(`단백질 ${dp}g 부족 (목표 ${t.p}g)`);
    else if (dp <= 0) out.push(`단백질 목표 달성 · 체중 1kg당 ${(i.p / x.weightKg).toFixed(1)}g`);
    const dk = i.kcal - t.kcal;
    if (!x.isToday && Math.abs(dk) >= 300) out.push(`목표 칼로리보다 ${Math.abs(dk).toLocaleString('ko-KR')}kcal ${dk > 0 ? '많이' : '적게'} 먹었어요`);
  }
  if (i.items && !x.isToday) {
    const bal = i.kcal - burn.total;
    out.push(`섭취 − 소모 ${bal > 0 ? '+' : bal < 0 ? '−' : ''}${Math.abs(bal).toLocaleString('ko-KR')}kcal`);
  }
  return out;
}
