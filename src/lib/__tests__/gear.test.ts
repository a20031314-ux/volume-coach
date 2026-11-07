import { describe, expect, it } from 'vitest';

import { LIBRARY } from '../exercises';
import { ALL_GEAR, UNKNOWN, canDo, fromLegacy, gearFor, gearSummary } from '../gear';

const ex = (n: string) => LIBRARY.find((e) => e.n === n)!;

describe('장비', () => {
  it('knows what every exercise needs', () => {
    const unknown = LIBRARY.filter((e) => gearFor(e) === UNKNOWN).map((e) => e.n);
    expect(unknown).toEqual([]);
    // bodyweight-only exercises need nothing (or only a bar / dip station / small gear)
    for (const e of LIBRARY) expect(gearFor(e).length).toBeGreaterThan(0);
  });
  it('matches what people actually have', () => {
    const home = ['dumbbell', 'pullup'] as const;
    expect(canDo(ex('풀업'), [...home])).toBe(true);
    expect(canDo(ex('덤벨 원암 로우'), [...home])).toBe(true);
    expect(canDo(ex('덤벨 벤치프레스'), [...home])).toBe(false); // needs a bench
    expect(canDo(ex('덤벨 벤치프레스'), [...home, 'bench'])).toBe(true);
    expect(canDo(ex('바벨 벤치프레스'), ['barbell', 'bench'])).toBe(false); // and a rack
    expect(canDo(ex('랫풀다운'), ['machine'])).toBe(true);
    expect(canDo(ex('랫풀다운'), ['cable'])).toBe(true);
    expect(canDo(ex('케틀벨 스윙'), ['dumbbell'])).toBe(true);
    expect(canDo(ex('푸시업'), [])).toBe(true);
    expect(canDo(ex('딥스'), [])).toBe(false);
    expect(canDo(ex('레그프레스'), ['barbell', 'rack'])).toBe(false);
    expect(canDo(ex('백스쿼트'), ['barbell', 'rack'])).toBe(true);
    expect(canDo(ex('레그프레스'), undefined)).toBe(true); // not chosen: no limit
  });
  it('carries the old single choice over', () => {
    expect(fromLegacy('gym')).toEqual(ALL_GEAR);
    expect(fromLegacy('bodyweight')).toEqual(['pullup']);
    expect(fromLegacy(undefined)).toBeUndefined();
    expect(gearSummary(ALL_GEAR)).toBe('헬스장');
    expect(gearSummary(['dumbbell', 'pullup'])).toBe('덤벨·철봉');
    expect(gearSummary([])).toBe('맨몸만');
  });
});
