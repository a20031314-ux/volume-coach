import { describe, expect, it } from 'vitest';

import {
  bucketTimeline, buildPhases, dopplerSpeed, dueCues, initialCues, phaseAt, phaseStats, smoothSpeed, spokenPace,
  type CueInput, type CueState, type IntervalPlan,
} from '../interval';
import type { GpsPoint } from '../run';

const plan: IntervalPlan = { warmupS: 300, workS: 240, restS: 180, repeats: 3, cooldownS: 300, targetPaceS: 300 };

describe('interval plan', () => {
  it('builds warmup, work/rest x reps without a trailing rest, and cooldown', () => {
    const ph = buildPhases(plan);
    expect(ph.map((p) => p.kind)).toEqual(['warmup', 'work', 'rest', 'work', 'rest', 'work', 'cooldown']);
    expect(ph[ph.length - 1].endS).toBe(300 + 240 * 3 + 180 * 2 + 300);
  });

  it('finds the current phase', () => {
    const ph = buildPhases(plan);
    const pos = phaseAt(ph, 300 + 100);
    expect(pos.phase?.kind).toBe('work');
    expect(pos.remainingS).toBe(140);
    expect(phaseAt(ph, 99999).done).toBe(true);
  });
});

describe('speed', () => {
  it('uses Doppler speed only when it is plausible', () => {
    expect(dopplerSpeed(3.2, 0.5)).toBe(3.2);
    expect(dopplerSpeed(-1)).toBeNull();
    expect(dopplerSpeed(3.2, 4)).toBeNull();
    expect(dopplerSpeed(25)).toBeNull();
  });

  it('smooths the last few seconds and buckets the timeline', () => {
    const s = Array.from({ length: 60 }, (_, i) => ({ ms: i, v: i < 30 ? 3 : 4 }));
    expect(smoothSpeed(s, 59, 8)).toBeCloseTo(4);
    const tl = bucketTimeline(s, 15);
    expect(tl.map((x) => x[1])).toEqual([3, 3, 4, 4]);
  });

  it('splits distance by phase', () => {
    const M = 1 / 111_195;
    const pts: GpsPoint[] = Array.from({ length: 21 }, (_, i) => ({ lat: 37.5 + i * 10 * M, lng: 127, t: i * 1000, seg: 0, ms: i * 30 }));
    const st = phaseStats([{ kind: 'work', startS: 0, endS: 300, rep: 1 }, { kind: 'rest', startS: 300, endS: 600, rep: 1 }], pts);
    expect(st[0].distanceM).toBe(100);
    expect(st[1].distanceM).toBe(100);
  });
});

describe('voice cues', () => {
  const phases = buildPhases(plan);
  const base = (over: Partial<CueInput>): CueInput => ({
    phases, plan, movingS: 0, distanceM: 0, paceNowS: 310, avgPaceS: 320, lastSplitS: null,
    phasePace: () => 295, kmAlert: false, everyMin: 0, ...over,
  });
  const run = (times: number[]) => {
    let st: CueState = initialCues;
    const all: string[] = [];
    for (const t of times) { const r = dueCues(st, base({ movingS: t })); st = r.next; all.push(...r.say); }
    return all;
  };

  it('announces phase changes once, the halfway pace, and a 10 s warning', () => {
    const said = run([0, 1, 2, 290, 301, 302, 420, 421, 531, 541]);
    expect(said[0]).toBe('워밍업 5분');
    expect(said.filter((s) => s.startsWith('1번째 달리기 시작')).length).toBe(1);
    expect(said).toContain('10초 후 달리기');
    expect(said.some((s) => s.startsWith('절반. 현재 페이스 5분 10초, 목표보다 10초 느려요'))).toBe(true);
    expect(said).toContain('10초 후 회복');
    expect(said.some((s) => s.startsWith('1번째 달리기 끝. 평균 페이스 4분 55초'))).toBe(true);
    expect(said).toContain('회복 3분');
  });

  it('announces each km in free runs', () => {
    let st = initialCues;
    const r1 = dueCues(st, base({ phases: null, plan: null, kmAlert: true, distanceM: 999 }));
    st = r1.next;
    const r2 = dueCues(st, base({ phases: null, plan: null, kmAlert: true, distanceM: 1003, lastSplitS: 302 }));
    expect(r1.say).toEqual([]);
    expect(r2.say).toEqual(['1킬로미터. 구간 5분 2초, 평균 5분 20초']);
  });

  it('speaks pace in Korean', () => {
    expect(spokenPace(300)).toBe('5분');
    expect(spokenPace(325)).toBe('5분 25초');
  });
});
