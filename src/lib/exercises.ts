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
  '디클라인 바벨프레스', '플로어 프레스', '스포토 프레스', '라슨 프레스', '핀 프레스', '웨이티드 딥스',
  '펜들레이 로우', '예이츠 로우', '웨이티드 풀업', '랙풀', '푸시 프레스', 'Z 프레스',
  '퍼즈 스쿼트', '박스 스쿼트', '세이프티바 스쿼트', '로우바 스쿼트', '젤처 스쿼트', '바벨 런지', '쓰러스터',
  '스모 데드리프트', '트랩바 데드리프트', '데피싯 데드리프트', '스티프레그 데드리프트', '파워 클린', '행 클린', '파워 스내치',
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

export interface Exercise { n: string; m: MuscleKey; s: MuscleKey[]; need: Need; p: Pattern; lv: Level; d: Demand[]; /** variation: recommended only once done or favourited */ extra?: boolean }

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
/**
 * Variations and functional movements. Pickable anywhere, but only recommended once the user has
 * done one or marked it as a favourite, so generated routines stay on the well-known lifts.
 */
const EXTRA: [string, MuscleKey, MuscleKey[], Need, Pattern, Level, Demand[]][] = [
  // 가슴
  ['디클라인 바벨프레스', 'chest', ['tri'], 'g', 'hpush', 2, ['bbPress']],
  ['와이드그립 벤치프레스', 'chest', ['shoulder'], 'g', 'hpush', 2, ['bbPress', 'deepShoulder']],
  ['플로어 프레스', 'chest', ['tri'], 'g', 'hpush', 2, ['bbPress']],
  ['스포토 프레스', 'chest', ['tri', 'shoulder'], 'g', 'hpush', 3, ['bbPress']],
  ['라슨 프레스', 'chest', ['tri', 'shoulder'], 'g', 'hpush', 3, ['bbPress']],
  ['핀 프레스', 'chest', ['tri'], 'g', 'hpush', 2, ['bbPress']],
  ['스미스 인클라인 프레스', 'chest', ['shoulder', 'tri'], 'g', 'hpush', 1, []],
  ['인클라인 머신 프레스', 'chest', ['shoulder', 'tri'], 'g', 'hpush', 1, []],
  ['케이블 크로스오버', 'chest', [], 'g', 'fly', 1, []],
  ['로우 케이블 플라이', 'chest', ['shoulder'], 'g', 'fly', 1, []],
  ['인클라인 덤벨 플라이', 'chest', ['shoulder'], 'd', 'fly', 1, ['deepShoulder']],
  ['덤벨 풀오버', 'chest', ['back'], 'd', 'fly', 2, ['overhead', 'deepShoulder']],
  ['웨이티드 딥스', 'chest', ['tri'], 'g', 'hpush', 3, ['dip', 'deepShoulder']],
  ['아처 푸시업', 'chest', ['tri'], 'b', 'hpush', 3, ['pushup', 'wrist']],
  ['스벤드 프레스', 'chest', [], 'd', 'fly', 1, []],
  // 등
  ['펜들레이 로우', 'back', ['bi'], 'g', 'hpull', 3, ['bbHinge', 'spine']],
  ['예이츠 로우', 'back', ['bi'], 'g', 'hpull', 2, ['spine']],
  ['실 로우', 'back', ['bi'], 'g', 'hpull', 1, []],
  ['메도우스 로우', 'back', ['bi'], 'g', 'hpull', 2, []],
  ['크로크 로우', 'back', ['bi'], 'd', 'hpull', 2, ['spine']],
  ['머신 로우', 'back', ['bi'], 'g', 'hpull', 1, []],
  ['하이 로우 머신', 'back', ['bi', 'shoulder'], 'g', 'hpull', 1, []],
  ['언더그립 랫풀다운', 'back', ['bi'], 'g', 'vpull', 1, []],
  ['V바 랫풀다운', 'back', ['bi'], 'g', 'vpull', 1, []],
  ['싱글암 랫풀다운', 'back', ['bi'], 'g', 'vpull', 1, []],
  ['웨이티드 풀업', 'back', ['bi'], 'g', 'vpull', 3, ['pullup']],
  ['뉴트럴그립 풀업', 'back', ['bi'], 'b', 'vpull', 3, ['pullup']],
  ['랙풀', 'back', ['ham'], 'g', 'hinge', 2, ['bbHinge', 'spine']],
  ['TRX 로우', 'back', ['bi'], 'b', 'hpull', 1, []],
  ['바벨 슈러그', 'back', [], 'g', 'hpull', 1, []],
  ['덤벨 슈러그', 'back', [], 'd', 'hpull', 1, []],
  ['덤벨 풀오버 (등)', 'back', ['chest'], 'd', 'vpull', 2, ['overhead', 'deepShoulder']],
  // 어깨
  ['푸시 프레스', 'shoulder', ['tri', 'quad'], 'g', 'vpush', 3, ['bbPress', 'overhead']],
  ['Z 프레스', 'shoulder', ['tri', 'abs'], 'g', 'vpush', 3, ['bbPress', 'overhead']],
  ['아놀드 프레스', 'shoulder', ['tri'], 'd', 'vpush', 2, ['overhead']],
  ['시티드 덤벨프레스', 'shoulder', ['tri'], 'd', 'vpush', 1, ['overhead']],
  ['업라이트 로우', 'shoulder', ['back'], 'g', 'lateral', 2, ['deepShoulder']],
  ['Y 레이즈', 'shoulder', ['back'], 'd', 'lateral', 1, ['overhead']],
  ['린어웨이 레터럴 레이즈', 'shoulder', [], 'd', 'lateral', 1, []],
  ['머신 레터럴 레이즈', 'shoulder', [], 'g', 'lateral', 1, []],
  ['프론트 레이즈', 'shoulder', [], 'd', 'vpush', 1, []],
  ['리버스 펙덱', 'shoulder', ['back'], 'g', 'rear', 1, []],
  ['케이블 리어델트 플라이', 'shoulder', ['back'], 'g', 'rear', 1, []],
  ['밴드 풀어파트', 'shoulder', ['back'], 'b', 'rear', 1, []],
  ['핸드스탠드 푸시업', 'shoulder', ['tri'], 'b', 'vpush', 3, ['pushup', 'overhead', 'wrist']],
  ['터키시 겟업', 'shoulder', ['abs', 'quad'], 'd', 'vpush', 3, ['overhead']],
  ['케틀벨 클린 앤 프레스', 'shoulder', ['ham', 'tri'], 'd', 'vpush', 3, ['overhead']],
  // 대퇴사두
  ['퍼즈 스쿼트', 'quad', ['ham'], 'g', 'squat', 3, ['bbSquat', 'deepKnee', 'spine']],
  ['박스 스쿼트', 'quad', ['ham'], 'g', 'squat', 2, ['bbSquat', 'spine']],
  ['세이프티바 스쿼트', 'quad', ['ham'], 'g', 'squat', 2, ['bbSquat', 'deepKnee', 'spine']],
  ['로우바 스쿼트', 'quad', ['ham'], 'g', 'squat', 3, ['bbSquat', 'deepKnee', 'spine']],
  ['젤처 스쿼트', 'quad', ['abs'], 'g', 'squat', 3, ['bbSquat', 'deepKnee']],
  ['펜듈럼 스쿼트', 'quad', [], 'g', 'squat', 1, ['deepKnee']],
  ['벨트 스쿼트', 'quad', ['ham'], 'g', 'squat', 1, ['deepKnee']],
  ['시시 스쿼트', 'quad', [], 'b', 'kneeExt', 2, ['deepKnee']],
  ['피스톨 스쿼트', 'quad', ['ham'], 'b', 'squat', 3, ['deepKnee']],
  ['점프 스쿼트', 'quad', ['calf'], 'b', 'squat', 2, []],
  ['스텝업', 'quad', ['ham'], 'd', 'lunge', 1, []],
  ['리버스 런지', 'quad', ['ham'], 'd', 'lunge', 1, []],
  ['커티시 런지', 'quad', ['ham'], 'd', 'lunge', 2, []],
  ['사이드 런지', 'quad', ['ham'], 'd', 'lunge', 2, ['deepKnee']],
  ['바벨 런지', 'quad', ['ham'], 'g', 'lunge', 2, ['spine']],
  ['박스 점프', 'quad', ['calf'], 'b', 'squat', 2, []],
  ['쓰러스터', 'quad', ['shoulder', 'tri'], 'g', 'squat', 3, ['bbSquat', 'overhead', 'deepKnee']],
  ['월볼', 'quad', ['shoulder'], 'g', 'squat', 2, ['deepKnee', 'overhead']],
  ['슬레드 푸시', 'quad', ['calf', 'ham'], 'g', 'lunge', 1, []],
  ['힙 어덕션 머신', 'quad', [], 'g', 'glute', 1, []],
  // 햄스트링·둔근
  ['스모 데드리프트', 'ham', ['quad', 'back'], 'g', 'hinge', 3, ['bbHinge', 'spine']],
  ['트랩바 데드리프트', 'ham', ['quad', 'back'], 'g', 'hinge', 2, ['spine']],
  ['데피싯 데드리프트', 'ham', ['back', 'quad'], 'g', 'hinge', 3, ['bbHinge', 'spine']],
  ['스티프레그 데드리프트', 'ham', ['back'], 'g', 'hinge', 2, ['bbHinge', 'spine']],
  ['싱글레그 루마니안 데드리프트', 'ham', [], 'd', 'hinge', 2, []],
  ['케이블 풀스루', 'ham', [], 'g', 'hinge', 1, []],
  ['글루트 햄 레이즈', 'ham', [], 'g', 'kneeFlex', 3, []],
  ['스탠딩 레그컬', 'ham', [], 'g', 'kneeFlex', 1, []],
  ['스위스볼 레그컬', 'ham', [], 'b', 'kneeFlex', 1, []],
  ['바벨 글루트 브릿지', 'ham', [], 'g', 'glute', 1, []],
  ['머신 힙 쓰러스트', 'ham', [], 'g', 'glute', 1, []],
  ['케이블 킥백', 'ham', [], 'g', 'glute', 1, []],
  ['힙 어브덕션 머신', 'ham', [], 'g', 'glute', 1, []],
  ['케틀벨 스윙', 'ham', ['back', 'abs'], 'd', 'hinge', 2, ['spine']],
  ['리버스 하이퍼', 'ham', ['back'], 'g', 'glute', 1, []],
  ['백 익스텐션', 'ham', ['back'], 'g', 'hinge', 1, ['spine']],
  ['파워 클린', 'ham', ['quad', 'back', 'shoulder'], 'g', 'hinge', 3, ['bbHinge', 'wrist', 'spine']],
  ['행 클린', 'ham', ['quad', 'back', 'shoulder'], 'g', 'hinge', 3, ['bbHinge', 'wrist', 'spine']],
  ['파워 스내치', 'ham', ['back', 'shoulder', 'quad'], 'g', 'hinge', 3, ['bbHinge', 'overhead', 'spine']],
  ['슬레드 풀', 'ham', ['quad', 'back'], 'g', 'lunge', 1, []],
  // 이두
  ['EZ바 컬', 'bi', [], 'g', 'curl', 1, []],
  ['스파이더 컬', 'bi', [], 'd', 'curl', 1, []],
  ['컨센트레이션 컬', 'bi', [], 'd', 'curl', 1, []],
  ['드래그 컬', 'bi', [], 'g', 'curl', 2, []],
  ['리버스 컬', 'bi', [], 'g', 'curl', 1, ['wrist']],
  ['베이시안 케이블 컬', 'bi', [], 'g', 'curl', 1, []],
  ['머신 컬', 'bi', [], 'g', 'curl', 1, []],
  ['크로스바디 해머 컬', 'bi', [], 'd', 'curl', 1, []],
  ['덤벨 컬', 'bi', [], 'd', 'curl', 1, []],
  // 삼두
  ['JM 프레스', 'tri', ['chest'], 'g', 'triExt', 3, ['bbPress']],
  ['케이블 오버헤드 익스텐션', 'tri', [], 'g', 'triExt', 1, ['overhead']],
  ['크로스바디 케이블 익스텐션', 'tri', [], 'g', 'triExt', 1, []],
  ['로프 푸시다운', 'tri', [], 'g', 'triExt', 1, []],
  ['리버스그립 푸시다운', 'tri', [], 'g', 'triExt', 1, []],
  ['덤벨 스컬크러셔', 'tri', [], 'd', 'triExt', 1, []],
  ['테이트 프레스', 'tri', [], 'd', 'triExt', 2, []],
  ['머신 딥스', 'tri', ['chest'], 'g', 'triExt', 1, []],
  // 종아리
  ['동키 카프레이즈', 'calf', [], 'g', 'calf', 1, []],
  ['스미스 카프레이즈', 'calf', [], 'g', 'calf', 1, []],
  ['덤벨 카프레이즈', 'calf', [], 'd', 'calf', 1, []],
  ['티비알리스 레이즈', 'calf', [], 'b', 'calf', 1, []],
  // 복근·코어 (시간으로 하는 건 반복 칸에 초를 적어도 돼요)
  ['플랭크', 'abs', [], 'b', 'core', 1, []],
  ['사이드 플랭크', 'abs', [], 'b', 'core', 1, []],
  ['행잉 니레이즈', 'abs', [], 'b', 'core', 1, []],
  ['러시안 트위스트', 'abs', [], 'b', 'core', 1, ['spine']],
  ['팔로프 프레스', 'abs', [], 'g', 'core', 1, []],
  ['케이블 우드찹', 'abs', ['shoulder'], 'g', 'core', 1, []],
  ['할로우 바디 홀드', 'abs', [], 'b', 'core', 2, []],
  ['드래곤 플래그', 'abs', [], 'b', 'core', 3, ['spine']],
  ['디클라인 싯업', 'abs', [], 'g', 'core', 1, ['spine']],
  ['바이시클 크런치', 'abs', [], 'b', 'core', 1, []],
  ['마운틴 클라이머', 'abs', ['shoulder'], 'b', 'core', 1, ['wrist']],
  ['베어 크롤', 'abs', ['shoulder', 'quad'], 'b', 'core', 1, ['wrist']],
  ['파머스 워크', 'abs', ['back'], 'd', 'core', 1, []],
  ['수트케이스 캐리', 'abs', ['back'], 'd', 'core', 1, []],
  ['랜드마인 로테이션', 'abs', ['shoulder'], 'g', 'core', 2, []],
  ['메디신볼 슬램', 'abs', ['back', 'shoulder'], 'g', 'core', 1, ['overhead']],
];

export const LIBRARY: Exercise[] = [
  ...RAW.map(([n, m, s, need, p, lv, d]): Exercise => ({ n, m, s, need, p, lv, d })),
  ...EXTRA.map(([n, m, s, need, p, lv, d]): Exercise => ({ n, m, s, need, p, lv, d, extra: true })),
];

/** Can this exercise be done with the given equipment? Custom exercises are always allowed. */
export function available(e: Exercise, eq: Equipment = 'gym'): boolean {
  if (eq === 'gym') return true;
  if (eq === 'dumbbell') return e.need !== 'g';
  return e.need === 'b';
}

export function library(custom: CustomExercise[] = []): Exercise[] {
  return LIBRARY.concat(custom.map((c) => ({ n: c.n, m: c.m, s: [], need: 'b' as const, p: 'core' as const, lv: 1 as const, d: [] })));
}
