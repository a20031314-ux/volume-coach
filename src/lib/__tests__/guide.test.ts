import { describe, expect, it } from 'vitest';

import { LIBRARY } from '../exercises';
import { appliesTo, buildRun, countWord, DEFAULT_GUIDE, describeTempo, parseTempo, restCues, rhythmKind, setCues, setupFor, tempoFor, runSpans, repProgress, type RunItem } from '../guide';

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
  it('waits for 자세 잡기 before 3·2·1 on barbell lifts', () => {
    expect(setupFor(ex('바벨 벤치프레스'))).toBe(10);
    expect(setupFor(ex('백스쿼트'))).toBe(12);
    expect(setupFor(ex('랫풀다운'))).toBe(4);
    const { cues } = setCues({ setNo: 1, reps: 1, tempo: '2-0-2-0', ex: ex('바벨 벤치프레스'), countdown: true, rhythm: true, setup: 10, intro: '1세트 준비, 자세 잡으세요' });
    expect(cues.find((c) => c.say === '3')?.t).toBe(10);
    expect(cues.find((c) => c.say === '시작')?.t).toBe(13);
  });
  it('builds the whole workout: sets, rest that ends on 시작, move to the next exercise', () => {
    const item = (name: string, p: RunItem['p'], o: Partial<RunItem> = {}): RunItem => ({
      key: name, name, p, sets: 2, first: 1, reps: 2, hold: 30, kg: 60, tempo: '2-0-2-0', rest: 60, setup: 10, on: true, ...o,
    });
    const { cues, length } = buildRun([item('바벨 벤치프레스', 'hpush'), item('플랭크', 'core', { setup: 0, kg: 0, rest: 30, sets: 1 }), item('랫풀다운', 'vpull', { on: false })],
      { countdown: true, rhythm: true, restCues: true, move: 90 });
    const acts = cues.filter((c) => c.act).map((c) => (c.act!.k === 'finish' ? 'finish' : `${c.act!.k}:${c.act!.key}:${c.act!.setNo}`));
    expect(acts).toEqual(['begin:바벨 벤치프레스:1', 'set:바벨 벤치프레스:1', 'set:바벨 벤치프레스:2', 'done:바벨 벤치프레스:2',
      'begin:플랭크:1', 'set:플랭크:1', 'done:플랭크:1', 'finish']);
    // the 2nd set's 시작 lands exactly 60s after the 1st set ended
    const end1 = cues.find((c) => c.act?.k === 'set')!.t;
    const start2 = cues.filter((c) => c.say === '시작')[1].t;
    expect(start2 - end1).toBeCloseTo(60, 0);
    // 90s to move on, plank held 30s
    const end2 = cues.filter((c) => c.act?.k === 'set')[1].t;
    const start3 = cues.filter((c) => c.say === '시작')[2].t;
    expect(start3 - end2).toBeCloseTo(90, 0);
    expect(cues.find((c) => c.mode === 'move')?.say).toContain('다음은 플랭크, 1세트, 30초');
    expect(cues.filter((c) => c.act?.k === 'set')[2 - 1 + 1].t - start3).toBeCloseTo(30, 0);
    expect(cues.some((c) => c.say?.includes('랫풀다운'))).toBe(false);
    expect(length).toBeGreaterThan(start3 + 30);
    expect(cues.every((c, i) => i === 0 || c.t >= cues[i - 1].t)).toBe(true);
  });
  it('spans per exercise and the moving dot follows the tempo', () => {
    const it0: RunItem = { key: 'b', name: '바벨 벤치프레스', p: 'hpush', sets: 2, first: 1, reps: 2, hold: 30, kg: 60, tempo: '3-0-1-0', rest: 60, setup: 10, on: true };
    const { cues } = buildRun([it0, { ...it0, key: 'r', name: '랫풀다운', p: 'vpull', sets: 1 }], { countdown: true, rhythm: true, restCues: true, move: 60 });
    const sp = runSpans(cues, 2);
    expect(sp[0].sets).toHaveLength(2);
    expect(sp[0].sets[1].go - sp[0].sets[0].e).toBeCloseTo(60, 0);
    expect(sp[1].start).toBeGreaterThan(sp[0].end);
    // push: halfway through the 1st rep's 3s 내리고 → about 1.5/4.3 of one of two reps
    expect(repProgress({ it: it0, rep: 0, phase: '내리고', lastMove: '내리고', since: 1.5 })).toBeCloseTo(1.5 / 4.3 / 2, 2);
    expect(repProgress({ it: it0, rep: 1, phase: '내리고', lastMove: '내리고', since: 0 })).toBeCloseTo(0.5, 2);
    // pull: counted after 당겨, so 내리고 belongs to the rep just counted
    const pull = { ...it0, p: 'vpull' as const };
    expect(repProgress({ it: pull, rep: 1, phase: '내리고', lastMove: '내리고', since: 0 })).toBeCloseTo(1 / 4.3 / 2, 2);
  });
});

