import { describe, expect, it } from 'vitest';

import { slope, weeklyTrends } from '../trends';
import type { BodyComp, Meal, WorkoutLog } from '../types';

const log = (date: string, exercise: string, muscle: WorkoutLog['muscle'], sets: number, kg?: number, reps?: string) =>
  ({ id: `${date}${exercise}`, updatedAt: 1, date, exercise, muscle, sets, kg, reps, at: 0 }) as WorkoutLog;
const comp = (date: string, weight: number, ffm?: number) => ({ id: date, updatedAt: 1, date, weight, ffm }) as BodyComp;
const meal = (date: string, p: number, kcal: number) => ({ id: `${date}${p}${kcal}`, updatedAt: 1, date, name: 'x', qty: 1, kcal, p, c: 0, f: 0, at: 0 }) as Meal;

// 2026-11-07 is a Saturday → weeks start 10/19, 10/26, 11/02
const base = { sessions: [], off: [], min: 12, max: 18 };

describe('weeklyTrends', () => {
  it('buckets body, strength, volume and protein by week', () => {
    const t = weeklyTrends({
      ...base,
      comps: [comp('2026-10-20', 78), comp('2026-10-28', 77.4, 61.5), comp('2026-11-05', 76.8)],
      logs: [
        log('2026-10-20', '바벨 벤치프레스', 'chest', 4, 80, '8'),
        log('2026-10-29', '바벨 벤치프레스', 'chest', 14, 82.5, '8'),
        log('2026-10-30', '백스쿼트', 'quad', 20, 100, '5'),
      ],
      meals: [meal('2026-11-03', 150, 2000), meal('2026-11-04', 130, 2200), meal('2026-11-04', 20, 300)],
    }, '2026-11-07', 3);
    expect(t.weeks).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(t.weight).toEqual([78, 77.4, 76.8]);
    expect(t.ffm).toEqual([null, 61.5, null]);
    expect(t.lift?.name).toBe('바벨 벤치프레스');
    expect(t.lift?.values).toEqual([101, 105, null]); // 80×(1+8/30)=101.3, 82.5×(1+8/30)=104.5
    expect(t.lifts.find((l) => l.name === '바벨 벤치프레스')?.change).toBe(3);
    expect(t.protein).toEqual([null, null, 150]);
    expect(t.mealDays).toEqual([0, 0, 2]);
    // last full week: chest 14 (ok), quads 20 (high), everything else low
    expect(t.highMuscles.map((m) => m.k)).toEqual(['quad']);
    expect(t.lowMuscles.some((m) => m.k === 'chest')).toBe(false);
  });
  it('slope needs two points', () => {
    expect(slope([null, 78])).toBeNull();
    expect(slope([78, null, 77])).toMatchObject({ change: -1, perWeek: -0.5 });
  });
});
