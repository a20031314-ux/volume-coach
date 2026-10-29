import { describe, expect, it } from 'vitest';

import { HEAVY, LIBRARY } from '../exercises';
import { betterDay, recommendRoutine, splitFor, todayDay, underRecovered, weeklyVolume } from '../routine';
import { DEFAULT_SETTINGS, type Profile, type Routine, type Session } from '../types';

const profile = (p: Partial<Profile> = {}): Profile => ({ goal: 'hyp', years: '3', days: 4, sessionMin: 75, equipment: 'gym', ...p });
const make = (p: Partial<Profile> = {}, schedule: Routine['schedule'] = 'rotation'): Routine => ({
  ...recommendRoutine({ profile: profile(p), settings: DEFAULT_SETTINGS, schedule }), id: 'r1', updatedAt: 0,
});

describe('recommended routines', () => {
  it('picks the split from days and experience', () => {
    expect(splitFor(3, '0').days.map((d) => d.name)).toEqual(['전신 A', '전신 B', '전신 C']);
    expect(splitFor(4, '3').days.map((d) => d.name)).toEqual(['상체 A', '하체 A', '상체 B', '하체 B']);
    expect(splitFor(6, '3').days.length).toBe(6);
  });

  it('lands big muscles inside the weekly range', () => {
    const r = make();
    const vol = weeklyVolume(r, { ...DEFAULT_SETTINGS, min: 12, max: 20 }, 4);
    for (const m of ['chest', 'back', 'quad', 'ham'] as const) {
      expect(vol.find((v) => v.muscle === m)!.sets).toBeGreaterThanOrEqual(12);
    }
  });

  it('respects the session time budget', () => {
    const r = make({ sessionMin: 45 });
    for (const d of r.days) expect(d.exercises.reduce((a, e) => a + e.sets, 0)).toBeLessThanOrEqual(15);
  });

  it('uses only bodyweight exercises when there is no equipment', () => {
    const r = make({ equipment: 'bodyweight', days: 3, years: '0' });
    const names = r.days.flatMap((d) => d.exercises.map((e) => e.name));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(LIBRARY.find((e) => e.n === n)!.need).toBe('b');
  });

  it('leaves out muscles to avoid', () => {
    const r = make({ avoid: ['shoulder'] });
    expect(r.days.flatMap((d) => d.exercises).some((e) => e.muscle === 'shoulder')).toBe(false);
  });

  it('opens each day with a compound lift at the gym', () => {
    const r = make();
    expect(HEAVY.has(r.days[0].exercises[0].name) || r.days[0].exercises[0].name === '풀업').toBe(true);
  });
});

describe('which day is today', () => {
  const sess = (dayKey: string, date: string, startedAt: number): Session => ({
    id: dayKey + date, updatedAt: 0, date, startedAt, endedAt: startedAt + 1, lastActivityAt: startedAt, detail: 'exercise',
    routineId: 'r1', dayKey, exercises: [{ key: 'k', name: 'x', muscle: 'chest', planned: 3, status: 'done', sets: [], doneSets: 3, logId: 'l' }],
  });

  it('continues a rotation from the last session', () => {
    const r = make();
    expect(todayDay(r, [], '2026-10-29', 4).reason).toBe('first');
    const t = todayDay(r, [sess('d1', '2026-10-27', 1), sess('d2', '2026-10-28', 2)], '2026-10-29', 4);
    expect(t.day?.key).toBe('d3');
    expect(todayDay(r, [sess('d4', '2026-10-28', 2)], '2026-10-29', 4).day?.key).toBe('d1');
    expect(todayDay(r, [sess('d2', '2026-10-29', 3)], '2026-10-29', 4).reason).toBe('done');
  });

  it('follows the calendar for weekday routines', () => {
    const r = make({}, 'weekday');
    expect(todayDay(r, [], '2026-10-26', 1).day?.key).toBe('d1'); // Monday
    expect(todayDay(r, [], '2026-10-28', 3).reason).toBe('rest'); // Wednesday off in a 4-day plan
  });

  it('suggests another day when today’s muscles are tired', () => {
    const r = make();
    const rec = { chest: 40, back: 45, shoulder: 60, tri: 50, bi: 55 };
    expect(underRecovered(r.days[0], rec, 70).length).toBeGreaterThan(0);
    const alt = betterDay(r, 0, rec, 70);
    expect(alt != null && r.days[alt].name.startsWith('하체')).toBe(true);
  });
});
