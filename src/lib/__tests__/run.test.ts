import { describe, expect, it } from 'vitest';

import { acceptPoint, fmtPace, haversine, simplify, summarize, type GpsPoint } from '../run';

// ~1 m of latitude in degrees
const M = 1 / 111_195;
/** points moving north at `speed` m/s, one fix per second */
const line = (n: number, speed: number, seg = 0, t0 = 0, lat0 = 37.5): GpsPoint[] =>
  Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * speed * M, lng: 127, t: t0 + i * 1000, acc: 5, seg }));

describe('run math', () => {
  it('measures distance with haversine', () => {
    expect(haversine({ lat: 37.5, lng: 127 }, { lat: 37.5 + 1000 * M, lng: 127 })).toBeCloseTo(1000, 0);
  });

  it('computes pace and km splits for a steady 5:00/km run', () => {
    // 3.333 m/s = 5:00 /km, 2100 m
    const pts = line(631, 10 / 3);
    const s = summarize(pts);
    expect(s.distanceM).toBeCloseTo(2100, -1);
    expect(s.paceSecPerKm).toBeCloseTo(300, 0);
    expect(s.splits.map((x) => x.seconds)).toEqual([300, 300]);
  });

  it('does not count distance or time across a pause', () => {
    const a = line(301, 10 / 3, 0, 0);
    const b = line(301, 10 / 3, 1, 900_000, a[a.length - 1].lat + 500 * M);
    const s = summarize([...a, ...b]);
    expect(s.distanceM).toBeCloseTo(2000, -1);
    expect(s.movingS).toBe(600);
  });

  it('rejects inaccurate fixes and GPS jumps', () => {
    const last: GpsPoint = { lat: 37.5, lng: 127, t: 0, acc: 5, seg: 0 };
    expect(acceptPoint(last, { ...last, t: 1000, acc: 80, lat: 37.5 + 3 * M })).toBeNull();
    expect(acceptPoint(last, { ...last, t: 1000, lat: 37.5 + 100 * M })).toBeNull();
    expect(acceptPoint(last, { ...last, t: 1000, lat: 37.5 + 1 * M })).toBeNull();
    expect(acceptPoint(last, { ...last, t: 1000, lat: 37.5 + 4 * M })).toBeCloseTo(4, 0);
    expect(acceptPoint(last, { ...last, t: 1000, seg: 1, lat: 37.6 })).toBe(0);
  });

  it('formats pace', () => {
    expect(fmtPace(300)).toBe(`5'00"`);
    expect(fmtPace(359.6)).toBe(`6'00"`);
    expect(fmtPace(null)).toBe(`–'––"`);
  });

  it('simplifies long tracks but keeps both ends', () => {
    const pts = line(5000, 3);
    const out = simplify(pts, 400);
    expect(out.length).toBeLessThanOrEqual(402);
    expect(out[0]).toBe(pts[0]);
    expect(out[out.length - 1]).toBe(pts[pts.length - 1]);
  });
});
