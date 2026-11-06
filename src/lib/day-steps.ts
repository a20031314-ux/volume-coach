/** A day's movement from the health store, in short slices: no location involved. */
export interface StepBucket { startMs: number; minutes: number; steps: number; meters: number }

/** typical walking cadence, steps per second (~110 per minute) */
const CADENCE = 1.85;

/**
 * Speed while actually moving in a slice. Steps were taken over only part of the slice, so
 * distance over the slice length would understate it; distance over (steps / cadence) doesn't.
 */
export function movingSpeed(b: Pick<StepBucket, 'steps' | 'meters' | 'minutes'>): number | null {
  if (b.steps < 60 || b.meters < 30) return null;
  const secs = Math.min(b.minutes * 60, b.steps / CADENCE);
  return b.meters / secs;
}

export function peakBucket(bs: StepBucket[]): StepBucket | null {
  return bs.reduce<StepBucket | null>((a, b) => (!a || b.steps > a.steps ? b : a), null);
}
