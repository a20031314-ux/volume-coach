import {
  SdkAvailabilityStatus,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
} from 'react-native-health-connect';
import { Linking } from 'react-native';

import type { DaySteps } from '@/lib/activity';
import { parse } from '@/lib/dates';

export type HealthStatus = 'ok' | 'unavailable' | 'needsInstall';
export const HEALTH_NAME = '헬스 커넥트';

let ready: Promise<boolean> | null = null;
const init = () => (ready ??= initialize().catch(() => { ready = null; return false; }));

export async function healthStatus(): Promise<HealthStatus> {
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'ok';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needsInstall';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestHealth(): Promise<boolean> {
  try {
    if (!(await init())) return false;
    const got = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'Distance' },
    ]);
    return got.some((p) => 'recordType' in p && p.recordType === 'Steps');
  } catch {
    return false;
  }
}

export async function readDaySteps(date: string): Promise<DaySteps | null> {
  const start = parse(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const timeRangeFilter = { operator: 'between' as const, startTime: start.toISOString(), endTime: end.toISOString() };
  try {
    if (!(await init())) return null;
    const granted = await getGrantedPermissions();
    const has = (t: string) => granted.some((p) => 'recordType' in p && p.recordType === t && p.accessType === 'read');
    if (!has('Steps')) return null;
    const [s, d] = await Promise.all([
      aggregateRecord({ recordType: 'Steps', timeRangeFilter }),
      has('Distance') ? aggregateRecord({ recordType: 'Distance', timeRangeFilter }) : null,
    ]);
    return { steps: s.COUNT_TOTAL ?? 0, meters: d?.DISTANCE?.inMeters ?? 0 };
  } catch {
    return null;
  }
}

export function openHealthSettings(): void {
  try {
    openHealthConnectSettings();
  } catch {
    Linking.openSettings();
  }
}
