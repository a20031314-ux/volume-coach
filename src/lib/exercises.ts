import type { CustomExercise, MuscleKey } from './types';

/** halfLife: hours for accumulated fatigue on this muscle to halve (before age adjustment) */
export const MUSCLES: { k: MuscleKey; n: string; halfLife: number }[] = [
  { k: 'chest', n: '가슴', halfLife: 30 },
  { k: 'back', n: '등', halfLife: 30 },
  { k: 'shoulder', n: '어깨', halfLife: 24 },
  { k: 'quad', n: '대퇴사두', halfLife: 42 },
  { k: 'ham', n: '햄스트링·둔근', halfLife: 42 },
  { k: 'bi', n: '이두', halfLife: 20 },
  { k: 'tri', n: '삼두', halfLife: 20 },
  { k: 'calf', n: '종아리', halfLife: 16 },
  { k: 'abs', n: '복근', halfLife: 16 },
];
export const MUSCLE_NAME = Object.fromEntries(MUSCLES.map((m) => [m.k, m.n])) as Record<MuscleKey, string>;
export const HALF_LIFE = Object.fromEntries(MUSCLES.map((m) => [m.k, m.halfLife])) as Record<MuscleKey, number>;
export const BIG_MUSCLES = new Set<MuscleKey>(['chest', 'back', 'quad', 'ham', 'shoulder']);

/** Heavy compound lifts leave more local and systemic fatigue. */
export const HEAVY = new Set([
  '바벨 벤치프레스', '인클라인 바벨프레스', '바벨 로우', '티바 로우', '오버헤드프레스', '백스쿼트',
  '프론트스쿼트', '핵스쿼트', '레그프레스', '루마니안 데드리프트', '컨벤셔널 데드리프트', '굿모닝',
]);

export type Equipment = 'gym' | 'dumbbell' | 'bodyweight';
/** g = needs gym equipment (barbell, machine, cable), d = dumbbells, b = bodyweight (a pull-up bar is assumed) */
type Need = 'g' | 'd' | 'b';

/** Movement pattern, used to find substitutes. */
export type Pattern =
  | 'hpush' | 'vpush' | 'fly' | 'hpull' | 'vpull' | 'lateral' | 'rear'
  | 'squat' | 'lunge' | 'hinge' | 'kneeExt' | 'kneeFlex' | 'glute'
  | 'curl' | 'triExt' | 'calf' | 'core';

/** What an exercise asks of the body: a skill that must be there, or a joint position that may hurt. */
export type Demand =
  | 'pullup' | 'dip' | 'pushup' | 'bbSquat' | 'bbHinge' | 'bbPress'
  | 'overhead' | 'deepKnee' | 'spine' | 'wrist' | 'deepShoulder';

/** 1 = easy to learn, 2 = some technique, 3 = technical or demanding */
export type Level = 1 | 2 | 3;

export interface Exercise { n: string; m: MuscleKey; s: MuscleKey[]; need: Need; p: Pattern; lv: Level; d: Demand[] }

