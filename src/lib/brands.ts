/**
 * 프랜차이즈 메뉴 — values the brands publish on their own sites (checked 2026-11-07).
 *
 * Korean franchise nutrition labels list 열량·단백질·당류·포화지방·나트륨 but not total carbs or
 * fat. kcal and protein here are the published numbers; carbs and fat are estimated by splitting
 * the remaining calories (kcal − 4×protein) with a typical fat share for that kind of food, and
 * marked `estCF` so the app can say so.
 */
import type { FoodDef } from './foods';

export interface BrandSource { brand: string; url: string; checked: string; note?: string }

export const BRAND_SOURCES: Record<string, BrandSource> = {
  mcd: { brand: '맥도날드', url: 'https://www.mcdonalds.co.kr/uploadFolder/data/Nutrition_Facts_BigMac_0306.pdf', checked: '2026-11-07', note: '맥도날드 제품 영양분석표(PDF, 문서 날짜 표기 없음)' },
  kyochon: { brand: '교촌치킨', url: 'https://www.kyochon.com/menu/chicken.asp', checked: '2026-11-07', note: '100g 기준. 표시 총중량은 조리 전 원료육 기준이라 실제 제공량과 다름' },
  dominos: { brand: '도미노피자', url: 'https://web.dominos.co.kr/contents/deliveryIngredient', checked: '2026-11-07', note: '오리지널 도우 L, 150g 기준값을 1조각(L 8조각)으로 환산' },
};

/** typical share of non-protein calories that come from fat */
const FAT_SHARE = { burger: 0.5, chicken: 0.7, sauced: 0.55, pizza: 0.45, fries: 0.45, fried: 0.6, dessert: 0.35, pasta: 0.45, salad: 0.65, wrap: 0.45 } as const;
type Kind = keyof typeof FAT_SHARE;

/** carbs and fat from kcal and protein (sugar is a floor for carbs) */
export function estimateCF(k: number, p: number, kind: Kind, sugar = 0): { c: number; f: number } {
  const rest = Math.max(0, k - 4 * p);
  let f = (rest * FAT_SHARE[kind]) / 9;
  let c = (rest - f * 9) / 4;
  if (c < sugar) { c = sugar; f = Math.max(0, (rest - 4 * c) / 9); }
  return { c: Math.round(c * 10) / 10, f: Math.round(f * 10) / 10 };
}

// [source, name, unit, base, step, kcal, protein, sugar, kind, grams per unit]
type Row = [keyof typeof BRAND_SOURCES, string, FoodDef['unit'], number, number, number, number, number, Kind, number?];

const ROWS: Row[] = [
  // 맥도날드 (1개)
  ['mcd', '햄버거', '개', 1, 1, 248, 13, 6, 'burger', 100],
  ['mcd', '치즈버거', '개', 1, 1, 297, 15, 7, 'burger', 114],
  ['mcd', '더블 치즈버거', '개', 1, 1, 445, 26, 7, 'burger', 164],
  ['mcd', '맥치킨', '개', 1, 1, 374, 15, 6, 'burger', 163],
  ['mcd', '빅맥', '개', 1, 1, 505, 26, 8, 'burger', 213],
  ['mcd', '메가맥', '개', 1, 1, 703, 41, 8, 'burger', 279],
  ['mcd', '미니맥', '개', 1, 1, 342, 16, 6, 'burger', 137],
  ['mcd', '불고기버거', '개', 1, 1, 399, 16, 13, 'burger', 155],
  ['mcd', '더블 불고기버거', '개', 1, 1, 649, 29, 23, 'burger', 236],
  ['mcd', '맥스파이시 상하이 버거', '개', 1, 1, 443, 22, 7, 'burger', 228],
  ['mcd', '쿼터파운더 치즈', '개', 1, 1, 519, 30, 8, 'burger', 197],
  ['mcd', '더블 쿼터파운더 치즈', '개', 1, 1, 761, 49, 8, 'burger', 278],
  ['mcd', '베이컨 토마토 디럭스', '개', 1, 1, 513, 26, 15, 'burger', 242],
  ['mcd', '1955 버거', '개', 1, 1, 506, 27, 11, 'burger', 244],
  ['mcd', '더블 1955 버거', '개', 1, 1, 748, 46, 11, 'burger', 325],
  ['mcd', '맥스파이시 케이준 버거', '개', 1, 1, 396, 16, 8, 'burger', 200],
  ['mcd', '토마토 치즈버거', '개', 1, 1, 362, 17, 8, 'burger', 181],
  ['mcd', '디럭스 슈림프 버거', '개', 1, 1, 392, 15, 9, 'burger', 197],
  ['mcd', '후렌치 후라이 M', '개', 1, 1, 352, 4, 0, 'fries', 114],
  ['mcd', '후렌치 후라이 L', '개', 1, 1, 433, 5, 0, 'fries', 140],
  ['mcd', '해쉬 브라운', '개', 1, 1, 174, 2, 0, 'fries', 57],
  ['mcd', '맥너겟', '조각', 1, 1, 42.8, 2.5, 0, 'fried', 17],
  ['mcd', '맥스파이시 치킨 텐더', '조각', 1, 1, 96, 7.5, 0, 'fried', 38.5],
  ['mcd', '맥윙', '조각', 1, 1, 118, 7.4, 0, 'fried', 40.5],
  ['mcd', '맥스파이시 치킨 스낵랩', '개', 1, 1, 300, 11, 3, 'wrap', 107],
  ['mcd', '바닐라 선데이', '개', 1, 1, 193, 7, 24, 'dessert', 140],
  ['mcd', '오레오 맥플러리', '개', 1, 1, 329, 8, 35, 'dessert', 168],
  // 교촌 (100g 기준)
  ['kyochon', '교촌신화오리지날', 'g', 100, 10, 367, 25, 6, 'chicken'],
  ['kyochon', '허니콤보', 'g', 100, 10, 320, 19, 5, 'sauced'],
  ['kyochon', '레드콤보', 'g', 100, 10, 305, 26, 4, 'sauced'],
  ['kyochon', '반반콤보(간장+레드)', 'g', 100, 10, 315, 27, 3, 'sauced'],
  ['kyochon', '양념치킨', 'g', 100, 10, 350, 22, 9, 'sauced'],
];

