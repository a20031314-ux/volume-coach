import { describe, expect, it } from 'vitest';

import { lastPerformance, logFields, newSession, prefill, restSeconds, shouldAutoEnd, summarize } from '../session';
import type { Session } from '../types';

let n = 0;
const ids = { session: 's1', log: () => `log${n++}` };
const T0 = new Date(2026, 9, 29, 18, 0).getTime();

const base = (): Session => ({
  ...newSession(
    [{ name: '바벨 벤치프레스', muscle: 'chest', sets: 3 }, { name: '케이블 플라이', muscle: 'chest', sets: 2 }],
    'set', T0, ids, '2026-10-29',
  ),
  updatedAt: 0,
});

describe('session', () => {
  it('starts with the first exercise active', () => {
    const s = base();
    expect(s.exercises.map((e) => e.status)).toEqual(['active', 'pending']);
    expect(s.exercises[0].logId).not.toBe(s.exercises[1].logId);
  });

  it('turns per-set detail into one workout log', () => {
    const s = base();
    const ex = { ...s.exercises[0], sets: [{ at: T0 + 60e3, kg: 80, reps: 8 }, { at: T0 + 240e3, kg: 82.5, reps: 6 }], endedAt: T0 + 300e3 };
    const log = logFields(ex, s, T0)!;
    expect(log.sets).toBe(2);
    expect(log.kg).toBe(82.5);
    expect(log.reps).toBe('8/6');
    expect(log.at).toBe(T0 + 300e3);
    expect(log.sessionId).toBe('s1');
  });

  it('turns exercise-level count into a log and skips empty ones', () => {
    const s = base();
    expect(logFields({ ...s.exercises[1], doneSets: 3 }, s, T0)!.sets).toBe(3);
    expect(logFields(s.exercises[1], s, T0)).toBeNull();
  });

  it('summarizes volume, sets and rest', () => {
    const s = base();
    s.exercises[0] = { ...s.exercises[0], status: 'done', sets: [{ at: T0, kg: 80, reps: 8 }, { at: T0 + 150e3, kg: 80, reps: 8 }] };
    s.exercises[1] = { ...s.exercises[1], status: 'done', doneSets: 2 };
    s.endedAt = T0 + 1800e3;
    const sum = summarize(s, T0);
    expect(sum.totalSets).toBe(4);
    expect(sum.volumeKg).toBe(1280);
    expect(sum.avgRestS).toBe(150);
    expect(sum.durationS).toBe(1800);
  });

  it('prefills from this session, then from last time', () => {
    const prev = base();
    prev.id = 'old';
    prev.exercises[0] = { ...prev.exercises[0], sets: [{ at: T0 - 864e5, kg: 77.5, reps: 9 }] };
    const cur = base();
    const last = lastPerformance('바벨 벤치프레스', [prev, cur], [], cur.id)!;
    expect(last.kg).toBe(77.5);
    expect(prefill(cur.exercises[0], last)).toEqual({ kg: 77.5, reps: 9 });
    const withSet = { ...cur.exercises[0], sets: [{ at: T0, kg: 80, reps: 7 }] };
    expect(prefill(withSet, last)).toEqual({ kg: 80, reps: 7 });
  });

  it('ends a forgotten session after the idle limit', () => {
    const s = base();
    expect(shouldAutoEnd(s, T0 + 89 * 60e3, 90)).toBe(false);
    expect(shouldAutoEnd(s, T0 + 91 * 60e3, 90)).toBe(true);
  });

  it('rests longer for heavy lifts and strength goals', () => {
    expect(restSeconds('백스쿼트', 'str')).toBeGreaterThan(restSeconds('레그 익스텐션', 'hyp'));
  });
});
