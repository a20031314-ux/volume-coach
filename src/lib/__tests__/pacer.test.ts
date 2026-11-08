import { describe, expect, it } from 'vitest';

import { bestAround, gapNow, ghostPacer, initialPacerCues, pacerCues, pacerDistAt, pacerTimeAt, planLegs, planPacer, runCurve } from '../pacer';
import type { Run } from '../types';

const run = (o: Partial<Run>): Run => ({
  id: 'r', updatedAt: 0, date: '2026-11-05', startedAt: new Date(2026, 10, 5, 7).getTime(), endedAt: 0, distanceM: 5000, movingS: 1500,
  paceSecPerKm: 300, kcal: 0, splits: [], route: [], ...o,
} as Run);

describe('pacer', () => {
  it('designed legs add up to the target for every strategy', () => {
    for (const s of ['even', 'negative', 'easyStart'] as const) {
      const legs = planLegs(5000, 1500, s);
      const total = legs.reduce((a, l) => a + l.paceS * ((l.toM - l.fromM) / 1000), 0);
      expect(total).toBeCloseTo(1500, 5);
      expect(legs.at(-1)!.toM).toBe(5000);
    }
    const neg = planLegs(5000, 1500, 'negative');
    expect(neg[0].paceS).toBeGreaterThan(neg[1].paceS);
    const easy = planLegs(10000, 3000, 'easyStart');
    expect(easy[0].toM).toBe(1000);
    expect(easy[0].paceS).toBe(320);
  });

  it('reads the gap from distance: ahead in metres and seconds, projected finish', () => {
    const p = planPacer({ kind: 'plan', distanceM: 5000, targetS: 1500, strategy: 'even' });
    expect(p.label).toBe('5km 25:00 · 균등');
    expect(pacerDistAt(p.curve, 600)).toBeCloseTo(2000);
    expect(pacerTimeAt(p.curve, 2000)).toBeCloseTo(600);
    const g = gapNow(p, 600, 2050)!;
    expect(g.m).toBeCloseTo(50);
    expect(g.s).toBeCloseTo(15);
    expect(g.projectedS).toBeCloseTo(1485);
    expect(gapNow(p, 10, 50)).toBeNull();
    // past the finish the pacer waits there
    expect(pacerDistAt(p.curve, 9999)).toBe(5000);
  });

  it('turns a past run into a curve that ends at its distance and time', () => {
    const r = run({ distanceM: 2000, movingS: 600, timeline: [[0, 3], [300, 3.5], [600, 3.2]] });
    const c = runCurve(r);
    expect(c.at(-1)![1]).toBeCloseTo(2000);
    expect(c.at(-1)![0]).toBe(600);
    expect(ghostPacer(r).label).toBe('11월 5일 2km');
    // splits only
    const s = runCurve(run({ distanceM: 2000, movingS: 610, splits: [{ km: 1, seconds: 300 }, { km: 2, seconds: 310 }] }));
    expect(pacerTimeAt(s, 1000)).toBeCloseTo(300);
    const best = bestAround([run({ id: 'a', distanceM: 5000, movingS: 1600 }), run({ id: 'b', distanceM: 5100, movingS: 1550 }), run({ id: 'c', distanceM: 10000, movingS: 2000 })], 5000);
    expect(best?.id).toBe('b');
  });

  it('speaks each km with the gap, nudges once when falling behind, and the result at the finish', () => {
    const p = planPacer({ kind: 'plan', distanceM: 2000, targetS: 600, strategy: 'even' });
    let st = initialPacerCues;
    let r = pacerCues(st, { pacer: p, t: 310, myM: 1000, lastSplitS: 310 });
    expect(r.say[0]).toBe('1킬로, 구간 5분 10초. 페이스메이커보다 10초 뒤처져요');
    st = r.next;
    r = pacerCues(st, { pacer: p, t: 330, myM: 1060, lastSplitS: null });
    expect(r.say).toEqual(['12초 뒤처졌어요. 조금 올려요']);
    st = r.next;
    r = pacerCues(st, { pacer: p, t: 340, myM: 1090, lastSplitS: null });
    expect(r.say).toEqual([]);
    r = pacerCues(r.next, { pacer: p, t: 595, myM: 2000, lastSplitS: null });
    expect(r.say[0]).toContain('목표 거리 도착. 9분 55초. 5초 빨라요');
    expect(r.next.reachedS).toBe(595);
  });
});
