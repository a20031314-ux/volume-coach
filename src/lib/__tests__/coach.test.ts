import { describe, expect, it } from 'vitest';

import { buildPlan, compute, suggestExercises, type CoachInput } from '../coach';
import { addDays, iso } from '../dates';
import { nutritionTargets } from '../nutrition';
import { body, proteinTarget, recommendedVolume } from '../profile';
import { DEFAULT_SETTINGS, type BodyComp, type WorkoutLog } from '../types';

// Wednesday 2026-10-28 10:00 local
const NOW = new Date(2026, 9, 28, 10, 0);
const T = iso(NOW);

let n = 0;
const log = (daysAgo: number, exercise: string, muscle: WorkoutLog['muscle'], sets: number): WorkoutLog => ({
  id: `l${n++}`, updatedAt: 0, date: addDays(T, -daysAgo), exercise, muscle, sets, at: 0,
});

const input = (logs: WorkoutLog[], over: Partial<CoachInput> = {}): CoachInput => ({
  settings: DEFAULT_SETTINGS, logs, checkins: {}, now: NOW, ...over,
});

describe('coach', () => {
  it('rests a muscle trained hard yesterday and recommends fresh ones', () => {
    const c = compute(input([log(1, '백스쿼트', 'quad', 5), log(1, '레그 익스텐션', 'quad', 4)]));
    const quad = c.stats.find((s) => s.k === 'quad')!;
    expect(quad.mode).toBe('rest');
    expect(quad.recNow).toBeLessThan(70);
    const chest = c.stats.find((s) => s.k === 'chest')!;
    expect(chest.mode).toBe('go');
    expect(chest.remaining).toBeGreaterThan(0);
  });

  it('never plans more than the daily cap after the first muscle', () => {
    const c = compute(input([]));
    const p = buildPlan(c, []);
    const total = p.plan.reduce((a, s) => a + s.remaining, 0);
    expect(total).toBeLessThanOrEqual(c.readiness.cap + p.plan[0].remaining);
  });

  it('cuts volume on a bad check-in', () => {
    const good = compute(input([]));
    const bad = compute(input([], { checkins: { [T]: { id: T, updatedAt: 0, date: T, sleep: 0, energy: 0, sore: [] } } }));
    expect(bad.readiness.cap).toBeLessThan(good.readiness.cap);
  });

  it('lets a long run yesterday tire the legs but not the chest', () => {
    const end = NOW.getTime() - 16 * 36e5;
    const run = { id: 'r1', updatedAt: 0, date: addDays(T, -1), startedAt: end - 3600e3, endedAt: end, distanceM: 12000, movingS: 3600, paceSecPerKm: 300, kcal: 900, splits: [], route: [] };
    const c = compute(input([], { runs: [run] }));
    const quad = c.stats.find((s) => s.k === 'quad')!;
    const calf = c.stats.find((s) => s.k === 'calf')!;
    expect(quad.recPre).toBeLessThan(80);
    expect(calf.recPre).toBeLessThan(100);
    expect(c.stats.find((s) => s.k === 'chest')!.recPre).toBe(100);
  });

  it('ignores check-in items that are turned off', () => {
    const ci = { [T]: { id: T, updatedAt: 0, date: T, sleep: 0 as const, energy: 0 as const, sore: ['chest' as const] } };
    const on = compute(input([], { checkins: ci }));
    const off = compute(input([], { checkins: ci, settings: { ...DEFAULT_SETTINGS, checkin: { sleep: false, energy: false, sore: false, systemic: false } } }));
    expect(on.readiness.cap).toBeLessThan(off.readiness.cap);
    expect(off.readiness.cap).toBe(DEFAULT_SETTINGS.cap);
    expect(on.stats.find((x) => x.k === 'chest')!.sore).toBe(true);
    expect(off.stats.find((x) => x.k === 'chest')!.sore).toBe(false);
    const sleepOnly = compute(input([], { checkins: ci, settings: { ...DEFAULT_SETTINGS, checkin: { sleep: true, energy: false, sore: false, systemic: false } } }));
    expect(sleepOnly.readiness.why).toEqual(['수면 부족']);
  });

  it('counts deleted logs as gone', () => {
    const l = log(0, '바벨 벤치프레스', 'chest', 4);
    const c = compute(input([{ ...l, deleted: true }]));
    expect(c.stats.find((s) => s.k === 'chest')!.todayS).toBe(0);
  });

  it('suggests at least minEx different exercises when the week has none', () => {
    const c = compute(input([]));
    const chest = c.stats.find((s) => s.k === 'chest')!;
    const ex = suggestExercises(chest, c, DEFAULT_SETTINGS, {});
    expect(new Set(ex.map((e) => e.name)).size).toBeGreaterThanOrEqual(Math.min(2, chest.remaining));
    expect(ex.reduce((a, e) => a + e.sets, 0)).toBe(chest.remaining);
  });
});

describe('profile & nutrition', () => {
  const comp: BodyComp = { id: 'b1', updatedAt: 0, date: T, weight: 88, smm: 42, fatPct: null };

  it('uses fat-free mass from skeletal muscle when body fat is unknown', () => {
    const b = body({ goal: 'hyp', height: 178 }, [comp])!;
    expect(b.ffmSource).toBe('smm');
    expect(b.ffm).toBeCloseTo(75, 0);
    const pt = proteinTarget({ goal: 'hyp' }, b);
    expect(pt.lo).toBe(150);
    expect(pt.hi).toBe(187);
  });

  it('prefers body fat % over skeletal muscle', () => {
    const b = body({ goal: 'hyp', height: 178 }, [{ ...comp, fatPct: 20 }])!;
    expect(b.ffmSource).toBe('fat');
    expect(b.ffm).toBeCloseTo(70.4, 1);
  });

  it('computes targets that add up to the calorie goal', () => {
    const t = nutritionTargets({ goal: 'cut', age: 32, sex: 'm', height: 178, act: '1' }, [comp], [], T)!;
    expect(t.bmrFormula).toBe('katch');
    expect(Math.abs(t.p * 4 + t.c * 4 + t.f * 9 - t.kcal)).toBeLessThan(10);
  });

  it('lowers volume for beginners and older lifters', () => {
    expect(recommendedVolume({ goal: 'hyp', years: '0' }).rec.max).toBe(12);
    expect(recommendedVolume({ goal: 'hyp', years: '3', age: 55 }).rec.max).toBe(17);
  });
});
