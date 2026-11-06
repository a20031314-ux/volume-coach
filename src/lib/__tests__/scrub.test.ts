import { describe, expect, it } from 'vitest';

import type { RoutePoint } from '../elevation';
import { indexAtTime, momentAt, nearestIndex, routeTimes } from '../scrub';
import type { Run } from '../types';

// 2 km straight north; first km at 4 m/s, second at 2 m/s
const route: RoutePoint[] = Array.from({ length: 21 }, (_, i) => [37.5 + (i * 100) / 111195, 127, 0, 10 + i]);
const tl: [number, number][] = [];
for (let t = 0; t < 250; t += 5) tl.push([t + 2.5, 4]);
for (let t = 250; t < 750; t += 5) tl.push([t + 2.5, 2]);
const run = { route, timeline: tl, movingS: 750, elev: { profile: route.map((p, i) => [i * 100, p[3]!] as [number, number]), pointGrade: route.map(() => 1) } as unknown as Run['elev'] };

describe('scrub', () => {
  it('estimates when each route point was passed', () => {
    const t = routeTimes(run);
    expect(t[0]).toBe(0);
    expect(t[10]).toBeCloseTo(250, -1); // 1 km at 4 m/s
    expect(t[20]).toBeCloseTo(750, -1);
    expect(routeTimes({ ...run, routeT: route.map((_, i) => i) })[5]).toBe(5);
  });

  it('maps a tap to the nearest point and a moment to its numbers', () => {
    expect(nearestIndex(route, 37.5 + 1010 / 111195, 127.0001)).toBe(10);
    const times = routeTimes(run);
    expect(indexAtTime(times, 400)).toBe(13);
    const m = momentAt(run, times, 400);
    expect(m.distanceM).toBeCloseTo(1300, -1);
    expect(m.speed).toBe(2);
    expect(m.altM).toBe(23);
    expect(m.gradePct).toBe(1);
  });
});
