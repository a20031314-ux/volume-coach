/**
 * All-day movement from low-rate background GPS. The phone reports a fix every ~20 m;
 * consecutive fixes are classified by speed and grouped into walks. Vehicles (bus, car,
 * subway) are told apart by speed and left out of walking distance.
 */
import { haversine } from './run';

/** [epoch seconds, lat, lng, accuracy m] — compact because a day can hold a few thousand. */
export type MovePoint = [number, number, number, number];

export interface MoveSegment {
  kind: 'walk' | 'vehicle';
  startMs: number;
  endMs: number;
  distanceM: number;
  /** index range into the day's filtered points, for drawing */
  from: number;
  to: number;
}

const MAX_ACC = 50;        // m; worse fixes are ignored
const GAP_S = 10 * 60;     // no fix for this long ends a segment
const STILL_V = 0.4;       // m/s
const VEHICLE_V = 3.5;     // m/s (12.6 km/h): faster than walking or easy jogging
const PAUSE_S = 120;       // a stop shorter than this (traffic light) doesn't end a walk
const MIN_WALK_S = 120;
const MIN_WALK_M = 150;

type Cls = 'still' | 'walk' | 'vehicle';

/** Points usable for movement: accurate enough, ordered, outside recorded runs. */
export function cleanPoints(points: MovePoint[], exclude: [number, number][] = []): MovePoint[] {
  const inRun = (t: number) => exclude.some(([a, b]) => t * 1000 >= a && t * 1000 <= b);
  return points
    .filter((p) => p[3] <= MAX_ACC && !inRun(p[0]))
    .sort((a, b) => a[0] - b[0]);
}

export function moveSegments(points: MovePoint[], exclude: [number, number][] = []): { points: MovePoint[]; segments: MoveSegment[] } {
  const pts = cleanPoints(points, exclude);
  const segments: MoveSegment[] = [];
  let cur: { kind: 'walk' | 'vehicle'; from: number; to: number; d: number; pauseS: number } | null = null;

  const close = () => {
    if (!cur) return;
    const startMs = pts[cur.from][0] * 1000, endMs = pts[cur.to][0] * 1000;
    const durS = (endMs - startMs) / 1000;
    const keep = cur.kind === 'vehicle' ? cur.d >= 500 : durS >= MIN_WALK_S && cur.d >= MIN_WALK_M;
    if (keep) segments.push({ kind: cur.kind, startMs, endMs, distanceM: Math.round(cur.d), from: cur.from, to: cur.to });
    cur = null;
  };

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dt = b[0] - a[0];
    if (dt <= 0) continue;
    if (dt > GAP_S) { close(); continue; }
    const d = haversine({ lat: a[1], lng: a[2] }, { lat: b[1], lng: b[2] });
    // movement smaller than the fixes' own error is noise
    const moved = d > Math.max(a[3], b[3]) * 0.5 ? d : 0;
    const v = moved / dt;
    const cls: Cls = v < STILL_V ? 'still' : v > VEHICLE_V ? 'vehicle' : 'walk';

    if (cls === 'still') {
      if (cur) {
        cur.pauseS += dt;
        if (cur.pauseS > PAUSE_S) close();
      }
      continue;
    }
    if (cur && cur.kind !== cls) close();
    if (!cur) cur = { kind: cls, from: i - 1, to: i, d: 0, pauseS: 0 };
    cur.to = i;
    cur.d += moved;
    cur.pauseS = 0;
  }
  close();
  return { points: pts, segments };
}

export function walkTotals(segments: MoveSegment[]): { m: number; min: number; count: number } {
  const w = segments.filter((s) => s.kind === 'walk');
  return {
    m: w.reduce((a, s) => a + s.distanceM, 0),
    min: Math.round(w.reduce((a, s) => a + (s.endMs - s.startMs), 0) / 60e3),
    count: w.length,
  };
}
