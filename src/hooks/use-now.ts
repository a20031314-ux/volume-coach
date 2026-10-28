import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time, refreshed every few minutes, when the screen regains focus, and when the app returns to the foreground. */
export function useNow(intervalMs = 5 * 60 * 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setNow(new Date()); });
    return () => { clearInterval(t); sub.remove(); };
  }, [intervalMs]);
  useFocusEffect(useCallback(() => { setNow(new Date()); }, []));
  return now;
}
