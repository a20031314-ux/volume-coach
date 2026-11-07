/**
 * 내 식습관 리포트: plain counting over the meals already on the phone — what gets eaten most,
 * where the protein and the staple carbs come from, when meals happen, and whether training days
 * fall short on protein. Also feeds the swap ranking (`prefer`) so suggestions start from the
 * foods this person actually eats.
 */
import { addDays, diffDays } from './dates';
import { findFood, type FoodDef } from './foods';
import type { Meal } from './types';

export type ProteinSource = 'chicken' | 'beef' | 'pork' | 'fish' | 'egg' | 'dairy' | 'supp' | 'soy' | 'other';
export const PROTEIN_NAME: Record<ProteinSource, string> = {
  chicken: '닭', beef: '소고기', pork: '돼지고기', fish: '생선·해산물', egg: '계란',
  dairy: '유제품', supp: '보충제', soy: '두부·콩', other: '밥·기타',
};

export type CarbSource = 'rice' | 'grain' | 'tuber' | 'oat' | 'bread' | 'noodle' | 'rcake' | 'fruit' | 'other';
export const CARB_NAME: Record<CarbSource, string> = {
  rice: '흰쌀밥', grain: '현미·잡곡', tuber: '고구마·감자', oat: '귀리·시리얼', bread: '빵',
  noodle: '면', rcake: '떡', fruit: '과일', other: '기타',
};

export type Slot = 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'night';
export const SLOT_NAME: Record<Slot, string> = { morning: '아침', lunch: '점심', afternoon: '오후', dinner: '저녁', night: '밤' };
export const SLOTS: Slot[] = ['morning', 'lunch', 'afternoon', 'dinner', 'night'];

// first match wins, so the more specific words come first
const PROTEIN_WORDS: [ProteinSource, string[]][] = [
  ['supp', ['보충제', '프로틴', '웨이', '쉐이크']],
  ['soy', ['두부', '두유', '콩', '낫또', '템페']],
  ['egg', ['계란', '달걀', '흰자', '메추리']],
  ['fish', ['연어', '고등어', '삼치', '참치', '광어', '대구', '새우', '오징어', '북어', '생선', '회', '갈치', '꽁치', '조기', '명태', '홍합', '조개', '굴']],
  ['chicken', ['닭', '치킨', '삼계탕', '오리']],
  ['beef', ['소고기', '우둔', '불고기', '차돌', '육회', '스테이크', '갈비탕', '장조림', '햄버거']],
  ['pork', ['돼지', '삼겹', '목살', '제육', '돈가스', '보쌈', '족발', '순대', '햄', '베이컨', '소시지', '부대찌개']],
  ['dairy', ['우유', '요거트', '요구르트', '치즈', '라떼']],
];

const CARB_WORDS: [CarbSource, string[]][] = [
  ['grain', ['현미', '잡곡', '퀴노아', '귀리밥']],
  ['tuber', ['고구마', '감자', '단호박']],
  ['oat', ['오트', '그래놀라', '시리얼']],
  ['bread', ['빵', '베이글', '샌드위치', '토스트', '햄버거', '피자']],
  ['noodle', ['면', '국수', '라면', '우동', '파스타', '짜장', '짬뽕', '냉면', '칼국수']],
  ['rcake', ['떡']],
  ['rice', ['밥', '김밥', '국밥', '덮밥', '곤약']],
];

const has = (name: string, words: string[]) => words.some((w) => name.includes(w));

export function proteinSource(name: string, def?: FoodDef): ProteinSource {
  for (const [k, words] of PROTEIN_WORDS) if (has(name, words)) return k;
  if (def?.g === 'dairy') return 'dairy';
  return 'other';
}

export function carbSource(name: string, def?: FoodDef): CarbSource {
  if (def?.g === 'fruit') return 'fruit';
  for (const [k, words] of CARB_WORDS) if (has(name, words)) return k;
  return 'other';
}

export function slotOf(at: number): Slot {
  const h = new Date(at).getHours();
  if (h >= 4 && h < 11) return 'morning';
  if (h < 15 && h >= 11) return 'lunch';
  if (h < 17 && h >= 15) return 'afternoon';
  if (h < 21 && h >= 17) return 'dinner';
  return 'night';
}

