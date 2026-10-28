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

export interface Exercise { n: string; m: MuscleKey; s: MuscleKey[] }

const RAW: [string, MuscleKey, MuscleKey[]][] = [
  ['바벨 벤치프레스', 'chest', ['tri', 'shoulder']], ['인클라인 덤벨프레스', 'chest', ['shoulder', 'tri']],
  ['덤벨 벤치프레스', 'chest', ['tri', 'shoulder']], ['인클라인 바벨프레스', 'chest', ['shoulder', 'tri']],
  ['머신 체스트프레스', 'chest', ['tri']], ['케이블 플라이', 'chest', []], ['펙덱 플라이', 'chest', []],
  ['딥스', 'chest', ['tri']], ['푸시업', 'chest', ['tri']],
  ['풀업', 'back', ['bi']], ['랫풀다운', 'back', ['bi']], ['바벨 로우', 'back', ['bi']],
  ['덤벨 원암 로우', 'back', ['bi']], ['시티드 케이블 로우', 'back', ['bi']], ['체스트 서포티드 로우', 'back', ['bi']],
  ['티바 로우', 'back', ['bi']], ['스트레이트암 풀다운', 'back', []],
  ['오버헤드프레스', 'shoulder', ['tri']], ['덤벨 숄더프레스', 'shoulder', ['tri']], ['사이드 레터럴 레이즈', 'shoulder', []],
  ['케이블 레터럴 레이즈', 'shoulder', []], ['리어델트 플라이', 'shoulder', []], ['페이스풀', 'shoulder', ['back']],
  ['머신 숄더프레스', 'shoulder', ['tri']],
  ['백스쿼트', 'quad', ['ham']], ['핵스쿼트', 'quad', []], ['레그프레스', 'quad', ['ham']], ['프론트스쿼트', 'quad', []],
  ['불가리안 스플릿 스쿼트', 'quad', ['ham']], ['레그 익스텐션', 'quad', []], ['워킹 런지', 'quad', ['ham']],
  ['고블릿 스쿼트', 'quad', []],
  ['루마니안 데드리프트', 'ham', ['back']], ['컨벤셔널 데드리프트', 'ham', ['back', 'quad']], ['라잉 레그컬', 'ham', []],
  ['시티드 레그컬', 'ham', []], ['힙 쓰러스트', 'ham', []], ['굿모닝', 'ham', []], ['노르딕 컬', 'ham', []],
  ['바벨 컬', 'bi', []], ['인클라인 덤벨 컬', 'bi', []], ['해머 컬', 'bi', []], ['프리처 컬', 'bi', []], ['케이블 컬', 'bi', []],
  ['케이블 푸시다운', 'tri', []], ['오버헤드 트라이셉스 익스텐션', 'tri', []], ['라잉 트라이셉스 익스텐션', 'tri', []],
  ['클로즈그립 벤치프레스', 'tri', ['chest']], ['덤벨 킥백', 'tri', []],
  ['스탠딩 카프레이즈', 'calf', []], ['시티드 카프레이즈', 'calf', []], ['레그프레스 카프레이즈', 'calf', []],
  ['행잉 레그레이즈', 'abs', []], ['케이블 크런치', 'abs', []], ['앱 롤아웃', 'abs', []],
];
export const LIBRARY: Exercise[] = RAW.map(([n, m, s]) => ({ n, m, s }));

export function library(custom: CustomExercise[] = []): Exercise[] {
  return LIBRARY.concat(custom.map((c) => ({ n: c.n, m: c.m, s: [] })));
}
