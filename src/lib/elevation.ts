/** Elevation and grade from a recorded track. Pure functions; the DEM lookup lives in src/run/elevation-fetch.ts. */
import { rideKcal } from './cardio';
import { haversine } from './run';

/** run/walk/hike/ride are GPS-tracked; other is time-based cardio (see cardio.ts) */
export type ActivityKind = 'run' | 'walk' | 'hike' | 'ride' | 'other';

export const KIND_NAME: Record<ActivityKind, string> = { run: '러닝', walk: '걷기', hike: '등산', ride: '자전거', other: '유산소' };

/** GPS-tracked kinds */
export const GPS_KINDS = ['run', 'walk', 'hike', 'ride'] as const;

export interface Climb { startM: number; lengthM: number; gainM: number; gradePct: number }

export interface Elevation {
  /** 'dem' = terrain model looked up after the run, 'gps' = phone altitude */
  source: 'dem' | 'gps';
  gainM: number;
  lossM: number;
  minM: number;
  maxM: number;
  /** [distance m, altitude m], at most ~150 points for charts */
  profile: [number, number][];
  /** grade % for each route point, for colouring the map */
  pointGrade: number[];
  climbs: Climb[];
  /** distance on flat ground that would cost the same effort */
  flatEqM: number;
}

/** Route point as stored on a run: [lat, lng, segment, gps altitude?] */
export type RoutePoint = [number, number, number, number?];

/** Cumulative along-track distance for each point. Gaps between pause segments add nothing. */
export function trackDistances(route: RoutePoint[]): number[] {
  const d = [0];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    d.push(d[i - 1] + (a[2] === b[2] ? haversine({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) : 0));
  }
  return d;
}

/** Linear resample of (dist, alt) to a fixed step. */
export function resample(dist: number[], alt: number[], step: number): { d: number[]; a: number[] } {
  const total = dist[dist.length - 1] ?? 0;
  const d: number[] = [], a: number[] = [];
  let j = 0;
  for (let x = 0; x <= total + 1e-6; x += step) {
    while (j < dist.length - 2 && dist[j + 1] < x) j++;
    const d0 = dist[j], d1 = dist[j + 1] ?? d0;
    const f = d1 > d0 ? (x - d0) / (d1 - d0) : 0;
    d.push(x);
    a.push(alt[j] + ((alt[j + 1] ?? alt[j]) - alt[j]) * Math.max(0, Math.min(1, f)));
  }
  if (d[d.length - 1] < total) { d.push(total); a.push(alt[alt.length - 1]); }
  return { d, a };
}

/** Centered moving average over `w` samples on each side. */
export function smooth(v: number[], w: number): number[] {
  if (w <= 0) return v.slice();
  const out: number[] = [];
  for (let i = 0; i < v.length; i++) {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(v.length - 1, i + w); k++) { s += v[k]; n++; }
    out.push(s / n);
  }
  return out;
}

/** Total climb and descent, ignoring wiggles smaller than `threshold` metres. */
export function gainLoss(alt: number[], threshold: number): { gain: number; loss: number } {
  if (!alt.length) return { gain: 0, loss: 0 };
  let gain = 0, loss = 0, ref = alt[0];
  for (const a of alt) {
    if (a - ref >= threshold) { gain += a - ref; ref = a; }
    else if (ref - a >= threshold) { loss += ref - a; ref = a; }
  }
  return { gain, loss };
}

/**
 * Energy cost of running on a grade (J/kg/m), Minetti et al. 2002. Walking has a similar
 * shape, so the same ratio is used to turn hills into flat-equivalent distance.
 */
export function gradeCost(g: number): number {
  const i = Math.max(-0.45, Math.min(0.45, g));
  return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
}

const STEP = 10;

/**
 * Builds the elevation summary. `alt` is one altitude per route point (DEM lookups or GPS);
 * points without a value are filled from neighbours.
 */
