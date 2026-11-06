// Fallback (web): no health store. Platform files steps.ios.ts / steps.android.ts replace this.
import type { DaySteps } from '@/lib/activity';
import type { StepBucket } from '@/lib/day-steps';

export type HealthStatus = 'ok' | 'unavailable' | 'needsInstall';

/** Name of the phone's health store, as users see it. */
export const HEALTH_NAME = '건강 앱';

export async function healthStatus(): Promise<HealthStatus> {
  return 'unavailable';
}

/** Asks for read access to steps and distance. Resolves true when the request went through. */
export async function requestHealth(): Promise<boolean> {
  return false;
}

/** Steps and walking/running distance for a local YYYY-MM-DD day; null if unreadable. */
export async function readDaySteps(_date: string): Promise<DaySteps | null> {
  return null;
}

/** Opens the store's own permission screen, where access can be changed. */
export function openHealthSettings(): void {}

/** Steps and distance in `minutes`-long slices of a day; null if unreadable. */
export async function readDayBuckets(_date: string, _minutes = 15): Promise<StepBucket[] | null> {
  return null;
}
