import { energyAdjust, focusOf } from './focus';
import { body, proteinTarget, type Body } from './profile';
import type { BodyComp, Profile, WorkoutLog } from './types';

export { FOODS } from './foods';

export interface NutritionTargets {
  kcal: number; p: number; c: number; f: number;
  tdee: number; bmr: number; bmrFormula: 'measured' | 'mifflin' | 'katch';
  trainingDay: boolean; proteinBasis: string; adjustLabel: string; body: Body;
}

const ACTIVITY = [1.4, 1.55, 1.7]; // includes ~5-6 training days a week

export function nutritionTargets(p: Profile, comps: BodyComp[], logs: WorkoutLog[], date: string): NutritionTargets | null {
  const b = body(p, comps);
  const age = Number(p.age) || 0;
  // no defaults: without a chosen goal there is no target to aim at
  if (!b || !age || !p.goal) return null;
  let bmr: number;
  let bmrFormula: NutritionTargets['bmrFormula'];
  if (b.bmr && b.bmr > 800) { bmr = b.bmr; bmrFormula = 'measured'; }
  else if (b.ffm) { bmr = 370 + 21.6 * b.ffm; bmrFormula = 'katch'; }
  else {
    const sexAdj = p.sex === 'm' ? 5 : p.sex === 'f' ? -161 : -78;
    bmr = 10 * b.weight + 6.25 * b.height - 5 * age + sexAdj;
    bmrFormula = 'mifflin';
  }
  const tdee = bmr * (ACTIVITY[Number(p.act ?? 1)] ?? 1.55);
  const g = p.goal;
  const cutBy = Math.round(Math.min(500, tdee * 0.2));
  // 체중 방향 (separate from the training focus) decides the surplus / deficit
  const dir = p.weightDir ? energyAdjust(p.weightDir, focusOf(p), tdee) : null;
  const adj = dir ? dir.adj : g === 'cut' ? -cutBy : g === 'hyp' ? 250 : g === 'str' ? 150 : 0;
  const trainingDay = logs.some((l) => !l.deleted && l.date === date);
  const kcal = tdee + adj + (trainingDay ? 100 : -100);
  const prot = proteinTarget(p, b);
  const fatRef = b.ffm ?? (b.bmi >= 30 ? 22 * Math.pow(b.height / 100, 2) : b.weight);
  const fat = Math.round(Math.max(fatRef * 0.8, (kcal * 0.2) / 9));
  const carb = Math.max(0, Math.round((kcal - prot.mid * 4 - fat * 9) / 4));
  const adjustLabel = dir ? dir.label : { hyp: '근비대 · 유지보다 +250kcal', str: '근력 · 유지보다 +150kcal', cut: `감량 · 유지보다 −${cutBy}kcal`, fit: '건강 · 유지 칼로리' }[g];
  return {
    kcal: Math.round(kcal), p: prot.mid, c: carb, f: fat, tdee: Math.round(tdee), bmr: Math.round(bmr), bmrFormula,
    trainingDay, proteinBasis: prot.basis, adjustLabel, body: b,
  };
}
