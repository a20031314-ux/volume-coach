/**
 * 고정식단 시간 추천: when to take each supplement / regular food, anchored on the user's own
 * meal times and usual workout time. General guidance only; a product label or a doctor's
 * instruction comes first.
 */
import { FOOD_DB } from './foods';
import type { Session } from './types';

export interface TimingContext {
  /** meal times, minutes after midnight, ascending (at least one) */
  meals: number[];
  /** usual workout start and length, when known */
  workout: { start: number; minutes: number } | null;
  /** 생활 시간에서 직접 정한 기상·취침 (없으면 끼니로 추정) */
  wake?: number | null;
  bed?: number | null;
}

/** the timing context from settings + history: 생활 시간 first, then estimates */
export function timingContext(s: { mealPlan: { times: number[] }; life?: { wake?: number | null; bed?: number | null; workout?: number | null } }, sessions: Session[]): TimingContext {
  const usual = usualWorkout(sessions);
  const w = s.life?.workout;
  return {
    meals: [...s.mealPlan.times].sort((a, b) => a - b),
    workout: w != null ? { start: w, minutes: usual?.minutes ?? 60 } : usual,
    wake: s.life?.wake ?? null,
    bed: s.life?.bed ?? null,
  };
}

type Anchor = 'empty' | 'breakfast' | 'lunch' | 'dinner' | 'bed' | 'snack' | 'pre' | 'during' | 'post';

interface Rule { anchor: Anchor; reason: string }