/** "닭가슴살 175g" → "닭가슴살"; custom foods keep their own name */
export function foodKey(name: string): { key: string; def?: FoodDef } {
  const def = findFood(name);
  return { key: def?.n ?? name.trim(), def };
}

export interface Share<K extends string> { k: K; g: number; pct: number }
export interface TopFood { name: string; times: number; days: number; p: number; kcal: number; source: ProteinSource }
export interface SlotStat { slot: Slot; p: number; kcal: number; /** share of the day's protein */ pct: number }
export interface DayStat { date: string; p: number; target: number | null; training: boolean; slots: Record<Slot, number> }

export interface DietReport {
  from: string; to: string;
  /** days with at least one meal logged */
  days: number;
  meals: number;
  top: TopFood[];
  protein: Share<ProteinSource>[];
  carbs: Share<CarbSource>[];
  slots: SlotStat[];
  training: { days: number; avgP: number; pct: number | null; short: number };
  rest: { days: number; avgP: number; pct: number | null };
  /** training days under 85% of the protein target, and which slot was usually the empty one */
  shortSlot: Slot | null;
  /** foods to try first in swaps, most eaten first */
  prefer: string[];
  notes: string[];
}

export const MIN_DAYS = 5;
const SHORT = 0.85;

/**
 * `targetP(date)` is the day's protein target (or null without a body profile);
 * `trainingDates` are the days with a workout.
 */
export function dietReport(meals: Meal[], opts: { to: string; days: number; targetP: (date: string) => number | null; trainingDates: Set<string> }): DietReport {
  const from = addDays(opts.to, -(opts.days - 1));
  const inRange = meals.filter((m) => !m.deleted && m.date >= from && m.date <= opts.to);

  const byDay = new Map<string, DayStat>();
  const foods = new Map<string, TopFood & { dates: Set<string> }>();
  const prot = new Map<ProteinSource, number>();
  const carb = new Map<CarbSource, number>();
  const slotP = new Map<Slot, number>(), slotK = new Map<Slot, number>();
  const emptySlots = (): Record<Slot, number> => ({ morning: 0, lunch: 0, afternoon: 0, dinner: 0, night: 0 });

  for (const m of inRange) {
    const { key, def } = foodKey(m.name);
    const src = proteinSource(key, def);
    const cs = carbSource(key, def);
    const slot = slotOf(m.at);
    let d = byDay.get(m.date);
    if (!d) {
      d = { date: m.date, p: 0, target: opts.targetP(m.date), training: opts.trainingDates.has(m.date), slots: emptySlots() };
      byDay.set(m.date, d);
    }
    d.p += m.p;
    d.slots[slot] += m.p;

    let f = foods.get(key);
    if (!f) { f = { name: key, times: 0, days: 0, p: 0, kcal: 0, source: src, dates: new Set() }; foods.set(key, f); }
    f.times += 1; f.p += m.p; f.kcal += m.kcal; f.dates.add(m.date);

    prot.set(src, (prot.get(src) ?? 0) + m.p);
    // vegetables, fats and drinks aren't staples; meals count by their main starch
    if (def?.g !== 'veg' && def?.g !== 'fat' && def?.g !== 'snack' && def?.g !== 'protein' && def?.g !== 'dairy') carb.set(cs, (carb.get(cs) ?? 0) + m.c);
    slotP.set(slot, (slotP.get(slot) ?? 0) + m.p);
    slotK.set(slot, (slotK.get(slot) ?? 0) + m.kcal);
  }

  const shares = <K extends string>(m: Map<K, number>, min = 0.5): Share<K>[] => {
    const sum = [...m.values()].reduce((a, b) => a + b, 0);
    return [...m.entries()].filter(([, g]) => g >= min)
      .map(([k, g]) => ({ k, g, pct: sum ? (g / sum) * 100 : 0 }))
      .sort((a, b) => b.g - a.g);
  };

  const days = [...byDay.values()];
  const totalP = days.reduce((a, d) => a + d.p, 0);
  const slots = SLOTS.map((slot) => ({ slot, p: (slotP.get(slot) ?? 0) / Math.max(1, days.length), kcal: (slotK.get(slot) ?? 0) / Math.max(1, days.length), pct: totalP ? ((slotP.get(slot) ?? 0) / totalP) * 100 : 0 }));

  const group = (list: DayStat[]) => {
    const withT = list.filter((d) => d.target);
    return {
      days: list.length,
      avgP: list.length ? list.reduce((a, d) => a + d.p, 0) / list.length : 0,
      pct: withT.length ? (withT.reduce((a, d) => a + d.p / d.target!, 0) / withT.length) * 100 : null,
    };
  };
  const trainDays = days.filter((d) => d.training);
  const shortDays = trainDays.filter((d) => d.target && d.p < d.target * SHORT);
  // the slot that, on short days, falls furthest below its usual share
  let shortSlot: Slot | null = null;
  if (shortDays.length >= 2) {
    let worst = 0;
    for (const s of SLOTS) {
      const usual = slots.find((x) => x.slot === s)!.p;
      const onShort = shortDays.reduce((a, d) => a + d.slots[s], 0) / shortDays.length;
      const gap = usual - onShort;
      if (gap > worst + 0.01) { worst = gap; shortSlot = s; }
    }
    if (worst < 5) shortSlot = null;
  }

  const top = [...foods.values()].map(({ dates, ...f }) => ({ ...f, days: dates.size }))
    .sort((a, b) => b.days - a.days || b.times - a.times || b.p - a.p);

  const report: DietReport = {
    from, to: opts.to, days: days.length, meals: inRange.length,
    top: top.slice(0, 8),
    protein: shares(prot),
    carbs: shares(carb),
    slots,
    training: { ...group(trainDays), short: shortDays.length },
    rest: group(days.filter((d) => !d.training)),
    shortSlot,
    // built-in foods eaten on 2+ days, most days first
    prefer: top.filter((f) => f.days >= 2 && findFood(f.name)?.n === f.name).map((f) => f.name),
    notes: [],
  };
  report.notes = dietNotes(report);
  return report;
}

