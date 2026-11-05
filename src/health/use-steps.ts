/** Steps from the phone's health store. The on/off switch is per device, so it isn't synced. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DaySteps } from '@/lib/activity';
import { today } from '@/lib/dates';

import { readDaySteps, requestHealth } from './steps';

interface HealthState {
  enabled: boolean;
  /** day → steps; today's entry is refreshed whenever it's asked for again */
  days: Record<string, DaySteps | null>;
  readAt: Record<string, number>;
}

export const useHealth = create<HealthState>()(
  persist((): HealthState => ({ enabled: false, days: {}, readAt: {} }), {
    name: 'volume-coach-health',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => ({ enabled: s.enabled }) as HealthState,
  }),
);

/** Turns the connection on (asking for permission) or off. Returns whether it ended up on. */
export async function setHealthEnabled(on: boolean): Promise<boolean> {
  if (!on) {
    useHealth.setState({ enabled: false, days: {}, readAt: {} });
    return false;
  }
  const ok = await requestHealth();
  useHealth.setState({ enabled: ok, days: {}, readAt: {} });
  return ok;
}

const inflight = new Set<string>();
const FRESH_MS = 60e3;

/** Re-reads a day unless it was read recently. Past days are read once. */
export async function refreshSteps(date: string, force = false) {
  const st = useHealth.getState();
  if (!st.enabled || inflight.has(date)) return;
  const past = date < today();
  const at = st.readAt[date];
  if (!force && at && (past || Date.now() - at < FRESH_MS)) return;
  inflight.add(date);
  try {
    const v = await readDaySteps(date);
    useHealth.setState((s) => ({ days: { ...s.days, [date]: v }, readAt: { ...s.readAt, [date]: Date.now() } }));
  } finally {
    inflight.delete(date);
  }
}

/**
 * Steps for a day: undefined while off or loading, null when unreadable (no permission).
 * Pass `tick` (e.g. a focus/foreground timestamp) to re-read today's count.
 */
export function useDaySteps(date: string, tick?: number): DaySteps | null | undefined {
  const enabled = useHealth((s) => s.enabled);
  const v = useHealth((s) => s.days[date]);
  useEffect(() => {
    if (enabled) refreshSteps(date);
  }, [enabled, date, tick]);
  return enabled ? v : undefined;
}