const RULES: Record<string, Rule> = {
  종합비타민: { anchor: 'breakfast', reason: '아침 식사와 함께 — 지용성 비타민 흡수가 낫고 빈속 메스꺼움이 줄어요' },
  오메가3: { anchor: 'dinner', reason: '지방이 있는 식사와 함께 먹으면 흡수가 잘 돼요' },
  비타민D: { anchor: 'dinner', reason: '지방이 있는 식사와 함께 (오메가3와 같이 먹어도 돼요)' },
  비타민C: { anchor: 'breakfast', reason: '시간은 상관없어요. 철분을 먹는다면 같이 먹을 때 철 흡수가 늘어요' },
  마그네슘: { anchor: 'bed', reason: '저녁·자기 전. 아연·철분과는 시간을 띄워요' },
  아연: { anchor: 'lunch', reason: '식사와 함께 (빈속엔 메스꺼울 수 있어요). 철분과는 2시간 이상 띄워요' },
  철분: { anchor: 'empty', reason: '아침 식사 30분 전 빈속에, 비타민C와 함께. 우유·커피·차·칼슘과는 2시간 띄워요' },
  유산균: { anchor: 'breakfast', reason: '아침 식사와 함께 (제품 안내가 다르면 그쪽을 따르세요)' },
  크레아틴: { anchor: 'post', reason: '시간보다 매일 꾸준히가 중요해요. 운동 후 식사와 함께 먹으면 챙기기 쉬워요' },
  콜라겐: { anchor: 'breakfast', reason: '시간은 상관없어요. 매일 같은 때 먹으면 잊지 않아요' },
  BCAA: { anchor: 'during', reason: '운동 중. 하루 단백질을 충분히 먹고 있다면 효과는 작아요' },
  '전해질 파우더': { anchor: 'during', reason: '운동 중·후, 땀을 많이 흘린 날' },
  '단백질 보충제': { anchor: 'post', reason: '운동 후 1~2시간 안, 또는 단백질이 모자란 끼니 대신' },
  '프로틴 음료': { anchor: 'post', reason: '운동 후, 또는 단백질이 모자란 끼니 대신' },
  바나나: { anchor: 'pre', reason: '운동 30~60분 전 — 빨리 쓰이는 탄수화물' },
  계란: { anchor: 'breakfast', reason: '아침 단백질 채우기' },
  '그릭요거트 무가당': { anchor: 'bed', reason: '자기 전 — 천천히 흡수되는 단백질(카제인)' },
  // 비타민
  비타민A: { anchor: 'dinner', reason: '지용성 — 지방이 있는 식사와 함께' },
  '비타민B1(티아민)': { anchor: 'breakfast', reason: '수용성 B군은 아침 식사와 함께 (늦게 먹으면 잠이 깰 수 있어요)' },
  벤포티아민: { anchor: 'breakfast', reason: '지용성 B1 — 식사와 함께 먹으면 흡수가 나아요' },
  '비타민B2(리보플라빈)': { anchor: 'breakfast', reason: '아침 식사와 함께 (소변이 노래지는 건 정상이에요)' },
  '비타민B3(나이아신)': { anchor: 'dinner', reason: '식사와 함께 — 얼굴 화끈거림(홍조)이 덜해요' },
  '비타민B5(판토텐산)': { anchor: 'breakfast', reason: '아침 식사와 함께' },
  비타민B6: { anchor: 'breakfast', reason: '아침 식사와 함께' },
  비오틴: { anchor: 'breakfast', reason: '아침 식사와 함께. 혈액검사 2~3일 전엔 끊으세요(갑상선 등 수치에 영향)' },
  엽산: { anchor: 'breakfast', reason: '아침 식사와 함께' },
  비타민B12: { anchor: 'breakfast', reason: '아침 — 늦게 먹으면 잠이 깰 수 있어요' },
  '비타민B군(복합)': { anchor: 'breakfast', reason: '아침 식사와 함께 — 늦게 먹으면 잠이 깰 수 있어요' },
  비타민E: { anchor: 'dinner', reason: '지용성 — 지방이 있는 식사와 함께' },
  비타민K2: { anchor: 'dinner', reason: '지용성 — 비타민D와 함께 지방이 있는 식사에' },
  '비타민D3+K2': { anchor: 'dinner', reason: '지용성 — 지방이 있는 식사와 함께' },
  // 미네랄
  칼슘: { anchor: 'dinner', reason: '식사와 함께, 한 번에 500mg 이하로. 철분·아연과는 2시간 띄워요' },
  '칼슘·마그네슘': { anchor: 'bed', reason: '저녁·자기 전. 철분·아연과는 2시간 띄워요' },
  셀레늄: { anchor: 'breakfast', reason: '식사와 함께' },
  요오드: { anchor: 'breakfast', reason: '아침 식사와 함께' },
  칼륨: { anchor: 'lunch', reason: '식사와 함께 물 충분히 (신장 질환이 있으면 먼저 상담)' },
  크롬: { anchor: 'lunch', reason: '식사와 함께' },
  구리: { anchor: 'dinner', reason: '식사와 함께. 아연과는 2시간 띄워요' },
  // 운동
  카페인: { anchor: 'pre', reason: '운동 30~60분 전. 자기 전 8시간 안에는 피하세요, 하루 400mg 이하' },
  프리워크아웃: { anchor: 'pre', reason: '운동 30분 전. 대부분 카페인이 들어 있어요(라벨 확인)' },
  시트룰린: { anchor: 'pre', reason: '운동 60분 전 (시트룰린 말레이트 6~8g이 흔한 양)' },
  아르기닌: { anchor: 'pre', reason: '운동 30~60분 전 (효과는 시트룰린보다 약한 편)' },
  베타알라닌: { anchor: 'pre', reason: '시간보다 매일 꾸준히. 따끔거리면 나눠 먹어요' },
  글루타민: { anchor: 'post', reason: '운동 후 또는 자기 전 (단백질을 충분히 먹으면 효과는 작아요)' },
  HMB: { anchor: 'pre', reason: '운동 전후. 매일 꾸준히' },
  타우린: { anchor: 'pre', reason: '운동 전' },
  'L-카르니틴': { anchor: 'breakfast', reason: '탄수화물이 있는 식사와 함께 흡수가 나아요' },
  EAA: { anchor: 'during', reason: '운동 중 또는 단백질이 적은 끼니에' },
  '카제인 프로틴': { anchor: 'bed', reason: '자기 전 — 천천히 흡수되는 단백질' },
  // 건강기능
  크릴오일: { anchor: 'dinner', reason: '지방이 있는 식사와 함께' },
  코엔자임Q10: { anchor: 'lunch', reason: '지용성 — 식사와 함께. 늦으면 잠이 깰 수 있어 낮에' },
  루테인: { anchor: 'dinner', reason: '지용성 — 지방이 있는 식사와 함께' },
  밀크씨슬: { anchor: 'breakfast', reason: '식사와 함께' },
  홍삼: { anchor: 'breakfast', reason: '아침 — 저녁엔 잠이 깰 수 있어요' },
  '커큐민(강황)': { anchor: 'dinner', reason: '지방이 있는 식사와 함께 (후추 추출물 포함 제품이 흡수가 나아요)' },
  NAC: { anchor: 'breakfast', reason: '아침 식사와 함께' },
  알파리포산: { anchor: 'empty', reason: '아침 식사 30분 전 빈속에 흡수가 나아요' },
  아쉬와간다: { anchor: 'bed', reason: '저녁 (졸릴 수 있어요)' },
  테아닌: { anchor: 'bed', reason: '저녁, 또는 카페인과 함께 먹으면 들뜬 느낌이 줄어요' },
  글루코사민: { anchor: 'breakfast', reason: '식사와 함께' },
  MSM: { anchor: 'breakfast', reason: '식사와 함께' },
  '차전자피(식이섬유)': { anchor: 'snack', reason: '물 한 컵 이상과 함께. 다른 영양제·약과 2시간 띄워요' },
  프리바이오틱스: { anchor: 'breakfast', reason: '아침 — 처음엔 소량부터(가스가 찰 수 있어요)' },
  '플레인 요거트': { anchor: 'breakfast', reason: '아침 식사와 함께' },
  코티지치즈: { anchor: 'bed', reason: '자기 전 — 천천히 흡수되는 단백질(카제인)' },
};

