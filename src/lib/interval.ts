/** Interval plans, live speed, and voice-coach cues for runs. Pure functions. */
import { haversine, type GpsPoint } from './run';

export interface IntervalPlan {
  warmupS: number;
  workS: number;
  restS: number;
  repeats: number;
  cooldownS: number;
  /** target pace for work phases, sec/km */
  targetPaceS?: number | null;
}

export type PhaseKind = 'warmup' | 'work' | 'rest' | 'cooldown';
export interface Phase { kind: PhaseKind; startS: number; endS: number; rep: number }

export const PHASE_NAME: Record<PhaseKind, string> = { warmup: '워밍업', work: '달리기', rest: '회복', cooldown: '쿨다운' };

export function buildPhases(p: IntervalPlan): Phase[] {
  const out: Phase[] = [];
  let t = 0;
  const push = (kind: PhaseKind, d: number, rep: number) => {
    if (d > 0) { out.push({ kind, startS: t, endS: t + d, rep }); t += d; }
  };
  push('warmup', p.warmupS, 0);
  for (let r = 1; r <= Math.max(0, p.repeats); r++) {
    push('work', p.workS, r);
    if (r < p.repeats) push('rest', p.restS, r);
  }
  push('cooldown', p.cooldownS, 0);
  return out;
}

export const planTotalS = (phases: Phase[]) => phases[phases.length - 1]?.endS ?? 0;

export interface PhasePosition { index: number; phase: Phase | null; elapsedS: number; remainingS: number; done: boolean }

export function phaseAt(phases: Phase[], movingS: number): PhasePosition {
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    if (movingS < ph.endS) return { index: i, phase: ph, elapsedS: movingS - ph.startS, remainingS: ph.endS - movingS, done: false };
  }
  return { index: phases.length, phase: null, elapsedS: 0, remainingS: 0, done: true };
}

/* ---------- speed ---------- */

/** One speed reading. `ms` = moving seconds since start, `v` = m/s. */
export interface SpeedSample { ms: number; v: number }

/** GPS Doppler speed when the chip reports it; otherwise null so the caller can fall back. */
export function dopplerSpeed(speed: number | null | undefined, speedAccuracy?: number | null): number | null {
  if (speed == null || speed < 0 || !Number.isFinite(speed)) return null;
  if (speedAccuracy != null && speedAccuracy > 1.5) return null;
  return speed > 12 ? null : speed;
}

/** Average speed over the last `windowS` moving seconds. */
export function smoothSpeed(samples: SpeedSample[], atS: number, windowS = 8): number | null {
  let sum = 0, n = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (atS - s.ms > windowS) break;
    sum += s.v; n++;
  }
  return n ? sum / n : null;
}

export const paceFromSpeed = (v: number | null) => (v && v > 0.5 ? 1000 / v : null);

/** Average into buckets for the saved timeline: [moving second, m/s]. */
export function bucketTimeline(samples: SpeedSample[], bucketS = 15): [number, number][] {
  const out: [number, number][] = [];
  let start = 0, sum = 0, n = 0;
  for (const s of samples) {
    while (s.ms >= start + bucketS) {
      if (n) out.push([start + bucketS / 2, Math.round((sum / n) * 100) / 100]);
      start += bucketS; sum = 0; n = 0;
    }
    sum += s.v; n++;
  }
  if (n) out.push([start + bucketS / 2, Math.round((sum / n) * 100) / 100]);
  return out;
}

export interface PhaseStat { kind: PhaseKind; rep: number; durS: number; distanceM: number; paceS: number | null }

/** Distance and pace per phase, from points that carry their moving second (`ms`). */
export function phaseStats(phases: Phase[], points: GpsPoint[]): PhaseStat[] {
  const dist = phases.map(() => 0);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a.seg !== b.seg || a.ms == null || b.ms == null) continue;
    const mid = (a.ms + b.ms) / 2;
    const idx = phases.findIndex((p) => mid >= p.startS && mid < p.endS);
    if (idx >= 0) dist[idx] += haversine(a, b);
  }
  return phases.map((p, i) => {
    const durS = p.endS - p.startS;
    return { kind: p.kind, rep: p.rep, durS, distanceM: Math.round(dist[i]), paceS: dist[i] > 30 ? durS / (dist[i] / 1000) : null };
  });
}

