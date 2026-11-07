import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { carbSource, dietReport, proteinSource, slotOf } from '../diet-report';
import { FOOD_DB, foodLabel, macrosOf } from '../foods';
import { swaps } from '../swap';
import type { Meal } from '../types';

const food = (n: string) => FOOD_DB.find((d) => d.n === n)!;
let id = 0;
function meal(date: string, hour: number, n: string, amt?: number): Meal {
  const d = food(n);
  const a = amt ?? d.base;
  const m = macrosOf(d, a);
  const [y, mo, da] = date.split('-').map(Number);
  return { id: String(++id), updatedAt: 0, date, name: foodLabel(d, a), qty: 1, kcal: m.k, p: m.p, c: m.c, f: m.f, at: new Date(y, mo - 1, da, hour).getTime() };
}

const TO = '2026-11-07';
/** 14 days: chicken + rice every lunch/dinner, eggs some mornings; training days skip breakfast */
function sample(): { meals: Meal[]; training: Set<string> } {
  const meals: Meal[] = [];
  const training = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const date = addDays(TO, -i);
    const train = i % 2 === 0;
    if (train) training.add(date);
    else meals.push(meal(date, 8, '계란', 3), meal(date, 8, '오트밀', 50));
    meals.push(meal(date, 12, '흰쌀밥', 1), meal(date, 12, '닭가슴살', 150));
    meals.push(meal(date, 19, '흰쌀밥', 1), meal(date, 19, '닭가슴살', 150), meal(date, 21, '단백질 보충제', 1));
  }
  return { meals, training };
}

describe('classifying', () => {
  it('sorts foods into protein and carb sources', () => {
    expect(proteinSource('닭가슴살 스테이크(시판)')).toBe('chicken');
    expect(proteinSource('단백질 보충제')).toBe('supp');
    expect(proteinSource('참치캔(기름 뺀)')).toBe('fish');
    expect(proteinSource('제육볶음')).toBe('pork');
    expect(proteinSource('그릭요거트 무가당', food('그릭요거트 무가당'))).toBe('dairy');
    expect(carbSource('현미밥')).toBe('grain');
    expect(carbSource('흰쌀밥')).toBe('rice');
    expect(carbSource('짬뽕')).toBe('noodle');
    expect(carbSource('바나나', food('바나나'))).toBe('fruit');
  });
  it('puts meal times into slots', () => {
    expect(slotOf(new Date(2026, 10, 7, 7).getTime())).toBe('morning');
    expect(slotOf(new Date(2026, 10, 7, 12).getTime())).toBe('lunch');
    expect(slotOf(new Date(2026, 10, 7, 23).getTime())).toBe('night');
    expect(slotOf(new Date(2026, 10, 7, 2).getTime())).toBe('night');
  });
});

describe('dietReport', () => {
  const { meals, training } = sample();
  const rep = dietReport(meals, { to: TO, days: 28, targetP: () => 160, trainingDates: training });

  it('counts days and ranks foods', () => {
    expect(rep.days).toBe(14);
    expect(rep.top[0].name).toMatch(/흰쌀밥|닭가슴살|단백질 보충제/);
    expect(rep.top.find((f) => f.name === '계란')?.days).toBe(7);
  });
  it('finds chicken as the main protein and white rice as the main carb', () => {
    expect(rep.protein[0].k).toBe('chicken');
    expect(rep.carbs[0].k).toBe('rice');
    expect(rep.carbs[0].pct).toBeGreaterThan(60);
  });
  it('sees training days short on protein, missing breakfast', () => {
    expect(rep.training.days).toBe(7);
    expect(rep.training.pct!).toBeLessThan(rep.rest.pct!);
    expect(rep.training.short).toBe(7);
    expect(rep.shortSlot).toBe('morning');
    expect(rep.notes.some((n) => n.includes('아침'))).toBe(true);
  });
  it('ignores meals outside the window and deleted ones', () => {
    const r7 = dietReport([...meals, { ...meals[0], id: 'x', deleted: true }], { to: TO, days: 7, targetP: () => null, trainingDates: training });
    expect(r7.days).toBe(7);
    expect(r7.training.pct).toBeNull();
  });
  it('lists foods eaten on 2+ days as swap preferences', () => {
    expect(rep.prefer).toContain('닭가슴살');
    expect(rep.prefer).toContain('계란');
    expect(rep.preferBySlot.morning[0]).toMatch(/계란|오트밀/);
    expect(rep.preferBySlot.lunch).not.toContain('계란');
  });
});

describe('swaps with preferences', () => {
  it('moves a preferred main up', () => {
    const target = macrosOf(food('연어'), 200);
    const plain = swaps(target, { group: 'protein', exclude: ['연어'], limit: 5 }).map((s) => s.parts[0].food.n);
    const pick = plain[plain.length - 1];
    const pref = swaps(target, { group: 'protein', exclude: ['연어'], limit: 5, prefer: [pick] }).map((s) => s.parts[0].food.n);
    expect(pref.indexOf(pick)).toBeLessThan(plain.indexOf(pick));
  });
});