const BY_GROUP: Record<string, Rule> = {
  supp: { anchor: 'breakfast', reason: '아침 식사와 함께 챙기면 잊지 않아요' },
  fat: { anchor: 'snack', reason: '오후 간식 — 저녁 과식을 줄여요' },
  fruit: { anchor: 'snack', reason: '오후 간식' },
  dairy: { anchor: 'breakfast', reason: '아침 식사와 함께' },
  protein: { anchor: 'breakfast', reason: '아침 단백질 채우기' },
};

/** pairs that should be at least 2 hours apart (first stays, second moves) */
const APART: [string, string[]][] = [
  ['철분', ['아연', '마그네슘', '종합비타민', '칼슘', '칼슘·마그네슘', '우유', '저지방 우유', '그릭요거트 무가당', '플레인 요거트', '카페라떼', '아메리카노', '차전자피(식이섬유)']],
  ['아연', ['마그네슘', '구리', '칼슘', '칼슘·마그네슘']],
  ['차전자피(식이섬유)', ['종합비타민', '오메가3', '비타민D', '마그네슘', '칼슘', '아연', '비타민D3+K2']],
];

/** sections for the checklist */
export const SUPP_SECTIONS: { title: string; names: string[] }[] = [
  { title: '비타민', names: ['종합비타민', '비타민A', '비타민B1(티아민)', '벤포티아민', '비타민B2(리보플라빈)', '비타민B3(나이아신)', '비타민B5(판토텐산)', '비타민B6', '비오틴', '엽산', '비타민B12', '비타민B군(복합)', '비타민C', '비타민D', '비타민D3+K2', '비타민E', '비타민K2'] },
  { title: '미네랄', names: ['마그네슘', '칼슘', '칼슘·마그네슘', '아연', '철분', '셀레늄', '요오드', '칼륨', '크롬', '구리'] },
  { title: '운동', names: ['단백질 보충제', '카제인 프로틴', 'EAA', 'BCAA', '크레아틴', '카페인', '프리워크아웃', '시트룰린', '아르기닌', '베타알라닌', 'HMB', '타우린', 'L-카르니틴', '글루타민', '전해질 파우더'] },
  { title: '건강', names: ['오메가3', '크릴오일', '유산균', '프리바이오틱스', '코엔자임Q10', '루테인', '밀크씨슬', '홍삼', '커큐민(강황)', 'NAC', '알파리포산', '아쉬와간다', '테아닌', '콜라겐', '글루코사민', 'MSM', '차전자피(식이섬유)'] },
];

/** caffeine: hours before bed, and a daily ceiling for healthy adults */
export const CAFFEINE_GAP_H = 8;
export const CAFFEINE_DAY_MG = 400;
const CAFFEINE = ['카페인', '프리워크아웃'];

