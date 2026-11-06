/**
 * Opt-in all-day movement recording. A low-rate background location task stores fixes per day
 * on this device only (never synced — it's a fine-grained location history). Walks are worked
 * out from them when shown. Runs keep their own high-rate task; fixes during a run are ignored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDays, iso, today } from '@/lib/dates';
import type { MovePoint } from '@/lib/movement';

export const MOVE_TASK = 'volume-coach-move';
const KEEP_DAYS = 14;
const MAX_PER_DAY = 6000;

interface MoveState {
  enabled: boolean;
  days: Record<string, MovePoint[]>;
}

export const useMove = create<MoveState>()(
  persist((): MoveState => ({ enabled: false, days: {} }), {
    name: 'volume-coach-move',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

function append(locs: Location.LocationObject[]) {
  if (!locs.length) return;
  const days = { ...useMove.getState().days };
  for (const l of locs) {
    const d = iso(new Date(l.timestamp));
    const arr = (days[d] = days[d] ? days[d].slice() : []);
    if (arr.length >= MAX_PER_DAY) continue;
    arr.push([Math.round(l.timestamp / 1000), Math.round(l.coords.latitude * 1e6) / 1e6, Math.round(l.coords.longitude * 1e6) / 1e6, Math.round(l.coords.accuracy ?? 99)]);
  }
  const cutoff = addDays(today(), -KEEP_DAYS);
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
  useMove.setState({ days });
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(MOVE_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    // the task can run before the persisted store has loaded; wait so nothing is overwritten
    if (!useMove.persist.hasHydrated()) await new Promise<void>((r) => { const off = useMove.persist.onFinishHydration(() => { off(); r(); }); });
    append(data.locations);
  });
}

async function startUpdates() {
  await Location.startLocationUpdatesAsync(MOVE_TASK, {
    // ~10 m accuracy is needed for walking distance; the distance filter keeps the rate low
    accuracy: Location.Accuracy.High,
    distanceInterval: 20,
    timeInterval: 30000,
    deferredUpdatesInterval: 60000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: '이동 기록 중',
      notificationBody: '걷기 거리를 재고 있어요',
      notificationColor: '#2f47c9',
      killServiceOnDestroy: false,
    },
  });
}

export type MoveResult = { ok: true } | { ok: false; message: string; openSettings?: boolean };

/** Turns all-day recording on (asking for "always" location) or off. */
export async function setMoveEnabled(on: boolean): Promise<MoveResult> {
  if (Platform.OS === 'web') return { ok: false, message: '설치한 앱에서만 쓸 수 있어요.' };
  if (!on) {
    useMove.setState({ enabled: false });
    try { if (await Location.hasStartedLocationUpdatesAsync(MOVE_TASK)) await Location.stopLocationUpdatesAsync(MOVE_TASK); } catch { /* not running */ }
    return { ok: true };
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, message: '위치 권한이 필요해요.', openSettings: !fg.canAskAgain };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return { ok: false, message: Platform.OS === 'ios' ? '위치 권한을 "항상"으로 바꿔 주세요.' : '위치 권한을 "항상 허용"으로 바꿔 주세요.', openSettings: true };
  }
  try {
    await startUpdates();
  } catch (e) {
    return { ok: false, message: `시작하지 못했어요: ${(e as Error).message}` };
  }
  useMove.setState({ enabled: true });
  return { ok: true };
}

/**
 * On launch. All-day recording is switched off for now (store policy on background location),
 * so anyone who had it on is turned off and the task stopped. History stays until cleared.
 */
export async function resumeMove() {
  if (Platform.OS === 'web' || !useMove.getState().enabled) return;
  await setMoveEnabled(false);
}

export function clearMoveHistory() {
  useMove.setState({ days: {} });
}