export function analyzeElevation(route: RoutePoint[], alt: (number | null | undefined)[], source: 'dem' | 'gps'): Elevation | null {
  const filled = fillGaps(alt);
  if (!filled || route.length < 2) return null;
  const dist = trackDistances(route);
  const total = dist[dist.length - 1];
  if (total < 50) return null;

  // Both sources are noisy at street scale: GPS altitude is off by ±10 m, and the 90 m terrain
  // model jumps next to rivers, bridges and embankments. Smooth over ~200 m with a 4 m hysteresis
  // so a flat riverside run doesn't collect phantom climbs.
  const { d, a: raw } = resample(dist, filled, STEP);
  const a = smooth(raw, 10);
  const { gain, loss } = gainLoss(a, 4);

  // grade over 50 m windows
  const W = 5;
  const grade = a.map((_, i) => {
    const lo = Math.max(0, i - W), hi = Math.min(a.length - 1, i + W);
    const run = d[hi] - d[lo];
    return run > 0 ? (a[hi] - a[lo]) / run : 0;
  });

  let flatEqM = 0;
  for (let i = 1; i < d.length; i++) flatEqM += (d[i] - d[i - 1]) * (gradeCost(grade[i]) / gradeCost(0));

  const climbs: Climb[] = [];
  let start = -1;
  const close = (end: number) => {
    const lengthM = d[end] - d[start];
    const gainM = a[end] - a[start];
    if (lengthM >= 200 && gainM >= 10) climbs.push({ startM: Math.round(d[start]), lengthM: Math.round(lengthM), gainM: Math.round(gainM), gradePct: Math.round((gainM / lengthM) * 1000) / 10 });
  };
  for (let i = 0; i < d.length; i++) {
    if (grade[i] >= 0.03) { if (start < 0) start = i; }
    else if (start >= 0) { close(i - 1); start = -1; }
  }
  if (start >= 0) close(d.length - 1);

  const pointGrade = dist.map((x) => Math.round(grade[Math.min(grade.length - 1, Math.round(x / STEP))] * 1000) / 10);
  const every = Math.max(1, Math.ceil(d.length / 150));
  const profile: [number, number][] = [];
  for (let i = 0; i < d.length; i += every) profile.push([Math.round(d[i]), Math.round(a[i] * 10) / 10]);
  if (profile[profile.length - 1][0] !== Math.round(d[d.length - 1])) profile.push([Math.round(d[d.length - 1]), Math.round(a[a.length - 1] * 10) / 10]);

  return {
    source,
    gainM: Math.round(gain),
    lossM: Math.round(loss),
    minM: Math.round(Math.min(...a)),
    maxM: Math.round(Math.max(...a)),
    profile,
    pointGrade,
    climbs,
    flatEqM: Math.round(flatEqM),
  };
}

function fillGaps(alt: (number | null | undefined)[]): number[] | null {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const first = alt.findIndex(ok);
  if (first < 0) return null;
  const out: number[] = [];
  let last = alt[first] as number;
  for (const v of alt) { if (ok(v)) last = v; out.push(last); }
  return out;
}

/** Pace on flat ground for the same effort. */
export function gradeAdjustedPace(movingS: number, e: Pick<Elevation, 'flatEqM'> | null | undefined): number | null {
  if (!e || e.flatEqM < 50) return null;
  return movingS / (e.flatEqM / 1000);
}

/** kcal per kg per flat-equivalent km by activity */
const KCAL_PER_KG_KM: Record<ActivityKind, number> = { run: 1.0, walk: 0.5, hike: 0.6, ride: 0.3, other: 0 };

/**
 * GPS activities. Rides are rated by average speed when moving time is known (cycling cost
 * isn't proportional to distance); hills scale it like the others.
 */
export function activityKcal(kind: ActivityKind, distanceM: number, weightKg: number, e?: Pick<Elevation, 'flatEqM'> | null, movingS?: number): number {
  if (kind === 'ride' && movingS) {
    const hill = e && e.flatEqM > 0 && distanceM > 0 ? Math.min(1.5, e.flatEqM / distanceM) : 1;
    return Math.round(rideKcal(distanceM, movingS, weightKg) * hill);
  }
  const m = e && e.flatEqM > 0 ? e.flatEqM : distanceM;
  return Math.round((m / 1000) * weightKg * KCAL_PER_KG_KM[kind]);
}

/** How hard a km of this activity is on the legs compared to a running km. */
export const LEG_LOAD: Record<ActivityKind, number> = { run: 1, walk: 0.2, hike: 0.5, ride: 0.15, other: 0 };
