import { describe, expect, it } from 'vitest';

import { CARDIO, cardioKcal, cardioLegKm, cardioType, rideKcal, rideMet } from '../cardio';

describe('cardio', () => {
  it('has unique keys and rising MET per level', () => {
    expect(new Set(CARDIO.map((c) => c.key)).size).toBe(CARDIO.length);
    for (const c of CARDIO) expect(c.met[0] <= c.met[1] && c.met[1] <= c.met[2]).toBe(true);
  });

  it('computes kcal from MET, or takes the machine value', () => {
    expect(cardioKcal('swim', 2, 30, 80)).toBe(Math.round(8.3 * 80 * 0.5));
    expect(cardioKcal('stairs', 3, 20, 70, 310)).toBe(310);
    expect(cardioType('nope').key).toBe('other');
  });

  it('scales leg load', () => {
    expect(cardioLegKm('stairs', 2, 30)).toBe(2);
    expect(cardioLegKm('stairs', 1, 30)).toBe(1.2);
    expect(cardioLegKm('yoga', 3, 60)).toBe(0);
  });

  it('rates rides by speed', () => {
    expect(rideMet(14)).toBe(4);
    expect(rideMet(23)).toBe(10);
    expect(rideKcal(20000, 3600, 70)).toBe(Math.round(8 * 70));
  });
});
