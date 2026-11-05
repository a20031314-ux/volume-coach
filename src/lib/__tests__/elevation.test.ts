import { describe, expect, it } from 'vitest';

import { activityKcal, analyzeElevation, gainLoss, gradeAdjustedPace, gradeCost, resample, smooth, trackDistances, type RoutePoint } from '../elevation';

// straight line north; 1e-4 deg latitude ≈ 11.1 m
const line = (n: number, seg = () => 0): RoutePoint[] => Array.from({ length: n }, (_, i) => [37.5 + i * 1e-4, 127, seg()]);

describe('elevation', () => {
  it('measures along-track distance and skips pause gaps', () => {
    const r: RoutePoint[] = [[37.5, 127, 0], [37.5001, 127, 0], [37.6, 127, 1], [37.6001, 127, 1]];
    const d = trackDistances(r);
    expect(d[1]).toBeCloseTo(11.1, 0);
    expect(d[2]).toBe(d[1]);
    expect(d[3]).toBeCloseTo(22.2, 0);
  });

  it('resamples and smooths', () => {
    const { d, a } = resample([0, 100], [0, 10], 25);
    expect(d).toEqual([0, 25, 50, 75, 100]);
    expect(a).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(smooth([0, 0, 9, 0, 0], 1)).toEqual([0, 3, 3, 3, 0]);
  });

  it('ignores wiggles below the threshold', () => {
    expect(gainLoss([0, 1, 0, 1, 0, 10, 5, 12], 3)).toEqual({ gain: 17, loss: 5 });
  });

  it('costs more uphill, less on a gentle downhill', () => {
    expect(gradeCost(0)).toBeCloseTo(3.6);
    expect(gradeCost(0.1)).toBeGreaterThan(gradeCost(0) * 1.4);
    expect(gradeCost(-0.1)).toBeLessThan(gradeCost(0));
  });

  it('finds a climb and adjusts pace for it', () => {
    // 100 points ≈ 1.1 km: flat for 40, then a 6% climb for 40, then flat
    const r = line(100);
    const step = 11.12;
    const alt = r.map((_, i) => (i < 40 ? 50 : i < 80 ? 50 + (i - 40) * step * 0.06 : 50 + 40 * step * 0.06));
    const e = analyzeElevation(r, alt, 'dem')!;
    expect(e.gainM).toBeGreaterThanOrEqual(25);
    expect(e.gainM).toBeLessThanOrEqual(28);
    expect(e.lossM).toBe(0);
    expect(e.climbs).toHaveLength(1);
    expect(e.climbs[0].gradePct).toBeGreaterThan(5);
    expect(e.climbs[0].gradePct).toBeLessThan(7);
    expect(e.flatEqM).toBeGreaterThan(1100);
    expect(e.pointGrade[60]).toBeCloseTo(6, 0);
    expect(e.pointGrade[10]).toBe(0);
    const gap = gradeAdjustedPace(330, e)!;
    expect(gap).toBeLessThan(330 / 1.1);
    expect(activityKcal('run', 1100, 70, e)).toBeGreaterThan(activityKcal('run', 1100, 70));
  });

  it('is robust to GPS noise on flat ground', () => {
    const r = line(300);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 8;
    const e = analyzeElevation(r, r.map(() => 30 + rnd()), 'gps')!;
    expect(e.gainM).toBeLessThan(15);
    expect(e.climbs).toHaveLength(0);
  });

  it('fills missing altitudes and gives up without any', () => {
    const r = line(20);
    expect(analyzeElevation(r, r.map((_, i) => (i % 2 ? null : 10)), 'gps')?.gainM).toBe(0);
    expect(analyzeElevation(r, r.map(() => null), 'gps')).toBeNull();
  });
});
