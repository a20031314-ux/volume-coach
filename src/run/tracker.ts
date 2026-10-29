/**
 * GPS run tracking that keeps going with the screen off.
 *
 * Location fixes arrive through a TaskManager task (also while the app is in the foreground, about
 * once a second), are filtered, and are appended to a small persisted store, so a run survives the
 * app being backgrounded or reloaded. Each fix also drives the voice coach, so cues keep coming
 * with the screen off; scheduled notifications back up interval phase changes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { iso } from '@/lib/dates';
import {
  PHASE_NAME, bucketTimeline, buildPhases, dopplerSpeed, dueCues, initialCues, paceFromSpeed, phaseStats, smoothSpeed,
  spokenPace, type CueState, type IntervalPlan, type Phase, type SpeedSample,
} from '@/lib/interval';
import { body } from '@/lib/profile';
import { acceptPoint, currentPace, haversine, runKcal, simplify, summarize, type GpsPoint } from '@/lib/run';
import { ensureNotifications } from '@/store/rest-timer';
import { live, useData } from '@/store/store';

export const RUN_TASK = 'volume-coach-run-location';

export type RunStatus = 'idle' | 'running' | 'paused';

export interface RunSetup {
  plan: IntervalPlan | null;
  voice: boolean;
  kmAlert: boolean;
  everyMin: number;
}

interface ActiveRun extends RunSetup {
  status: RunStatus;
  startedAt: number;
  pausedMs: number;
  pauseStart: number | null;
  seg: number;
  points: GpsPoint[];
  speeds: SpeedSample[];
  distanceM: number;
  /** last fix time, even if it was filtered out — shows whether GPS is alive */
  lastFixAt: number | null;
  lastAccuracy: number | null;
  cues: CueState;
  notifIds: string[];
}

const idle: ActiveRun = {
  status: 'idle', startedAt: 0, pausedMs: 0, pauseStart: null, seg: 0, points: [], speeds: [], distanceM: 0,
  lastFixAt: null, lastAccuracy: null, cues: initialCues, notifIds: [],
  plan: null, voice: true, kmAlert: true, everyMin: 0,
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
  persist((): ActiveRun => ({ ...idle }), {
    name: 'volume-coach-active-run',
    storage: createJSONStorage(() => throttledStorage()),
    merge: (p, cur) => ({ ...cur, ...((p ?? {}) as Partial<ActiveRun>) }),
  }),
);

function waitForHydration(): Promise<void> {
  if (useRun.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useRun.persist.onFinishHydration(() => { unsub(); resolve(); });
  });
}

export function elapsedS(s: Pick<ActiveRun, 'status' | 'startedAt' | 'pausedMs' | 'pauseStart'>, now = Date.now()): number {
  if (s.status === 'idle') return 0;
  const pausedNow = s.status === 'paused' && s.pauseStart ? now - s.pauseStart : 0;
  return Math.max(0, Math.floor((now - s.startedAt - s.pausedMs - pausedNow) / 1000));
}

const movingAt = (s: ActiveRun, t: number) => Math.max(0, (t - s.startedAt - s.pausedMs) / 1000);

export const phasesOf = (s: Pick<ActiveRun, 'plan'>): Phase[] | null => (s.plan ? buildPhases(s.plan) : null);

/** Smoothed current pace: GPS Doppler speed over the last 8 s, else position-based over 200 m. */
export function livePace(s: ActiveRun, now = Date.now()): number | null {
  if (s.status !== 'running') return null;
  const v = smoothSpeed(s.speeds, elapsedS(s, now), 8);
  return paceFromSpeed(v) ?? currentPace(s.points);
}

export function appendLocations(locs: Location.LocationObject[]) {
  const s = useRun.getState();
  if (!locs.length) return;
  const lastLoc = locs[locs.length - 1];
  const patch: Partial<ActiveRun> = { lastFixAt: lastLoc.timestamp, lastAccuracy: lastLoc.coords.accuracy ?? null };
  if (s.status === 'running') {
    const points = s.points.slice();
    const speeds = s.speeds.slice();
    let distanceM = s.distanceM;
    for (const l of [...locs].sort((a, b) => a.timestamp - b.timestamp)) {
      if (l.timestamp < s.startedAt) continue;
      const ms = movingAt(s, l.timestamp);
      const p: GpsPoint = { lat: l.coords.latitude, lng: l.coords.longitude, t: l.timestamp, acc: l.coords.accuracy, seg: s.seg, ms };
      const prev = points[points.length - 1];
      const d = acceptPoint(prev, p);
      let v = dopplerSpeed(l.coords.speed, (l.coords as { speedAccuracy?: number | null }).speedAccuracy);
      if (v == null && d != null && prev && prev.seg === p.seg) v = d / Math.max(0.5, (p.t - prev.t) / 1000);
      if (v == null && prev && prev.seg === p.seg && d == null && (l.coords.accuracy ?? 99) <= 35) {
        // fix dropped as standing-still wobble: that's speed ~0
        if (haversine(prev, p) < 3) v = 0;
      }
      if (v != null) speeds.push({ ms, v });
      if (d == null) continue;
      points.push(p);
      distanceM += d;
    }
    patch.points = points;
    patch.speeds = speeds.length > 20000 ? speeds.slice(-20000) : speeds;
    patch.distanceM = distanceM;
  }
  useRun.setState(patch);
  tickCues();
}

/* ---------- voice coach ---------- */

function speak(lines: string[]) {
  if (!lines.length || Platform.OS === 'web') return;
  for (const line of lines) {
    try { Speech.speak(line, { language: 'ko-KR', rate: 1.0, useApplicationAudioSession: false }); } catch { /* no TTS */ }
  }
}

