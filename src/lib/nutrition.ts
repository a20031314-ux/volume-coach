import { body, proteinTarget, type Body } from './profile';
import type { BodyComp, Food, Profile, WorkoutLog } from './types';

/** Approximate values per serving. */
export const FOODS: Food[] = ([
  ['닭가슴살 100g', 109, 23, 0, 1.5], ['계란 1개', 72, 6.3, 0.4, 4.8], ['흰쌀밥 1공기 (210g)', 315, 5.5, 69, 0.6],
  ['현미밥 1공기 (210g)', 315, 6.5, 66, 2.4], ['고구마 1개 (150g)', 130, 2.4, 30, 0.2], ['바나나 1개', 105, 1.3, 27, 0.4],
  ['오트밀 40g', 150, 5, 27, 2.8], ['단백질 보충제 1스쿱', 120, 24, 3, 1.5], ['그릭요거트 무가당 100g', 80, 9, 4, 3],
  ['우유 200ml', 130, 6.4, 9.6, 7.6], ['두부 반 모 (150g)', 120, 12, 3, 7], ['소고기 우둔 100g', 140, 22, 0, 5.5],
  ['돼지 안심 100g', 120, 22, 0, 3.5], ['연어 100g', 208, 20, 0, 13], ['참치캔 (기름 뺀 100g)', 120, 26, 0, 1.5],
  ['아몬드 20g', 115, 4, 4, 10], ['사과 1개', 95, 0.5, 25, 0.3], ['식빵 1장', 80, 2.7, 15, 1],
  ['김치찌개 1인분', 250, 15, 12, 15], ['삼겹살 100g', 330, 17, 0, 29],
] as [string, number, number, number, number][]).map(([n, k, p, c, f]) => ({ n, k, p, c, f }));

export interface NutritionTargets {
  kcal: number; p: number; c: number; f: number;
  tdee: number; bmr: number; bmrFormula: 'mifflin' | 'katch';
  trainingDay: boolean; proteinBasis: string; adjustLabel: string; body: Body;
}

const ACTIVITY = [1.4, 1.55, 1.7]; // includes ~5-6 training days a week

export function nutritionTargets(p: Profile, comps: BodyComp[], logs: WorkoutLog[], date: string): NutritionTargets | null {
  const b = body(p, comps);
  const age = Number(p.age) || 0;
  if (!b || !age) return null;
  let bmr: number;
  let bmrFormula: NutritionTargets['bmrFormula'];
  if (b.ffm) { bmr = 370 + 21.6 * b.ffm; bmrFormula = 'katch'; }
  else {
    const sexAdj = p.sex === 'm' ? 5 : p.sex === 'f' ? -161 : -78;
    bmr = 10 * b.weight + 6.25 * b.height - 5 * age + sexAdj;
    bmrFormula = 'mifflin';
  }
  const tdee = bmr * (ACTIVITY[Number(p.act ?? 1)] ?? 1.55);
  const g = p.goal || 'hyp';
  const cutBy = Math.round(Math.min(500, tdee * 0.2));
  const adj = g === 'cut' ? -cutBy : g === 'hyp' ? 250 : g === 'str' ? 150 : 0;
  const trainingDay = logs.some((l) => !l.deleted && l.date === date);
  const kcal = tdee + adj + (trainingDay ? 100 : -100);
  const prot = proteinTarget(p, b);
  const fatRef = b.ffm ?? (b.bmi >= 30 ? 22 * Math.pow(b.height / 100, 2) : b.weight);
  const fat = Math.round(Math.max(fatRef * 0.8, (kcal * 0.2) / 9));
  const carb = Math.max(0, Math.round((kcal - prot.mid * 4 - fat * 9) / 4));
  const adjustLabel = { hyp: '근비대 · 유지보다 +250kcal', str: '근력 · 유지보다 +150kcal', cut: `감량 · 유지보다 −${cutBy}kcal`, fit: '건강 · 유지 칼로리' }[g];
  return {
    kcal: Math.round(kcal), p: prot.mid, c: carb, f: fat, tdee: Math.round(tdee), bmr: Math.round(bmr), bmrFormula,
    trainingDay, proteinBasis: prot.basis, adjustLabel, body: b,
  };
}
