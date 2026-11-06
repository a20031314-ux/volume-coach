import { describe, expect, it } from 'vitest';

import { moveSegments, walkTotals, type MovePoint } from '../movement';

const T0 = 1_780_000_000; // epoch seconds
const DEG_M = 111_195;    // metres per degree of latitude

/** Points moving north at `v` m/s, one every `every` seconds, for `secs`. */
function leg(start: { t: number; lat: number }, v: number, secs: number, every = 15, acc = 10): MovePoint[] {
  const out: MovePoint[] = [];
  for (let s = every; s <= secs; s += every) out.push([start.t + s, start.lat + (v * s) / DEG_M, 127, acc]);
  return out;
}

describe('moveSegments', () => {
  it('finds a walk and ignores standing still', () => {
    const still: MovePoint[] = Array.from({ length: 20 }, (_, i) => [T0 + i * 30, 37.5 + (i % 2) * 2e-5, 127, 12]);
    const walk = leg({ t: T0 + 600, lat: 37.5 }, 1.3, 600);
    const { segments } = moveSegments([...still, [T0 + 600, 37.5, 127, 10], ...walk]);
    expect(segments).toHaveLength(1);
    expect(segments[0].kind).toBe('walk');
    expect(segments[0].distanceM).toBeGreaterThan(700);
    expect(segments[0].distanceM).toBeLessThan(820);
    expect(walkTotals(segments)).toMatchObject({ count: 1, min: 10 });
  });

  it('keeps a walk through a short stop and splits off a bus ride', () => {
    const a = leg({ t: T0, lat: 37.5 }, 1.4, 300);
    const lastA = a[a.length - 1];
    const stop: MovePoint[] = [[lastA[0] + 60, lastA[1], 127, 10]];
    const b = leg({ t: lastA[0] + 60, lat: lastA[1] }, 1.4, 300);
    const lastB = b[b.length - 1];
    const bus = leg({ t: lastB[0], lat: lastB[1] }, 9, 600, 20);
    const { segments } = moveSegments([[T0, 37.5, 127, 10], ...a, ...stop, ...b, ...bus]);
    expect(segments.map((s) => s.kind)).toEqual(['walk', 'vehicle']);
    expect(segments[0].distanceM).toBeGreaterThan(780);
    expect(segments[1].distanceM).toBeGreaterThan(5000);
  });

  it('drops inaccurate fixes, recorded runs and tiny moves', () => {
    const walk = leg({ t: T0, lat: 37.5 }, 1.3, 600);
    const run: [number, number] = [T0 * 1000, (T0 + 600) * 1000];
    expect(moveSegments(walk, [run]).segments).toHaveLength(0);
    expect(moveSegments(walk.map((p) => [p[0], p[1], p[2], 80] as MovePoint)).segments).toHaveLength(0);
    expect(moveSegments(leg({ t: T0, lat: 37.5 }, 1.3, 60)).segments).toHaveLength(0);
  });
});
