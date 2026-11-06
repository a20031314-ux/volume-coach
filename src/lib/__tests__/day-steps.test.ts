import { describe, expect, it } from 'vitest';

import { movingSpeed, peakBucket } from '../day-steps';

describe('day steps', () => {
  it('estimates walking speed from the time actually spent stepping', () => {
    // 1,110 steps ≈ 10 min of walking, 800 m → 1.33 m/s (4.8 km/h), though the slice is 15 min
    expect(movingSpeed({ steps: 1110, meters: 800, minutes: 15 })! * 3.6).toBeCloseTo(4.8, 1);
    expect(movingSpeed({ steps: 30, meters: 20, minutes: 15 })).toBeNull();
    expect(peakBucket([{ startMs: 1, minutes: 15, steps: 10, meters: 5 }, { startMs: 2, minutes: 15, steps: 900, meters: 600 }])?.startMs).toBe(2);
  });
});
