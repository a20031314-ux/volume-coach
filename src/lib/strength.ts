/**
 * How strong the user is on each exercise: an estimated 1-rep max (e1RM) from their own sets,
 * or, for exercises they haven't done, derived from a main lift (벤치 100 → 인클라인 바벨 ~80).
 */
import { library, type Exercise } from './exercises';
import type { CustomExercise, Session, WorkoutLog } from './types';

/** Epley. Above ~12 reps the estimate gets loose, so those sets don't count. */
export function e1rm(kg: number, reps: number): number | null {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return null;
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

/** Weight for `reps` leaving `rir` reps in reserve. */
export function weightFor(oneRm: number, reps: number, rir = 2): number {
  return oneRm / (1 + (reps + rir) / 30);
}

export const MAIN_LIFTS = ['바벨 벤치프레스', '백스쿼트', '컨벤셔널 데드리프트', '오버헤드프레스'] as const;
export type MainLift = (typeof MAIN_LIFTS)[number];

export const SHORT: Record<MainLift, string> = { '바벨 벤치프레스': '벤치', '백스쿼트': '스쿼트', '컨벤셔널 데드리프트': '데드', '오버헤드프레스': '오버헤드' };

/**
 * Typical 1RM of an exercise as a share of a main lift's 1RM, from common strength-standard
 * ratios. Dumbbell values are per hand. Machines vary a lot, so these are only a starting point;
 * as soon as the exercise has its own sets, those are used instead.
 */
export const RATIOS: Record<string, { from: MainLift; r: number }> = {
  '인클라인 바벨프레스': { from: '바벨 벤치프레스', r: 0.8 },
  '클로즈그립 벤치프레스': { from: '바벨 벤치프레스', r: 0.85 },
  '덤벨 벤치프레스': { from: '바벨 벤치프레스', r: 0.36 },
  '인클라인 덤벨프레스': { from: '바벨 벤치프레스', r: 0.3 },
  '머신 체스트프레스': { from: '바벨 벤치프레스', r: 0.85 },
  '덤벨 플라이': { from: '바벨 벤치프레스', r: 0.12 },
  '오버헤드프레스': { from: '바벨 벤치프레스', r: 0.62 },
  '덤벨 숄더프레스': { from: '오버헤드프레스', r: 0.36 },
  '머신 숄더프레스': { from: '오버헤드프레스', r: 0.85 },
  '사이드 레터럴 레이즈': { from: '오버헤드프레스', r: 0.15 },
  '프론트스쿼트': { from: '백스쿼트', r: 0.8 },
  '스미스 머신 스쿼트': { from: '백스쿼트', r: 0.9 },
  '핵스쿼트': { from: '백스쿼트', r: 1.0 },
  '레그프레스': { from: '백스쿼트', r: 1.8 },
  '불가리안 스플릿 스쿼트': { from: '백스쿼트', r: 0.22 },
  '고블릿 스쿼트': { from: '백스쿼트', r: 0.35 },
  '레그 익스텐션': { from: '백스쿼트', r: 0.45 },
  '루마니안 데드리프트': { from: '컨벤셔널 데드리프트', r: 0.7 },
  '덤벨 루마니안 데드리프트': { from: '컨벤셔널 데드리프트', r: 0.3 },
  '힙 쓰러스트': { from: '컨벤셔널 데드리프트', r: 1.0 },
  '굿모닝': { from: '컨벤셔널 데드리프트', r: 0.4 },
  '바벨 로우': { from: '컨벤셔널 데드리프트', r: 0.5 },
  '백스쿼트': { from: '컨벤셔널 데드리프트', r: 0.82 },
  '컨벤셔널 데드리프트': { from: '백스쿼트', r: 1.2 },
};

export interface StrengthEntry { e1rm: number; date: string; kg: number; reps: number }

/** Best e1RM per exercise from the last `days` days of sets. */
export function strengthTable(sessions: Session[], logs: WorkoutLog[], since: string): Map<string, StrengthEntry> {
  const out = new Map<string, StrengthEntry>();
  const put = (name: string, kg: number, reps: number, date: string) => {
    const v = e1rm(kg, reps);
    if (v == null || date < since) return;
    const cur = out.get(name);
    if (!cur || v > cur.e1rm) out.set(name, { e1rm: v, date, kg, reps });
  };
  const detailed = new Set<string>();
  for (const s of sessions) {
    if (s.deleted) continue;
    for (const ex of s.exercises) {
      if (ex.sets.length) detailed.add(ex.logId);
      for (const st of ex.sets) if (st.kg && st.reps) put(ex.name, st.kg, st.reps, s.date);
    }
  }
  for (const l of logs) {
    if (l.deleted || detailed.has(l.id)) continue;
    const reps = parseInt(l.reps ?? '', 10);
    if (l.kg && reps) put(l.exercise, l.kg, reps, l.date);
  }
  return out;
}

export interface Estimate { e1rm: number; source: 'own' | 'derived'; from?: MainLift }

export function estimateFor(name: string, table: Map<string, StrengthEntry>, overrides: Partial<Record<string, number>> = {}): Estimate | null {
  const own = overrides[name] ?? table.get(name)?.e1rm;
  if (own) return { e1rm: own, source: 'own' };
  const rel = RATIOS[name];
  if (!rel) return null;
  const base = overrides[rel.from] ?? table.get(rel.from)?.e1rm;
  return base ? { e1rm: base * rel.r, source: 'derived', from: rel.from } : null;
}

/** Plate/dumbbell steps: barbell 2.5 kg, dumbbells 2 kg, machines 5 kg. */
export function roundFor(ex: Pick<Exercise, 'need' | 'n'> | undefined, kg: number): number {
  const step = !ex ? 2.5 : ex.need === 'd' ? 2 : /머신|레그프레스|핵스쿼트|레그 익스텐션|케이블|펙덱/.test(ex.n) ? 5 : 2.5;
  return Math.max(step, Math.round(kg / step) * step);
}

/** Lower end of a "6~10회 …" rep range. */
export function repsFrom(range: string): number {
  const m = range.match(/(\d+)\s*~\s*(\d+)/);
  return m ? Number(m[1]) : 8;
}

export interface Suggestion { kg: number; reps: number; source: Estimate['source']; from?: MainLift }

/** Suggested working weight for an exercise at its rep target, if there's anything to go on. */
export function suggestWeight(name: string, reps: number, table: Map<string, StrengthEntry>, custom: CustomExercise[] = [], overrides: Partial<Record<string, number>> = {}): Suggestion | null {
  const est = estimateFor(name, table, overrides);
  if (!est) return null;
  const ex = library(custom).find((e) => e.n === name);
  return { kg: roundFor(ex, weightFor(est.e1rm, reps)), reps, source: est.source, from: est.from };
}
