import { describe, expect, it } from 'vitest';

import { hhmm, mealName, mealTarget, nextMeal, recommendMeal, shortLabel, staples } from '../meal-plan';

const T = [8 * 60, 12 * 60 + 30, 19 * 60];
const lunch = { k: 750, p: 45, c: 90, f: 20 };

describe('meal times', () => {
  it('names and formats', () => {
    expect(hhmm(12 * 60 + 30)).toBe('12:30');
    expect(T.map(mealName)).toEqual(['아침', '점심', '저녁']);
  });
  it('keeps a meal current for a while after its time', () => {
    expect(nextMeal(T, 7 * 60)).toBe(0);
    expect(nextMeal(T, 13 * 60 + 30)).toBe(1);
    expect(nextMeal(T, 14 * 60 + 30)).toBe(2);
    expect(nextMeal(T, 21 * 60)).toBeNull();
  });
  it('splits what is left over the meals left', () => {
    const t = mealTarget({ kcal: 2400, p: 150, c: 280, f: 70 }, { k: 600, p: 30, c: 70, f: 20 }, 2)!;
    expect(t.k).toBe(900);
    expect(t.p).toBe(60);
    expect(mealTarget({ kcal: 2400, p: 150, c: 280, f: 70 }, { k: 2300, p: 150, c: 280, f: 70 }, 1)).toBeNull();
  });
});

describe('recommendMeal', () => {
  it('uses the usual protein and staple', () => {
    const r = recommendMeal(lunch, { prefer: ['돼지 안심', '현미밥', '계란'] });
    expect(r.parts.map((p) => p.food.n)).toEqual(['돼지 안심', '현미밥']);
    expect(Math.abs(r.total.p - lunch.p)).toBeLessThan(8);
    expect(Math.abs(r.total.c - lunch.c)).toBeLessThan(25);
  });
  it('falls back to everyday foods without history', () => {
    const r = recommendMeal(lunch, { prefer: [] });
    expect(r.parts.map((p) => p.food.n)).toEqual(['닭가슴살', '흰쌀밥']);
    expect(shortLabel(r.parts)).toMatch(/^닭가슴살 \d+g \+ 흰쌀밥 [\d.]+공기$/);
  });
  it('swaps a food the user does not have for an equivalent', () => {
    const r = recommendMeal(lunch, { prefer: ['닭가슴살', '흰쌀밥'], unavailable: ['닭가슴살'] });
    expect(r.swapped).toEqual(['닭가슴살']);
    expect(r.parts.some((p) => p.food.n === '닭가슴살')).toBe(false);
    expect(Math.abs(r.total.p - lunch.p)).toBeLessThan(10);
    const r2 = recommendMeal(lunch, { prefer: ['닭가슴살', '흰쌀밥'], unavailable: ['흰쌀밥'] });
    expect(r2.parts.some((p) => p.food.n === '흰쌀밥')).toBe(false);
    expect(r2.parts.some((p) => p.food.g === 'carb')).toBe(true);
  });
  it('does not make a meal of six eggs', () => {
    const r = recommendMeal(lunch, { prefer: ['계란', '돼지 안심', '흰쌀밥'] });
    expect(r.parts[0].food.n).toBe('돼지 안심');
  });
  it('skips protein shakes as a meal protein', () => {
    expect(staples(['단백질 보충제', '계란']).protein[0].n).toBe('계란');
  });
});
