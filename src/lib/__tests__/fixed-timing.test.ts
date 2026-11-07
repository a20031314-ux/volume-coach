import { describe, expect, it } from 'vitest';

import { suggestTimes, usualWorkout } from '../fixed-timing';
import type { Session } from '../types';

const ctx = { meals: [8 * 60, 12 * 60 + 30, 19 * 60], workout: { start: 18 * 60, minutes: 60 } };

describe('고정식단 시간 추천', () => {
  it('anchors on meals and the workout', () => {
    const s = suggestTimes(['종합비타민', '오메가3', '크레아틴', '바나나', '마그네슘', '아몬드'], ctx);
    expect(s['종합비타민'].time).toBe(8 * 60);
    expect(s['오메가3'].time).toBe(19 * 60);
    expect(s['크레아틴'].time).toBe(19 * 60 + 30);
    expect(s['바나나'].time).toBe(17 * 60 + 30);
    expect(s['마그네슘'].time).toBe(22 * 60);
    expect(s['아몬드'].time).toBe(16 * 60);
  });
  it('keeps iron apart from zinc, magnesium and the multivitamin, and pairs it with vitamin C', () => {
    const s = suggestTimes(['철분', '비타민C', '종합비타민', '아연', '마그네슘'], ctx);
    expect(s['비타민C'].time).toBe(s['철분'].time);
    for (const n of ['종합비타민', '아연', '마그네슘']) expect(Math.abs(s[n].time - s['철분'].time)).toBeGreaterThanOrEqual(120);
    expect(Math.abs(s['마그네슘'].time - s['아연'].time)).toBeGreaterThanOrEqual(120);
  });
  it('falls back to meal times without workout history', () => {
    const s = suggestTimes(['단백질 보충제'], { meals: ctx.meals, workout: null });
    expect(s['단백질 보충제'].time).toBe(19 * 60);
  });
  it('reads the usual workout time from sessions', () => {
    const mk = (h: number, len: number): Session => ({ id: String(h + len), updatedAt: 0, date: '2026-11-01', startedAt: new Date(2026, 10, 1, h).getTime(), endedAt: new Date(2026, 10, 1, h).getTime() + len * 60000, lastActivityAt: 0, detail: 'exercise', exercises: [] } as unknown as Session);
    expect(usualWorkout([mk(18, 60), mk(19, 70), mk(18, 50)])).toEqual({ start: 18 * 60, minutes: 60 });
    expect(usualWorkout([mk(18, 60)])).toBeNull();
  });
});
