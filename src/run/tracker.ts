/**
 * GPS run tracking that keeps going with the screen off.
 *
 * Location fixes arrive through a TaskManager task (also while the app is in the foreground),
 * are filtered, and are appended to a small persisted store, so a run survives the app being
 * backgrounded or reloaded.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { body } from '@/lib/profile';
import { acceptPoint, runKcal, simplify, summarize, type GpsPoint } from '@/lib/run';
import { iso } from '@/lib/dates';
import { live, useData } from '@/store/store';

export const RUN_TASK = 'volume-coach-run-location';

export type RunStatus = 'idle' | 'running' | 'paused';

interface ActiveRun {
  status: RunStatus;
  startedAt: number;
  pausedMs: number;
  pauseStart: number | null;
  seg: number;
  points: GpsPoint[];
  distanceM: number;
  /** last fix time, even if it was filtered out — shows whether GPS is alive */
  lastFixAt: number | null;
  lastAccuracy: number | null;
}

const idle: ActiveRun = {
  status: 'idle', startedAt: 0, pausedMs: 0, pauseStart: null, seg: 0, points: [], distanceM: 0, lastFixAt: null, lastAccuracy: null,
};

/** AsyncStorage writes at most every 4 s; a long run's track is a few hundred KB. */
function throttledStorage(ms = 4000): StateStorage {
  let pending: { name: string; value: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    timer = null;
    if (!pending) return;
    const { name, value } = pending;
    pending = null;
    await AsyncStorage.setItem(name, value);
  };
  return {
    getItem: (name) => AsyncStorage.getItem(name),
    setItem: (name, value) => {
      pending = { name, value };
      if (!timer) timer = setTimeout(() => { void flush(); }, ms);
    },
    removeItem: (name) => AsyncStorage.removeItem(name),
  };
}

export const useRun = create<ActiveRun>()(
  persist(() => ({ ...idle }), {
    name: 'volume-coach-active-run',
    storage: createJSONStorage(() => throttledStorage()),
  }),
);

function waitForHydration(): Promise<void> {
  if (useRun.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useRun.persist.onFinishHydration(() => { unsub(); resolve(); });
  });
}

export function appendLocations(locs: Location.LocationObject[]) {
  const s = useRun.getState();
  if (!locs.length) return;
  const lastLoc = locs[locs.length - 1];
  const patch: Partial<ActiveRun> = { lastFixAt: lastLoc.timestamp, lastAccuracy: lastLoc.coords.accuracy ?? null };
  if (s.status === 'running') {
    const points = s.points.slice();
    let distanceM = s.distanceM;
    for (const l of [...locs].sort((a, b) => a.timestamp - b.timestamp)) {
      if (l.timestamp < s.startedAt) continue;
      const p: GpsPoint = { lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp, acc: l.coords.accuracy, seg: s.seg };
      const d = acceptPoint(points[points.length - 1], p);
      if (d == null) continue;
      points.push(p);
      distanceM += d;
    }
    patch.points = points;
    patch.distanceM = distanceM;
  }
  useRun.setState(patch);
}

// Must be defined at module scope so the background runtime can find it.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RUN_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    await waitForHydration();
    appendLocations(data.locations);
  });
}

export function elapsedS(s: ActiveRun, now = Date.now()): number {
  if (s.status === 'idle') return 0;
  const pausedNow = s.status === 'paused' && s.pauseStart ? now - s.pauseStart : 0;
  return Math.max(0, Math.floor((now - s.startedAt - s.pausedMs - pausedNow) / 1000));
}

export type StartResult = { ok: true } | { ok: false; message: string; openSettings?: boolean };

export async function isTrackingAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return TaskManager.isAvailableAsync();
}

async function startUpdates() {
  await Location.startLocationUpdatesAsync(RUN_TASK, {
    accuracy: Location.Accuracy.Highest,
    distanceInterval: 5,
    timeInterval: 2000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: '러닝 기록 중',
      notificationBody: '화면을 꺼도 거리를 계속 재고 있어요',
      notificationColor: '#2f47c9',
      killServiceOnDestroy: false,
    },
  });
}

