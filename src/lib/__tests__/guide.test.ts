import { describe, expect, it } from 'vitest';

import { LIBRARY } from '../exercises';
import { appliesTo, countWord, DEFAULT_GUIDE, describeTempo, parseTempo, restCues, rhythmKind, setCues, tempoFor } from '../guide';

const ex = (n: string) => LIBRARY.find((e) => e.n === n)!;

describe('가이드 모드', () => {
  it('reads tempos', () => {
    expect(parseTempo('3-0-1-0')).toMatchObject({ down: 3, bottom: 0, up: 1, top: 0, explosive: false });
    expect(parseTempo('2-0-X-0').explosive).toBe(true);
    expect(describeTempo('3-1-1-0')).toBe('3초 내리고, 1초 멈추고, 1초 올리기');
    expect(countWord(1)).toBe('하나');
    expect(countWord(12)).toBe('열둘');
  });
  it('counts down, keeps the rhythm and ends the set', () => {
    const { cues, length } = setCues({ setNo: 2, reps: 3, tempo: '3-0-1-0', ex: ex('바벨 벤치프레스'), countdown: true, rhythm: true });
    const said = cues.map((c) => c.say);
    expect(said.slice(0, 5)).toEqual(['2세트 준비', '3', '2', '1', '시작']);
    expect(said).toContain('내리고');
    expect(said).toContain('밀어');
    expect(said.filter((s) => s === '하나' || s === '둘' || s === '셋')).toEqual(['하나', '둘', '셋']);
    expect(said.at(-1)).toBe('2세트 끝');
    // 3 reps × (3s down + 1s up + 0.3) after the 4.6s countdown and 0.8s settle
    expect(length).toBeCloseTo(4.6 + 0.8 + 3 * 4.3, 1);
    expect(cues.every((c, i) => i === 0 || c.t >= cues[i - 1].t)).toBe(true);
  });
  it('pulls start with the lifting half', () => {
    const { cues } = setCues({ setNo: 1, reps: 1, tempo: '2-0-1-0', ex: ex('랫풀다운'), countdown: false, rhythm: true });
    const said = cues.map((c) => c.say);
    expect(said.indexOf('당겨')).toBeLessThan(said.indexOf('내리고'));
  });
  it('no rhythm for holds; explosive lifts just count', () => {
    expect(rhythmKind(ex('플랭크'))).toBe('hold');
    expect(rhythmKind(ex('케틀벨 스윙'))).toBe('explosive');
    const hold = setCues({ setNo: 1, reps: 10, tempo: '2-0-2-0', ex: ex('플랭크'), countdown: true, rhythm: true });
    expect(hold.cues.at(-1)?.say).toBe('시작');
    const swing = setCues({ setNo: 1, reps: 3, tempo: '3-0-1-0', ex: ex('케틀벨 스윙'), countdown: false, rhythm: true });
    expect(swing.cues.map((c) => c.say)).toEqual(['시작', '하나', '둘', '셋', '1세트 끝']);
  });
  it('rest cues: time left and the next start', () => {
    expect(restCues(90, 3, true).map((c) => [c.t, c.say])).toEqual([[0, '휴식 1분 30초'], [60, '30초 남았어요'], [80, '10초 남았어요']]);
    expect(restCues(30, 2, false).at(-1)).toMatchObject({ t: 30, say: '2세트 시작' });
  });
  it('applies to chosen exercises with per-exercise tempo', () => {
    const g = { ...DEFAULT_GUIDE, on: true, only: ['백스쿼트'], tempoBy: { 백스쿼트: '4-0-1-0' } };
    expect(appliesTo(g, '백스쿼트')).toBe(true);
    expect(appliesTo(g, '랫풀다운')).toBe(false);
    expect(tempoFor(g, '백스쿼트', 'hyp')).toBe('4-0-1-0');
    expect(tempoFor(g, '랫풀다운', 'hyp')).toBe('3-0-1-0');
    expect(tempoFor({ ...g, tempo: '2-0-2-0' }, '랫풀다운', 'str')).toBe('2-0-2-0');
  });
});
