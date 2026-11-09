import { describe, expect, it } from 'vitest';

import { allotMin, budgetMin, demandMin, dirOf, energyAdjust, FULL_MIN, focusLabel, focusOf, legacyGoal, primary } from '../focus';
import { nutritionTargets } from '../nutrition';
import type { Profile } from '../types';

describe('목적 다각형', () => {
  it('a full polygon is 405 minutes a week; the schedule is the budget', () => {
    expect(FULL_MIN).toBe(405);
    expect(demandMin({ hyp: 3, str: 2, fit: 1, health: 0 })).toBe(270);
    expect(budgetMin({ days: 4, sessionMin: null })).toBe(240);
    const a = allotMin({ hyp: 3, str: 2, fit: 1, health: 0 }, 240);
    expect(a.scale).toBeCloseTo(240 / 270);
    expect(a.hyp + a.str + a.fit).toBeLessThanOrEqual(241);
    expect(allotMin({ hyp: 2, str: 0, fit: 0, health: 0 }, 240).scale).toBe(1);
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
