/**
 * Food swaps: other foods that add up to about the same macros ("연어 200g ≈ 닭가슴살 175g + 올리브유 1.5큰술").
 * Plain arithmetic: match the main macro with one food, then top up what's missing with up to two
 * simple fillers (oil/nuts for fat, rice/sweet potato for carbs, eggs/protein for protein).
 */
import { FOOD_DB, macrosOf, type FoodDef, type FoodGroup, type Macros } from './foods';

type Macro = 'p' | 'c' | 'f';
const KCAL: Record<Macro, number> = { p: 4, c: 4, f: 9 };

export interface SwapPart { food: FoodDef; amt: number }
export interface Swap { parts: SwapPart[]; total: Macros; score: number }

/**
 * What the food is "for". Protein wins at a quarter of the calories — salmon is more fat than
 * protein by calories, but people eat it as a protein source.
 */
export function dominant(m: Macros): Macro {
  const kcal = m.p * 4 + m.c * 4 + m.f * 9;
  if (kcal > 0 && (m.p * 4) / kcal >= 0.25) return 'p';
  return m.c * 4 >= m.f * 9 ? 'c' : 'f';
}

const FILLERS: Record<Macro, string[]> = {
  f: ['올리브유', '아몬드', '땅콩버터', '호두', '아보카도'],
  c: ['흰쌀밥', '고구마', '바나나', '오트밀', '현미밥'],
  p: ['계란', '단백질 보충제', '닭가슴살', '그릭요거트 무가당'],
};
/** below this gap (g) a macro isn't worth another food */
const GAP: Record<Macro, number> = { p: 6, c: 10, f: 4 };
/** groups a replacement main can come from */
const MAIN_GROUPS: FoodGroup[] = ['protein', 'dairy', 'carb', 'fat', 'fruit', 'veg'];

const byName = (n: string) => FOOD_DB.find((d) => d.n === n)!;
const roundTo = (x: number, step: number) => Math.round(x / step) * step;
const add = (a: Macros, b: Macros): Macros => ({ k: a.k + b.k, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f });
const ZERO: Macros = { k: 0, p: 0, c: 0, f: 0 };

/** an amount someone would actually eat in one go */
export function sensible(d: FoodDef, amt: number): boolean {
  if (amt <= 0) return false;
  const grams = d.unit === 'g' || d.unit === 'ml' ? amt : d.gPer ? d.gPer * amt : null;
  if (grams != null && grams > 450) return false;
  if (d.unit === '큰술' && amt > 3) return false;
  if (d.unit === '개' && amt > 6) return false;
  if ((d.unit === '스쿱' || d.unit === '팩' || d.unit === '봉') && amt > 2) return false;
  return macrosOf(d, amt).k <= 1200;
}

function score(t: Macros, x: Macros): number {
  return Math.abs(x.k - t.k) / Math.max(t.k, 100)
    + Math.abs(x.p - t.p) / Math.max(t.p, 15)
    + 0.4 * (Math.abs(x.c - t.c) / Math.max(t.c, 30) + Math.abs(x.f - t.f) / Math.max(t.f, 10));
}

/** close enough to call it the same: ±12% kcal (or 40kcal), ±15% protein (or 4g) */
export function close(t: Macros, x: Macros): boolean {
  return Math.abs(x.k - t.k) <= Math.max(0.12 * t.k, 40) && Math.abs(x.p - t.p) <= Math.max(0.15 * t.p, 4);
}

/** Foods that could stand in as the main part for this target. */
export function mainOptions(target: Macros, opts: { group?: FoodGroup; exclude?: string[]; primary?: Macro } = {}): FoodDef[] {
  const primary = opts.primary ?? (opts.group === 'protein' ? 'p' : dominant(target));
  // rice swaps for other carbs, nuts for other fats; meat can also become dairy or tofu;
  // dishes and custom foods break down by their main macro
  const sameGroupOnly = opts.group != null && opts.group !== 'protein' && opts.group !== 'meal' && opts.group !== 'snack';
  return FOOD_DB.filter((d) => MAIN_GROUPS.includes(d.g) && !opts.exclude?.includes(d.n)
    && (sameGroupOnly ? d.g === opts.group : d.g !== 'veg' && d.g !== 'fruit' && dominant(d) === primary));
}

