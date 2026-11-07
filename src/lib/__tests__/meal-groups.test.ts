import { describe, expect, it } from 'vitest';

import { groupMeals, warnText } from '../meal-groups';
import type { Meal } from '../types';

let id = 0;
const meal = (h: number, kcal: number, p = 20, c = 50, f = 10): Meal =>
  ({ id: String(++id), updatedAt: 0, date: '2026-11-07', name: 'x', qty: 1, kcal, p, c, f, at: new Date(2026, 10, 7, h, 10).getTime() });
const goal = { kcal: 2000, p: 150, c: 220, f: 60 };

describe('groupMeals', () => {
  it('groups by time of day and computes the share of the day', () => {
    const g = groupMeals([meal(8, 400), meal(12, 600), meal(12, 100), meal(19, 500)], goal);
    expect(g.map((x) => x.name)).toEqual(['아침', '점심', '저녁']);
    expect(g[1].sum.k).toBe(700);
    expect(g[1].pct!.k).toBe(35);
    expect(g.every((x) => !x.warns.length)).toBe(true);
  });
  it('uses the user meal times when given', () => {
    const g = groupMeals([meal(10, 300), meal(16, 300)], goal, [9 * 60, 13 * 60, 18 * 60]);
    expect(g.map((x) => x.name)).toEqual(['아침', '저녁']);
  });
  it('flags a very big meal and the meal that crosses the goal', () => {
    const g = groupMeals([meal(8, 500, 20, 50, 10), meal(19, 1700, 60, 120, 70)], goal);
    const kinds = g[1].warns.map((w) => (w.kind === 'big' ? 'big' : w.what));
    expect(kinds).toContain('big');
    expect(kinds).toContain('kcal');
    expect(kinds).toContain('f');
    expect(g[0].warns).toEqual([]);
    expect(warnText(g[1].warns.find((w) => w.kind === 'over' && w.what === 'kcal')!)).toBe('이 끼니에서 하루 칼로리 목표 초과 (+200kcal)');
  });
  it('works without a goal', () => {
    const g = groupMeals([meal(8, 500)], null);
    expect(g[0].pct).toBeNull();
    expect(g[0].warns).toEqual([]);
  });
});