const r = Math.round;

/** A few lines worth reading; nothing when the numbers are unremarkable. */
export function dietNotes(rep: DietReport): string[] {
  const out: string[] = [];
  const p = rep.protein.filter((s) => s.k !== 'other');
  if (p[0] && p[0].pct >= 45) out.push(`단백질의 ${r(p[0].pct)}%가 ${PROTEIN_NAME[p[0].k]}에서 와요. 대체 식단에서 다른 공급원을 섞어 보세요.`);
  const supp = rep.protein.find((s) => s.k === 'supp');
  if (supp && supp.pct >= 35) out.push(`보충제 비중이 ${r(supp.pct)}%로 높아요. 음식 단백질을 한 끼 늘리면 미량영양소도 같이 채워져요.`);
  const fish = rep.protein.find((s) => s.k === 'fish');
  if (rep.days >= 14 && (!fish || fish.pct < 5)) out.push('생선이 거의 없어요. 등푸른 생선을 주 1~2회 넣으면 오메가3를 채울 수 있어요.');
  const c = rep.carbs[0];
  if (c && c.k === 'rice' && c.pct >= 60) out.push(`탄수화물의 ${r(c.pct)}%가 흰쌀밥이에요. 일부를 현미·고구마·오트밀로 바꾸면 식이섬유가 늘어요.`);
  const late = rep.slots.filter((s) => s.slot === 'dinner' || s.slot === 'night').reduce((a, s) => a + s.pct, 0);
  const morning = rep.slots.find((s) => s.slot === 'morning')!;
  if (late >= 55) out.push(`하루 단백질의 ${r(late)}%를 저녁 이후에 먹어요.${morning.p < 15 ? ` 아침은 평균 ${r(morning.p)}g이에요.` : ''}`);
  if (rep.training.short >= 2 && rep.training.days) {
    out.push(`운동한 날 ${rep.training.days}일 중 ${rep.training.short}일은 단백질이 목표의 85%에 못 미쳤어요${rep.shortSlot ? ` — 주로 ${SLOT_NAME[rep.shortSlot]}이 비어요` : ''}.`);
  }
  return out;
}

/** how many calendar days the window covers, for the empty state */
export const windowDays = (rep: DietReport) => diffDays(rep.to, rep.from) + 1;
