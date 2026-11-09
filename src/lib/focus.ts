/**
 * 목적 = 훈련 성향(다각형: 근비대 · 근력 · 체력 · 건강, 각 0~3) + 체중 방향(감량 / 유지 / 증량, 하나).
 *
 * 다각형의 "꽉"(모든 축 3)은 주간 운동 시간으로 정한다. 축은 따로가 아니라서(중간 무게 세트는 근비대와
 * 근력에 같이, 근력운동은 건강에도 쌓임) 실제 운동 4가지(`EFFECT`)로 모든 축 목표를 채우는 가장 짧은 시간을 구한다.
 * 운동 일정(주 N일 × 1회 분)이 쓸 수 있는 양, 넘치면 비율대로 줄인다.
 *
 * 1단계: 계산(볼륨·반복·휴식·템포)은 아직 가장 높은 축 하나로 — `legacyGoal`이 예전 목적 값을 만든다.
 */
import type { Goal, Profile } from './types';

export type FocusKey = 'hyp' | 'str' | 'fit' | 'health';
export type Level = 0 | 1 | 2 | 3;
export type Focus = Record<FocusKey, Level>;
export type WeightDir = 'cut' | 'keep' | 'gain';

export const FOCUS_KEYS: FocusKey[] = ['hyp', 'str', 'fit', 'health'];
export const FOCUS_NAME: Record<FocusKey, string> = { hyp: '근비대', str: '근력', fit: '체력', health: '건강' };
export const DIR_NAME: Record<WeightDir, string> = { cut: '감량', keep: '유지', gain: '증량' };
export const NO_FOCUS: Focus = { hyp: 0, str: 0, fit: 0, health: 0 };

/**
 * 축별 목표 = 그 효과를 얻는 데 필요한 "효과 시간"(분/주). 3 = 그 성향을 제대로 챙기는 양(대회 준비 수준은 아님).
 */
export const LEVEL_MIN: Record<FocusKey, [number, number, number, number]> = {
  hyp: [0, 60, 120, 180],
  str: [0, 30, 60, 90],
  fit: [0, 30, 60, 90],
  health: [0, 15, 30, 45],
};
export const LEVEL_NOTE: Record<FocusKey, [string, string, string]> = {
  hyp: ['부위당 주 6세트', '부위당 주 10세트', '부위당 주 14세트+'],
  str: ['주요 리프트 무겁게 주 1회', '주 2회', '주 3회'],
  fit: ['유산소·인터벌 주 1회', '주 2회', '주 3회 (회당 30분)'],
  health: ['가동성·코어 회당 5분', '회당 10분', '회당 15분 + 쉬운 종목 위주'],
};
export const DEFAULT_SESSION_MIN = 60;

/* ---------- 축은 따로가 아니다: 실제로 하는 운동 4가지가 여러 축에 같이 쌓인다 ---------- */

export type WorkKey = 'mod' | 'heavy' | 'cardio' | 'mobility';
export const WORK_NAME: Record<WorkKey, string> = { mod: '중간 무게 (6~12회)', heavy: '무거운 세트 (1~5회)', cardio: '유산소·인터벌', mobility: '가동성·코어' };

/**
 * 1분 했을 때 각 축에 쌓이는 효과(추정치). 중간 무게 세트는 근비대에 1, 근력에 0.5;
 * 무거운 세트는 근력 1, 근비대 0.6; 근력운동·유산소는 건강에도 쌓인다.
 */
export const EFFECT: Record<WorkKey, Record<FocusKey, number>> = {
  mod: { hyp: 1, str: 0.5, fit: 0, health: 0.3 },
  heavy: { hyp: 0.6, str: 1, fit: 0, health: 0.3 },
  cardio: { hyp: 0, str: 0, fit: 1, health: 0.5 },
  mobility: { hyp: 0, str: 0, fit: 0, health: 1 },
};
/** 그래도 각 축은 제 운동이 있어야 한다: 근비대의 절반은 중간 무게, 근력의 절반은 무거운 세트, 체력은 전부 유산소, 건강의 1/3은 가동성 */
const SPECIFIC = { hyp: 0.5, str: 0.5, fit: 1, health: 1 / 3 };
const OWN: Record<FocusKey, WorkKey> = { hyp: 'mod', str: 'heavy', fit: 'cardio', health: 'mobility' };

export interface WorkPlan {
  /** minutes a week of each kind of work */
  work: Record<WorkKey, number>;
  total: number;
  /** if each axis were trained on its own */
  naive: number;
  /** effect each axis gets (minutes-equivalent), including what carries over */
  effect: Record<FocusKey, number>;
  /** 1 = fits the schedule; < 1 = everything scaled down to fit */
  scale: number;
}

const tgt = (f: Focus, k: FocusKey) => LEVEL_MIN[k][f[k]];