/** Within each muscle, the order is the order templates pick from: main compound first. */
const RAW: [string, MuscleKey, MuscleKey[], Need, Pattern, Level, Demand[]][] = [
  ['바벨 벤치프레스', 'chest', ['tri', 'shoulder'], 'g', 'hpush', 2, ['bbPress']],
  ['인클라인 덤벨프레스', 'chest', ['shoulder', 'tri'], 'd', 'hpush', 1, []],
  ['덤벨 벤치프레스', 'chest', ['tri', 'shoulder'], 'd', 'hpush', 1, []],
  ['인클라인 바벨프레스', 'chest', ['shoulder', 'tri'], 'g', 'hpush', 2, ['bbPress']],
  ['머신 체스트프레스', 'chest', ['tri'], 'g', 'hpush', 1, []],
  ['케이블 플라이', 'chest', [], 'g', 'fly', 1, []],
  ['펙덱 플라이', 'chest', [], 'g', 'fly', 1, []],
  ['덤벨 플라이', 'chest', [], 'd', 'fly', 1, ['deepShoulder']],
  ['딥스', 'chest', ['tri'], 'b', 'hpush', 3, ['dip', 'deepShoulder']],
  ['푸시업', 'chest', ['tri'], 'b', 'hpush', 2, ['pushup', 'wrist']],
  ['인클라인 푸시업', 'chest', ['tri'], 'b', 'hpush', 1, ['wrist']],
  ['디클라인 푸시업', 'chest', ['shoulder', 'tri'], 'b', 'hpush', 3, ['pushup', 'wrist']],
  ['풀업', 'back', ['bi'], 'b', 'vpull', 3, ['pullup']],
  ['랫풀다운', 'back', ['bi'], 'g', 'vpull', 1, []],
  ['어시스트 풀업 머신', 'back', ['bi'], 'g', 'vpull', 1, []],
  ['밴드 보조 풀업', 'back', ['bi'], 'b', 'vpull', 2, []],
  ['바벨 로우', 'back', ['bi'], 'g', 'hpull', 2, ['bbHinge', 'spine']],
  ['덤벨 원암 로우', 'back', ['bi'], 'd', 'hpull', 1, []],
  ['시티드 케이블 로우', 'back', ['bi'], 'g', 'hpull', 1, []],
  ['체스트 서포티드 로우', 'back', ['bi'], 'd', 'hpull', 1, []],
  ['티바 로우', 'back', ['bi'], 'g', 'hpull', 2, ['spine']],
  ['스트레이트암 풀다운', 'back', [], 'g', 'vpull', 1, []],
  ['인버티드 로우', 'back', ['bi'], 'b', 'hpull', 2, []],
  ['오버헤드프레스', 'shoulder', ['tri'], 'g', 'vpush', 2, ['bbPress', 'overhead', 'spine']],
  ['덤벨 숄더프레스', 'shoulder', ['tri'], 'd', 'vpush', 1, ['overhead']],
  ['랜드마인 프레스', 'shoulder', ['chest', 'tri'], 'g', 'vpush', 1, []],
  ['사이드 레터럴 레이즈', 'shoulder', [], 'd', 'lateral', 1, []],
  ['케이블 레터럴 레이즈', 'shoulder', [], 'g', 'lateral', 1, []],
  ['리어델트 플라이', 'shoulder', [], 'd', 'rear', 1, []],
  ['페이스풀', 'shoulder', ['back'], 'g', 'rear', 1, []],
  ['머신 숄더프레스', 'shoulder', ['tri'], 'g', 'vpush', 1, ['overhead']],
  ['파이크 푸시업', 'shoulder', ['tri'], 'b', 'vpush', 3, ['pushup', 'overhead', 'wrist']],
  ['백스쿼트', 'quad', ['ham'], 'g', 'squat', 3, ['bbSquat', 'deepKnee', 'spine']],
  ['핵스쿼트', 'quad', [], 'g', 'squat', 1, ['deepKnee']],
  ['레그프레스', 'quad', ['ham'], 'g', 'squat', 1, []],
  ['스미스 머신 스쿼트', 'quad', ['ham'], 'g', 'squat', 1, ['deepKnee']],
  ['프론트스쿼트', 'quad', [], 'g', 'squat', 3, ['bbSquat', 'deepKnee', 'wrist']],
  ['불가리안 스플릿 스쿼트', 'quad', ['ham'], 'b', 'lunge', 2, ['deepKnee']],
  ['스플릿 스쿼트', 'quad', ['ham'], 'b', 'lunge', 1, []],
  ['레그 익스텐션', 'quad', [], 'g', 'kneeExt', 1, []],
  ['워킹 런지', 'quad', ['ham'], 'b', 'lunge', 2, ['deepKnee']],
  ['고블릿 스쿼트', 'quad', [], 'd', 'squat', 1, ['deepKnee']],
  ['맨몸 스쿼트', 'quad', [], 'b', 'squat', 1, []],
  ['루마니안 데드리프트', 'ham', ['back'], 'g', 'hinge', 2, ['bbHinge', 'spine']],
  ['덤벨 루마니안 데드리프트', 'ham', ['back'], 'd', 'hinge', 1, ['spine']],
  ['컨벤셔널 데드리프트', 'ham', ['back', 'quad'], 'g', 'hinge', 3, ['bbHinge', 'spine']],
  ['라잉 레그컬', 'ham', [], 'g', 'kneeFlex', 1, []],
  ['시티드 레그컬', 'ham', [], 'g', 'kneeFlex', 1, []],
  ['힙 쓰러스트', 'ham', [], 'g', 'glute', 1, []],
  ['굿모닝', 'ham', [], 'g', 'hinge', 3, ['bbHinge', 'spine']],
  ['싱글레그 글루트 브릿지', 'ham', [], 'b', 'glute', 1, []],
  ['노르딕 컬', 'ham', [], 'b', 'kneeFlex', 3, []],
  ['바벨 컬', 'bi', [], 'g', 'curl', 1, []],
  ['인클라인 덤벨 컬', 'bi', [], 'd', 'curl', 1, []],
  ['해머 컬', 'bi', [], 'd', 'curl', 1, []],
  ['프리처 컬', 'bi', [], 'g', 'curl', 1, []],
  ['케이블 컬', 'bi', [], 'g', 'curl', 1, []],
  ['친업', 'bi', ['back'], 'b', 'vpull', 3, ['pullup']],
  ['케이블 푸시다운', 'tri', [], 'g', 'triExt', 1, []],
  ['오버헤드 트라이셉스 익스텐션', 'tri', [], 'd', 'triExt', 1, ['overhead']],
  ['라잉 트라이셉스 익스텐션', 'tri', [], 'g', 'triExt', 2, []],
  ['클로즈그립 벤치프레스', 'tri', ['chest'], 'g', 'hpush', 2, ['bbPress', 'wrist']],
  ['덤벨 킥백', 'tri', [], 'd', 'triExt', 1, []],
  ['다이아몬드 푸시업', 'tri', ['chest'], 'b', 'hpush', 3, ['pushup', 'wrist']],
  ['벤치 딥스', 'tri', [], 'b', 'triExt', 1, ['deepShoulder', 'wrist']],
  ['스탠딩 카프레이즈', 'calf', [], 'g', 'calf', 1, []],
  ['시티드 카프레이즈', 'calf', [], 'g', 'calf', 1, []],
  ['레그프레스 카프레이즈', 'calf', [], 'g', 'calf', 1, []],
  ['싱글레그 카프레이즈', 'calf', [], 'b', 'calf', 1, []],
  ['행잉 레그레이즈', 'abs', [], 'b', 'core', 2, []],
  ['케이블 크런치', 'abs', [], 'g', 'core', 1, []],
  ['앱 롤아웃', 'abs', [], 'b', 'core', 3, ['spine']],
  ['크런치', 'abs', [], 'b', 'core', 1, []],
  ['데드버그', 'abs', [], 'b', 'core', 1, []],
];
export const LIBRARY: Exercise[] = RAW.map(([n, m, s, need, p, lv, d]) => ({ n, m, s, need, p, lv, d }));

/** Can this exercise be done with the given equipment? Custom exercises are always allowed. */
export function available(e: Exercise, eq: Equipment = 'gym'): boolean {
  if (eq === 'gym') return true;
  if (eq === 'dumbbell') return e.need !== 'g';
  return e.need === 'b';
}

export function library(custom: CustomExercise[] = []): Exercise[] {
  return LIBRARY.concat(custom.map((c) => ({ n: c.n, m: c.m, s: [], need: 'b' as const, p: 'core' as const, lv: 1 as const, d: [] })));
}
