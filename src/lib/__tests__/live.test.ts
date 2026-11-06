import { describe, expect, it } from 'vitest';

import { dueCues, initialCues, type CueInput } from '../interval';
import { liveSeries, paceStatus, targetBand } from '../live';

describe('live speed', () => {
  it('gives one smoothed value per second for the window', () => {
    const samples = Array.from({ length: 300 }, (_, i) => ({ ms: i + 1, v: i % 2 ? 3.2 : 2.8 }));
    const s = liveSeries(samples, 300, 60, 2);
    expect(s).toHaveLength(61);
    expect(s[0][0]).toBe(240);
    expect(s[s.length - 1][1]).toBeCloseTo(3.0);
  });

  it('classifies against the target band', () => {
    const band = targetBand(300); // 5'00" ±10 s
    expect(paceStatus(1000 / 320, band)).toBe('slow');
    expect(paceStatus(1000 / 300, band)).toBe('ok');
    expect(paceStatus(1000 / 285, band)).toBe('fast');
    expect(paceStatus(null, band)).toBeNull();
  });
});

describe('off-target nudge', () => {
  const base: CueInput = { phases: null, movingS: 0, distanceM: 0, paceNowS: null, avgPaceS: null, lastSplitS: null, phasePace: () => null, kmAlert: false, everyMin: 0 };
  it('speaks after 20 s off pace, then not again for a minute', () => {
    let st = initialCues;
    const said: string[] = [];
    for (let t = 100; t <= 200; t += 5) {
      const r = dueCues(st, { ...base, movingS: t, targetNowS: 300, steadyPaceS: 330, paceAlert: true });
      st = r.next; said.push(...r.say);
    }
    expect(said.filter((x) => x.includes('느려요'))).toHaveLength(2);
    const r = dueCues(initialCues, { ...base, movingS: 50, targetNowS: 300, steadyPaceS: 304, paceAlert: true });
    expect(r.say).toEqual([]);
  });
});
