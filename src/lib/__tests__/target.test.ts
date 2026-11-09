import { describe, expect, it } from 'vitest';

import { defaultPriority, liftEta, priorityOptions, programFor, weeksUntil, withFloor, floorFor } from '../target';

describe('목표 vs 다각형', () => {
  it('ETA from experience and sessions a week', () => {
    // 100→105kg (+5%), 1~3년(2.5%/월), 주 3회 → 2개월 ≈ 9주
    expect(liftEta(100, 105, 3, '1')).toBe(9);
    expect(liftEta(100, 105, 1, '1')).toBeGreaterThan(liftEta(100, 105, 3, '1'));
    expect(weeksUntil('2026-11-09', '2027-02-01')).toBe(12);
    expect(defaultPriority(12)).toBe('goal');
    expect(defaultPriority(16)).toBe('balance');
  });
  it('three ways to share a 180-minute week with 근비대 3 (the lift sessions count toward it too)', () => {
    const [goal, balance, focus] = priorityOptions({
      focus: { hyp: 3, str: 0, fit: 0, health: 0 }, budget: 180, years: '1', start1rm: 100, target1rm: 105, deadlineWeeks: 9,
    });
    expect(goal).toMatchObject({ priority: 'goal', perWeek: 3, onTime: true, goalMin: 75, focusMin: 105 });
    // 근비대 is squeezed below 3 so the goal makes it
    expect(goal.lead!.level).toBeLessThan(3);
    expect(balance).toMatchObject({ perWeek: 2, onTime: false });
    expect(focus).toMatchObject({ perWeek: 1, focusMin: 155 });
    expect(focus.lead!.level).toBeGreaterThan(balance.lead!.level);
    expect(balance.lead!.level).toBeGreaterThan(goal.lead!.level);
    // plenty of time: nothing has to give
    const roomy = priorityOptions({ focus: { hyp: 3, str: 0, fit: 0, health: 0 }, budget: 300, years: '1', start1rm: 100, target1rm: 105, deadlineWeeks: 9 });
    expect(roomy.every((o) => o.perWeek === 3 && o.onTime)).toBe(true);
  });
  it('the goal sets a floor on the polygon and becomes a program', () => {
    expect(withFloor({ hyp: 3, str: 0, fit: 1, health: 0 }, floorFor('goal'))).toEqual({ hyp: 3, str: 2, fit: 1, health: 0 });
    expect(withFloor({ hyp: 3, str: 3, fit: 1, health: 0 }, floorFor('focus')).str).toBe(3);
    const [goal, , focus] = priorityOptions({ focus: { hyp: 3, str: 0, fit: 0, health: 0 }, budget: 180, years: '1', start1rm: 100, target1rm: 105, deadlineWeeks: 9 });
    const base = { lift: '바벨 벤치프레스' as const, start: '2026-11-09', start1rm: 100, target1rm: 105 };
    expect(programFor(goal, base, '2027-01-11', 9)).toMatchObject({ weeks: 9, perWeek: 3, priority: 'goal', deadline: '2027-01-11' });
    expect(programFor(focus, base, '2027-01-11', 9).weeks).toBeGreaterThan(9);
  });
});