export async function startRun(): Promise<StartResult> {
  if (!(await isTrackingAvailable())) {
    return { ok: false, message: '이 기기에서는 러닝 기록을 쓸 수 없어요. 앱으로 설치한 버전에서 사용해 주세요.' };
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, message: '휴대폰의 위치 서비스가 꺼져 있어요. 설정에서 켜 주세요.', openSettings: true };
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { ok: false, message: '거리를 재려면 위치 권한이 필요해요. 설정에서 위치를 허용해 주세요.', openSettings: !fg.canAskAgain };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return {
      ok: false,
      message: Platform.OS === 'ios'
        ? '화면을 꺼도 기록하려면 위치 권한을 "항상"으로 바꿔 주세요.'
        : '화면을 꺼도 기록하려면 위치 권한을 "항상 허용"으로 바꿔 주세요.',
      openSettings: true,
    };
  }
  useRun.setState({ ...idle, status: 'running', startedAt: Date.now() });
  try {
    await startUpdates();
  } catch (e) {
    useRun.setState({ ...idle });
    return { ok: false, message: `위치 기록을 시작하지 못했어요: ${(e as Error).message}` };
  }
  return { ok: true };
}

export function pauseRun() {
  const s = useRun.getState();
  if (s.status !== 'running') return;
  useRun.setState({ status: 'paused', pauseStart: Date.now(), seg: s.seg + 1 });
}

export async function resumeRun(): Promise<StartResult> {
  const s = useRun.getState();
  if (s.status !== 'paused') return { ok: true };
  const now = Date.now();
  useRun.setState({ status: 'running', pausedMs: s.pausedMs + (s.pauseStart ? now - s.pauseStart : 0), pauseStart: null });
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(RUN_TASK))) await startUpdates();
  } catch (e) {
    return { ok: false, message: `위치 기록을 다시 시작하지 못했어요: ${(e as Error).message}` };
  }
  return { ok: true };
}

async function stopUpdates() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RUN_TASK)) await Location.stopLocationUpdatesAsync(RUN_TASK);
  } catch {
    // already stopped
  }
}

/** Stop and save. Returns the saved distance, or null when the run was too short to keep. */
export async function finishRun(): Promise<number | null> {
  await stopUpdates();
  const s = useRun.getState();
  const endedAt = s.status === 'paused' && s.pauseStart ? s.pauseStart : Date.now();
  const sum = summarize(s.points);
  const movingS = elapsedS({ ...s, status: 'running', pauseStart: null }, endedAt);
  useRun.setState({ ...idle });
  if (sum.distanceM < 50) return null;
  const data = useData.getState();
  const b = body(data.settings.profile, live(data.bodyComps));
  data.addRun({
    date: iso(new Date(s.startedAt)),
    startedAt: s.startedAt,
    endedAt,
    distanceM: Math.round(sum.distanceM),
    movingS,
    paceSecPerKm: movingS / (sum.distanceM / 1000),
    kcal: runKcal(sum.distanceM, b?.weight ?? 70),
    splits: sum.splits,
    route: simplify(s.points).map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6, p.seg]),
  });
  return sum.distanceM;
}

export async function discardRun() {
  await stopUpdates();
  useRun.setState({ ...idle });
}

/**
 * After a restart the OS may have stopped location updates (Android does when the app is killed).
 * Turn such a run into a paused one so the user can resume or finish it.
 */
export async function reconcileRun(): Promise<void> {
  await waitForHydration();
  const s = useRun.getState();
  if (s.status !== 'running' || Platform.OS === 'web') return;
  let started = false;
  try { started = await Location.hasStartedLocationUpdatesAsync(RUN_TASK); } catch { started = false; }
  if (!started) {
    const lastT = s.points[s.points.length - 1]?.t ?? s.lastFixAt ?? Date.now();
    useRun.setState({ status: 'paused', pauseStart: lastT, seg: s.seg + 1 });
  }
}

export const openSettings = () => { void Linking.openSettings(); };
