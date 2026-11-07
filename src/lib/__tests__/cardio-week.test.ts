import { describe, expect, it } from 'vitest';

import { cardioWeek, weekMonday } from '../cardio-week';
import type { Run } from '../types';

const run = (date: string, kind: Run['kind'], min: number, km = 0) =>
  ({ id: `${date}${kind}${min}`, date, kind, movingS: min * 60, distanceM: km * 1000, startedAt: 0 }) as unknown as Run;

describe('cardioWeek', () => {
  it('starts the week on Monday', () => {
    expect(weekMonday('2026-11-07')).toBe('2026-11-02'); // Saturday
    expect(weekMonday('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekMonday('2026-11-02')).toBe('2026-11-02');
  });
  it('splits minutes into hard and easy and totals GPS distance', () => {
    const w = cardioWeek([
      run('2026-11-02', 'run', 30, 5), run('2026-11-02', 'walk', 40, 3),
      run('2026-11-04', 'other', 20), run('2026-11-04', 'ride', 60, 20), run('2026-10-30', 'run', 99, 9),
    ], '2026-11-02');
    expect(w.days[0]).toMatchObject({ hard: 30, easy: 40 });
    expect(w.days[2]).toMatchObject({ hard: 80, easy: 0 });
    expect(w.count).toBe(4);
    expect(w.km).toBe(8); // ride km is not mixed in with running/walking
    expect(w.min).toBe(150);
  });
});