/** Warnings for caffeine taken too close to bed, or too much in a day (doses in mg). */
export function caffeineWarnings(items: { n: string; time: number; dose?: number | null; doseUnit?: string | null; amt: number }[], ctx: TimingContext): string[] {
  const out: string[] = [];
  const bed = bedTime(ctx);
  const late = items.filter((x) => CAFFEINE.includes(x.n) && x.time > bed - CAFFEINE_GAP_H * 60);
  if (late.length) out.push(`${late.map((x) => x.n).join('·')}: 자기 전(${hhmmLocal(bed)}) ${CAFFEINE_GAP_H}시간 안이라 잠에 영향이 있을 수 있어요. 양을 줄이거나 카페인 없는 제품을 고려하세요.`);
  const mg = items.filter((x) => CAFFEINE.includes(x.n) && x.dose && (x.doseUnit ?? 'mg') === 'mg').reduce((a, x) => a + (x.dose ?? 0) * x.amt, 0);
  if (mg > CAFFEINE_DAY_MG) out.push(`카페인 영양제만 하루 ${Math.round(mg)}mg — 권장 상한 ${CAFFEINE_DAY_MG}mg을 넘어요 (커피는 따로예요).`);
  return out;
}
const hhmmLocal = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function bedTime(ctx: TimingContext): number { return clampDay(anchorTime('bed', ctx)); }

const clampDay = (m: number) => Math.max(5 * 60, Math.min(23 * 60 + 30, Math.round(m / 30) * 30));

function anchorTime(a: Anchor, ctx: TimingContext): number {
  const m = ctx.meals.length ? ctx.meals : [8 * 60, 12 * 60 + 30, 19 * 60];
  const breakfast = m[0], dinner = m[m.length - 1], lunch = m.length >= 3 ? m[1] : Math.round((breakfast + dinner) / 2);
  const w = ctx.workout;
  switch (a) {
    case 'empty': return ctx.wake != null ? Math.min(ctx.wake + 15, breakfast - 30) : breakfast - 30;
    case 'breakfast': return breakfast;
    case 'lunch': return lunch;
    case 'dinner': return dinner;
    case 'bed': return ctx.bed ?? Math.min(dinner + 180, 23 * 60);
    case 'snack': return Math.round((lunch + dinner) / 2);
    case 'pre': return w ? w.start - 45 : lunch + 180;
    case 'during': return w ? w.start + Math.round(w.minutes / 2) : dinner - 60;
    case 'post': return w ? w.start + w.minutes + 30 : dinner;
  }
}

export interface Suggestion { time: number; reason: string; moved?: string }

export function ruleFor(n: string): Rule {
  return RULES[n] ?? BY_GROUP[FOOD_DB.find((d) => d.n === n)?.g ?? ''] ?? { anchor: 'breakfast', reason: '매일 같은 때 먹으면 잊지 않아요' };
}

/** Suggested times for a set of items, keeping clashing pairs 2 hours apart. */
export function suggestTimes(names: string[], ctx: TimingContext): Record<string, Suggestion> {
  const out: Record<string, Suggestion> = {};
  for (const n of names) { const r = ruleFor(n); out[n] = { time: clampDay(anchorTime(r.anchor, ctx)), reason: r.reason }; }
  // 철분 + 비타민C together
  if (out['철분'] && out['비타민C']) out['비타민C'] = { time: out['철분'].time, reason: '철분과 함께 — 철 흡수를 높여요' };
  const later = [anchorTime('lunch', ctx), anchorTime('dinner', ctx), anchorTime('bed', ctx)].map(clampDay);
  for (const [a, others] of APART) {
    if (!out[a]) continue;
    for (const b of others) {
      if (!out[b] || Math.abs(out[b].time - out[a].time) >= 120) continue;
      const t = later.find((x) => Math.abs(x - out[a].time) >= 120 && (b !== '마그네슘' || x >= out[a].time)) ?? clampDay(out[a].time + 120);
      out[b] = { ...out[b], time: t, moved: `${a}과 2시간 이상 띄웠어요` };
    }
  }
  return out;
}

/** Usual workout start (median of the last sessions) and length. */
export function usualWorkout(sessions: Session[]): TimingContext['workout'] {
  const recent = sessions.filter((s) => !s.deleted && s.endedAt).sort((a, b) => b.startedAt - a.startedAt).slice(0, 20);
  if (recent.length < 3) return null;
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const start = med(recent.map((s) => { const d = new Date(s.startedAt); return d.getHours() * 60 + d.getMinutes(); }));
  const minutes = med(recent.map((s) => Math.round(((s.endedAt as number) - s.startedAt) / 60000)));
  return { start, minutes: Math.max(20, Math.min(150, minutes)) };
}
