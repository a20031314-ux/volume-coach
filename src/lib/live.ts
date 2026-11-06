/** Live speed while running: a short rolling window at 1-second detail, against a target band. */
import type { SpeedSample } from './interval';

/** within this many seconds per km of the target counts as on pace */
export const PACE_TOLERANCE_S = 10;

export type PaceStatus = 'slow' | 'ok' | 'fast';

/**
 * Speed for the last `windowS` moving seconds, one value per second, each averaged over
 * `smoothS` seconds so single GPS wobbles don't jump around. `samples[].ms` is moving seconds.
 */
export function liveSeries(samples: SpeedSample[], nowS: number, windowS: number, smoothS = 3): [number, number][] {
  const from = Math.max(0, nowS - windowS);
  let i = samples.length - 1;
  while (i > 0 && samples[i - 1].ms >= from - smoothS) i--;
  const recent = samples.slice(i);
  const out: [number, number][] = [];
  for (let t = Math.ceil(from); t <= nowS; t++) {
    let sum = 0, n = 0;
    for (const s of recent) if (s.ms > t - smoothS && s.ms <= t) { sum += s.v; n++; }
    if (n) out.push([t, sum / n]);
  }
  return out;
}

/** Speed band (m/s) for a target pace: slower edge first. */
export function targetBand(targetPaceS: number, tolS = PACE_TOLERANCE_S): { lo: number; hi: number } {
  return { lo: 1000 / (targetPaceS + tolS), hi: 1000 / Math.max(60, targetPaceS - tolS) };
}

export function paceStatus(v: number | null, band: { lo: number; hi: number } | null): PaceStatus | null {
  if (v == null || !band) return null;
  return v < band.lo ? 'slow' : v > band.hi ? 'fast' : 'ok';
}
