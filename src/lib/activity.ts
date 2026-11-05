import type { Run, Session, WorkoutLog } from './types';

/** Steps and walking+running distance for one day, as the phone's health store reports it. */
export interface DaySteps { steps: number; meters: number }

export interface DayActivity {
  lift: { sets: number; minutes: number; kcal: number };
  run: { km: number; minutes: number; kcal: number; count: number };
  /** null when steps aren't connected or not read yet */
  walk: { steps: number; km: number; kcal: number } | null;
  /** minutes of deliberate exercise (lifting + running) */
  activeMin: number;
  kcal: number;
}

const MIN_PER_SET = 3;
/** ~MET 5 for resistance training, as kcal per kg per minute */
const LIFT_KCAL_PER_KG_MIN = 5 / 60;
/** net cost of walking, kcal per kg per km */
const WALK_KCAL_PER_KG_KM = 0.5;

/**
 * Sums one day's training. Health stores count running steps and distance too (the phone was
 * in your pocket), so runs recorded here are subtracted from the walking distance to avoid
 * counting them twice. Steps stay as the store reports them — that's the number people know.
 */
export function dayActivity(
  date: string,
  data: { logs: WorkoutLog[]; sessions: Session[]; runs: Run[]; steps: DaySteps | null; weightKg: number; now: number },
): DayActivity {
  const { weightKg: w } = data;
  const logs = data.logs.filter((l) => l.date === date);
  const sessions = data.sessions.filter((s) => s.date === date);
  const runs = data.runs.filter((r) => r.date === date);

  const sets = logs.reduce((a, l) => a + l.sets, 0);
  let liftMin = 0;
  for (const s of sessions) {
    const end = s.endedAt ?? Math.min(data.now, s.lastActivityAt);
    liftMin += Math.max(0, end - s.startedAt) / 60e3;
  }
  const loggedBySession = new Set(sessions.map((s) => s.id));
  liftMin += logs.filter((l) => !l.sessionId || !loggedBySession.has(l.sessionId)).reduce((a, l) => a + l.sets * MIN_PER_SET, 0);
  liftMin = Math.round(liftMin);

  const runM = runs.reduce((a, r) => a + r.distanceM, 0);
  const runMin = Math.round(runs.reduce((a, r) => a + r.movingS, 0) / 60);
  const runKcal = runs.reduce((a, r) => a + r.kcal, 0);

  let walk: DayActivity['walk'] = null;
  if (data.steps) {
    const km = Math.max(0, data.steps.meters - runM) / 1000;
    walk = { steps: Math.round(data.steps.steps), km: Math.round(km * 10) / 10, kcal: Math.round(km * w * WALK_KCAL_PER_KG_KM) };
  }

  const liftKcal = Math.round(liftMin * w * LIFT_KCAL_PER_KG_MIN);
  return {
    lift: { sets, minutes: liftMin, kcal: liftKcal },
    run: { km: Math.round(runM / 100) / 10, minutes: runMin, kcal: runKcal, count: runs.length },
    walk,
    activeMin: liftMin + runMin,
    kcal: liftKcal + runKcal + (walk?.kcal ?? 0),
  };
}

/** One-line summary for headers, e.g. "8,214보 · 웨이트 52분 · 러닝 5.0km". Empty when nothing happened. */
export function activityLine(a: DayActivity): string {
  return [
    a.walk && a.walk.steps ? `${a.walk.steps.toLocaleString('ko-KR')}보` : null,
    a.lift.minutes ? `웨이트 ${a.lift.minutes}분` : null,
    a.run.count ? `러닝 ${a.run.km.toFixed(1)}km` : null,
  ].filter(Boolean).join(' · ');
}
