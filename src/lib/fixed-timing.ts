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
  ['철분', ['아연', '마그네슘', '종합비타민', '우유', '저지방 우유', '그릭요거트 무가당', '플레인 요거트', '카페라떼', '아메리카노']],
  ['아연', ['마그네슘']],
];

const clampDay = (m: number) => Math.max(5 * 60, Math.min(23 * 60 + 30, Math.round(m / 30) * 30));

function anchorTime(a: Anchor, ctx: TimingContext): number {
  const m = ctx.meals.length ? ctx.meals : [8 * 60, 12 * 60 + 30, 19 * 60];
  const breakfast = m[0], dinner = m[m.length - 1], lunch = m.length >= 3 ? m[1] : Math.round((breakfast + dinner) / 2);
  const w = ctx.workout;
  switch (a) {
    case 'empty': return breakfast - 30;
    case 'breakfast': return breakfast;
    case 'lunch': return lunch;
    case 'dinner': return dinner;
    case 'bed': return Math.min(dinner + 180, 23 * 60);
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
