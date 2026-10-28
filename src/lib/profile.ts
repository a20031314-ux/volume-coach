import { HEAVY } from './exercises';
import type { BodyComp, Profile, Settings } from './types';

/** Fatigue half-life multiplier: older lifters recover more slowly; women slightly faster between sessions. */
export function recoveryMultiplier(p: Profile): number {
  const a = Number(p.age) || 0;
  let m = 1;
  if (a >= 60) m = 1.45;
  else if (a >= 50) m = 1.3;
  else if (a >= 40) m = 1.15;
  else if (a >= 31) m = 1.05;
  if (p.sex === 'f') m *= 0.9;
  return m;
}

export interface VolumeRec { min: number; max: number; cap: number; mcap: number; minEx: number }

export function recommendedVolume(p: Profile): { rec: VolumeRec; why: string[] } {
  const y = p.years === '' || p.years == null ? null : Number(p.years);
  const a = Number(p.age) || 0;
  let r: VolumeRec =
    y === 0 ? { min: 8, max: 12, cap: 18, mcap: 8, minEx: 2 }
    : y === 1 ? { min: 10, max: 16, cap: 22, mcap: 9, minEx: 2 }
    : y === 3 ? { min: 12, max: 20, cap: 26, mcap: 10, minEx: 2 }
    : { min: 10, max: 16, cap: 22, mcap: 9, minEx: 2 };
  const why: string[] = [];
  if (p.goal === 'str') { r.min -= 2; r.max -= 4; r.cap = Math.round(r.cap * 0.85); why.push('근력 목표: 무거운 세트 위주라 볼륨은 낮게'); }
  if (p.goal === 'cut') { r.min -= 2; r.max -= 2; r.cap = Math.round(r.cap * 0.9); why.push('감량 중: 회복 여력이 줄어 볼륨을 조금 낮게'); }
  if (p.goal === 'fit') { r = { min: 6, max: 10, cap: 16, mcap: 6, minEx: 2 }; why.push('건강·체력 목표: 주 6~10세트로도 충분'); }
  if (a >= 50) { r.min -= 2; r.max -= 3; r.cap -= 4; why.push('50대 이상: 볼륨을 낮추고 회복을 길게'); }
  else if (a >= 40) { r.max -= 2; r.cap -= 2; why.push('40대: 최대 볼륨을 조금 낮게'); }
  r.min = Math.max(4, r.min);
  r.max = Math.max(r.min + 2, r.max);
  r.mcap = Math.min(r.mcap, r.max);
  return { rec: r, why };
}

export function latestBodyComp(list: BodyComp[]): BodyComp | undefined {
  return list.filter((b) => !b.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt))[0];
}

/** Typical InBody ratio of skeletal muscle mass to fat-free mass. */
export const SMM_TO_FFM = 0.56;

export interface Body {
  weight: number; height: number; bmi: number;
  /** fat-free mass, kg; null when no body-composition data */
  ffm: number | null;
  ffmSource: 'fat' | 'smm' | null;
  fatPct: number | null;
  smm: number | null;
}

export function body(p: Profile, comps: BodyComp[] = []): Body | null {
  const latest = latestBodyComp(comps);
  const weight = latest?.weight || Number(p.weight) || 0;
  const height = Number(p.height) || 0;
  if (!weight || !height) return null;
  const bmi = weight / Math.pow(height / 100, 2);
  const fatPct = latest?.fatPct ?? null;
  const smm = latest?.smm ?? null;
  let ffm: number | null = null;
  let ffmSource: Body['ffmSource'] = null;
  if (fatPct != null && fatPct > 0 && fatPct < 70) { ffm = weight * (1 - fatPct / 100); ffmSource = 'fat'; }
  else if (smm) { ffm = Math.min(weight, smm / SMM_TO_FFM); ffmSource = 'smm'; }
  return { weight, height, bmi, ffm, ffmSource, fatPct, smm };
}

export interface ProteinTarget { lo: number; hi: number; mid: number; basis: string }

export function proteinTarget(p: Profile, b: Body): ProteinTarget {
  const cut = p.goal === 'cut';
  if (b.ffm) {
    const lo = Math.round(b.ffm * (cut ? 2.3 : 2.0));
    const hi = Math.round(b.ffm * (cut ? 2.8 : 2.5));
    return { lo, hi, mid: Math.round((lo + hi) / 2), basis: `제지방량 ${b.ffm.toFixed(1)}kg × ${cut ? '2.3~2.8' : '2.0~2.5'}g` };
  }
  // high BMI: use a BMI-22 reference weight so the target isn't inflated by fat mass
  const ref = b.bmi >= 30 ? 22 * Math.pow(b.height / 100, 2) : b.weight;
  const lo = Math.round(ref * (cut ? 2.0 : 1.6));
  const hi = Math.round(ref * 2.2);
  return {
    lo, hi, mid: Math.round((lo + hi) / 2),
    basis: b.bmi >= 30 ? `표준 체중 ${ref.toFixed(0)}kg × ${cut ? '2.0' : '1.6'}~2.2g` : `체중 ${b.weight}kg × ${cut ? '2.0' : '1.6'}~2.2g`,
  };
}

export function repRange(exercise: string, p: Profile): string {
  const g = p.goal || 'hyp';
  const heavy = HEAVY.has(exercise);
  const old = (Number(p.age) || 0) >= 50;
  if (g === 'str') return old && heavy ? '5~8회 · 휴식 3분+' : heavy ? '3~6회 · 휴식 3분+' : '6~10회 · 휴식 2분';
  if (g === 'cut') return heavy ? '6~10회 · 휴식 2분' : '12~20회 · 휴식 60초';
  if (g === 'fit') return heavy ? '8~12회 · 휴식 2분' : '12~15회 · 휴식 60초';
  return heavy ? '6~10회 · 휴식 2~3분' : '10~15회 · 휴식 90초';
}

export function applyVolumeRec(s: Settings, r: VolumeRec): Settings {
  return { ...s, ...r };
}
