import { describe, expect, it } from 'vitest';

import { nutritionTargets } from '../nutrition';
import { applyGoal, applyMode, onDefaults, restart, startRows, startVisible } from '../start';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const fresh: Settings = { ...DEFAULT_SETTINGS, start: {} };

describe('시작하기', () => {
  it('starts with nothing chosen', () => {
    expect(startRows(fresh).map((r) => [r.key, r.done, r.summary])).toEqual([
      ['goal', false, null], ['schedule', false, null], ['ability', false, null], ['mode', false, null],
    ]);
    expect(startVisible(fresh)).toBe(true);
    expect(onDefaults(fresh)).toBe(true);
  });
  it('is hidden for people from the old first-run screen and after 나중에', () => {
    expect(startVisible({ ...DEFAULT_SETTINGS, start: undefined })).toBe(false);
    expect(onDefaults({ ...DEFAULT_SETTINGS, start: undefined })).toBe(false);
    expect(startVisible({ ...fresh, start: { skipped: true } })).toBe(false);
  });
  it('uses maintenance calories until a goal is chosen', () => {
    const p = { ...fresh.profile, age: 25, sex: 'm' as const, height: 175, weight: 75 };
    const none = nutritionTargets(p, [], [], '2026-11-07')!;
    const hyp = nutritionTargets({ ...p, goal: 'hyp' }, [], [], '2026-11-07')!;
    expect(none.adjustLabel).toBe('목적 미입력 · 유지 칼로리');
    expect(hyp.kcal - none.kcal).toBe(250);
  });
  it('a chosen goal brings its recommended volume', () => {
    const s = { ...fresh, ...applyGoal(fresh, { goal: 'fit' }) } as Settings;
    expect([s.min, s.max]).toEqual([6, 10]);
    expect(startRows(s)[0]).toMatchObject({ done: true, summary: '건강·체력' });
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
});
