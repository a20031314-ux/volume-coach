/**
 * Sprint timing from GPS speed. Over 30–400 m, positions wobble by a few metres, so distance is
 * the integral of the chip's Doppler speed instead: speed is taken as straight lines between
 * samples, starting from standstill at the go signal. Pure functions, no device APIs.
 */
import type { SpeedSample } from './interval';

export const SPRINT_DISTANCES = [30, 50, 60, 100, 200, 400] as const;

export interface SprintSplit { m: number; s: number }

export interface SprintProgress {
  /** metres covered so far */
  distanceM: number;
  /** seconds from the go signal to the target, interpolated; null until crossed */
  finishS: number | null;
  /** top speed, m/s */
  topV: number;
  /** where the top speed happened, m */
  topAtM: number;
  /** cumulative time at each split mark */
  splits: SprintSplit[];
  /** longest gap between speed samples, s (GPS dropouts make the result rougher) */
  maxGapS: number;
}

/** Split marks: every 10 m up to 100 m, every 50 m beyond. */
export const splitStep = (targetM: number) => (targetM <= 100 ? 10 : 50);

/** Time to cover `d` metres on a segment starting at v0 with constant acceleration a. */
function timeFor(d: number, v0: number, a: number, dt: number): number {
  if (Math.abs(a) < 1e-9) return v0 > 0 ? Math.min(dt, d / v0) : dt;
  const disc = v0 * v0 + 2 * a * d;
  if (disc < 0) return dt;
  return Math.min(dt, Math.max(0, (-v0 + Math.sqrt(disc)) / a));
}

/** A single sample far above both neighbours is a GPS spike, not speed. */
function despike(s: SpeedSample[]): SpeedSample[] {
  return s.filter((x, i) => {
    const a = s[i - 1]?.v, b = s[i + 1]?.v;
    if (a == null || b == null) return true;
    return !(x.v - a > 2 && x.v - b > 2);
  });
}

export function sprintProgress(samples: SpeedSample[], targetM: number, stepM = splitStep(targetM)): SprintProgress {
  const pts = despike(samples.filter((s) => s.ms > 0).sort((a, b) => a.ms - b.ms));
  let t0 = 0, v0 = 0, dist = 0, topV = 0, topAtM = 0, maxGapS = 0;
  let finishS: number | null = null;
  const splits: SprintSplit[] = [];
  let nextSplit = stepM;
  for (const p of pts) {
    const dt = p.ms - t0;
    if (dt <= 0) continue;
    maxGapS = Math.max(maxGapS, dt);
    const a = (p.v - v0) / dt;
    const segD = ((v0 + p.v) / 2) * dt;
    // marks crossed inside this segment
    while (nextSplit <= targetM && dist + segD >= nextSplit) {
      splits.push({ m: nextSplit, s: Math.round((t0 + timeFor(nextSplit - dist, v0, a, dt)) * 100) / 100 });
      nextSplit += stepM;
    }
    if (finishS == null && dist + segD >= targetM) finishS = t0 + timeFor(targetM - dist, v0, a, dt);
    dist += segD;
    if (finishS == null && p.v > topV) { topV = p.v; topAtM = dist; }
    t0 = p.ms; v0 = p.v;
    if (finishS != null) break;
  }
  // the target itself is always the last split
  if (finishS != null && splits[splits.length - 1]?.m !== targetM) splits.push({ m: targetM, s: Math.round(finishS * 100) / 100 });
  return {
    distanceM: finishS != null ? targetM : dist,
    finishS: finishS != null ? Math.round(finishS * 100) / 100 : null,
    topV, topAtM: Math.round(topAtM), splits, maxGapS,
  };
}

/** Speed in each split, m/s. */
export function splitSpeeds(splits: SprintSplit[]): { from: number; to: number; s: number; v: number }[] {
  return splits.map((sp, i) => {
    const prev = splits[i - 1] ?? { m: 0, s: 0 };
    const s = sp.s - prev.s;
    return { from: prev.m, to: sp.m, s, v: s > 0 ? (sp.m - prev.m) / s : 0 };
  });
}

/** 14.82초 */
export const fmtSprint = (s: number) => `${s.toFixed(2)}초`;
/** "14초 82" for voice */
export const spokenSprint = (s: number) => {
  const whole = Math.floor(s);
  const hund = Math.round((s - whole) * 100);
  return hund === 100 ? `${whole + 1}초` : `${whole}초 ${String(hund).padStart(2, '0')}`;
};
export const kmh = (v: number) => `${(v * 3.6).toFixed(1)}km/h`;
