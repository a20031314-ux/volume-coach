import {
  isHealthDataAvailableAsync,
  queryStatisticsCollectionForQuantity,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import type { DaySteps } from '@/lib/activity';
import type { StepBucket } from '@/lib/day-steps';
import { parse } from '@/lib/dates';

export type HealthStatus = 'ok' | 'unavailable' | 'needsInstall';
export const HEALTH_NAME = '건강 앱';

const STEPS = 'HKQuantityTypeIdentifierStepCount' as const;
const DIST = 'HKQuantityTypeIdentifierDistanceWalkingRunning' as const;

export async function healthStatus(): Promise<HealthStatus> {
  try {
    return (await isHealthDataAvailableAsync()) ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestHealth(): Promise<boolean> {
  try {
    // iOS never says whether read access was granted; a denied read just returns no data.
    return await requestAuthorization({ toRead: [STEPS, DIST] });
  } catch {
    return false;
  }
}

export async function readDaySteps(date: string): Promise<DaySteps | null> {
  const startDate = parse(date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const filter = { date: { startDate, endDate } };
  try {
    const [s, d] = await Promise.all([
      queryStatisticsForQuantity(STEPS, ['cumulativeSum'], { filter, unit: 'count' }),
      queryStatisticsForQuantity(DIST, ['cumulativeSum'], { filter, unit: 'm' }),
    ]);
    return { steps: s.sumQuantity?.quantity ?? 0, meters: d.sumQuantity?.quantity ?? 0 };
  } catch {
    return null;
  }
}

export function openHealthSettings(): void {
  // Health has no deep link to an app's permissions; the app's Settings page links to it.
  Linking.openSettings();
}

export async function readDayBuckets(date: string, minutes = 15): Promise<StepBucket[] | null> {
  const startDate = parse(date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  const filter = { date: { startDate, endDate } };
  try {
    const [s, d] = await Promise.all([
      queryStatisticsCollectionForQuantity(STEPS, ['cumulativeSum'], startDate, { minute: minutes }, { filter, unit: 'count' }),
      queryStatisticsCollectionForQuantity(DIST, ['cumulativeSum'], startDate, { minute: minutes }, { filter, unit: 'm' }),
    ]);
    const by = new Map<number, StepBucket>();
    for (const x of s) {
      if (!x.startDate) continue;
      const k = new Date(x.startDate).getTime();
      by.set(k, { startMs: k, minutes, steps: x.sumQuantity?.quantity ?? 0, meters: 0 });
    }
    for (const x of d) {
      if (!x.startDate) continue;
      const k = new Date(x.startDate).getTime();
      const b = by.get(k) ?? { startMs: k, minutes, steps: 0, meters: 0 };
      b.meters = x.sumQuantity?.quantity ?? 0;
      by.set(k, b);
    }
    return [...by.values()].filter((b) => b.steps > 0 || b.meters > 0).sort((a, b) => a.startMs - b.startMs);
  } catch {
    return null;
  }
}
