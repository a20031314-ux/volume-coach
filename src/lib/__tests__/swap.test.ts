import { describe, expect, it } from 'vitest';

import { FOOD_DB, findFood, foodLabel, macrosOf } from '../foods';
import { close, swapNote, swaps } from '../swap';

const food = (n: string) => FOOD_DB.find((d) => d.n === n)!;

describe('food data', () => {
  it('kcal roughly matches 4/4/9 for everything but alcohol', () => {
    for (const d of FOOD_DB) {
      // alcohol has its own calories; vegetables and fruit count fiber as carbs
      if (d.n === '맥주' || d.n === '소주' || d.g === 'veg' || d.g === 'fruit') continue;
      const calc = d.p * 4 + d.c * 4 + d.f * 9;
      expect(Math.abs(calc - d.k) / d.k, d.n).toBeLessThan(0.25);
    }
  });
  it('has unique names and finds older meal names', () => {
    expect(new Set(FOOD_DB.map((d) => d.n)).size).toBe(FOOD_DB.length);
    expect(findFood('두부 반 모 (150g)')?.n).toBe('두부');
    expect(findFood('닭가슴살 스테이크(시판) 100g')?.n).toBe('닭가슴살 스테이크(시판)');
    expect(foodLabel(food('흰쌀밥'), 1.5)).toBe('흰쌀밥 1.5공기 (315g)');
  });
});

describe('swaps', () => {
  const salmon = food('연어');
  const t = macrosOf(salmon, 200);

  it('replaces salmon 200g with chicken + a fat, close on kcal and protein', () => {
    const s = swaps(t, { group: 'protein', exclude: ['연어'] });
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) expect(close(t, x.total)).toBe(true);
    const chicken = swaps(t, { main: '닭가슴살', exclude: ['연어'] })[0];
    expect(chicken.parts[0].amt).toBeGreaterThanOrEqual(160);
    expect(chicken.parts.some((p) => p.food.g === 'fat')).toBe(true);
    expect(swapNote(salmon, chicken)).toContain('오메가3');
  });

  it('swaps rice for other carbs without adding protein foods', () => {
    const rice = macrosOf(food('흰쌀밥'), 1);
    const s = swaps(rice, { group: 'carb', exclude: ['흰쌀밥'] });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].parts[0].food.g).toBe('carb');
  });

  it('breaks a mixed dish into protein + carbs + fat', () => {
    const d = food('제육볶음');
    const s = swaps(macrosOf(d, 1), { group: d.g, exclude: [d.n], primary: 'p' });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].parts.length).toBeGreaterThan(1);
  });
});
