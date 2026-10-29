/** Rest countdown between sets, with a local notification so it works with the screen off. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface RestState { until: number | null; total: number; notifId: string | null; label: string }

export const useRest = create<RestState>()(
  persist((): RestState => ({ until: null, total: 0, notifId: null, label: '' }), {
    name: 'volume-coach-rest',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

let ready = false;
/** Set up local notifications once and ask permission. Returns false when they can't be shown. */
export async function ensureNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!ready) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rest', {
        // AndroidImportance is re-exported through a types module the import plugin can't follow
        // eslint-disable-next-line import/namespace
        name: '운동 알림', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 300, 150, 300],
      });
    }
    ready = true;
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelPending() {
  const id = useRest.getState().notifId;
  if (id && Platform.OS !== 'web') {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* already fired */ }
  }
}

export async function startRest(seconds: number, label: string) {
  await cancelPending();
  useRest.setState({ until: Date.now() + seconds * 1000, total: seconds, notifId: null, label });
  try {
    if (!(await ensureNotifications())) return;
    const notifId = await Notifications.scheduleNotificationAsync({
      content: { title: '휴식 끝', body: `${label} 다음 세트를 시작하세요`, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: 'rest' },
    });
    useRest.setState({ notifId });
  } catch {
    // notifications unavailable (e.g. Expo Go on some platforms): the on-screen timer still works
  }
}

export async function addRest(seconds: number) {
  const s = useRest.getState();
  if (!s.until) return;
  const left = Math.max(0, (s.until - Date.now()) / 1000) + seconds;
  if (left <= 0) return stopRest();
  await startRest(left, s.label);
  useRest.setState({ total: s.total + seconds });
}

export async function stopRest() {
  await cancelPending();
  useRest.setState({ until: null, total: 0, notifId: null });
}

/** Buzz once when the timer runs out while the app is open. */
export function buzz() {
  if (Platform.OS !== 'web') Vibration.vibrate([0, 300, 150, 300]);
}
