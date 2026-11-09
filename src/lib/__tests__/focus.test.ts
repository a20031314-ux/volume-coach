import { describe, expect, it } from 'vitest';

import { budgetMin, dirOf, effectLevel, energyAdjust, FULL_MIN, focusLabel, focusOf, legacyGoal, planWork, primary } from '../focus';
import { nutritionTargets } from '../nutrition';
import type { Profile } from '../types';

describe('목적 다각형', () => {
  it('axes overlap: 근비대 work counts toward 근력 and 건강, so a mix needs less than the sum', () => {
    const p = planWork({ hyp: 3, str: 2, fit: 0, health: 0 });
    expect(p.naive).toBe(240);
    expect(p.total).toBe(192);
    expect(p.work).toMatchObject({ mod: 162, heavy: 30, cardio: 0 });
    // 근비대만 골라도 근력·건강이 따라오지만, 제 운동 없이는 1.5단계 / 2단계까지만
    const only = planWork({ hyp: 3, str: 0, fit: 0, health: 0 });
    expect(effectLevel('str', only.effect.str)).toBeCloseTo(1.5);
    expect(effectLevel('health', only.effect.health)).toBeCloseTo(2);
    expect(effectLevel('fit', only.effect.fit)).toBe(0);
    // 꽉 찬 다각형, 겹침을 한 번만 세면
    expect(FULL_MIN).toBe(303);
    expect(budgetMin({ days: 4, sessionMin: null })).toBe(240);
    const tight = planWork({ hyp: 3, str: 2, fit: 2, health: 1 }, 240);
    expect(tight.scale).toBeLessThan(1);
    expect(Object.values(tight.work).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(241);
  });
  it('the top axis still drives the old single goal; 감량 wins', () => {
    expect(primary({ hyp: 2, str: 2, fit: 3, health: 0 })).toBe('fit');
    expect(primary({ hyp: 2, str: 2, fit: 0, health: 0 })).toBe('hyp');
    expect(legacyGoal({ hyp: 1, str: 3, fit: 0, health: 0 }, 'keep')).toBe('str');
    expect(legacyGoal({ hyp: 0, str: 0, fit: 0, health: 2 }, 'gain')).toBe('fit');
    expect(legacyGoal({ hyp: 3, str: 0, fit: 0, health: 0 }, 'cut')).toBe('cut');
    expect(legacyGoal({ hyp: 0, str: 0, fit: 0, health: 0 }, 'keep')).toBe('');
  });
  it('old profiles read as a shape, and keep their calories', () => {
    expect(focusOf({ goal: 'str' })).toEqual({ hyp: 1, str: 3, fit: 0, health: 0 });
    expect(dirOf({ goal: 'hyp' })).toBe('gain');
    expect(focusLabel({ goal: 'hyp', focus: { hyp: 3, str: 2, fit: 1, health: 0 }, weightDir: 'keep' })).toBe('근비대 중심 · 근력 · 체력 · 체중 유지');
    const base = { age: 30, sex: 'm', height: 175, weight: 75, act: '1' } as Profile;
    const old = nutritionTargets({ ...base, goal: 'hyp' }, [], [], '2026-11-09')!;
    const kept = nutritionTargets({ ...base, goal: 'hyp', focus: { hyp: 3, str: 0, fit: 0, health: 0 }, weightDir: 'keep' }, [], [], '2026-11-09')!;
    expect(old.kcal - kept.kcal).toBe(250);
    expect(kept.adjustLabel).toBe('유지 칼로리');
    expect(energyAdjust('cut', { hyp: 3, str: 0, fit: 0, health: 0 }, 2500).adj).toBe(-500);
  });
});
