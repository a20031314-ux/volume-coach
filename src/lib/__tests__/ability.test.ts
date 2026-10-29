import { describe, expect, it } from 'vitest';

import { abilityHints, candidatesFor, pickable, substitutes, verdict, type AbilityCtx } from '../ability';
import { LIBRARY } from '../exercises';
import { recommendRoutine } from '../routine';
import { DEFAULT_SETTINGS, type Ability, type Session } from '../types';

const ex = (n: string) => LIBRARY.find((e) => e.n === n)!;
const checked: Ability = { checked: true, pullups: '6+', pushups: '21+', dips: 'yes', bbSquat: 'yes', bbHinge: 'yes', bbPress: 'yes', pain: [] };
const ctx = (over: Partial<AbilityCtx> = {}): AbilityCtx => ({
  ability: checked, exercisePrefs: {}, customExercises: [], profile: { goal: 'hyp', years: '3' }, known: new Set(), ...over,
});

describe('what the user can do', () => {
  it('drops pull-ups for someone who can’t do one and offers assisted versions', () => {
    const c = ctx({ ability: { ...checked, pullups: '0' } });
    expect(verdict(ex('풀업'), c).ok).toBe(false);
    const back = candidatesFor('back', c).map((e) => e.n);
    expect(back).not.toContain('풀업');
    expect(back).toContain('어시스트 풀업 머신');
    expect(substitutes('풀업', 'back', c)[0]).toBe('랫풀다운');
  });

  it('avoids painful movements', () => {
    const c = ctx({ ability: { ...checked, pain: ['overhead'] } });
    const sh = candidatesFor('shoulder', c).map((e) => e.n);
    expect(sh).not.toContain('오버헤드프레스');
    expect(sh).not.toContain('덤벨 숄더프레스');
    expect(sh).toContain('랜드마인 프레스');
    expect(sh).toContain('사이드 레터럴 레이즈');
  });

  it('keeps to easy exercises before the check, unless done before', () => {
    const c = ctx({ ability: DEFAULT_SETTINGS.ability });
    expect(verdict(ex('백스쿼트'), c).ok).toBe(false);
    expect(verdict(ex('레그프레스'), c).ok).toBe(true);
    expect(verdict(ex('백스쿼트'), { ...c, known: new Set(['백스쿼트']) }).ok).toBe(true);
  });

  it('treats questions left blank as not yet', () => {
    const c = ctx({ ability: { ...checked, bbSquat: 'unknown' } });
    expect(verdict(ex('백스쿼트'), c).ok).toBe(false);
    expect(verdict(ex('바벨 벤치프레스'), c).ok).toBe(true);
  });

  it('follows favourites, dislikes and can’t-do marks', () => {
    const c = ctx({ exercisePrefs: { '펙덱 플라이': 'fav', '바벨 벤치프레스': 'dislike', '딥스': 'cant' } });
    const chest = candidatesFor('chest', c).map((e) => e.n);
    expect(chest[0]).toBe('펙덱 플라이');
    expect(chest).not.toContain('바벨 벤치프레스');
    const pick = pickable('chest', c).map((e) => e.n);
    expect(pick).toContain('바벨 벤치프레스');
    expect(pick).not.toContain('딥스');
  });

  it('builds routines from what the user can do', () => {
    const r = recommendRoutine({
      profile: { goal: 'hyp', years: '1', days: 4, equipment: 'gym' },
      settings: { ...DEFAULT_SETTINGS, ability: { ...checked, pullups: '0', bbSquat: 'no', pain: ['overhead'] } },
    });
    const names = r.days.flatMap((d) => d.exercises.map((e) => e.name));
    expect(names).not.toContain('풀업');
    expect(names).not.toContain('백스쿼트');
    expect(names).not.toContain('오버헤드프레스');
  });
});

describe('hints', () => {
  const sess = (i: number, exs: Session['exercises']): Session => ({
    id: `s${i}`, updatedAt: 0, date: '2026-10-20', startedAt: Date.UTC(2026, 9, 20 + i), endedAt: Date.UTC(2026, 9, 20 + i) + 1,
    lastActivityAt: 0, detail: 'set', exercises: exs,
  });
  const exo = (name: string, status: 'done' | 'skipped', reps: number[] = []) => ({
    key: name, name, muscle: 'back' as const, planned: 3, status, sets: reps.map((r) => ({ at: 0, reps: r })), logId: 'l',
  });
  const now = Date.UTC(2026, 9, 29);

  it('offers the quick check until it is done or dismissed', () => {
    expect(abilityHints(DEFAULT_SETTINGS, [], now)[0].key).toBe('ability-intro');
    expect(abilityHints({ ...DEFAULT_SETTINGS, dismissed: ['ability-intro'] }, [], now)).toEqual([]);
  });

  it('suggests dropping an exercise skipped three times', () => {
    const ss = [0, 1, 2].map((i) => sess(i, [exo('바벨 로우', 'skipped')]));
    const h = abilityHints({ ...DEFAULT_SETTINGS, dismissed: ['ability-intro'] }, ss, now);
    expect(h[0].key).toBe('skip:바벨 로우');
  });

  it('suggests upgrading pull-up ability when the log shows it', () => {
    const s = { ...DEFAULT_SETTINGS, ability: { ...checked, pullups: '1-5' as const }, dismissed: ['ability-intro'] };
    const h = abilityHints(s, [sess(0, [exo('풀업', 'done', [7, 6])])], now);
    expect(h[0].key).toBe('pull:6+');
  });
});