// 도미노 L (오리지널 도우): [name, total g, kcal/150g, protein/150g, sugar/150g]
const PIZZA_L: [string, number, number, number, number][] = [
  ['그릴드 패티 치즈 버거 더블 치즈 엣지', 1206, 425, 20, 5],
  ['더블 미트 할라피뇨 더블 치즈 엣지', 1308, 370, 18, 4],
  ['레몬 버터 더블 살시챠 더블 치즈 엣지', 1191, 425, 19, 7],
  ['리얼불고기 더블치즈엣지', 1075, 395, 20, 4],
  ['무진장 슈림프 스테이크+포테이토 더블 치즈 엣지', 1285, 380, 18, 4],
  ['베스트 콰트로 더블치즈엣지', 1129, 385, 20, 3],
  ['베이컨체더치즈 더블치즈엣지', 1101, 400, 21, 3],
  ['슈퍼디럭스 더블치즈엣지', 1153, 385, 19, 3],
  ['슈퍼슈프림 더블치즈엣지', 1238, 350, 17, 4],
  ['와일드 와일드 웨스트 스테이크', 988, 355, 16, 3],
  ['우리 고구마 더블치즈엣지', 1111, 415, 19, 6],
  ['치즈 더블치즈엣지', 944, 415, 20, 4],
  ['페퍼로니 더블치즈엣지', 1019, 420, 22, 3],
  ['포테이토 더블치즈엣지', 1277, 385, 19, 2],
  ['필라델피아 치즈 스테이크 더블 치즈 엣지', 1125, 435, 23, 4],
];
const DOMINO_SIDES: Row[] = [
  ['dominos', '더블 크런치 치킨텐더', '조각', 1, 1, 85, 8, 0.4, 'fried', 46],
  ['dominos', '스와이시 치킨 윙', '조각', 1, 1, 65, 6, 3, 'fried', 33],
  ['dominos', '웨스턴 핫 윙', '조각', 1, 1, 65, 7, 0.5, 'fried', 27],
  ['dominos', '도미노 코울슬로', '개', 1, 1, 105, 1, 10, 'salad', 100],
  ['dominos', '베이컨 까르보나라 스파게티', '개', 1, 1, 705, 29, 10, 'pasta', 395],
  ['dominos', 'NEW 치즈 볼로네즈 스파게티', '개', 1, 1, 515, 21, 13, 'pasta', 379],
];

const SLICES_L = 8;
const pizzaRows: Row[] = PIZZA_L.map(([n, total, k, p, sugar]) => {
  const g = total / SLICES_L;
  const r = g / 150;
  return ['dominos', `${n} L`, '조각', 1, 1, Math.round(k * r), Math.round(p * r * 10) / 10, Math.round(sugar * r * 10) / 10, 'pizza', Math.round(g)];
});

export const BRAND_FOODS: FoodDef[] = [...ROWS, ...DOMINO_SIDES, ...pizzaRows].map(([src, n, unit, base, step, k, p, sugar, kind, gPer]) => ({
  n: `${BRAND_SOURCES[src].brand} ${n}`,
  unit, base, step, k, p, ...estimateCF(k, p, kind, sugar),
  g: 'brand' as const,
  ...(gPer ? { gPer } : {}),
  brand: BRAND_SOURCES[src].brand, src, estCF: true,
}));
