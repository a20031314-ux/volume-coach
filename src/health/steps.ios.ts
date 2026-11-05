import {
  isHealthDataAvailableAsync,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { Linking } from 'react-native';

import type { DaySteps } from '@/lib/activity';
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
