/** This week of cardio: minutes per day (hard vs easy) and week totals. */
import { addDays, parse } from './dates';
import type { ActivityKind } from './elevation';
import type { Run } from './types';

export const HARD: ActivityKind[] = ['run', 'ride', 'other'];
const GPS_KM: ActivityKind[] = ['run', 'walk', 'hike'];

/** Monday of the week `date` falls in. */
export function weekMonday(date: string): string {
  const d = parse(date).getDay();
  return addDays(date, -((d + 6) % 7));
}

/** Per-day minutes split into hard (run, ride, indoor) and easy (walk, hike), plus week totals. */
export function cardioWeek(runs: Run[], monday: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((date) => {
    const rs = runs.filter((r) => r.date === date);
    const hard = rs.filter((r) => HARD.includes(r.kind ?? 'run')).reduce((a, r) => a + r.movingS, 0) / 60;
    const easy = rs.filter((r) => !HARD.includes(r.kind ?? 'run')).reduce((a, r) => a + r.movingS, 0) / 60;
    return { date, runs: rs, hard, easy };
  });
  const week = days.flatMap((d) => d.runs);
  return {
    days,
    km: week.filter((r) => GPS_KM.includes(r.kind ?? 'run')).reduce((a, r) => a + r.distanceM, 0) / 1000,
    count: week.length,
    min: days.reduce((a, d) => a + d.hard + d.easy, 0),
  };
}