/* ---------- voice cues ---------- */

export interface CueState {
  phaseIdx: number;
  half: boolean;
  warned: boolean;
  km: number;
  minuteMark: number;
}
export const initialCues: CueState = { phaseIdx: -1, half: false, warned: false, km: 0, minuteMark: 0 };

export interface CueInput {
  phases: Phase[] | null;
  plan?: IntervalPlan | null;
  movingS: number;
  distanceM: number;
  paceNowS: number | null;
  avgPaceS: number | null;
  /** seconds the last completed km took */
  lastSplitS: number | null;
  /** pace of the phase that just ended */
  phasePace: (index: number) => number | null;
  kmAlert: boolean;
  everyMin: number;
}

/** Korean spoken pace, e.g. "5분 10초". */
export function spokenPace(s: number | null): string {
  if (s == null || !Number.isFinite(s) || s > 1800) return '측정 중';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (sec === 60) return `${m + 1}분`;
  return sec ? `${m}분 ${sec}초` : `${m}분`;
}
export const spokenDuration = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m && sec ? `${m}분 ${sec}초` : m ? `${m}분` : `${sec}초`;
};
const spokenKm = (m: number) => `${(Math.floor(m / 10) / 100).toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}킬로미터`;

/** Decide which cues are due now. Call it as often as you like; the returned state prevents repeats. */
export function dueCues(st: CueState, x: CueInput): { say: string[]; next: CueState } {
  const say: string[] = [];
  const next = { ...st };

  if (x.phases?.length) {
    const pos = phaseAt(x.phases, x.movingS);
    if (pos.index !== st.phaseIdx) {
      const prev = st.phaseIdx >= 0 ? x.phases[st.phaseIdx] : null;
      if (prev?.kind === 'work') say.push(`${prev.rep}번째 달리기 끝. 평균 페이스 ${spokenPace(x.phasePace(st.phaseIdx))}`);
      if (pos.done) say.push(`인터벌 완료. 총 ${spokenKm(x.distanceM)}. 계속 기록 중이에요`);
      else if (pos.phase) {
        const ph = pos.phase;
        const reps = x.phases.filter((p) => p.kind === 'work').length;
        const d = spokenDuration(ph.endS - ph.startS);
        if (ph.kind === 'work') say.push(`${ph.rep}번째 달리기 시작. ${reps}회 중 ${ph.rep}회, ${d}${x.plan?.targetPaceS ? `, 목표 ${spokenPace(x.plan.targetPaceS)}` : ''}`);
        else say.push(`${PHASE_NAME[ph.kind]} ${d}`);
      }
      next.phaseIdx = pos.index; next.half = false; next.warned = false;
    } else if (pos.phase) {
      const len = pos.phase.endS - pos.phase.startS;
      if (pos.phase.kind === 'work' && !st.half && pos.elapsedS >= len / 2 && len >= 40) {
        next.half = true;
        let line = `절반. 현재 페이스 ${spokenPace(x.paceNowS)}`;
        const target = x.plan?.targetPaceS;
        if (target && x.paceNowS) {
          const diff = Math.round(x.paceNowS - target);
          line += Math.abs(diff) <= 3 ? ', 목표대로예요' : diff > 0 ? `, 목표보다 ${diff}초 느려요` : `, 목표보다 ${-diff}초 빨라요`;
        }
        say.push(line);
      }
      if (!st.warned && len >= 90 && pos.remainingS <= 10) {
        next.warned = true;
        const after = x.phases[pos.index + 1];
        say.push(after ? `10초 후 ${PHASE_NAME[after.kind]}` : '10초 남았어요');
      }
    }
  }

  if (x.kmAlert) {
    const km = Math.floor(x.distanceM / 1000);
    if (km > st.km) {
      next.km = km;
      say.push(`${km}킬로미터. 구간 ${spokenPace(x.lastSplitS)}, 평균 ${spokenPace(x.avgPaceS)}`);
    }
  }
  if (x.everyMin > 0) {
    const mark = Math.floor(x.movingS / (x.everyMin * 60));
    if (mark > st.minuteMark) {
      next.minuteMark = mark;
      say.push(`${mark * x.everyMin}분. ${spokenKm(x.distanceM)}, 현재 페이스 ${spokenPace(x.paceNowS)}`);
    }
  }
  return { say, next };
}
