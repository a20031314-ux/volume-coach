import { describe, expect, it } from 'vitest';

import { applySetup } from '../setup';
import { DEFAULT_SETTINGS } from '../types';

describe('applySetup', () => {
  it('skipping gives a recommended routine to follow', () => {
    const { patch, routine } = applySetup(DEFAULT_SETTINGS, null);
    expect(patch).toEqual({ onboarded: true, planMode: 'routine' });
    expect(routine?.days.length).toBe(4);
  });

  it('uses answers: recommended volume unless set by hand, routine only in routine mode', () => {
    const profile = { ...DEFAULT_SETTINGS.profile, years: '0' as const, days: 3, equipment: 'dumbbell' as const };
    const ability = { ...DEFAULT_SETTINGS.ability, pullups: '0' as const };
    const auto = applySetup(DEFAULT_SETTINGS, { profile, ability, volume: null, mode: 'auto' });
    expect(auto.routine).toBeNull();
    expect(auto.patch).toMatchObject({ onboarded: true, planMode: 'auto', min: 8, max: 12, ability: { checked: true } });

    const own = applySetup(DEFAULT_SETTINGS, { profile, ability: DEFAULT_SETTINGS.ability, volume: { min: 14, max: 20, minEx: 3, gap: 2 }, mode: 'routine' });
    expect(own.patch).toMatchObject({ min: 14, max: 20, minEx: 3, gap: 2, planMode: 'routine', ability: { checked: false } });
    expect(own.routine?.days.length).toBe(3);
    expect(own.routine?.days.flatMap((d) => d.exercises).every((e) => !/바벨|스미스|머신|케이블/.test(e.name))).toBe(true);
  });
});

describe('applySetup skip with a routine already in use', () => {
  it('keeps the current routine', () => {
    const { patch, routine } = applySetup(DEFAULT_SETTINGS, null, undefined, true);
    expect(routine).toBeNull();
    expect(patch.planMode).toBe('routine');
  });
});
