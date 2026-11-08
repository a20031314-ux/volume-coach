/**
 * 페이스메이커: a virtual runner to race. Either designed by the user (거리 + 목표 기록 + 구간 전략)
 * or one of their past runs (지난 기록 — the way it actually went, speed-ups and slow-downs included).
 * Both become a distance-over-time curve; the gap is read from cumulative distance, not instant pace.
 */
import { haversine } from './run';
import type { Run } from './types';

export type PacerStrategy = 'even' | 'negative' | 'easyStart';

export const STRATEGY_NAME: Record<PacerStrategy, string> = { even: '균등', negative: '후반 빠르게', easyStart: '초반 여유' };
export const STRATEGY_NOTE: Record<PacerStrategy, string> = {
  even: '처음부터 끝까지 같은 페이스',
  negative: '전반은 조금 느리게, 후반에 당겨서 같은 기록 (네거티브 스플릿)',
  easyStart: '첫 구간은 몸 푸는 페이스, 나머지에서 만회',
};

/** what's saved in settings */
export type PacerChoice =
  | { kind: 'plan'; distanceM: number; targetS: number; strategy: PacerStrategy }
  | { kind: 'ghost'; runId: string };

/** knots of [moving second, metres], increasing */
export type Curve = [number, number][];

/** what runs during a run (persisted with it) */
export interface Pacer {
  kind: 'plan' | 'ghost';
  /** "5km 25:00 · 균등" / "11월 5일 5.02km" */
  label: string;
  distanceM: number;
  /** the pacer's finish time */
  targetS: number;
  curve: Curve;
  /** per-km pace of the plan, s/km (for the screen) */
  legs?: { fromM: number; toM: number; paceS: number }[];
}

/** what's kept on the saved run */
export interface PacerResult {
  kind: 'plan' | 'ghost';
  label: string;
  distanceM: number;
  targetS: number;
  /** my time at the pacer's distance (null = stopped before it) */
  reachedS: number | null;
  /** ahead (+) / behind (−), seconds, at the end */
  gapS: number | null;
}

/* ---------- design ---------- */

/** legs of a designed pacer: pace per stretch so the total is exactly the target */
export function planLegs(distanceM: number, targetS: number, strategy: PacerStrategy): { fromM: number; toM: number; paceS: number }[] {
  const avg = targetS / (distanceM / 1000);
  if (strategy === 'negative') {
    const half = distanceM / 2;
    // ±2% around the average: equal distances, so the time still adds up
    return [{ fromM: 0, toM: half, paceS: avg * 1.02 }, { fromM: half, toM: distanceM, paceS: avg * 0.98 }];
  }
  if (strategy === 'easyStart') {
    const first = Math.min(1000, distanceM * 0.2);
    const slow = avg + 20;
    const restM = distanceM - first;
    const restS = targetS - slow * (first / 1000);
    if (restM <= 0 || restS <= 0) return [{ fromM: 0, toM: distanceM, paceS: avg }];
    return [{ fromM: 0, toM: first, paceS: slow }, { fromM: first, toM: distanceM, paceS: restS / (restM / 1000) }];
  }
  return [{ fromM: 0, toM: distanceM, paceS: avg }];
}

const fmtT = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
export const fmtKmShort = (m: number) => `${Number((m / 1000).toFixed(m % 1000 ? 2 : 0)).toString()}km`;

export function planPacer(p: Extract<PacerChoice, { kind: 'plan' }>): Pacer {
  const legs = planLegs(p.distanceM, p.targetS, p.strategy);
  const curve: Curve = [[0, 0]];
  let t = 0;
  for (const l of legs) {
    t += l.paceS * ((l.toM - l.fromM) / 1000);
    curve.push([t, l.toM]);
  }
  return { kind: 'plan', label: `${fmtKmShort(p.distanceM)} ${fmtT(p.targetS)} · ${STRATEGY_NAME[p.strategy]}`, distanceM: p.distanceM, targetS: p.targetS, curve, legs };
}

/* ---------- a past run ---------- */

