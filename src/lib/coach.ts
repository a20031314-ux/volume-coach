import { addDays, diffDays, iso, parse } from './dates';
import { BIG_MUSCLES, HALF_LIFE, HEAVY, MUSCLES, MUSCLE_NAME, library, type Exercise } from './exercises';
import { recoveryMultiplier } from './profile';
import type { Checkin, MuscleKey, Run, Settings, WorkoutLog } from './types';

export interface CoachInput {
  settings: Settings;
  logs: WorkoutLog[];
  checkins: Record<string, Checkin>;
  runs?: Run[];
  now?: Date;
}

/** Fatigue a running km leaves on the legs, in set-equivalents. */
export const RUN_FATIGUE_PER_KM: Partial<Record<MuscleKey, number>> = { quad: 0.6, ham: 0.5, calf: 0.8 };
/** Systemic load of one running km, in set-equivalents. */
export const RUN_SYSTEMIC_PER_KM = 1;

export type Mode = 'go' | 'light' | 'rest';
export type StatusTone = 'ok' | 'warn' | 'bad' | 'rest' | 'accent';

export interface MuscleStat {
  k: MuscleKey; n: string;
  before: number; todayS: number; done: number;
  last: string | null; mode: Mode; nextOK: string | null; opp: number;
  deficit: number; target: number; remaining: number;
  names: string[]; status: { label: string; tone: StatusTone };
  recPre: number; recNow: number; sore: boolean; urgency: number;
}

export interface Readiness {
  factor: number; why: string[]; ratio: number; cap: number; hasCheckin: boolean; sore: MuscleKey[];
}

export interface CoachResult {
  T: string; W: string; E: string; daysLeft: number;
  min: number; max: number;
  stats: MuscleStat[]; readiness: Readiness;
}

const H = 36e5;

export function volumeRange(s: Settings) {
  return s.deload ? { min: Math.round(s.min / 2), max: Math.round(s.max / 2) } : { min: s.min, max: s.max };
}

function liveLogs(logs: WorkoutLog[]) {
  return logs.filter((l) => !l.deleted);
}

/** Time a set counts from: the logged timestamp when it belongs to that day, else 6pm of the day. */
export function logTime(l: WorkoutLog): number {
  if (l.at && iso(new Date(l.at)) === l.date) return l.at;
  return parse(l.date).getTime() + 18 * H;
}

export function contribution(l: WorkoutLog, mk: MuscleKey, s: Settings, lib: Exercise[]): number {
  if (l.muscle === mk) return l.sets;
  const sec = lib.find((e) => e.n === l.exercise)?.s ?? [];
  return sec.includes(mk) ? l.sets * s.sec : 0;
}

/**
 * Recovery % for a muscle at time `when`.
 * Each set leaves fatigue (primary 1, secondary × sec, heavy compound × 1.3) that halves every
 * HALF_LIFE × age multiplier hours. 10 fatigue units = 0 %.
 */
export function recoveryAt(mk: MuscleKey, when: number, input: CoachInput, beforeDate?: string): number {
  const { settings: s } = input;
  const lib = library(s.customExercises);
  const half = HALF_LIFE[mk] * recoveryMultiplier(s.profile);
  let F = 0;
  for (const l of liveLogs(input.logs)) {
    if (beforeDate && l.date >= beforeDate) continue;
    const c = contribution(l, mk, s, lib);
    if (!c) continue;
    const h = (when - logTime(l)) / H;
    if (h < 0 || h > 336) continue;
    F += c * (HEAVY.has(l.exercise) ? 1.3 : 1) * Math.pow(0.5, h / half);
  }
  const perKm = RUN_FATIGUE_PER_KM[mk];
  if (perKm) {
    for (const r of input.runs ?? []) {
      if (r.deleted || (beforeDate && r.date >= beforeDate)) continue;
      const h = (when - r.endedAt) / H;
      if (h < 0 || h > 336) continue;
      F += (r.distanceM / 1000) * perKm * Math.pow(0.5, h / half);
    }
  }
  return Math.max(0, Math.min(100, Math.round(100 - F * 10)));
}

