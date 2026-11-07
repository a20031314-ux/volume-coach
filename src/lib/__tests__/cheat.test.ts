import { describe, expect, it } from 'vitest';

import { adjustFor, autoDays, bank, bankDay, cutCap, DEFAULT_CHEAT, nextCheatDay, offsetChoices, offsetCutOn, offsetPlan, overDays, type DayIntake } from '../cheat';

// 2026-11-07 is a Saturday
const SAT = '2026-11-07';
const weekly = { ...DEFAULT_CHEAT, on: true, dow: 6 };
const day = (date: string, intake: number, logged = true): DayIntake => ({ date, target: 2500, bmr: 1700, intake, logged });

describe('cheat day', () => {
  it('finds the next cheat day', () => {
    expect(nextCheatDay(weekly, '2026-11-03')).toBe(SAT);
    expect(nextCheatDay(weekly, SAT)).toBe(SAT);
    expect(nextCheatDay(weekly, '2026-11-08')).toBe('2026-11-14');
    expect(nextCheatDay({ ...weekly, mode: 'date', date: '2026-11-20' }, SAT)).toBe('2026-11-20');
    expect(nextCheatDay({ ...weekly, mode: 'date', date: '2026-11-01' }, SAT)).toBeNull();
  });
  it('banks what is left under target, capped, and never rewards eating below BMR', () => {
    expect(bankDay(day('d', 2300)).saved).toBe(200);
    expect(bankDay(day('d', 1800)).saved).toBe(400); // capped at 20% / 400
    expect(bankDay(day('d', 1500))).toEqual({ date: 'd', saved: 0, low: true });
    expect(bankDay(day('d', 2700)).saved).toBe(0);
    expect(bankDay(day('d', 0, false)).saved).toBe(0);
  });
  it('fills the gauge from the start of the week to yesterday', () => {
    const intake: Record<string, number> = { '2026-11-01': 2000, '2026-11-02': 2300, '2026-11-03': 2400, '2026-11-04': 2600, '2026-11-05': 2200, '2026-11-06': 1500 };
    const b = bank(weekly, '2026-11-06', (d) => day(d, intake[d] ?? 0, d in intake))!;
    expect(b.cheatDay).toBe(SAT);
    expect(b.daysLeft).toBe(1);
    // 11-01 is outside (week starts 11-01? SAT−6 = 11-01) → included: 400 + 200 + 100 + 0 + 300
    expect(b.banked).toBe(1000);
    expect(b.pct).toBe(100);
  });
  it('raises the target on the cheat day and lowers it while saving, never under 1.1×BMR', () => {
    expect(adjustFor(weekly, SAT, 2500, 1700, 800).kcal).toBe(800);
    expect(adjustFor({ ...weekly, save: 200 }, '2026-11-04', 2500, 1700, null)).toEqual({ kcal: -200, label: '치팅 저금 −200' });
    expect(adjustFor({ ...weekly, save: 300 }, '2026-11-04', 1950, 1700, null).kcal).toBe(1870 - 1950);
    expect(adjustFor({ ...weekly, on: false }, SAT, 2500, 1700, 800).kcal).toBe(0);
  });
});

describe('offset', () => {
  it('splits an overeat into a capped food cut and movement', () => {
    const p = offsetPlan(1200, { days: 3, mix: 'mix', target: 2500, bmr: 1700, weightKg: 75 });
    expect(p.cuts).toEqual([240, 240, 240]);
    expect(p.foodKcal + p.moveKcal).toBe(1200);
    expect(p.runMin).toBeLessThan(p.walkMin);
    const diet = offsetPlan(3000, { days: 3, mix: 'diet', target: 2500, bmr: 1700, weightKg: 75 });
    expect(diet.cut).toBe(cutCap(2500, 1700));
    expect(diet.moveKcal).toBe(3000 - diet.foodKcal);
  });
  it('picks the shortest length that fits the cap, and offers 7 days too', () => {
    expect(autoDays(600, 'diet', 2500, 1700)).toBe(2);
    expect(autoDays(1200, 'diet', 2500, 1700)).toBe(4);
    expect(autoDays(5000, 'diet', 2500, 1700)).toBe(7);
    const ch = offsetChoices(900, { mix: 'diet', target: 2500, bmr: 1700, weightKg: 75 });
    expect(ch.map((x) => x.label)).toEqual(['빠르게 3일', '여유 있게 7일']);
    expect(ch[1].plan.cut).toBeLessThan(ch[0].plan.cut);
    expect(ch[1].plan.foodKcal).toBe(910 - 10); // 7 × 130 rounded to 10s
  });
  it('never cuts more than the cap on a day when plans overlap', () => {
    const first = offsetPlan(900, { days: 3, mix: 'diet', target: 2500, bmr: 1700, weightKg: 75 });
    const existing = [{ src: 'a', from: SAT, days: 3, cut: first.cut, cuts: first.cuts, over: 900, moveKcal: 0, walkMin: 0, runMin: 0 }];
    const second = offsetPlan(600, { days: 2, mix: 'diet', target: 2500, bmr: 1700, weightKg: 75, from: SAT, existing });
    const all = [...existing, { ...existing[0], src: 'b', cuts: second.cuts, days: second.days }];
    for (let i = 0; i < 8; i++) {
      const d = new Date(2026, 10, 7 + i); const iso = `2026-11-${String(d.getDate()).padStart(2, '0')}`;
      expect(offsetCutOn(all, iso)).toBeLessThanOrEqual(cutCap(2500, 1700));
    }
    expect(second.cuts.length).toBeGreaterThan(2); // pushed past the busy days
    expect(second.foodKcal).toBe(600);
  });
  it('applies the cut while the plan runs', () => {
    const c = { ...DEFAULT_CHEAT, on: true, mode: 'date' as const, offsets: [{ src: '2026-11-06', from: SAT, days: 3, cut: 200, over: 900, moveKcal: 300, walkMin: 60, runMin: 25 }] };
    expect(adjustFor(c, '2026-11-08', 2500, 1700, null).kcal).toBe(-200);
    expect(adjustFor(c, '2026-11-10', 2500, 1700, null).kcal).toBe(0);
  });
  it('finds recent days well over target', () => {
    const intake: Record<string, number> = { '2026-11-06': 3400, '2026-11-05': 2650 };
    const found = overDays(weekly, SAT, (d) => day(d, intake[d] ?? 0, d in intake), () => 2500);
    expect(found).toEqual([{ date: '2026-11-06', over: 900 }]);
    expect(overDays({ ...weekly, dismissed: ['2026-11-06'] }, SAT, (d) => day(d, intake[d] ?? 0, d in intake), () => 2500)).toEqual([]);
  });
});
