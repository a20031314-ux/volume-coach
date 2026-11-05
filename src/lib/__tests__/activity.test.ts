import { describe, expect, it } from 'vitest';

import { activityLine, dayActivity } from '../activity';
import type { Run, Session, WorkoutLog } from '../types';

const D = '2026-11-05';
const T0 = new Date(2026, 10, 5, 18, 0).getTime();
const meta = { updatedAt: 0 };

const log = (id: string, sets: number, sessionId?: string, date = D): WorkoutLog =>
  ({ ...meta, id, date, exercise: '벤치프레스', muscle: 'chest', sets, at: T0, sessionId });
const session = (id: string, min: number): Session =>
  ({ ...meta, id, date: D, startedAt: T0, endedAt: T0 + min * 60e3, lastActivityAt: T0 + min * 60e3, detail: 'exercise', exercises: [] });
const run = (km: number, min: number): Run =>
  ({ ...meta, id: `r${km}`, date: D, startedAt: T0, endedAt: T0, distanceM: km * 1000, movingS: min * 60, paceSecPerKm: null, kcal: Math.round(km * 80), splits: [], route: [] });

describe('dayActivity', () => {
  it('uses session time when there is a session and 3 min/set for loose logs', () => {
    const a = dayActivity(D, { logs: [log('a', 10, 's1'), log('b', 4)], sessions: [session('s1', 50)], runs: [], steps: null, weightKg: 80, now: T0 });
    expect(a.lift).toEqual({ sets: 14, minutes: 62, kcal: Math.round(62 * 80 * 5 / 60) });
    expect(a.walk).toBeNull();
  });

  it('does not count recorded runs again as walking', () => {
    const a = dayActivity(D, { logs: [], sessions: [], runs: [run(5, 28)], steps: { steps: 12000, meters: 9000 }, weightKg: 80, now: T0 });
    expect(a.walk).toEqual({ steps: 12000, km: 4, kcal: 160 });
    expect(a.run).toMatchObject({ km: 5, minutes: 28, kcal: 400, count: 1 });
    expect(a.kcal).toBe(560);
    expect(a.activeMin).toBe(28);
  });

  it('keeps recorded walks and hikes apart from running', () => {
    const hike = { ...run(6, 120), id: 'h', kind: 'hike' as const, kcal: 300, elev: { gainM: 420 } as Run['elev'] };
    const a = dayActivity(D, { logs: [], sessions: [], runs: [run(5, 28), hike], steps: { steps: 20000, meters: 14000 }, weightKg: 80, now: T0 });
    expect(a.run.km).toBe(5);
    expect(a.outdoor).toEqual({ km: 6, minutes: 120, kcal: 300, count: 1, gainM: 420 });
    expect(a.walk?.km).toBe(3);
    expect(a.activeMin).toBe(148);
  });

  it('ignores other days and never goes negative', () => {
    const a = dayActivity(D, { logs: [log('x', 5, undefined, '2026-11-04')], sessions: [], runs: [run(5, 28)], steps: { steps: 3000, meters: 2000 }, weightKg: 70, now: T0 });
    expect(a.lift.sets).toBe(0);
    expect(a.walk?.km).toBe(0);
  });

  it('summarises in one line', () => {
    const a = dayActivity(D, { logs: [log('a', 10, 's1')], sessions: [session('s1', 52)], runs: [run(5, 28)], steps: { steps: 8214, meters: 11000 }, weightKg: 80, now: T0 });
    expect(activityLine(a)).toBe('8,214보 · 웨이트 52분 · 러닝 5.0km');
    expect(activityLine(dayActivity(D, { logs: [], sessions: [], runs: [], steps: null, weightKg: 80, now: T0 }))).toBe('');
  });
});
