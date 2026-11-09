import { describe, expect, it } from 'vitest';

import { nutritionTargets } from '../nutrition';
import { applyGoal, applyMode, missingChoices, needsChoice, restart, startRows, startVisible } from '../start';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const fresh: Settings = { ...DEFAULT_SETTINGS, start: {} };

describe('시작하기', () => {
  it('starts with nothing chosen', () => {
    expect(startRows(fresh).map((r) => [r.key, r.done, r.summary])).toEqual([
      ['goal', false, null], ['schedule', false, null], ['body', false, null], ['ability', false, null], ['mode', false, null],
    ]);
    expect(startRows(fresh).filter((r) => r.required).map((r) => r.key)).toEqual(['goal', 'schedule', 'body']);
    expect(startVisible(fresh)).toBe(true);
    expect(needsChoice(fresh)).toBe(true);
    expect(missingChoices(fresh)).toEqual(['목적', '운동 일정']);
  });
  it('stays while goal or schedule is missing, for everyone; 나중에 hides only the optional two', () => {
    expect(startVisible({ ...DEFAULT_SETTINGS, start: undefined })).toBe(true);
    expect(startVisible({ ...fresh, start: { skipped: true } })).toBe(true);
    const chosen = { ...fresh, profile: { ...fresh.profile, goal: 'hyp' as const, days: 4 } };
    expect(startVisible(chosen)).toBe(true);
    expect(startVisible({ ...chosen, start: { skipped: true } })).toBe(false);
    expect(startVisible({ ...chosen, start: undefined })).toBe(false);
  });
  it('has no calorie target until a goal is chosen (no defaults)', () => {
    const p = { ...fresh.profile, age: 25, sex: 'm' as const, height: 175, weight: 75 };
    expect(nutritionTargets(p, [], [], '2026-11-07')).toBeNull();
    expect(nutritionTargets({ ...p, goal: 'hyp' }, [], [], '2026-11-07')?.kcal).toBeGreaterThan(0);
    expect(needsChoice({ ...fresh, profile: { ...p, goal: 'hyp', days: 4 } })).toBe(false);
  });
  it('a chosen goal brings its recommended volume', () => {
    const s = { ...fresh, ...applyGoal(fresh, { goal: 'fit' }) } as Settings;
    expect([s.min, s.max]).toEqual([6, 10]);
    expect(startRows(s)[0]).toMatchObject({ done: true, summary: '체력 중심 · 건강 · 근비대 · 체중 유지' });
    const hyp = { ...fresh, ...applyGoal(fresh, { goal: 'hyp', years: '3' }) } as Settings;
    expect(hyp.max).toBeGreaterThan(10);
  });
  it('routine mode makes a recommended routine when there is none', () => {
    const { patch, routine } = applyMode({ ...fresh, profile: { ...fresh.profile, days: 4 } }, 'routine', new Set(), false);
    expect(patch.planMode).toBe('routine');
    expect(patch.start?.mode).toBe(true);
    expect(routine?.days.length).toBe(4);
    expect(applyMode(fresh, 'routine', new Set(), true).routine).toBeNull();
  });
  it('restart brings the card back without touching records', () => {
    const s = { ...fresh, ...applyGoal(fresh, { goal: 'hyp' }), start: { mode: true, skipped: true } } as Settings;
    const r = { ...s, ...restart(s) } as Settings;
    expect(startVisible(r)).toBe(true);
    expect(r.profile.goal).toBe('');
  });
  it('몸 정보 is done with age, height and a weight (typed or 인바디)', () => {
    const p = { ...fresh.profile, age: 30, height: 175 };
    expect(startRows({ ...fresh, profile: p }).find((r) => r.key === 'body')?.done).toBe(false);
    expect(startRows({ ...fresh, profile: p }, 74.2).find((r) => r.key === 'body')).toMatchObject({ done: true, summary: '30세 · 175cm · 74.2kg' });
    expect(startRows({ ...fresh, profile: { ...p, weight: 70 } }).find((r) => r.key === 'body')?.done).toBe(true);
  });
});