function build(target: Macros, main: FoodDef, primary: Macro, exclude: string[], prefer: string[] = []): Swap | null {
  const per = main[primary] / main.base;
  if (per <= 0) return null;
  const amt = roundTo(target[primary] / per, main.step);
  if (!sensible(main, amt)) return null;
  let parts: SwapPart[] = [{ food: main, amt }];
  let total = macrosOf(main, amt);
  const used = new Set([main.n, ...exclude]);
  // top up the remaining macros, biggest gap (in kcal) first
  const rest = (['p', 'c', 'f'] as Macro[]).filter((m) => m !== primary)
    .sort((a, b) => (target[b] - total[b]) * KCAL[b] - (target[a] - total[a]) * KCAL[a]);
  for (const m of rest) {
    if (target[m] - total[m] < GAP[m]) continue;
    let best: { part: SwapPart; total: Macros; s: number } | null = null;
    for (const n of FILLERS[m]) {
      if (used.has(n)) continue;
      const d = byName(n);
      const a = roundTo((target[m] - total[m]) / (d[m] / d.base), d.step);
      if (!sensible(d, a)) continue;
      const next = add(total, macrosOf(d, a));
      // a filler this person already eats wins a near-tie
      const s = score(target, next) - (prefer.includes(n) ? 0.03 : 0);
      if (!best || s < best.s) best = { part: { food: d, amt: a }, total: next, s };
    }
    if (best && best.s < score(target, total)) {
      parts = [...parts, best.part];
      total = best.total;
      used.add(best.part.food.n);
    }
  }
  return { parts, total, score: score(target, total) };
}

/** everyday foods first when two swaps are about as close */
const COMMON = new Set(['닭가슴살', '계란', '두부', '소고기 우둔', '돼지 안심', '고등어', '참치캔(기름 뺀)', '연어', '그릭요거트 무가당', '우유',
  '흰쌀밥', '현미밥', '고구마', '감자', '오트밀', '바나나', '사과', '아몬드', '올리브유', '브로콜리']);
/** foods this person eats most (식습관 리포트) come before the general everyday list */
const rankScore = (s: Swap, prefer: string[]) => {
  const i = prefer.indexOf(s.parts[0].food.n);
  if (i >= 0) return s.score - 0.12 + Math.min(i, 10) * 0.005;
  return s.score + (COMMON.has(s.parts[0].food.n) ? 0 : 0.15);
};

/**
 * Up to `limit` swaps for the target macros, closest first, each with a different main food.
 * `main` forces the main food; `loose` keeps the best ones even when none is close (used for
 * "fill what's left today", where there's no exact target). `prefer` (most eaten first) moves
 * the person's own foods up.
 */
export function swaps(target: Macros, opts: { group?: FoodGroup; exclude?: string[]; main?: string; limit?: number; primary?: Macro; loose?: boolean; prefer?: string[] } = {}): Swap[] {
  const primary = opts.primary ?? (opts.group === 'veg' || opts.group === 'fruit' ? 'c' : opts.group === 'protein' ? 'p' : dominant(target));
  const exclude = opts.exclude ?? [];
  const prefer = opts.prefer ?? [];
  const mains = opts.main ? [byName(opts.main)].filter(Boolean) : mainOptions(target, { ...opts, primary });
  const out = mains
    .map((m) => build(target, m, primary, exclude, prefer))
    .filter((s): s is Swap => s != null && (opts.loose || close(target, s.total)))
    .sort((a, b) => rankScore(a, prefer) - rankScore(b, prefer));
  return out.slice(0, opts.limit ?? 3);
}

/** What the swap leaves out that the original had. */
export function swapNote(from: FoodDef | undefined, s: Swap): string | null {
  if (from?.o3 && !s.parts.some((p) => p.food.o3)) {
    return `${from.n}의 오메가3(EPA·DHA)는 이 조합으로 채워지지 않아요. 등푸른 생선을 주 1~2회 먹거나 영양제로 보충하세요.`;
  }
  return null;
}

export const total = (parts: SwapPart[]): Macros => parts.reduce((a, p) => add(a, macrosOf(p.food, p.amt)), ZERO);
