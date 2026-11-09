/**
 * A strength program for one main lift: waves of three building weeks and one lighter week,
 * expected strength rising from the current estimate toward the target, ending with a test.
 * Each session's weights follow how the last program session actually went.
 */
import { e1rm, type MainLift } from './strength';

export interface StrengthProgram {
  lift: MainLift;
  start: string;           // YYYY-MM-DD
  /** when it was set up; sets earlier on the start day don't count as program sessions */
  startAt?: number;
  start1rm: number;
  target1rm: number;
  weeks: number;
  perWeek: 1 | 2 | 3;
  /** 목표 기한 (YYYY-MM-DD) and how it shares the week with the polygon */
  deadline?: string;
  priority?: 'goal' | 'balance' | 'focus';
}

export interface ProgramSession {
  index: number;
  week: number;            // 1-based
  kind: 'heavy' | 'volume' | 'deload' | 'test';
  sets: number;
  reps: number;
  pct: number;             // of the expected 1RM at this point
  expected1rm: number;
  note?: string;
}

export const SESSION_NAME: Record<ProgramSession['kind'], string> = { heavy: '고중량', volume: '볼륨', deload: '가볍게', test: '테스트' };

// within each 4-week wave: [heavy day, volume day]
const WAVE: { heavy: [number, number, number]; vol: [number, number, number] }[] = [
  { heavy: [4, 6, 0.77], vol: [3, 8, 0.7] },
  { heavy: [4, 5, 0.81], vol: [3, 8, 0.72] },
  { heavy: [5, 3, 0.86], vol: [3, 6, 0.75] },
  { heavy: [3, 5, 0.7], vol: [2, 5, 0.65] }, // lighter week
];

export function buildProgram(p: StrengthProgram): ProgramSession[] {
  const out: ProgramSession[] = [];
  const total = p.weeks * p.perWeek;
  for (let w = 1; w <= p.weeks; w++) {
    const last = w === p.weeks;
    const phase = WAVE[(w - 1) % 4];
    for (let d = 0; d < p.perWeek; d++) {
      const i = out.length;
      const expected1rm = p.start1rm + ((p.target1rm - p.start1rm) * i) / Math.max(1, total - 1);
      if (last && d === p.perWeek - 1) {
        out.push({ index: i, week: w, kind: 'test', sets: 1, reps: 1, pct: 1, expected1rm: p.target1rm, note: '웜업 후 1회 최대 시도 (또는 90%로 최대 반복)' });
        continue;
      }
      // every 4th week is lighter; in the last week that doubles as the taper before the test
      const deload = w % 4 === 0 || (last && phase === WAVE[3]);
      // day 1 heavy; day 2 volume; day 3 repeats the heavy pattern lighter
      const [sets, reps, pct] = d === 1 ? phase.vol : d === 2 ? [phase.heavy[0] - 1, phase.heavy[1], phase.heavy[2] - 0.05] as [number, number, number] : phase.heavy;
      out.push({ index: i, week: w, kind: deload ? 'deload' : d === 1 ? 'volume' : 'heavy', sets, reps, pct, expected1rm });
    }
  }
  return out;
}

/** Percent gain per month the plan asks for, and whether that's realistic for someone training 2+ years. */
export function feasibility(p: Pick<StrengthProgram, 'start1rm' | 'target1rm' | 'weeks'>): { perMonthPct: number; level: 'ok' | 'hard' | 'unlikely'; weeksFor: (pctPerMonth: number) => number } {
  const months = p.weeks / 4.345;
  const perMonthPct = ((p.target1rm / p.start1rm - 1) * 100) / Math.max(0.5, months);
  // short programs also bank some "peaking" (skill at heavy singles), so a few % a month is reachable
  const level = perMonthPct <= 2.5 ? 'ok' : perMonthPct <= 4.5 ? 'hard' : 'unlikely';
  const weeksFor = (r: number) => Math.ceil(((p.target1rm / p.start1rm - 1) * 100 / r) * 4.345);
  return { perMonthPct, level, weeksFor };
}

export interface DoneSession { date: string; best1rm: number | null; hit: boolean }

/** How a logged lift day compares with what was prescribed. */
export function judge(prescribed: ProgramSession, sets: { kg?: number | null; reps?: number | null }[], plannedKg: number): DoneSession['hit'] {
  const work = sets.filter((s) => (s.kg ?? 0) >= plannedKg - 0.01);
  if (prescribed.kind === 'test') return work.length > 0;
  return work.length >= prescribed.sets && work.slice(0, prescribed.sets).every((s) => (s.reps ?? 0) >= prescribed.reps);
}

/**
 * Factor on planned weights from how it's going: the last session's e1RM against what the plan
 * expected then. Two misses in a row pull weights down; clearly beating the plan nudges them up.
 */
export function adjustment(plan: ProgramSession[], done: DoneSession[]): number {
  if (!done.length) return 1;
  const last = done[done.length - 1];
  const exp = plan[Math.min(done.length - 1, plan.length - 1)].expected1rm;
  let f = last.best1rm ? last.best1rm / exp : 1;
  const missedTwice = done.length >= 2 && !done[done.length - 1].hit && !done[done.length - 2].hit;
  if (missedTwice) f = Math.min(f, 0.95);
  return Math.max(0.9, Math.min(1.05, f));
}

export interface Prescription { session: ProgramSession; kg: number; sets: number; reps: number; doneCount: number; total: number }

/** The next program session with its weight, rounded to 2.5 kg. */
export function nextPrescription(p: StrengthProgram, done: DoneSession[]): Prescription | null {
  const plan = buildProgram(p);
  if (done.length >= plan.length) return null;
  const s = plan[done.length];
  const f = adjustment(plan, done);
  const kg = Math.max(20, Math.round((s.expected1rm * f * s.pct) / 2.5) * 2.5);
  return { session: s, kg, sets: s.sets, reps: s.reps, doneCount: done.length, total: plan.length };
}

/** Days the lift was trained since the program started, in order, as program sessions. */
export function doneSessions(
  p: StrengthProgram,
  days: { date: string; lastAt?: number; sets: { kg?: number | null; reps?: number | null }[] }[],
): DoneSession[] {
  const plan = buildProgram(p);
  const out: DoneSession[] = [];
  const counts = (x: { date: string; lastAt?: number }) => x.date > p.start || (x.date === p.start && (!p.startAt || (x.lastAt ?? 0) >= p.startAt));
  for (const d of days.filter(counts).sort((a, b) => a.date.localeCompare(b.date))) {
    if (out.length >= plan.length) break;
    const pres = nextPrescription(p, out)!;
    let best: number | null = null;
    for (const s of d.sets) { const v = s.kg && s.reps ? e1rm(s.kg, s.reps) : null; if (v && (!best || v > best)) best = v; }
    out.push({ date: d.date, best1rm: best, hit: judge(pres.session, d.sets, pres.kg) });
  }
  return out;
}
