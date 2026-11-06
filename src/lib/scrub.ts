/** Linking a run's map and its speed chart: a place on the route ↔ a moment in the run. */
import { trackDistances, type RoutePoint } from './elevation';
import { bucketOf } from './range';
import type { Run } from './types';

/** distance covered by moving second t, from the speed timeline */
function timelineDistance(tl: [number, number][], t: number): number {
  const b = bucketOf(tl);
  let d = 0;
  for (const [c, v] of tl) {
    const s = c - b / 2;
    if (s >= t) break;
    d += v * Math.min(b, t - s);
  }
  return d;
}

/**
 * Moving second at each route point. New runs store it; older ones are estimated by matching
 * distance along the route to distance along the speed timeline.
 */
export function routeTimes(r: Pick<Run, 'route' | 'routeT' | 'timeline' | 'movingS'>): number[] {
  if (r.routeT && r.routeT.length === r.route.length) return r.routeT;
  const d = trackDistances(r.route);
  const D = d[d.length - 1] || 1;
  const tl = r.timeline ?? [];
  if (tl.length < 2) return d.map((x) => (x / D) * r.movingS);
  const b = bucketOf(tl);
  const end = Math.max(r.movingS, tl[tl.length - 1][0] + b / 2);
  const total = timelineDistance(tl, end) || 1;
  // walk both curves together
  const out: number[] = [];
  let t = 0, cum = 0, k = 0;
  for (const x of d) {
    const target = (x / D) * total;
    while (k < tl.length) {
      const v = tl[k][1];
      const step = v * b;
      if (cum + step >= target) { t = tl[k][0] - b / 2 + (v > 0 ? (target - cum) / v : 0); break; }
      cum += step; k++;
      t = tl[Math.min(k, tl.length - 1)][0] - b / 2;
    }
    out.push(Math.max(0, Math.min(end, t)));
  }
  return out;
}

/** Index of the route point closest to a tapped coordinate. */
export function nearestIndex(route: RoutePoint[], lat: number, lng: number): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let best = 0, bd = Infinity;
  route.forEach((p, i) => {
    const dy = p[0] - lat, dx = (p[1] - lng) * k;
    const dd = dx * dx + dy * dy;
    if (dd < bd) { bd = dd; best = i; }
  });
  return best;
}

/** Index of the route point at (or just before) moving second t. */
export function indexAtTime(times: number[], t: number): number {
  let lo = 0, hi = times.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (times[mid] <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

export interface Moment { t: number; distanceM: number; speed: number | null; altM: number | null; gradePct: number | null; index: number }

/** What was happening at moving second t. */
export function momentAt(r: Pick<Run, 'route' | 'routeT' | 'timeline' | 'movingS' | 'elev'>, times: number[], t: number): Moment {
  const tl = r.timeline ?? [];
  const index = indexAtTime(times, t);
  let speed: number | null = null;
  if (tl.length) {
    let best = tl[0];
    for (const p of tl) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    speed = best[1];
  }
  const distanceM = tl.length ? timelineDistance(tl, t) : trackDistances(r.route)[index] ?? 0;
  let altM: number | null = null;
  const prof = r.elev?.profile;
  if (prof?.length) {
    const along = trackDistances(r.route)[index] ?? 0;
    let j = 0;
    while (j < prof.length - 2 && prof[j + 1][0] < along) j++;
    const [d0, a0] = prof[j], [d1, a1] = prof[Math.min(j + 1, prof.length - 1)];
    altM = Math.round(d1 > d0 ? a0 + ((a1 - a0) * (along - d0)) / (d1 - d0) : a0);
  }
  const g = r.elev?.pointGrade?.[index];
  return { t, distanceM: Math.round(distanceM), speed, altM, gradePct: g == null ? null : Math.round(g), index };
}
