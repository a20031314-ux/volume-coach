import { describe, expect, it } from 'vitest';

import { splitSpeeds, spokenSprint, sprintProgress } from '../sprint';

/** one sample per second, like the GPS chip */
const samples = (f: (t: number) => number, until: number) => Array.from({ length: until }, (_, i) => ({ ms: i + 1, v: f(i + 1) }));

describe('sprint timing', () => {
  it('integrates speed from standstill and interpolates the finish', () => {
    // steady 2 m/s² from the go signal: distance = t²
    const p = sprintProgress(samples((t) => 2 * t, 14), 100);
    expect(p.finishS).toBeCloseTo(10, 2);
    expect(p.distanceM).toBe(100);
    expect(p.splits[0]).toEqual({ m: 10, s: 3.16 });
    expect(p.splits[p.splits.length - 1]).toEqual({ m: 100, s: 10 });
    expect(p.splits).toHaveLength(10);
  });

  it('finds the finish between samples at constant speed', () => {
    // 8 m/s from the first second on: 4 m in the first second, then 8 m/s
    const p = sprintProgress(samples(() => 8, 10), 60);
    expect(p.finishS).toBeCloseTo(1 + 56 / 8, 2);
    expect(p.topV).toBe(8);
  });

  it('reports progress before the target', () => {
    const p = sprintProgress(samples(() => 6, 3), 100);
    expect(p.finishS).toBeNull();
    expect(p.distanceM).toBeCloseTo(3 + 6 + 6);
  });

  it('ignores a single GPS spike for top speed', () => {
    const p = sprintProgress(samples((t) => (t === 4 ? 15 : Math.min(9, 3 * t)), 15), 100);
    expect(p.topV).toBe(9);
  });

  it('notes dropouts', () => {
    const p = sprintProgress([{ ms: 1, v: 3 }, { ms: 2, v: 6 }, { ms: 5, v: 8 }], 50);
    expect(p.maxGapS).toBe(3);
  });

  it('gives speed per split and speaks hundredths', () => {
    const sp = splitSpeeds([{ m: 10, s: 2 }, { m: 20, s: 3.25 }]);
    expect(sp[1].v).toBeCloseTo(8);
    expect(spokenSprint(14.82)).toBe('14초 82');
    expect(spokenSprint(9.05)).toBe('9초 05');
  });
});
