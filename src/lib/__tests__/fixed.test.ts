import { describe, expect, it } from 'vitest';

import { dueAuto, fixedFor, fixedMeal, fixedRows, plannedLeft, type FixedSettings } from '../fixed';
import type { Meal } from '../types';

// 2026-11-07 is a Saturday (6)
const f: FixedSettings = {
  mode: 'check',
  items: [
    { id: 'a', n: '오메가3', amt: 2, time: 8 * 60, dows: [] },
    { id: 'b', n: '아몬드', amt: 30, time: 15 * 60, dows: [1, 3, 5] },
    { id: 'c', n: '바나나', amt: 1, time: 10 * 60, dows: [6, 0] },
  ],
};

describe('고정식단', () => {
  it('picks the items for the day in time order', () => {
    expect(fixedFor(f, '2026-11-07').map((x) => x.id)).toEqual(['a', 'c']);
    expect(fixedFor(f, '2026-11-09').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('builds the meal at its scheduled time and knows what is logged', () => {
    const rows = fixedRows(f, '2026-11-07', []);
    const m = fixedMeal(rows[1], '2026-11-07')!;
    expect(m.name.startsWith('바나나 1개')).toBe(true);
    expect(new Date(m.at).getHours()).toBe(10);
    expect(m.fixed).toBe('c');
    const logged: Meal = { ...m, id: 'x', updatedAt: 0 };
    const after = fixedRows(f, '2026-11-07', [logged]);
    expect(after[1].logged?.id).toBe('x');
    expect(plannedLeft(after).k).toBeCloseTo(after[0].macros.k);
  });
  it('auto mode logs only items whose time has passed and were not skipped', () => {
    const rows = fixedRows(f, '2026-11-07', []);
    expect(dueAuto(rows, 9 * 60, []).map((r) => r.item.id)).toEqual(['a']);
    expect(dueAuto(rows, 12 * 60, ['a']).map((r) => r.item.id)).toEqual(['c']);
  });
});