/** the least total time that reaches every axis' target (small LP, solved by its corners) */
export function planWork(f: Focus, budget: number | null = null): WorkPlan {
  const Th = tgt(f, 'hyp'), Ts = tgt(f, 'str'), Tf = tgt(f, 'fit'), Tg = tgt(f, 'health');
  const m0 = Th * SPECIFIC.hyp, h0 = Ts * SPECIFIC.str;
  const ok = (m: number, h: number) => m >= m0 - 1e-6 && h >= h0 - 1e-6 && m + EFFECT.heavy.hyp * h >= Th - 1e-6 && h + EFFECT.mod.str * m >= Ts - 1e-6;
  const cands: [number, number][] = [];
  { const m = Math.max(m0, Th - EFFECT.heavy.hyp * h0); cands.push([m, Math.max(h0, Ts - EFFECT.mod.str * m)]); }
  { const h = Math.max(h0, Ts - EFFECT.mod.str * m0); cands.push([Math.max(m0, Th - EFFECT.heavy.hyp * h), h]); }
  { const m = (Th - EFFECT.heavy.hyp * Ts) / (1 - EFFECT.heavy.hyp * EFFECT.mod.str); cands.push([m, Ts - EFFECT.mod.str * m]); }
  const [m, h] = cands.filter(([a, b]) => ok(a, b)).sort((a, b) => a[0] + a[1] - (b[0] + b[1]))[0] ?? [Math.max(m0, Th), Math.max(h0, Ts)];
  const c = Tf * SPECIFIC.fit;
  const g = Tg ? Math.max(Tg * SPECIFIC.health, Tg - EFFECT.mod.health * m - EFFECT.heavy.health * h - EFFECT.cardio.health * c) : 0;
  const work = { mod: m, heavy: h, cardio: c, mobility: g };
  const total = m + h + c + g;
  const scale = budget && total > budget ? budget / total : 1;
  const effect = {} as Record<FocusKey, number>;
  // what carries over from other work only goes so far (근비대 운동만으로는 근력 1.5단계까지)
  for (const k of FOCUS_KEYS) {
    const own = work[OWN[k]] * EFFECT[OWN[k]][k];
    const carry = (Object.keys(work) as WorkKey[]).filter((w) => w !== OWN[k]).reduce((a, w) => a + work[w] * EFFECT[w][k], 0);
    effect[k] = (own + Math.min(carry, (1 - SPECIFIC[k]) * LEVEL_MIN[k][3])) * scale;
  }
  const r = (x: number) => Math.round(x);
  return {
    work: { mod: r(m * scale), heavy: r(h * scale), cardio: r(c * scale), mobility: r(g * scale) },
    total: r(total), naive: Th + Ts + Tf + Tg, effect, scale,
  };
}

/** an axis' effect on the 0~3 scale (can go past 3 when it carries over a lot) */
export const effectLevel = (k: FocusKey, minutes: number) => (3 * minutes) / LEVEL_MIN[k][3];

/** every axis at 3, with the overlap counted once — the "꽉 찬" polygon */
export const FULL_MIN = planWork({ hyp: 3, str: 3, fit: 3, health: 3 }).total;
export const budgetMin = (p: Pick<Profile, 'days' | 'sessionMin'>) => (p.days ? p.days * (p.sessionMin ?? DEFAULT_SESSION_MIN) : null);

/** the axis that leads (ties: 근비대 > 근력 > 체력 > 건강) */
export function primary(f: Focus): FocusKey | null {
  let best: FocusKey | null = null;
  for (const k of FOCUS_KEYS) if (f[k] > 0 && (!best || f[k] > f[best])) best = k;
  return best;
}

/** the single goal the rest of the app still reads (stage 1) */
export function legacyGoal(f: Focus, dir: WeightDir | null | undefined): Goal | '' {
  if (dir === 'cut') return 'cut';
  const p = primary(f);
  return p === 'hyp' ? 'hyp' : p === 'str' ? 'str' : p ? 'fit' : '';
}

/** profiles saved before the 다각형: read their single goal as a shape */
export function focusOf(p: Pick<Profile, 'focus' | 'goal'>): Focus {
  if (p.focus) return { ...NO_FOCUS, ...p.focus };
  switch (p.goal) {
    case 'hyp': return { hyp: 3, str: 0, fit: 0, health: 0 };
    case 'str': return { hyp: 1, str: 3, fit: 0, health: 0 };
    case 'cut': return { hyp: 2, str: 0, fit: 1, health: 0 };
    case 'fit': return { hyp: 1, str: 0, fit: 2, health: 2 };
    default: return { ...NO_FOCUS };
  }
}
export function dirOf(p: Pick<Profile, 'weightDir' | 'goal'>): WeightDir | null {
  if (p.weightDir) return p.weightDir;
  return p.goal === 'cut' ? 'cut' : p.goal === 'hyp' || p.goal === 'str' ? 'gain' : p.goal === 'fit' ? 'keep' : null;
}

/** "근비대 중심 · 근력 · 체중 유지" */
export function focusLabel(p: Pick<Profile, 'focus' | 'goal' | 'weightDir'>): string {
  const f = focusOf(p);
  const top = primary(f);
  if (!top) return '목적 미입력';
  const others = FOCUS_KEYS.filter((k) => k !== top && f[k] > 0).sort((a, b) => f[b] - f[a]).map((k) => FOCUS_NAME[k]);
  const dir = dirOf(p);
  return [`${FOCUS_NAME[top]}${others.length ? ' 중심' : ''}`, ...others, dir ? `체중 ${DIR_NAME[dir]}` : null].filter(Boolean).join(' · ');
}

/** kcal vs maintenance, and its label */
export function energyAdjust(dir: WeightDir, f: Focus, tdee: number): { adj: number; label: string } {
  if (dir === 'cut') { const by = Math.round(Math.min(500, tdee * 0.2)); return { adj: -by, label: `감량 · 유지보다 −${by}kcal` }; }
  if (dir === 'gain') { const by = primary(f) === 'str' ? 150 : 250; return { adj: by, label: `증량 · 유지보다 +${by}kcal` }; }
  return { adj: 0, label: '유지 칼로리' };
}
