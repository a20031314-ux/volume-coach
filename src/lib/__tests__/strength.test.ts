import { describe, expect, it } from 'vitest';

import { adjustment, buildProgram, doneSessions, feasibility, nextPrescription, type StrengthProgram } from '../progression';
import { e1rm, estimateFor, repsFrom, strengthTable, suggestWeight, weightFor } from '../strength';
import type { Session, WorkoutLog } from '../types';

const log = (exercise: string, kg: number, reps: string, date = '2026-11-01'): WorkoutLog =>
  ({ id: exercise + date, updatedAt: 0, date, exercise, muscle: 'chest', sets: 3, kg, reps, at: 0 });

describe('strength', () => {
  it('estimates 1RM and the weight for a rep target', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(80, 8)).toBeCloseTo(101.3, 1);
    expect(e1rm(40, 20)).toBeNull();
    expect(weightFor(100, 8, 2)).toBeCloseTo(75, 0);
    expect(repsFrom('6~10회 · 휴식 2~3분')).toBe(6);
  });

  it('uses own sets first, then a main lift ratio', () => {
    const t = strengthTable([], [log('바벨 벤치프레스', 90, '5'), log('덤벨 숄더프레스', 24, '10')], '2026-08-01');
    expect(t.get('바벨 벤치프레스')!.e1rm).toBeCloseTo(105, 0);
    const inc = estimateFor('인클라인 바벨프레스', t)!;
    expect(inc.source).toBe('derived');
    expect(inc.e1rm).toBeCloseTo(84, 0);
    expect(estimateFor('덤벨 숄더프레스', t)!.source).toBe('own');
    const s = suggestWeight('인클라인 바벨프레스', 8, t)!;
    expect(s.kg % 2.5).toBe(0);
    expect(s.kg).toBe(62.5);
    expect(suggestWeight('인클라인 덤벨프레스', 10, t)!.kg % 2).toBe(0);
    expect(suggestWeight('케이블 컬', 10, t)).toBeNull();
  });

  it('reads session sets too', () => {
    const s = [{ id: 's', date: '2026-11-02', exercises: [{ name: '백스쿼트', logId: 'x', sets: [{ at: 0, kg: 120, reps: 5 }] }] }] as unknown as Session[];
    expect(strengthTable(s, [], '2026-08-01').get('백스쿼트')!.e1rm).toBe(140);
  });
});

describe('progression', () => {
  const p: StrengthProgram = { lift: '바벨 벤치프레스', start: '2026-11-09', start1rm: 100, target1rm: 107.5, weeks: 8, perWeek: 2 };

  it('builds waves with a lighter 4th week and a test at the end', () => {
    const plan = buildProgram(p);
    expect(plan).toHaveLength(16);
    expect(plan[0]).toMatchObject({ week: 1, kind: 'heavy', sets: 4, reps: 6 });
    expect(plan[1].kind).toBe('volume');
    expect(plan[6].kind).toBe('deload');
    expect(plan[15]).toMatchObject({ kind: 'test', reps: 1, expected1rm: 107.5 });
    expect(plan[14].expected1rm).toBeGreaterThan(plan[0].expected1rm);
  });

  it('judges realism', () => {
    expect(feasibility(p).level).toBe('hard');
    expect(feasibility({ ...p, target1rm: 103 }).level).toBe('ok');
    expect(feasibility({ ...p, target1rm: 120 }).level).toBe('unlikely');
    expect(feasibility({ ...p, target1rm: 110 }).weeksFor(2)).toBe(22);
  });

  it('follows how sessions went', () => {
    const first = nextPrescription(p, [])!;
    expect(first.kg).toBe(77.5);
    const done = doneSessions(p, [
      { date: '2026-11-10', sets: [1, 2, 3, 4].map(() => ({ kg: 77.5, reps: 6 })) },
      { date: '2026-11-05', sets: [{ kg: 100, reps: 1 }] }, // before the start: ignored
    ]);
    expect(done).toHaveLength(1);
    expect(done[0].hit).toBe(true);
    const missed = [{ date: 'a', best1rm: 90, hit: false }, { date: 'b', best1rm: 90, hit: false }];
    expect(adjustment(buildProgram(p), missed)).toBeLessThanOrEqual(0.95);
    expect(nextPrescription(p, missed)!.kg).toBeLessThan(buildProgram(p)[2].expected1rm * buildProgram(p)[2].pct);
  });
});
