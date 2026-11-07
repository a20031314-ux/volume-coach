import { describe, expect, it } from 'vitest';

import { classify, normalize, validate } from '../../../supabase/functions/food-lookup/logic';

const base = { name: 'BBQ 황금올리브치킨', brand: 'BBQ', unit: 'g', base: 100, g_per: null, sugar: null, sodium: null, source_url: 'https://bbq.co.kr/menu/1', source_kind: 'official' };

describe('food-lookup logic', () => {
  it('normalizes names', () => {
    expect(normalize('BBQ 황금 올리브-치킨!')).toBe('bbq황금올리브치킨');
  });
  it('shares only cited official or public sources', () => {
    const cited = new Set(['https://bbq.co.kr/menu/1', 'https://www.kca.go.kr/x', 'https://blog.naver.com/a']);
    expect(classify('https://bbq.co.kr/menu/1', 'official', cited)).toBe('official');
    expect(classify('https://www.kca.go.kr/x', 'other', cited)).toBe('public');
    expect(classify('https://blog.naver.com/a', 'official', cited)).toBe('other');
    expect(classify('https://made-up.example/x', 'official', cited)).toBe('estimate');
    expect(classify(null, 'official', cited)).toBe('estimate');
  });
  it('fills carbs/fat when the label has only kcal and protein', () => {
    const v = validate({ ...base, k: 253, p: 18, c: null, f: null })!;
    expect(v.est_cf).toBe(true);
    expect(Math.abs(v.p * 4 + v.c * 4 + v.f * 9 - 253)).toBeLessThan(2);
  });
  it('rejects numbers that cannot be food', () => {
    expect(validate({ ...base, k: 100, p: 40, c: null, f: null })).toBeNull();
    expect(validate({ ...base, k: 300, p: 10, c: 10, f: 1 })).toBeNull();
    expect(validate({ ...base, k: 0, p: 0, c: 0, f: 0 })).toBeNull();
  });
});
