import { describe, expect, it } from 'vitest';

import { COURSES, myShare } from '../courses';
import { FOOD_DB } from '../foods';

describe('courses', () => {
  it('only use foods that exist', () => {
    const names = new Set(FOOD_DB.map((d) => d.n));
    for (const c of COURSES) for (const x of c.items) expect(names.has(x.n), `${c.name}: ${x.n}`).toBe(true);
  });
  it('split the checked items by people', () => {
    const c = COURSES[0];
    const two = myShare(c);
    expect(two.lines.find((l) => l.food.n === '삼겹살')!.amt).toBe(200);
    expect(two.lines.some((l) => l.food.n === '소주')).toBe(false);
    const one = myShare({ ...c, people: 1 });
    expect(Math.round(one.total.k)).toBe(Math.round(two.total.k * 2));
    const noRice = myShare({ ...c, items: c.items.map((x) => (x.n.startsWith('철판') ? { ...x, on: false } : x)) });
    expect(noRice.total.k).toBeLessThan(two.total.k);
  });
});