export function readiness(input: CoachInput, T: string): Readiness {
  const { settings: s } = input;
  const now = (input.now ?? new Date()).getTime();
  const ci = input.checkins[T];
  let S = 0;
  for (const l of liveLogs(input.logs)) {
    if (l.date >= T) continue;
    const h = (now - logTime(l)) / H;
    if (h < 0 || h > 336) continue;
    S += l.sets * (HEAVY.has(l.exercise) ? 1.5 : 1) * Math.pow(0.5, h / 48);
  }
  for (const r of input.runs ?? []) {
    if (r.deleted || r.date >= T) continue;
    const h = (now - r.endedAt) / H;
    if (h < 0 || h > 336) continue;
    S += (r.distanceM / 1000) * RUN_SYSTEMIC_PER_KM * Math.pow(0.5, h / 48);
  }
  const opt = s.checkin ?? { sleep: true, energy: true, sore: true, systemic: true };
  const ratio = opt.systemic ? S / Math.max(1, s.cap) : 0;
  const sleep = opt.sleep ? ci?.sleep : null;
  const energy = opt.energy ? ci?.energy : null;
  let f = 1;
  const why: string[] = [];
  if (sleep === 0) { f -= 0.15; why.push('수면 부족'); }
  if (energy === 0) { f -= 0.15; why.push('컨디션 처짐'); }
  // a bonus only when every enabled signal is at its best
  if ((sleep === 2 || !opt.sleep) && (energy === 2 || !opt.energy) && (opt.sleep || opt.energy)) f += 0.05;
  if (ratio > 1.3) { f -= 0.15; why.push('최근 전신 피로 높음'); }
  else if (ratio > 1) { f -= 0.05; why.push('전신 피로 약간 높음'); }
  f = Math.max(0.5, Math.min(1.05, f));
  return {
    factor: f, why, ratio, cap: Math.round(s.cap * f),
    hasCheckin: sleep != null || energy != null, sore: opt.sore ? ci?.sore ?? [] : [],
  };
}

export function compute(input: CoachInput): CoachResult {
  const s = input.settings;
  const nowD = input.now ?? new Date();
  const now = nowD.getTime();
  const T = iso(nowD);
  const { min, max } = volumeRange(s);
  const W = addDays(T, -((parse(T).getDay() - s.weekStart + 7) % 7));
  const E = addDays(W, 6);
  const daysLeft = diffDays(E, T) + 1;
  const step = s.gap + 1;
  const rd = readiness(input, T);
  const lib = library(s.customExercises);
  const logs = liveLogs(input.logs);
  const stats: MuscleStat[] = [];

  for (const m of MUSCLES.filter((x) => !s.off.includes(x.k))) {
    let before = 0, todayS = 0;
    let last: string | null = null;
    const names = new Set<string>();
    for (const l of logs) {
      const c = contribution(l, m.k, s, lib);
      if (l.muscle === m.k && l.date < T && (!last || l.date > last)) last = l.date;
      if (l.date < W || l.date > E || !c) continue;
      if (l.date < T) before += c;
      else if (l.date === T) todayS += c;
      if (l.muscle === m.k && l.date <= T) names.add(l.exercise);
    }
    const sore = rd.sore.includes(m.k);
    const sorePen = sore ? 25 : 0;
    const recPre = Math.max(0, recoveryAt(m.k, now, input, T) - sorePen);
    const recNow = Math.max(0, recoveryAt(m.k, now, input) - sorePen);
    const gapOK = !last || diffDays(T, last) >= step;
    const deficit = Math.max(0, min - before);

    let nextOK: string | null = null;
    for (let i = 0; i <= 7; i++) {
      const d = addDays(T, i);
      const t = i === 0 ? now : parse(d).getTime() + 9 * H;
      const ok = (!last || diffDays(d, last) >= step) && recoveryAt(m.k, t, input, T) - (i === 0 ? sorePen : 0) >= s.ready;
      if (ok) { nextOK = d; break; }
    }
    const fullOK = gapOK && recPre >= s.ready;
    const oppFrom = (d: string | null) => (d && d <= E ? Math.floor(diffDays(E, d) / step) + 1 : 0);
    const oppLater = oppFrom(nextOK && nextOK > T ? nextOK : addDays(T, step));
    const urgent = deficit > 0 && (oppLater === 0 || deficit / (oppLater + 1) > s.mcap * 0.6);
    const lightOK = !fullOK && gapOK && recPre >= s.ready - 20 && urgent;
    const mode: Mode = todayS > 0 || fullOK ? 'go' : lightOK ? 'light' : 'rest';
    const opp = mode === 'rest' ? oppFrom(nextOK) : oppFrom(T);

    let target = 0;
    if (mode !== 'rest' && deficit > 0) {
      target = Math.ceil(deficit / Math.max(1, opp));
      target = Math.max(target, Math.min(4, deficit));
      target = Math.min(target, s.mcap, max - before);
      if (mode === 'light') target = Math.max(2, Math.ceil(target / 2));
      if (rd.factor < 1) target = Math.max(2, Math.round(target * Math.max(rd.factor, 0.7)));
    }
    const done = before + todayS;
    const remaining = Math.max(0, Math.ceil(target - todayS));

    let status: MuscleStat['status'];
    if (done > max) status = { label: '초과', tone: 'warn' };
    else if (done >= min) status = { label: '범위 내', tone: 'ok' };
    else if (mode === 'rest') status = { label: nextOK && nextOK <= E ? `회복 중` : '회복 중', tone: 'rest' };
    else if (mode === 'light') status = { label: '가볍게', tone: 'warn' };
    else if (opp * s.mcap < deficit) status = { label: '미달 위험', tone: 'bad' };
    else status = { label: '부족', tone: 'accent' };

    stats.push({
      k: m.k, n: MUSCLE_NAME[m.k], before, todayS, done, last, mode, nextOK, opp, deficit, target, remaining,
      names: [...names], status, recPre, recNow, sore, urgency: deficit / (opp || 0.5),
    });
  }
  return { T, W, E, daysLeft, min, max, stats, readiness: rd };
}

