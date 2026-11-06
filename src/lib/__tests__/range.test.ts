import { describe, expect, it } from 'vitest';

import { bucketOf, presetRanges, rangeStats } from '../range';

// 20 minutes at 3 m/s, then 10 at 2 m/s, in 15 s buckets
const tl: [number, number][] = Array.from({ length: 120 }, (_, i) => [i * 15 + 7.5, i < 80 ? 3 : 2]);

describe('range', () => {
  it('measures a slice of the run', () => {
    expect(bucketOf(tl)).toBe(15);
    const a = rangeStats(tl, [0, 600]);
    expect(a.distanceM).toBe(1800);
    expect(a.paceS).toBeCloseTo(333.3, 0);
    const b = rangeStats(tl, [1150, 1250]); // straddles the change
    expect(b.distanceM).toBe(50 * 3 + 50 * 2);
    expect(b.maxV).toBe(3);
    expect(b.minV).toBe(2);
  });

  it('offers each km, or interval phases', () => {
    const km = presetRanges({ timeline: tl, movingS: 1800 });
    expect(km[0].label).toBe('1km');
    expect(km[0].range[1]).toBeCloseTo(333.3, 0);
    expect(km.length).toBe(5); // 3.6 + 1.2 = 4.8 km → 4 full km + remainder
    const ph = presetRanges({ timeline: tl, movingS: 1800, phases: [
      { kind: 'warmup', rep: 0, durS: 300, distanceM: 800, paceS: 375 },
      { kind: 'work', rep: 1, durS: 240, distanceM: 800, paceS: 300 },
    ] });
    expect(ph.map((p) => p.label)).toEqual(['워밍업', '달리기 1']);
    expect(ph[1].range).toEqual([300, 540]);
  });
});
