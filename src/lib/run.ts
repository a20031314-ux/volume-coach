/** GPS run math. Pure functions, no device APIs. */

export interface GpsPoint {
  lat: number;
  lng: number;
  t: number;          // epoch ms
  acc?: number | null; // horizontal accuracy, m
  seg: number;        // segment index; a new segment starts after each pause
  ms?: number;        // moving seconds since the start (pauses excluded)
}

export interface Split { km: number; seconds: number }

export interface RunSummary {
  distanceM: number;
  movingS: number;
  paceSecPerKm: number | null;
  splits: Split[];
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Drop fixes worse than this. */
export const MAX_ACCURACY_M = 35;
/** Faster than ~43 km/h between fixes is a GPS jump, not running. */
export const MAX_SPEED_MS = 12;
/** Ignore wobble smaller than this while standing still. */
export const MIN_STEP_M = 3;

/**
 * Decide whether a new fix should be appended after `last`.
 * Returns the distance to add (0 when it starts a new segment), or null to drop the fix.
 */
export function acceptPoint(last: GpsPoint | undefined, p: GpsPoint): number | null {
  if (p.acc != null && p.acc > MAX_ACCURACY_M) return null;
  if (!last || last.seg !== p.seg) return 0;
  if (p.t <= last.t) return null;
  const d = haversine(last, p);
  const minStep = Math.max(MIN_STEP_M, ((last.acc ?? 0) + (p.acc ?? 0)) / 4);
  if (d < minStep) return null;
  if (d / ((p.t - last.t) / 1000) > MAX_SPEED_MS) return null;
  return d;
}

/** Distance, moving time and per-km splits from accepted points. Time between segments (pauses) is not counted. */
export function summarize(points: GpsPoint[]): RunSummary {
  let distanceM = 0;
  let movingMs = 0;
  const splits: Split[] = [];
  let splitStartMs = 0;
  let nextKm = 1000;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.seg !== b.seg) continue;
    const d = haversine(a, b);
    const dt = b.t - a.t;
    // interpolate the moment each km mark is crossed
    while (d > 0 && distanceM + d >= nextKm) {
      const frac = (nextKm - distanceM) / d;
      const at = movingMs + dt * frac;
      splits.push({ km: nextKm / 1000, seconds: Math.round((at - splitStartMs) / 1000) });
      splitStartMs = at;
      nextKm += 1000;
    }
    distanceM += d;
    movingMs += dt;
  }
  const movingS = Math.round(movingMs / 1000);
  return { distanceM, movingS, paceSecPerKm: distanceM >= 50 ? movingS / (distanceM / 1000) : null, splits };
}

/** Pace over roughly the last `windowM` metres of the current segment. */
export function currentPace(points: GpsPoint[], windowM = 200): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  let d = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1], b = points[i];
    if (a.seg !== last.seg) break;
    d += haversine(a, b);
    if (d >= windowM) {
      const s = (last.t - a.t) / 1000;
      return s / (d / 1000);
    }
  }
  return null;
}

/** Running burns roughly 1 kcal per kg body weight per km. */
export const runKcal = (distanceM: number, weightKg: number) => Math.round((distanceM / 1000) * weightKg);

/** Keep at most `max` points for storage, always keeping segment ends. */
export function simplify(points: GpsPoint[], max = 400): GpsPoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: GpsPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const keep = Math.floor(i / step) !== Math.floor((i - 1) / step) || i === points.length - 1
      || points[i + 1]?.seg !== points[i].seg || points[i - 1]?.seg !== points[i].seg;
    if (keep) out.push(points[i]);
  }
  return out;
}

export const fmtPace = (secPerKm: number | null) => {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm > 60 * 30) return "–'––\"";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}'00"` : `${m}'${String(s).padStart(2, '0')}"`;
};

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export const fmtKm = (m: number) => (m / 1000).toFixed(2);
