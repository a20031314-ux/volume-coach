/**
 * 목적 = 훈련 성향(다각형: 근비대 · 근력 · 체력 · 건강, 각 0~3) + 체중 방향(감량 / 유지 / 증량, 하나).
 *
 * 다각형의 "꽉"(모든 축 3)은 주간 운동 시간으로 정한다: 축마다 단계별로 주에 드는 시간이 있고,
 * 다 합친 게 원하는 양, 운동 일정(주 N일 × 1회 분)이 쓸 수 있는 양. 넘치면 비율대로 줄인다.
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
 * 단계별 주간 시간(분)과 그게 뜻하는 것. 3 = 그 성향을 제대로 챙기는 양(대회 준비 수준은 아님).
 * 모든 축 3 = 405분 ≈ 주 6일 × 70분 → 이게 다각형이 "꽉 찬" 기준.
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
export const FULL_MIN = FOCUS_KEYS.reduce((a, k) => a + LEVEL_MIN[k][3], 0);
export const DEFAULT_SESSION_MIN = 60;

export const demandMin = (f: Focus) => FOCUS_KEYS.reduce((a, k) => a + LEVEL_MIN[k][f[k]], 0);
export const budgetMin = (p: Pick<Profile, 'days' | 'sessionMin'>) => (p.days ? p.days * (p.sessionMin ?? DEFAULT_SESSION_MIN) : null);

/** minutes per axis that fit the schedule (scaled down evenly when the wish is bigger) */
export function allotMin(f: Focus, budget: number | null): Record<FocusKey, number> & { scale: number } {
  const want = demandMin(f);
  const scale = budget && want > budget ? budget / want : 1;
  const out = { scale } as Record<FocusKey, number> & { scale: number };
  for (const k of FOCUS_KEYS) out[k] = Math.round(LEVEL_MIN[k][f[k]] * scale);
  return out;
}

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
