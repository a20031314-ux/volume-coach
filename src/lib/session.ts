/** Workout session helpers. Pure functions, no storage or device APIs. */
import { HEAVY } from './exercises';
import type { Goal, MuscleKey, Session, SessionDetail, SessionExercise, SessionSet, WorkoutLog } from './types';

/** Rest between sets, seconds — matches the rest shown next to each exercise's rep range. */
export function restSeconds(exercise: string, goal: Goal = 'hyp'): number {
  const heavy = HEAVY.has(exercise);
  if (goal === 'str') return heavy ? 180 : 120;
  if (goal === 'cut' || goal === 'fit') return heavy ? 120 : 60;
  return heavy ? 150 : 90;
}

export interface PlannedExercise { name: string; muscle: MuscleKey; sets: number }

export function newSession(
  plan: PlannedExercise[], detail: SessionDetail, now: number, ids: { session: string; log: () => string }, date: string,
): Omit<Session, 'updatedAt'> {
  return {
    id: ids.session, date, startedAt: now, endedAt: null, lastActivityAt: now, detail,
    exercises: plan.map((p, i) => ({
      key: `${i}-${p.name}`, name: p.name, muscle: p.muscle, planned: Math.max(1, p.sets),
      status: i === 0 ? 'active' : 'pending', startedAt: i === 0 ? now : null, endedAt: null,
      sets: [], doneSets: null, logId: ids.log(),
    })),
  };
}

/** How many sets an exercise counts for, whichever mode recorded it. */
export const setCount = (ex: SessionExercise) => (ex.sets.length ? ex.sets.length : ex.doneSets ?? 0);

/** The WorkoutLog fields an exercise produces, or null when it has no sets. */
export function logFields(ex: SessionExercise, session: Pick<Session, 'id' | 'date'>, now: number): Omit<WorkoutLog, 'updatedAt'> | null {
  const n = setCount(ex);
  if (!n) return null;
  const kgs = ex.sets.map((s) => s.kg).filter((k): k is number => k != null && k > 0);
  const reps = ex.sets.map((s) => s.reps).filter((r): r is number => r != null && r > 0);
  return {
    id: ex.logId, date: session.date, exercise: ex.name, muscle: ex.muscle, sets: n,
    kg: kgs.length ? Math.max(...kgs) : null,
    reps: reps.length ? reps.join('/') : '',
    at: ex.endedAt ?? ex.sets[ex.sets.length - 1]?.at ?? now,
    sessionId: session.id,
  };
}

export interface LastPerformance { date: string; sets: SessionSet[]; count: number; kg: number | null; reps: string }

/** Most recent time this exercise was done, outside the given session. */
export function lastPerformance(name: string, sessions: Session[], logs: WorkoutLog[], excludeSessionId?: string): LastPerformance | null {
  let best: LastPerformance | null = null;
  let bestAt = -1;
  for (const s of sessions) {
    if (s.deleted || s.id === excludeSessionId) continue;
    for (const ex of s.exercises) {
      if (ex.name !== name || !setCount(ex)) continue;
      const at = ex.endedAt ?? ex.sets[ex.sets.length - 1]?.at ?? s.startedAt;
      if (at > bestAt) {
        bestAt = at;
        const kgs = ex.sets.map((x) => x.kg ?? 0);
        best = { date: s.date, sets: ex.sets, count: setCount(ex), kg: kgs.length ? Math.max(...kgs) || null : null, reps: ex.sets.map((x) => x.reps).filter(Boolean).join('/') };
      }
    }
  }
  for (const l of logs) {
    if (l.deleted || l.exercise !== name || (excludeSessionId && l.sessionId === excludeSessionId)) continue;
    if (l.sessionId && sessions.some((s) => s.id === l.sessionId)) continue; // already counted with detail
    if (l.at > bestAt) {
      bestAt = l.at;
      best = { date: l.date, sets: [], count: l.sets, kg: l.kg ?? null, reps: l.reps ?? '' };
    }
  }
  return best;
}

/** Values to prefill the next set with: this session's last set, else the same set number last time. */
export function prefill(ex: SessionExercise, last: LastPerformance | null): { kg: number | null; reps: number | null } {
  const mine = ex.sets[ex.sets.length - 1];
  if (mine) return { kg: mine.kg ?? null, reps: mine.reps ?? null };
  const prev = last?.sets[0];
  if (prev) return { kg: prev.kg ?? null, reps: prev.reps ?? null };
  const firstReps = Number(String(last?.reps ?? '').split('/')[0]);
  return { kg: last?.kg ?? null, reps: Number.isFinite(firstReps) && firstReps > 0 ? firstReps : null };
}

export interface SessionSummary {
  durationS: number;
  totalSets: number;
  volumeKg: number;
  done: number;
  skipped: number;
  perMuscle: { muscle: MuscleKey; sets: number }[];
  avgRestS: number | null;
}

export function summarize(s: Session, now: number): SessionSummary {
  const end = s.endedAt ?? now;
  let totalSets = 0, volumeKg = 0, restSum = 0, restN = 0;
  const per = new Map<MuscleKey, number>();
  for (const ex of s.exercises) {
    const n = setCount(ex);
    totalSets += n;
    if (n) per.set(ex.muscle, (per.get(ex.muscle) ?? 0) + n);
    for (let i = 0; i < ex.sets.length; i++) {
      const st = ex.sets[i];
      volumeKg += (st.kg ?? 0) * (st.reps ?? 0);
      if (i > 0) {
        const gap = (st.at - ex.sets[i - 1].at) / 1000;
        if (gap > 0 && gap < 15 * 60) { restSum += gap; restN++; }
      }
    }
  }
  return {
    durationS: Math.max(0, Math.round((end - s.startedAt) / 1000)),
    totalSets, volumeKg: Math.round(volumeKg),
    done: s.exercises.filter((e) => e.status === 'done').length,
    skipped: s.exercises.filter((e) => e.status === 'skipped').length,
    perMuscle: [...per.entries()].map(([muscle, sets]) => ({ muscle, sets })),
    avgRestS: restN ? Math.round(restSum / restN) : null,
  };
}

export const shouldAutoEnd = (s: Session, now: number, idleMin: number) =>
  s.endedAt == null && idleMin > 0 && now - s.lastActivityAt > idleMin * 60_000;