/** distance over time of a saved run, scaled so it ends at the run's recorded distance */
export function runCurve(r: Pick<Run, 'distanceM' | 'movingS' | 'route' | 'routeT' | 'timeline' | 'splits'>): Curve {
  let raw: Curve = [];
  if (r.routeT && r.route.length >= 2 && r.routeT.length === r.route.length) {
    raw = [[r.routeT[0], 0]];
    let d = 0;
    for (let i = 1; i < r.route.length; i++) {
      const a = r.route[i - 1], b = r.route[i];
      // a pause starts a new segment: no distance across it
      if (a[2] === b[2]) d += haversine({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
      const t = r.routeT[i];
      if (t > raw[raw.length - 1][0]) raw.push([t, d]);
    }
  } else if (r.timeline && r.timeline.length >= 2) {
    raw = [[0, 0]];
    let d = 0;
    for (let i = 1; i < r.timeline.length; i++) {
      const [t0, v0] = r.timeline[i - 1], [t1, v1] = r.timeline[i];
      d += ((v0 + v1) / 2) * (t1 - t0);
      raw.push([t1, d]);
    }
  } else if (r.splits.length) {
    raw = [[0, 0]];
    let t = 0;
    r.splits.forEach((s, i) => { t += s.seconds; raw.push([t, (i + 1) * 1000]); });
  }
  const last = raw[raw.length - 1];
  if (!last || last[1] <= 0) return [[0, 0], [r.movingS, r.distanceM]];
  const k = r.distanceM / last[1];
  const out: Curve = raw.map(([t, d]) => [t - raw[0][0], d * k]);
  if (out[out.length - 1][0] < r.movingS) out.push([r.movingS, r.distanceM]);
  return out;
}

export function ghostPacer(r: Run): Pacer {
  const d = new Date(r.startedAt);
  return {
    kind: 'ghost', label: `${d.getMonth() + 1}월 ${d.getDate()}일 ${fmtKmShort(r.distanceM)}`,
    distanceM: r.distanceM, targetS: r.movingS, curve: runCurve(r),
  };
}

/** runs worth racing: GPS runs of 1km+ with a speed record, newest first */
export function ghostCandidates(runs: Run[]): Run[] {
  return runs.filter((r) => (r.kind ?? 'run') === 'run' && !r.sprint && !r.manual && r.distanceM >= 1000 && r.movingS > 0)
    .sort((a, b) => b.startedAt - a.startedAt);
}

/** the fastest pace among runs about this long (±10%) — the 최고 기록 badge */
export function bestAround(runs: Run[], distanceM: number): Run | null {
  let best: Run | null = null;
  for (const r of ghostCandidates(runs)) {
    if (Math.abs(r.distanceM - distanceM) > distanceM * 0.1) continue;
    if (!best || r.movingS / r.distanceM < best.movingS / best.distanceM) best = r;
  }
  return best;
}

/* ---------- the race ---------- */

/** where the pacer is at moving second t (stays at the finish once there) */
export function pacerDistAt(c: Curve, t: number): number {
  if (t <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (t <= c[i][0]) {
      const [t0, d0] = c[i - 1], [t1, d1] = c[i];
      return d0 + ((d1 - d0) * (t - t0)) / (t1 - t0 || 1);
    }
  }
  return c[c.length - 1][1];
}

/** when the pacer passed distance d (past its finish: at its last pace) */
export function pacerTimeAt(c: Curve, d: number): number {
  if (d <= c[0][1]) return c[0][0];
  for (let i = 1; i < c.length; i++) {
    if (d <= c[i][1]) {
      const [t0, d0] = c[i - 1], [t1, d1] = c[i];
      return t0 + ((t1 - t0) * (d - d0)) / (d1 - d0 || 1);
    }
  }
  const [t0, d0] = c[Math.max(0, c.length - 2)], [t1, d1] = c[c.length - 1];
  const pace = (t1 - t0) / Math.max(1, d1 - d0);
  return t1 + (d - d1) * pace;
}

/** before this many metres GPS noise is bigger than the gap */
export const GAP_FROM_M = 100;

export interface Gap {
  /** me − pacer, m (+ = ahead) */
  m: number;
  /** seconds ahead (+) / behind (−) */
  s: number;
  pacerM: number;
  /** finish time if the gap holds (plan) */
  projectedS: number;
}

export function gapNow(p: Pick<Pacer, 'curve' | 'targetS'>, t: number, myM: number): Gap | null {
  const pacerM = pacerDistAt(p.curve, t);
  if (myM < GAP_FROM_M) return null;
  const s = pacerTimeAt(p.curve, myM) - t;
  return { m: myM - pacerM, s, pacerM, projectedS: p.targetS - s };
}

/* ---------- voice ---------- */

export interface PacerCueState { km: number; band: -1 | 0 | 1; nudgeAt: number; last500: boolean; reachedS: number | null }
export const initialPacerCues: PacerCueState = { km: 0, band: 0, nudgeAt: -999, last500: false, reachedS: null };

const secWord = (s: number) => {
  const a = Math.round(Math.abs(s));
  return a >= 60 ? `${Math.floor(a / 60)}분${a % 60 ? ` ${a % 60}초` : ''}` : `${a}초`;
};
const timeWord = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return [h ? `${h}시간` : '', m ? `${m}분` : '', sec ? `${sec}초` : ''].filter(Boolean).join(' ') || '0초';
};
const who = (p: Pick<Pacer, 'kind'>) => (p.kind === 'ghost' ? '지난 기록' : '페이스메이커');
const gapWord = (p: Pick<Pacer, 'kind'>, s: number) => (Math.abs(s) < 2 ? `${who(p)}와 나란히 가요` : `${who(p)}보다 ${secWord(s)} ${s > 0 ? '앞서요' : '뒤처져요'}`);

/** what to say now; call on every tick (the state stops repeats) */
export function pacerCues(st: PacerCueState, x: {
  pacer: Pick<Pacer, 'kind' | 'curve' | 'targetS' | 'distanceM'>; t: number; myM: number; lastSplitS: number | null;
  /** how far apart before saying so, s */
  tolS?: number;
}): { say: string[]; next: PacerCueState } {
  const say: string[] = [];
  const next = { ...st };
  const g = gapNow(x.pacer, x.t, x.myM);
  const tol = x.tolS ?? 10;
  // reaching the pacer's distance: the result, once
  if (st.reachedS == null && x.myM >= x.pacer.distanceM) {
    next.reachedS = x.t;
    const d = x.pacer.targetS - x.t;
    say.push(`${x.pacer.kind === 'ghost' ? '지난 기록 거리' : '목표 거리'} 도착. ${timeWord(x.t)}. ${Math.abs(d) < 2 ? '딱 맞췄어요' : `${secWord(d)} ${d > 0 ? '빨라요' : '늦었어요'}`}. 계속 기록 중이에요`);
    return { say, next };
  }
  if (st.reachedS != null || !g) return { say, next };
  const km = Math.floor(x.myM / 1000);
  if (km > st.km) {
    next.km = km;
    say.push(`${km}킬로${x.lastSplitS ? `, 구간 ${timeWord(x.lastSplitS)}` : ''}. ${gapWord(x.pacer, g.s)}`);
  }
  const left = x.pacer.distanceM - x.myM;
  if (!st.last500 && left <= 500 && x.pacer.distanceM >= 1500) {
    next.last500 = true;
    say.push(x.pacer.kind === 'plan'
      ? `남은 500미터. 목표까지 ${timeWord(Math.max(0, x.pacer.targetS - x.t))}`
      : `남은 500미터. ${gapWord(x.pacer, g.s)}`);
  }
  // falling behind / going out too fast: when it changes, at most once a minute
  const band: -1 | 0 | 1 = g.s <= -tol ? -1 : g.s >= tol * 1.5 ? 1 : 0;
  if (band !== st.band && x.t - st.nudgeAt >= 60 && !say.length) {
    next.band = band;
    next.nudgeAt = x.t;
    if (band === -1) say.push(`${secWord(g.s)} 뒤처졌어요. 조금 올려요`);
    else if (band === 1) say.push(x.pacer.kind === 'plan' ? `${secWord(g.s)} 앞서요. 너무 빨라요, 아껴두세요` : `${secWord(g.s)} 앞서요. 좋아요`);
    else if (st.band === -1) say.push('따라잡았어요');
  } else if (band === st.band) next.band = band;
  return { say, next };
}
