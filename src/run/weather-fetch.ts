/**
 * Weather for a saved outdoor activity from Open-Meteo (free, no key; non-commercial use).
 * Phones have no air-temperature sensor, so the reading comes from the nearest weather model
 * point at the start of the route. Fetched once, right after saving.
 */
import type { Run } from '@/lib/types';
import { weatherFactor, type Weather } from '@/lib/weather';
import { useData } from '@/store/store';

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';

export async function fetchWeather(lat: number, lng: number): Promise<Weather | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const q = `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m`;
    const r = await fetch(`${URL_BASE}?${q}`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as { current?: Record<string, number> };
    const c = j.current;
    if (!c || typeof c.temperature_2m !== 'number') return null;
    return {
      tempC: Math.round(c.temperature_2m * 10) / 10,
      feelsC: Math.round((c.apparent_temperature ?? c.temperature_2m) * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m ?? 0),
      windKmh: Math.round(c.wind_speed_10m ?? 0),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Adds weather to a run that just finished and folds it into the calorie estimate. */
export async function enrichWeather(run: Pick<Run, 'id' | 'route' | 'weather' | 'endedAt'>): Promise<void> {
  // only for a run that ended in the last couple of hours; "current" weather says nothing about older ones
  if (run.weather || !run.route.length || Date.now() - run.endedAt > 2 * 3600e3) return;
  const [lat, lng] = run.route[0];
  const w = await fetchWeather(lat, lng);
  if (!w) return;
  const cur = useData.getState().runs[run.id];
  if (!cur || cur.weather) return;
  useData.getState().patchRun(run.id, { weather: w, kcal: Math.round(cur.kcal * weatherFactor(w)) });
}
