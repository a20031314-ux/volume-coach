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

export interface Exercise { n: string; m: MuscleKey; s: MuscleKey[]; need: Need }

/** Within each muscle, the order is the order templates pick from: main compound first. */
const RAW: [string, MuscleKey, MuscleKey[], Need][] = [
  ['바벨 벤치프레스', 'chest', ['tri', 'shoulder'], 'g'], ['인클라인 덤벨프레스', 'chest', ['shoulder', 'tri'], 'd'],
  ['덤벨 벤치프레스', 'chest', ['tri', 'shoulder'], 'd'], ['인클라인 바벨프레스', 'chest', ['shoulder', 'tri'], 'g'],
  ['머신 체스트프레스', 'chest', ['tri'], 'g'], ['케이블 플라이', 'chest', [], 'g'], ['펙덱 플라이', 'chest', [], 'g'],
  ['덤벨 플라이', 'chest', [], 'd'], ['딥스', 'chest', ['tri'], 'b'], ['푸시업', 'chest', ['tri'], 'b'],
  ['디클라인 푸시업', 'chest', ['shoulder', 'tri'], 'b'],
  ['풀업', 'back', ['bi'], 'b'], ['랫풀다운', 'back', ['bi'], 'g'], ['바벨 로우', 'back', ['bi'], 'g'],
  ['덤벨 원암 로우', 'back', ['bi'], 'd'], ['시티드 케이블 로우', 'back', ['bi'], 'g'], ['체스트 서포티드 로우', 'back', ['bi'], 'd'],
  ['티바 로우', 'back', ['bi'], 'g'], ['스트레이트암 풀다운', 'back', [], 'g'], ['인버티드 로우', 'back', ['bi'], 'b'],
  ['오버헤드프레스', 'shoulder', ['tri'], 'g'], ['덤벨 숄더프레스', 'shoulder', ['tri'], 'd'], ['사이드 레터럴 레이즈', 'shoulder', [], 'd'],
  ['케이블 레터럴 레이즈', 'shoulder', [], 'g'], ['리어델트 플라이', 'shoulder', [], 'd'], ['페이스풀', 'shoulder', ['back'], 'g'],
  ['머신 숄더프레스', 'shoulder', ['tri'], 'g'], ['파이크 푸시업', 'shoulder', ['tri'], 'b'],
  ['백스쿼트', 'quad', ['ham'], 'g'], ['핵스쿼트', 'quad', [], 'g'], ['레그프레스', 'quad', ['ham'], 'g'], ['프론트스쿼트', 'quad', [], 'g'],
  ['불가리안 스플릿 스쿼트', 'quad', ['ham'], 'b'], ['레그 익스텐션', 'quad', [], 'g'], ['워킹 런지', 'quad', ['ham'], 'b'],
  ['고블릿 스쿼트', 'quad', [], 'd'], ['맨몸 스쿼트', 'quad', [], 'b'],
  ['루마니안 데드리프트', 'ham', ['back'], 'g'], ['덤벨 루마니안 데드리프트', 'ham', ['back'], 'd'],
  ['컨벤셔널 데드리프트', 'ham', ['back', 'quad'], 'g'], ['라잉 레그컬', 'ham', [], 'g'],
  ['시티드 레그컬', 'ham', [], 'g'], ['힙 쓰러스트', 'ham', [], 'g'], ['굿모닝', 'ham', [], 'g'],
  ['싱글레그 글루트 브릿지', 'ham', [], 'b'], ['노르딕 컬', 'ham', [], 'b'],
  ['바벨 컬', 'bi', [], 'g'], ['인클라인 덤벨 컬', 'bi', [], 'd'], ['해머 컬', 'bi', [], 'd'], ['프리처 컬', 'bi', [], 'g'],
  ['케이블 컬', 'bi', [], 'g'], ['친업', 'bi', ['back'], 'b'],
  ['케이블 푸시다운', 'tri', [], 'g'], ['오버헤드 트라이셉스 익스텐션', 'tri', [], 'd'], ['라잉 트라이셉스 익스텐션', 'tri', [], 'g'],
  ['클로즈그립 벤치프레스', 'tri', ['chest'], 'g'], ['덤벨 킥백', 'tri', [], 'd'], ['다이아몬드 푸시업', 'tri', ['chest'], 'b'],
  ['스탠딩 카프레이즈', 'calf', [], 'g'], ['시티드 카프레이즈', 'calf', [], 'g'], ['레그프레스 카프레이즈', 'calf', [], 'g'],
  ['싱글레그 카프레이즈', 'calf', [], 'b'],
  ['행잉 레그레이즈', 'abs', [], 'b'], ['케이블 크런치', 'abs', [], 'g'], ['앱 롤아웃', 'abs', [], 'b'], ['크런치', 'abs', [], 'b'],
];
export const LIBRARY: Exercise[] = RAW.map(([n, m, s, need]) => ({ n, m, s, need }));

/** Can this exercise be done with the given equipment? Custom exercises are always allowed. */
export function available(e: Exercise, eq: Equipment = 'gym'): boolean {
  if (eq === 'gym') return true;
  if (eq === 'dumbbell') return e.need !== 'g';
  return e.need === 'b';
}

export function library(custom: CustomExercise[] = []): Exercise[] {
  return LIBRARY.concat(custom.map((c) => ({ n: c.n, m: c.m, s: [], need: 'b' as const })));
}
