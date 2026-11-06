import { describe, expect, it } from 'vitest';

import type { DayActivity } from '../activity';
import { dayBurn, dayIntake, liftVolume, reviewNotes } from '../review';
import type { Session, WorkoutLog } from '../types';

const act = (over: Partial<DayActivity> = {}): DayActivity => ({
  lift: { sets: 20, minutes: 60, kcal: 430 }, run: { km: 0, minutes: 0, kcal: 0, count: 0 },
  outdoor: { km: 0, minutes: 0, kcal: 0, count: 0, gainM: 0 }, walk: null, activeMin: 60, kcal: 430, ...over,
});

describe('review', () => {
  it('adds BMR, everyday living, walking and net exercise', () => {
    const b = dayBurn(1800, act({ walk: { steps: 9000, km: 6, kcal: 260 } }), '1');
    expect(b.bmr).toBe(1800);
    expect(b.daily).toBe(270);
    expect(b.walk).toBe(260);
    expect(b.exercise).toBe(430 - 75); // 60 min of BMR already counted
    expect(b.total).toBe(1800 + 270 + 260 + 355);
    const p = dayBurn(1800, act(), '2');
    expect(p.dailySource).toBe('profile');
    expect(p.daily).toBe(810);
  });

  it('sums intake and lifting volume', () => {
    const i = dayIntake([{ date: 'd', kcal: 500, p: 40, c: 50, f: 10 }, { date: 'd', kcal: 300.4, p: 20.4, c: 0, f: 5 }, { date: 'x', kcal: 999, p: 0, c: 0, f: 0 }], 'd');
    expect(i).toEqual({ kcal: 800, p: 60, c: 50, f: 15, items: 2 });
    const logs = [
      { id: 'l1', date: 'd', exercise: '벤치', muscle: 'chest', sets: 2, at: 0, updatedAt: 0 },
      { id: 'l2', date: 'd', exercise: '컬', muscle: 'bi', sets: 3, kg: 10, reps: '12', at: 0, updatedAt: 0 },
    ] as WorkoutLog[];
    const s = [{ id: 's', date: 'd', exercises: [{ logId: 'l1', sets: [{ at: 0, kg: 80, reps: 8 }, { at: 1, kg: 80, reps: 6 }] }] }] as unknown as Session[];
    const v = liftVolume(logs, s, 'd');
    expect(v.kg).toBe(80 * 14 + 10 * 12 * 3);
    expect(v.perMuscle[0]).toEqual({ muscle: 'bi', sets: 3 });
  });

  it('notes protein gaps and the balance for past days', () => {
    const burn = dayBurn(1800, act(), '1');
    const n = reviewNotes({ intake: { kcal: 2000, p: 100, c: 200, f: 60, items: 5 }, targets: { kcal: 2600, p: 150, c: 300, f: 70, bmr: 1800 }, burn, isToday: false, weightKg: 80 });
    expect(n[0]).toBe('단백질 50g 부족 (목표 150g)');
    expect(n[1]).toBe('목표 칼로리보다 600kcal 적게 먹었어요');
    expect(n[2]).toMatch(/^섭취 − 소모 −?/);
    expect(reviewNotes({ intake: { kcal: 0, p: 0, c: 0, f: 0, items: 0 }, targets: null, burn, isToday: true, weightKg: 80 })).toEqual(['아직 먹은 음식 기록이 없어요']);
  });
});