/** Speak whatever cue is due. Safe to call repeatedly (each fix and each UI tick). */
export function tickCues(now = Date.now()) {
  const s = useRun.getState();
  if (s.status !== 'running') return;
  const movingS = elapsedS(s, now);
  const phases = phasesOf(s);
  const crossedKm = Math.floor(s.distanceM / 1000) > s.cues.km;
  const splits = crossedKm ? summarize(s.points).splits : [];
  const { say, next } = dueCues(s.cues, {
    phases, plan: s.plan, movingS, distanceM: s.distanceM,
    paceNowS: livePace(s, now),
    avgPaceS: s.distanceM >= 50 ? movingS / (s.distanceM / 1000) : null,
    lastSplitS: splits.length ? splits[splits.length - 1].seconds : null,
    phasePace: (i) => (phases ? phaseStats(phases, s.points)[i]?.paceS ?? null : null),
    kmAlert: s.kmAlert,
    everyMin: s.everyMin,
  });
  if (next !== s.cues && JSON.stringify(next) !== JSON.stringify(s.cues)) useRun.setState({ cues: next });
  if (s.voice) speak(say);
}

/* ---------- backup notifications for phase changes ---------- */

async function cancelPhaseNotifications() {
  const ids = useRun.getState().notifIds;
  if (!ids.length || Platform.OS === 'web') return;
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  useRun.setState({ notifIds: [] });
}

async function schedulePhaseNotifications() {
  await cancelPhaseNotifications();
  const s = useRun.getState();
  const phases = phasesOf(s);
  if (!phases || s.status !== 'running' || !(await ensureNotifications())) return;
  const nowS = elapsedS(s);
  const reps = phases.filter((p) => p.kind === 'work').length;
  const ids: string[] = [];
  const items = phases.filter((p) => p.startS > nowS + 1).map((p) => ({
    at: p.startS,
    title: p.kind === 'work' ? `${p.rep}/${reps} 달리기` : PHASE_NAME[p.kind],
    body: `${Math.round((p.endS - p.startS) / 60 * 10) / 10}분${p.kind === 'work' && s.plan?.targetPaceS ? ` · 목표 ${spokenPace(s.plan.targetPaceS)}` : ''}`,
  }));
  const end = phases[phases.length - 1]?.endS;
  if (end && end > nowS + 1) items.push({ at: end, title: '인터벌 완료', body: '러닝은 계속 기록 중이에요' });
  for (const it of items.slice(0, 60)) {
    try {
      ids.push(await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(it.at - nowS)), channelId: 'rest' },
      }));
    } catch { break; }
  }
  useRun.setState({ notifIds: ids });
}

// Must be defined at module scope so the background runtime can find it.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RUN_TASK, async ({ data, error }) => {
    if (error || !data?.locations) return;
    await waitForHydration();
    appendLocations(data.locations);
  });
}

export type StartResult = { ok: true } | { ok: false; message: string; openSettings?: boolean };

export async function isTrackingAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return TaskManager.isAvailableAsync();
}

async function startUpdates() {
  await Location.startLocationUpdatesAsync(RUN_TASK, {
    accuracy: Location.Accuracy.Highest,
    // every fix (about 1 s) so the voice coach keeps time even while standing during a rest
    distanceInterval: 0,
    timeInterval: 1000,
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

export async function startRun(setup: RunSetup): Promise<StartResult> {
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
  useRun.setState({ ...idle, ...setup, status: 'running', startedAt: Date.now() });
  try {
    await startUpdates();
  } catch (e) {
    useRun.setState({ ...idle });
    return { ok: false, message: `위치 기록을 시작하지 못했어요: ${(e as Error).message}` };
  }
  if (setup.voice) speak([setup.plan ? '인터벌 러닝을 시작합니다' : '러닝을 시작합니다']);
  tickCues();
  void schedulePhaseNotifications();
  return { ok: true };
}

export function pauseRun() {
  const s = useRun.getState();
  if (s.status !== 'running') return;
  useRun.setState({ status: 'paused', pauseStart: Date.now(), seg: s.seg + 1 });
  if (s.voice) speak(['일시정지']);
  void cancelPhaseNotifications();
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
  if (s.voice) speak(['다시 시작']);
  void schedulePhaseNotifications();
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
  await cancelPhaseNotifications();
  const s = useRun.getState();
  const endedAt = s.status === 'paused' && s.pauseStart ? s.pauseStart : Date.now();
  const sum = summarize(s.points);
  const movingS = elapsedS({ ...s, status: 'running', pauseStart: null }, endedAt);
  const phases = phasesOf(s);
  useRun.setState({ ...idle });
  if (sum.distanceM < 50) return null;
  const pace = movingS / (sum.distanceM / 1000);
  if (s.voice) speak([`러닝 끝. 총 ${(sum.distanceM / 1000).toFixed(2)}킬로미터, 평균 페이스 ${spokenPace(pace)}`]);
  const data = useData.getState();
  const b = body(data.settings.profile, live(data.bodyComps));
  data.addRun({
    date: iso(new Date(s.startedAt)),
    startedAt: s.startedAt,
    endedAt,
    distanceM: Math.round(sum.distanceM),
    movingS,
    paceSecPerKm: pace,
    kcal: runKcal(sum.distanceM, b?.weight ?? 70),
    splits: sum.splits,
    route: simplify(s.points).map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6, p.seg]),
    timeline: bucketTimeline(s.speeds, 15),
    intervalPlan: s.plan,
    phases: phases ? phaseStats(phases, s.points).filter((p) => p.distanceM > 0 || p.kind === 'work') : undefined,
  });
  return sum.distanceM;
}

export async function discardRun() {
  await stopUpdates();
  await cancelPhaseNotifications();
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
    void cancelPhaseNotifications();
  }
}

export const openSettings = () => { void Linking.openSettings(); };
