import { useMemo } from 'react';

import { addDays, today } from '@/lib/dates';
import { doneSessions, nextPrescription, type DoneSession, type Prescription, type StrengthProgram } from '@/lib/progression';
import { strengthTable, type StrengthEntry } from '@/lib/strength';
import type { Session, WorkoutLog } from '@/lib/types';

import { live, useData } from './store';

/** Best estimated 1RM per exercise over the last 4 months. */
export function useStrengthTable(): Map<string, StrengthEntry> {
  const sessionsT = useData((s) => s.sessions);
  const logsT = useData((s) => s.logs);
  return useMemo(() => strengthTable(live(sessionsT), live(logsT), addDays(today(), -120)), [sessionsT, logsT]);
}

/** Each day an exercise was trained, with its sets (session detail where there is any). */
export function liftDays(name: string, sessions: Session[], logs: WorkoutLog[]): { date: string; lastAt: number; sets: { kg?: number | null; reps?: number | null }[] }[] {
  const by = new Map<string, { lastAt: number; sets: { kg?: number | null; reps?: number | null }[] }>();
  const add = (date: string, at: number, sets: { kg?: number | null; reps?: number | null }[]) => {
    const cur = by.get(date) ?? { lastAt: 0, sets: [] };
    by.set(date, { lastAt: Math.max(cur.lastAt, at), sets: [...cur.sets, ...sets] });
  };
  const detailed = new Set<string>();
  for (const s of sessions) for (const ex of s.exercises) {
    if (ex.name !== name || !ex.sets.length) continue;
    detailed.add(ex.logId);
    add(s.date, Math.max(...ex.sets.map((x) => x.at)), ex.sets);
  }
  for (const l of logs) {
    if (l.exercise !== name || detailed.has(l.id)) continue;
    const reps = parseInt(l.reps ?? '', 10) || null;
    add(l.date, l.at, Array.from({ length: l.sets }, () => ({ kg: l.kg ?? null, reps })));
  }
  return [...by.entries()].map(([date, v]) => ({ date, ...v }));
}

export interface ProgramState {
  program: StrengthProgram;
  done: DoneSession[];
  next: Prescription | null;
  /** a program session is due today (enough rest since the last one, not done today) */
  due: boolean;
  doneToday: boolean;
}

export function useProgram(): ProgramState | null {
  const program = useData((s) => s.settings.program ?? null);
  const sessionsT = useData((s) => s.sessions);
  const logsT = useData((s) => s.logs);
  return useMemo(() => {
    if (!program) return null;
    const days = liftDays(program.lift, live(sessionsT), live(logsT));
    const done = doneSessions(program, days);
    // trained today already (even before the program started): the next one waits
    const trainedToday = days.some((d) => d.date === today());
    const next = nextPrescription(program, done);
    const last = done[done.length - 1]?.date;
    const doneToday = last === today();
    const gap = program.perWeek >= 3 ? 1 : program.perWeek === 2 ? 2 : 5;
    const due = !!next && !doneToday && !trainedToday && today() >= program.start && (!last || addDays(last, gap) <= today());
    return { program, done, next, due, doneToday };
  }, [program, sessionsT, logsT]);
}
