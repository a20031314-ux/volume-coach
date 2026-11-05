/**
 * Terrain altitude for a route from the Open-Meteo elevation API (Copernicus GLO-90 DEM, free,
 * no key; up to 100 coordinates per request). Phone GPS altitude is off by 10 m or more, so a
 * terrain model gives much steadier climb and grade numbers. Falls back to GPS when offline.
 */
import { analyzeElevation, type Elevation, type RoutePoint } from '@/lib/elevation';
import type { Run } from '@/lib/types';
import { useData } from '@/store/store';

const URL_BASE = 'https://api.open-meteo.com/v1/elevation';
const BATCH = 100;

async function lookup(points: RoutePoint[]): Promise<number[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const batches: RoutePoint[][] = [];
    for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH));
    const res = await Promise.all(batches.map(async (b) => {
      const lat = b.map((p) => p[0].toFixed(5)).join(',');
      const lng = b.map((p) => p[1].toFixed(5)).join(',');
      const r = await fetch(`${URL_BASE}?latitude=${lat}&longitude=${lng}`, { signal: ctrl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { elevation?: number[] };
      if (!Array.isArray(j.elevation) || j.elevation.length !== b.length) throw new Error('bad response');
      return j.elevation;
    }));
    return res.flat();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Elevation from the phone's own altitude readings, available right away. */
export function gpsElevation(route: RoutePoint[]): Elevation | null {
  if (!route.some((p) => p[3] != null)) return null;
  return analyzeElevation(route, route.map((p) => p[3]), 'gps');
}

const inflight = new Set<string>();

/** Looks up terrain altitude for a saved run and stores it. Safe to call repeatedly. */
export async function enrichElevation(run: Pick<Run, 'id' | 'route' | 'elev' | 'kcal' | 'distanceM'>): Promise<void> {
  if (run.elev?.source === 'dem' || run.route.length < 2 || inflight.has(run.id)) return;
  inflight.add(run.id);
  try {
    const alt = await lookup(run.route);
    if (!alt) {
      // offline or rate-limited: show the phone's own altitude for now; terrain is tried again next time
      const g = run.elev ? null : gpsElevation(run.route);
      if (g) useData.getState().patchRun(run.id, { elev: g });
      return;
    }
    const e = analyzeElevation(run.route, alt, 'dem');
    if (!e) return;
    // kcal was estimated from the earlier (GPS or flat) distance; rescale it to the new effort
    const before = run.elev?.flatEqM || run.distanceM;
    useData.getState().patchRun(run.id, { elev: e, kcal: Math.round((run.kcal * e.flatEqM) / Math.max(1, before)) });
  } finally {
    inflight.delete(run.id);
  }
}