export interface Plan { plan: MuscleStat[]; later: MuscleStat[]; doneToday: MuscleStat[]; used: number }

export function buildPlan(c: CoachResult, logs: WorkoutLog[]): Plan {
  const w = (s: MuscleStat) => s.urgency * (BIG_MUSCLES.has(s.k) ? 1.15 : 1);
  const cand = c.stats
    .filter((s) => s.mode !== 'rest' && s.remaining > 0)
    .sort((a, b) => Number(a.mode === 'light') - Number(b.mode === 'light') || w(b) - w(a) || b.recPre - a.recPre);
  const plan: MuscleStat[] = [];
  const later: MuscleStat[] = [];
  let used = liveLogs(logs).filter((l) => l.date === c.T).reduce((x, l) => x + l.sets, 0);
  for (const s of cand) {
    if ((plan.length === 0 && used < c.readiness.cap) || used + s.remaining <= c.readiness.cap) {
      plan.push(s);
      used += s.remaining;
    } else later.push(s);
  }
  const order = (k: MuscleKey) => MUSCLES.findIndex((m) => m.k === k);
  plan.sort((a, b) => order(a.k) - order(b.k)); // big muscles first, while fresh
  const doneToday = c.stats.filter((s) => s.todayS > 0 && s.remaining === 0);
  return { plan, later, doneToday, used };
}

export interface Suggestion { name: string; sets: number; isNew: boolean; heavy: boolean; slot: number }

/** swaps: "muscle:slot" → how many times the user tapped 교체 */
export function suggestExercises(s: MuscleStat, c: CoachResult, settings: Settings, swaps: Record<string, number>): Suggestion[] {
  let pool = library(settings.customExercises).filter((e) => e.m === s.k).map((e) => e.n);
  const avoidHeavy = s.mode === 'light' || c.readiness.ratio > 1.3 || s.recPre < 85;
  if (avoidHeavy) pool = pool.filter((n) => !HEAVY.has(n)).concat(pool.filter((n) => HEAVY.has(n)));
  const needNew = Math.max(0, settings.minEx - s.names.length);
  const fresh = pool.filter((n) => !s.names.includes(n));
  const seen = pool.filter((n) => s.names.includes(n));
  const ordered = needNew > 0 ? fresh.concat(seen) : pool;
  let n = s.remaining <= 3 ? 1 : s.remaining <= 8 ? 2 : 3;
  n = Math.max(n, Math.min(needNew, s.remaining));
  n = Math.min(n, ordered.length);
  if (!n) return [];
  const picks: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const off = swaps[`${s.k}:${i}`] || 0;
    for (let j = 0; j < ordered.length; j++) {
      const cand = ordered[(i + off + j) % ordered.length];
      if (!used.has(cand)) { used.add(cand); picks.push(cand); break; }
    }
  }
  const base = Math.floor(s.remaining / picks.length);
  const extra = s.remaining % picks.length;
  return picks.map((name, i) => ({
    name, sets: base + (i < extra ? 1 : 0), isNew: !s.names.includes(name), heavy: HEAVY.has(name), slot: i,
  }));
}

/** Suggest a deload after 4 straight weeks near target volume, or 3 of the last 4 check-ins low. */
export function deloadHint(c: CoachResult, input: CoachInput): string | null {
  const s = input.settings;
  if (s.deload) return null;
  const logs = liveLogs(input.logs);
  const active = MUSCLES.filter((m) => !s.off.includes(m.k)).length;
  const target = active * s.min * 0.9;
  let streak = 0;
  for (let w = 1; w <= 4; w++) {
    const st = addDays(c.W, -7 * w);
    const en = addDays(st, 6);
    const tot = logs.filter((l) => l.date >= st && l.date <= en).reduce((a, l) => a + l.sets, 0);
    if (tot >= target) streak++; else break;
  }
  const recent = Object.values(input.checkins).filter((x) => !x.deleted && x.date <= c.T)
    .sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-4);
  const ck = s.checkin ?? { sleep: true, energy: true };
  const low = recent.filter((x) => (ck.sleep && x.sleep === 0) || (ck.energy && x.energy === 0)).length;
  if (streak >= 4) return '4주 연속 목표 볼륨을 채웠어요. 이번 주는 설정에서 디로드를 켜는 걸 고려해 보세요.';
  if (recent.length >= 3 && low >= 3) return '최근 컨디션 체크가 계속 낮아요. 설정에서 디로드를 켜면 범위가 절반으로 줄어요.';
  return null;
}
