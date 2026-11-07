/**
 * 가이드 모드: spoken cues for a set — "2세트 준비, 3, 2, 1, 시작", then the rhythm of each rep
 * (템포 3-0-1: 내리고 … 올려, 하나), "세트 끝", and during rest "30초 남았어요 … 2세트 준비".
 * Pure: builds a timeline of cues; the player speaks them.
 */
import type { Exercise } from './exercises';
import type { Goal } from './types';

export interface GuideSettings {
  on: boolean;
  /** speak the cues */
  voice: boolean;
  /** short vibration on 시작 / each rep / 끝 */
  haptic: boolean;
  /** "3-0-1-0" style; null = by goal */
  tempo: string | null;
  countdown: boolean;
  /** rhythm of each rep */
  reps: boolean;
  /** between sets: time left and the next set's countdown */
  rest: boolean;
  /** exercises it applies to; empty = all */
  only: string[];
  /** per-exercise tempo */
  tempoBy: Record<string, string>;
}

export const DEFAULT_GUIDE: GuideSettings = {
  on: false, voice: true, haptic: true, tempo: null, countdown: true, reps: true, rest: true, only: [], tempoBy: {},
};

export const GOAL_TEMPO: Record<Goal | '', string> = { hyp: '3-0-1-0', str: '2-0-X-0', cut: '2-0-2-0', fit: '2-0-2-0', '': '2-0-2-0' };
export const TEMPO_CHOICES = ['2-0-2-0', '3-0-1-0', '4-0-1-0', '2-0-X-0', '3-1-1-1'];

export interface Tempo { down: number; bottom: number; up: number; top: number; explosive: boolean }

/** "3-0-1-0" → seconds; X = as fast as possible (counted as 0.8s) */
export function parseTempo(t: string): Tempo {
  const p = t.split('-').map((x) => x.trim().toUpperCase());
  const n = (x: string | undefined, d: number) => (x === 'X' ? 0.8 : x != null && x !== '' && !Number.isNaN(Number(x)) ? Number(x) : d);
  return { down: n(p[0], 2), bottom: n(p[1], 0), up: n(p[2], 2), top: n(p[3], 0), explosive: p[2] === 'X' };
}

export function describeTempo(t: string): string {
  const x = parseTempo(t);
  return [
    `${x.down}초 내리고`,
    x.bottom ? `${x.bottom}초 멈추고` : null,
    x.explosive ? '빠르게 올리기' : `${x.up}초 올리기`,
    x.top ? `${x.top}초 멈추기` : null,
  ].filter(Boolean).join(', ');
}

const NATIVE = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
export function countWord(n: number): string {
  if (n <= 10) return NATIVE[n];
  if (n < 20) return `열${NATIVE[n - 10]}`;
  if (n === 20) return '스물';
  return String(n);
}

type Kind = 'rhythm' | 'explosive' | 'hold';
const EXPLOSIVE = ['클린', '스내치', '스윙', '점프', '슬램', '푸시 프레스', '쓰러스터', '월볼'];
const HOLD = ['플랭크', '홀드', '캐리', '파머스', '워크', '겟업', '크롤', '데드버그', '버드독'];
/** pulling movements start with the lifting half */
const PULL = new Set(['hpull', 'vpull', 'curl', 'kneeFlex', 'rear', 'lateral']);

export function rhythmKind(e: Pick<Exercise, 'n'>): Kind {
  if (HOLD.some((w) => e.n.includes(w))) return 'hold';
  if (EXPLOSIVE.some((w) => e.n.includes(w))) return 'explosive';
  return 'rhythm';
}

export interface Cue {
  /** seconds from the start of this timeline */
  t: number;
  say?: string;
  buzz?: boolean;
  /** for the screen */
  rep?: number;
  phase?: string;
  end?: boolean;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Countdown + reps of one set. `t` = 0 is when the countdown starts. */
export function setCues(o: {
  setNo: number; reps: number; tempo: string; ex: Pick<Exercise, 'n' | 'p'>; countdown: boolean; rhythm: boolean;
}): { cues: Cue[]; length: number } {
  const cues: Cue[] = [];
  let t = 0;
  if (o.countdown) {
    cues.push({ t: 0, say: `${o.setNo}세트 준비`, phase: '준비' });
    cues.push({ t: 1.6, say: '3' }, { t: 2.6, say: '2' }, { t: 3.6, say: '1' });
    t = 4.6;
  }
  cues.push({ t, say: '시작', buzz: true, phase: '시작', rep: 0 });
  const kind = rhythmKind(o.ex);
  if (!o.rhythm || kind === 'hold') return { cues, length: t };
  const x = parseTempo(o.tempo);
  t += 0.8;
  const pullFirst = PULL.has(o.ex.p);
  const upWord = o.ex.p === 'hpull' || o.ex.p === 'vpull' ? '당겨' : o.ex.p === 'hpush' || o.ex.p === 'vpush' ? '밀어' : '올려';
  for (let r = 1; r <= o.reps; r++) {
    if (kind === 'explosive') {
      // no tempo for explosive lifts: a steady pace and the count
      cues.push({ t, say: countWord(r), rep: r, phase: '', buzz: true });
      t += 3;
      continue;
    }
    const down = () => { cues.push({ t, say: '내리고', phase: '내리고' }); t += x.down; if (x.bottom) { cues.push({ t, say: '멈춰', phase: '멈춰' }); t += x.bottom; } };
    const up = (last: boolean) => {
      cues.push({ t, say: x.explosive ? '빠르게' : upWord, phase: upWord });
      t += x.up;
      if (last) cues.push({ t, say: countWord(r), rep: r, buzz: true });
      if (x.top) { cues.push({ t, say: '멈춰', phase: '멈춰' }); t += x.top; }
    };
    if (pullFirst) { up(true); down(); } else { down(); up(true); }
    t = r1(t + 0.3);
  }
  cues.push({ t, say: `${o.setNo}세트 끝`, buzz: true, end: true, phase: '끝' });
  return { cues, length: t };
}

/** During rest: what's left, then the next set's countdown starts right as the rest ends. */
export function restCues(restS: number, nextSet: number, countdown: boolean): Cue[] {
  const cues: Cue[] = [{ t: 0, say: `휴식 ${restS >= 60 ? `${Math.floor(restS / 60)}분${restS % 60 ? ` ${restS % 60}초` : ''}` : `${restS}초`}`, phase: '휴식' }];
  if (restS > 45) cues.push({ t: restS - 30, say: '30초 남았어요' });
  if (restS > 15) cues.push({ t: restS - 10, say: '10초 남았어요' });
  // the countdown (about 4.6s) ends on 시작 when the rest is over
  if (!countdown) cues.push({ t: restS, say: `${nextSet}세트 시작`, buzz: true });
  return cues;
}

export function tempoFor(g: GuideSettings, exercise: string, goal: Goal | ''): string {
  return g.tempoBy[exercise] ?? g.tempo ?? GOAL_TEMPO[goal];
}

export const appliesTo = (g: GuideSettings, exercise: string) => g.on && (!g.only.length || g.only.includes(exercise));
