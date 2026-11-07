/**
 * 식단 추천 notifications: one per meal time for the next week, each with that meal's
 * recommendation. Rescheduled whenever the plan or what was eaten changes, so today's later
 * meals reflect what's left.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { useDietReport } from '@/hooks/use-diet-report';
import type { DietReport } from '@/lib/diet-report';
import { missingToday, planMeals, useMissing } from '@/hooks/use-meal-plan';
import { parse } from '@/lib/dates';
import { hhmm, shortLabel } from '@/lib/meal-plan';
import { ensureNotifications } from '@/store/rest-timer';
import { live, useData } from '@/store/store';

const KEY = 'volume-coach-meal-notifs';
const DAYS = 7;
const URL = '/food';

let channel = false;
async function ensureChannel() {
  if (channel || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('meal', {
    // eslint-disable-next-line import/namespace
    name: '식단 추천', importance: Notifications.AndroidImportance.DEFAULT,
  });
  channel = true;
}

async function cancelAll() {
  const ids: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{"ids":[]}').ids ?? [];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.setItem(KEY, JSON.stringify({ ids: [], sig: '' }));
}

/** Ask for permission (when the user turns it on). */
export async function enableMealReminders(): Promise<boolean> {
  return ensureNotifications();
}

async function reschedule(rep: DietReport) {
  if (Platform.OS === 'web') return;
  const s = useData.getState();
  if (!s.settings.mealPlan.on) { await cancelAll(); return; }
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const now = new Date();
  const plans = planMeals({
    settings: s.settings, meals: live(s.meals), logs: live(s.logs), comps: live(s.bodyComps),
    prefer: rep.prefer, preferBySlot: rep.preferBySlot, missing: missingToday(), now, days: DAYS,
  });
  const items = plans.map((m) => {
    const at = parse(m.date);
    at.setHours(Math.floor(m.min / 60), m.min % 60, 0, 0);
    return {
      at,
      title: `${m.name} 추천 · ${hhmm(m.min)}`,
      body: `${shortLabel(m.rec.parts)} · 단백질 ${Math.round(m.rec.total.p)}g · ${Math.round(m.rec.total.k)}kcal`,
    };
  }).filter((x) => x.at.getTime() > now.getTime() + 30e3);
  const sig = JSON.stringify(items.map((x) => [x.at.getTime(), x.body]));
  const prev = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
  if (prev.sig === sig) return;
  await cancelAll();
  await ensureChannel();
  const ids: string[] = [];
  for (const it of items) {
    try {
      ids.push(await Notifications.scheduleNotificationAsync({
        content: { title: it.title, body: it.body, data: { url: URL } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: it.at, channelId: 'meal' },
      }));
    } catch { /* keep the rest */ }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify({ ids, sig }));
}

/** Mounted once at the root (native only — web has no notification API): keeps reminders in step with the data, and opens 영양 on tap. */
export function useMealReminders() {
  const plan = useData((s) => s.settings.mealPlan);
  const profile = useData((s) => s.settings.profile);
  const meals = useData((s) => s.meals);
  const missing = useMissing((s) => s.foods);
  const rep = useDietReport(28);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (timer.current) clearTimeout(timer.current);
    // meals get added a few at a time: wait for the burst to settle
    timer.current = setTimeout(() => { void reschedule(rep).catch(() => undefined); }, 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [plan, profile, meals, missing, rep]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void reschedule(rep).catch(() => undefined); });
    return () => sub.remove();
  }, [rep]);

  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (Platform.OS === 'web' || !last) return;
    if (last.notification.request.content.data?.url !== URL || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    Notifications.clearLastNotificationResponse();
    router.navigate(URL);
  }, [last]);
}
