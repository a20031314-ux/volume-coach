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
  /** seconds to walk to the next exercise */
  move?: number;
  /** 자세 잡는 시간 (s) after "준비"; null = by exercise (바벨 길게, 머신 짧게) */
  setup?: number | null;
}

export const DEFAULT_GUIDE: GuideSettings = {
  on: false, voice: true, haptic: true, tempo: null, countdown: true, reps: true, rest: true, only: [], tempoBy: {}, move: 60, setup: null,
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

/** Rough time to say a line (rate 1.1) — the countdown waits for it. */
export const speakTime = (text: string) => Math.max(1.2, text.replace(/[\s,.]/g, '').length * 0.17 + 0.4);

/**
 * 자세 잡는 시간: after "준비" before 3·2·1. Barbell lifts need to unrack / set the grip and brace.
 */
export function setupFor(e: Pick<Exercise, 'n'>): number {
  const n = e.n;
  if (/스쿼트/.test(n) && !/고블릿|스플릿|덤벨|맨몸|점프|피스톨|핵|머신/.test(n)) return 12;
  if (/데드리프트|랙풀|굿모닝|힙 쓰러스트|클린|스내치/.test(n) && !/덤벨|싱글/.test(n)) return 10;
  if (/바벨|벤치프레스|오버헤드프레스|밀리터리|Z프레스|푸시 프레스|SSB/.test(n) && !/덤벨|머신|스미스/.test(n)) return 10;
  if (/덤벨|케틀벨|스미스/.test(n)) return 6;
  return 4;
}

/** seconds from the "준비" line to 시작 */
export const leadTime = (o: { countdown: boolean; setup: number; intro: string }) =>
  (o.countdown ? Math.max(speakTime(o.intro), o.setup) + 3 : Math.max(o.setup, o.setup ? speakTime(o.intro) : 0));

/** Countdown + reps of one set. `t` = 0 is when the "준비" line starts. */
export function setCues(o: {
  setNo: number; reps: number; tempo: string; ex: Pick<Exercise, 'n' | 'p'>; countdown: boolean; rhythm: boolean;
  /** 자세 잡는 시간 (s) */
  setup?: number;
  intro?: string;
  /** seconds to hold (플랭크·캐리) */
  hold?: number;
}): { cues: Cue[]; length: number } {
  const cues: Cue[] = [];
  const setup = o.setup ?? 0;
  const intro = o.intro ?? `${o.setNo}세트 준비`;
  let t = 0;
  if (o.countdown) {
    const w = Math.max(1.6, speakTime(intro), setup);
    cues.push({ t: 0, say: intro, phase: setup >= 4 ? '자세 잡기' : '준비' });
    cues.push({ t: w, say: '3', phase: '준비' }, { t: w + 1, say: '2' }, { t: w + 2, say: '1' });
    t = w + 3;
  } else if (setup) {
    cues.push({ t: 0, say: intro, phase: '자세 잡기' });
    t = Math.max(setup, speakTime(intro));
  }
  cues.push({ t, say: '시작', buzz: true, phase: '시작', rep: 0 });
  const kind = rhythmKind(o.ex);
  const x = parseTempo(o.tempo);
  if (kind === 'hold') {
    if (!o.hold) return { cues, length: t };
    if (o.hold > 15) cues.push({ t: t + o.hold - 10, say: '10초' });
    t += o.hold;
    cues.push({ t, say: `${o.setNo}세트 끝`, buzz: true, end: true, phase: '끝' });
    return { cues, length: t };
  }
  if (!o.rhythm) {
    // no rhythm: the set ends after about as long as the reps take
    t = r1(t + 0.8 + o.reps * (kind === 'explosive' ? 3 : x.down + x.bottom + x.up + x.top + 0.3));
    cues.push({ t, say: `${o.setNo}세트 끝`, buzz: true, end: true, phase: '끝' });
    return { cues, length: t };
  }
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

/* ---------- 한 번에 쭉: the whole workout as one timeline ---------- */

export interface RunItem {
  key: string;
  name: string;
  p: Exercise['p'];
  /** sets to do in this run */
  sets: number;
  /** set number of the first one (sets already done + 1) */
  first: number;
  reps: number;
  /** seconds for holds */
  hold: number;
  kg: number;
  tempo: string;
  rest: number;
  setup: number;
  on: boolean;
}

export interface RunOpts { countdown: boolean; rhythm: boolean; restCues: boolean; move: number }

export type RunAct = { k: 'begin' | 'set' | 'done'; key: string; setNo: number } | { k: 'finish' };

export interface RunCue extends Cue {
  act?: RunAct;
  /** what's on screen from here on */
  label?: string;
  mode?: 'set' | 'rest' | 'move' | 'end';
  /** when this part ends (timeline seconds) — rest/move countdown */
  until?: number;
  /** a set's "준비" line: where 이 세트 처음부터 / 다음으로 jump to */
  mark?: boolean;
  /** item index */
  item?: number;
  /** reps to do this set (null for holds) */
  target?: number | null;
  /** a timed set (hold): show the time left */
  timed?: boolean;
}

const amount = (it: RunItem) => (rhythmKind({ n: it.name }) === 'hold' ? `${it.hold}초` : `${it.kg ? `${fmtKg(it.kg)}킬로 ` : ''}${it.reps}회`);
const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));
const restWord = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}` : `${s}초`);

/** Every set of every exercise in order: 준비(자세) → 3·2·1 → reps → rest → … → 이동 → next exercise. */
export function buildRun(items: RunItem[], o: RunOpts): { cues: RunCue[]; length: number } {
  const list = items.filter((i) => i.on && i.sets > 0);
  const cues: RunCue[] = [];
  let T = 0;
  list.forEach((it, idx) => {
    const last = it.first + it.sets - 1;
    for (let k = 0; k < it.sets; k++) {
      const setNo = it.first + k;
      const intro = k === 0
        ? (idx === 0 ? `${it.name}, ${it.sets}세트, ${amount(it)}. ${setNo}세트 준비` : `${it.name} ${setNo}세트 준비`)
        : `${setNo}세트 준비`;
      const { cues: sc, length } = setCues({
        setNo, reps: it.reps, tempo: it.tempo, ex: { n: it.name, p: it.p }, countdown: o.countdown, rhythm: o.rhythm, setup: it.setup,
        intro: it.setup >= 4 ? `${intro}, 자세 잡으세요` : intro, hold: rhythmKind({ n: it.name }) === 'hold' ? it.hold : undefined,
      });
      cues.push({ t: T, mark: true, item: idx, target: rhythmKind({ n: it.name }) === 'hold' ? null : it.reps, timed: rhythmKind({ n: it.name }) === 'hold', mode: 'set', label: `${it.name} · ${setNo}/${last}세트`, until: T + length, rep: 0, phase: '준비', act: k === 0 ? { k: 'begin', key: it.key, setNo } : undefined });
      for (const c of sc) cues.push({ ...c, t: r1(T + c.t), end: undefined, ...(c.end ? { act: { k: 'set' as const, key: it.key, setNo } } : {}) });
      T = r1(T + length);
      const next = k < it.sets - 1 ? { item: it, setNo: setNo + 1 } : null;
      if (next) {
        const nextIntro = `${setNo + 1}세트 준비${it.setup >= 4 ? ', 자세 잡으세요' : ''}`;
        const lead = leadTime({ countdown: o.countdown, setup: it.setup, intro: nextIntro });
        const wait = Math.max(0, it.rest - lead);
        cues.push({ t: T + 0.01, timed: false, mode: 'rest', label: `휴식 · 다음 ${setNo + 1}/${last}세트`, until: r1(T + it.rest), phase: '휴식' });
        if (o.restCues) for (const c of restCues(it.rest, setNo + 1, true)) if (c.t < wait - 1) cues.push({ ...c, t: r1(T + c.t + 1.2) });
        T = r1(T + wait);
      }
    }
    cues.push({ t: T + 0.02, act: { k: 'done', key: it.key, setNo: last } });
    const nx = list[idx + 1];
    if (nx) {
      const intro = `${nx.name} ${nx.first}세트 준비${nx.setup >= 4 ? ', 자세 잡으세요' : ''}`;
      const lead = leadTime({ countdown: o.countdown, setup: nx.setup, intro });
      const gap = Math.max(o.move, it.rest);
      const wait = Math.max(0, gap - lead);
      cues.push({ t: T + 1.2, timed: false, mode: 'move', label: `이동 · 다음 ${nx.name}`, until: r1(T + gap), phase: '이동',
        say: `다음은 ${nx.name}, ${nx.sets}세트, ${amount(nx)}. ${restWord(gap)} 뒤 시작해요` });
      if (o.restCues && gap > 25) cues.push({ t: r1(T + gap - lead - 10), say: '10초 뒤 준비' });
      T = r1(T + wait);
    }
  });
  if (list.length) cues.push({ t: T + 1, mode: 'end', label: '오늘 가이드 끝', say: '오늘 운동 끝. 수고했어요', buzz: true, phase: '끝', act: { k: 'finish' } });
  cues.sort((a, b) => a.t - b.t);
  return { cues, length: T + 1 };
}

/* ---------- 템포 그림: one rep as blocks, in the order they happen ---------- */

export interface TempoBlock { k: 'down' | 'bottom' | 'up' | 'top'; word: string; s: number }

export function upWordOf(p: Exercise['p']): string {
  return p === 'hpull' || p === 'vpull' ? '당겨' : p === 'hpush' || p === 'vpush' ? '밀어' : '올려';
}

export function tempoBlocks(tempo: string, ex: Pick<Exercise, 'p'>): TempoBlock[] {
  const x = parseTempo(tempo);
  const down: TempoBlock = { k: 'down', word: '내리고', s: x.down };
  const bottom: TempoBlock = { k: 'bottom', word: '멈춤', s: x.bottom };
  const up: TempoBlock = { k: 'up', word: x.explosive ? '빠르게' : upWordOf(ex.p), s: x.up };
  const top: TempoBlock = { k: 'top', word: '멈춤', s: x.top };
  const order = PULL.has(ex.p) ? [up, top, down, bottom] : [down, bottom, up, top];
  return order.filter((b) => b.s > 0);
}

/** which block a spoken phase is in ('멈춰' after 내리고 = bottom) */
export function blockOf(phase: string, lastMove: string): TempoBlock['k'] | null {
  if (phase === '내리고') return 'down';
  if (phase === '밀어' || phase === '당겨' || phase === '올려' || phase === '빠르게') return 'up';
  if (phase === '멈춰') return lastMove === '내리고' ? 'bottom' : 'top';
  return null;
}

/** per item: when each set starts ("준비") and ends (recorded) — for the 가로 타임라인 */
export interface ItemSpan { start: number; end: number; sets: { s: number; go: number; e: number }[] }
export function runSpans(cues: RunCue[], count: number): ItemSpan[] {
  const spans: ItemSpan[] = Array.from({ length: count }, () => ({ start: 0, end: 0, sets: [] }));
  let cur = -1;
  let open: { s: number; go: number; e: number } | null = null;
  for (const c of cues) {
    if (c.mark && c.item != null) {
      cur = c.item;
      open = { s: c.t, go: c.t, e: c.t };
      spans[cur].sets.push(open);
    } else if (open && c.say === '시작' && open.go === open.s) open.go = c.t;
    else if (open && c.act?.k === 'set') { open.e = c.t; open = null; }
  }
  for (const sp of spans) if (sp.sets.length) { sp.start = sp.sets[0].s; sp.end = sp.sets.at(-1)!.e; }
  return spans;
}

/**
 * Where the moving dot is in the current set, 0–1: reps done + how far into this rep (by tempo).
 * Counts land at the end of the lifting half, so blocks after it belong to the rep just counted.
 */
export function repProgress(o: { it: Pick<RunItem, 'tempo' | 'p' | 'reps' | 'hold' | 'name'>; rep: number; phase: string; lastMove: string; since: number }): number {
  const kind = rhythmKind({ n: o.it.name });
  if (kind === 'hold') return o.phase === '시작' ? Math.min(1, o.since / o.it.hold) : 0;
  if (kind === 'explosive') return Math.min(1, (o.rep + Math.min(1, o.since / 3)) / o.it.reps);
  const blocks = tempoBlocks(o.it.tempo, o.it);
  const k = blockOf(o.phase, o.lastMove);
  if (!k) return o.phase === '끝' ? 1 : Math.min(1, o.rep / o.it.reps);
  const cycle = blocks.reduce((a, b) => a + b.s, 0) + 0.3;
  const i = blocks.findIndex((b) => b.k === k);
  if (i < 0) return Math.min(1, o.rep / o.it.reps);
  const upAt = blocks.findIndex((b) => b.k === 'up');
  const done = o.rep - (i > upAt ? 1 : 0);
  const into = blocks.slice(0, i).reduce((a, b) => a + b.s, 0) + Math.min(o.since, blocks[i].s);
  return Math.max(0, Math.min(1, (done + into / cycle) / o.it.reps));
}
