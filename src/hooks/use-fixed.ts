/** 고정식단: today's checklist, toggling, and auto logging. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useNow } from '@/hooks/use-now';
import { today } from '@/lib/dates';
import { dueAuto, fixedMeal, fixedOf, fixedRows, type FixedRow } from '@/lib/fixed';
import { useCloudFoods } from '@/lib/food-lookup';
import { live, useData } from '@/store/store';

/** auto mode: items the user un-checked today, so they aren't logged again */
interface SkipState { date: string; ids: string[] }
const useSkipped = create<SkipState>()(
  persist((): SkipState => ({ date: '', ids: [] }), { name: 'volume-coach-fixed-skip', storage: createJSONStorage(() => AsyncStorage) }),
);
const skippedToday = () => { const s = useSkipped.getState(); return s.date === today() ? s.ids : []; };
function setSkipped(id: string, on: boolean) {
  const ids = skippedToday();
  useSkipped.setState({ date: today(), ids: on ? [...new Set([...ids, id])] : ids.filter((x) => x !== id) });
}

export function useFixedToday(date = today()): FixedRow[] {
  const f = useData((s) => s.settings.fixed);
  const mealsT = useData((s) => s.meals);
  const cloud = useCloudFoods((s) => s.foods);
  return useMemo(() => fixedRows(fixedOf(f), date, live(mealsT), cloud), [f, mealsT, cloud, date]);
}

export function toggleFixed(r: FixedRow, date = today()) {
  const { addMeal, removeMeal, settings } = useData.getState();
  const auto = fixedOf(settings.fixed).mode === 'auto';
  if (r.logged) {
    removeMeal(r.logged.id);
    if (auto && date === today()) setSkipped(r.item.id, true);
    return;
  }
  const m = fixedMeal(r, date);
  if (m) addMeal(m);
  if (date === today()) setSkipped(r.item.id, false);
}

/** Mounted once at the root: in auto mode, log items whose time has passed. */
export function useFixedAuto() {
  const now = useNow(5 * 60e3);
  const f = useData((s) => s.settings.fixed);
  const rows = useFixedToday();
  useEffect(() => {
    const run = () => {
      if (fixedOf(f).mode !== 'auto') return;
      const d = new Date();
      const due = dueAuto(rows, d.getHours() * 60 + d.getMinutes(), skippedToday());
      const add = useData.getState().addMeal;
      for (const r of due) { const m = fixedMeal(r, today()); if (m) add(m); }
    };
    run();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') run(); });
    return () => sub.remove();
  }, [f, rows, now]);
}
