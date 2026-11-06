import { describe, expect, it } from 'vitest';

import { weatherFactor } from '../weather';

describe('weatherFactor', () => {
  it('is neutral in mild weather and small at the extremes', () => {
    expect(weatherFactor({ feelsC: 15 })).toBe(1);
    expect(weatherFactor({ feelsC: 30 })).toBeCloseTo(1.06);
    expect(weatherFactor({ feelsC: 40 })).toBeCloseTo(1.08);
    expect(weatherFactor({ feelsC: -6 })).toBeCloseTo(1.03);
    expect(weatherFactor({ feelsC: -30 })).toBeCloseTo(1.05);
    expect(weatherFactor(null)).toBe(1);
  });
});
