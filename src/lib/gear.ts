/**
 * 장비: what the user has (checked), and what each exercise needs — a list of alternatives, each a
 * set of gear that must all be there (랫풀다운 = 케이블 or 머신; 바벨 벤치프레스 = 바벨 + 벤치 + 랙).
 */
import type { Exercise } from './exercises';

export type Gear = 'barbell' | 'rack' | 'bench' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'smith' | 'pullup' | 'dip' | 'band' | 'misc';

export const GEAR: { k: Gear; n: string }[] = [
  { k: 'barbell', n: '바벨·원판' }, { k: 'rack', n: '스쿼트랙·파워랙' }, { k: 'bench', n: '벤치' },
  { k: 'dumbbell', n: '덤벨' }, { k: 'kettlebell', n: '케틀벨' }, { k: 'cable', n: '케이블' },
  { k: 'machine', n: '머신(레그프레스·레그컬 등)' }, { k: 'smith', n: '스미스머신' }, { k: 'pullup', n: '철봉' },
  { k: 'dip', n: '딥스대' }, { k: 'band', n: '밴드' }, { k: 'misc', n: '소도구(메디신볼·박스·TRX·롤러)' },
];
export const GEAR_NAME = Object.fromEntries(GEAR.map((g) => [g.k, g.n])) as Record<Gear, string>;
export const ALL_GEAR = GEAR.map((g) => g.k);

export const GEAR_PRESETS: { n: string; gear: Gear[] }[] = [
  { n: '헬스장', gear: ALL_GEAR },
  { n: '홈짐', gear: ['barbell', 'rack', 'bench', 'dumbbell', 'pullup'] },
  { n: '덤벨·철봉', gear: ['dumbbell', 'bench', 'pullup'] },
  { n: '맨몸만', gear: [] },
];

/** the old single choice, carried over */
export function fromLegacy(eq: 'gym' | 'dumbbell' | 'bodyweight' | undefined): Gear[] | undefined {
  if (eq === 'gym') return ALL_GEAR;
  if (eq === 'dumbbell') return ['dumbbell', 'bench'];
  // the old 맨몸 assumed a pull-up bar
  if (eq === 'bodyweight') return ['pullup'];
  return undefined;
}

const has = (n: string, ...words: string[]) => words.some((w) => n.includes(w));
const NONE: Gear[][] = [[]];

const MACHINE = ['레그프레스', '핵스쿼트', '펙덱', '레그 익스텐션', '레그컬', '펜듈럼 스쿼트', '벨트 스쿼트', '동키 카프레이즈', '시티드 카프레이즈', '글루트 햄 레이즈', '리버스 하이퍼', '백 익스텐션'];
const BENCH_PRESS = ['벤치프레스', '인클라인 바벨프레스', '디클라인 바벨프레스', '스포토 프레스', '라슨 프레스', '핀 프레스'];
const RACKED = ['백스쿼트', '프론트스쿼트', '퍼즈 스쿼트', '박스 스쿼트', '세이프티바 스쿼트', '로우바 스쿼트', '오버헤드프레스', '푸시 프레스', 'Z 프레스', '바벨 런지', '굿모닝', '랙풀'];
const BARBELL = ['바벨', '데드리프트', '클린', '스내치', '펜들레이', '예이츠', '업라이트 로우', 'EZ바', '드래그 컬', '리버스 컬', '쓰러스터', '젤처', '랜드마인', '티바 로우', '메도우스 로우', '플로어 프레스'];
const BENCH_DB = ['인클라인 덤벨', '덤벨 벤치프레스', '덤벨 플라이', '덤벨 풀오버', '체스트 서포티드', '시티드 덤벨프레스', '스파이더 컬', '덤벨 스컬크러셔', '테이트 프레스'];

/** What an exercise needs, as alternatives (any one set is enough). */
export function gearFor(e: Pick<Exercise, 'n' | 'need'>): Gear[][] {
  const n = e.n;
  if (e.need === 'b') {
    if (n === '밴드 보조 풀업') return [['band', 'pullup']];
    if (has(n, '풀업', '친업', '행잉')) return [['pullup']];
    if (n === '딥스') return [['dip']];
    if (n === '인버티드 로우') return [['pullup'], ['rack', 'barbell'], ['smith']];
    if (has(n, '밴드')) return [['band']];
    if (has(n, 'TRX', '앱 롤아웃', '박스 점프', '스위스볼')) return [['misc']];
    return NONE;
  }
  if (e.need === 'd') {
    if (has(n, '케틀벨', '터키시 겟업', '파머스', '수트케이스')) return [['kettlebell'], ['dumbbell']];
    if (has(n, ...BENCH_DB)) return [['dumbbell', 'bench']];
    return [['dumbbell']];
  }
  // gym
  if (has(n, '스미스')) return [['smith']];
  if (has(n, '랫풀다운')) return [['cable'], ['machine']];
  if (has(n, '머신', ...MACHINE)) return [['machine']];
  if (n === '스탠딩 카프레이즈') return [['machine'], ['smith'], ['barbell', 'rack']];
  if (has(n, '케이블', '풀다운', '페이스풀', '푸시다운', '팔로프', '우드찹', '풀스루')) return [['cable']];
  if (n === '프리처 컬') return [['barbell', 'bench'], ['machine']];
  if (n === '웨이티드 풀업') return [['pullup']];
  if (n === '웨이티드 딥스') return [['dip']];
  if (has(n, '슬레드', '월볼', '메디신볼')) return [['misc']];
  if (n === '디클라인 싯업') return [['bench']];
  if (has(n, ...BENCH_PRESS)) return [['barbell', 'bench', 'rack']];
  if (has(n, ...RACKED)) return [['barbell', 'rack']];
  if (has(n, '라잉 트라이셉스', 'JM 프레스', '실 로우', '힙 쓰러스트')) return [['barbell', 'bench']];
  if (has(n, ...BARBELL)) return [['barbell']];
  return UNKNOWN;
}

/** sentinel for gym exercises no rule covers (tests make sure there are none) */
export const UNKNOWN: Gear[][] = [['machine']];

/** the gear a profile has: the new checklist, else the old single choice carried over */
export function gearOf(p: { gear?: Gear[] | null; equipment?: 'gym' | 'dumbbell' | 'bodyweight' }): Gear[] | undefined {
  return p.gear ?? fromLegacy(p.equipment);
}

/** Can it be done with this gear? Unset gear (not chosen) limits nothing. */
export function canDo(e: Pick<Exercise, 'n' | 'need'>, gear: Gear[] | undefined): boolean {
  if (!gear) return true;
  return gearFor(e).some((set) => set.every((g) => gear.includes(g)));
}

export function gearSummary(gear: Gear[] | undefined): string | null {
  if (!gear) return null;
  const preset = GEAR_PRESETS.find((p) => p.gear.length === gear.length && p.gear.every((g) => gear.includes(g)));
  if (preset) return preset.n;
  return gear.length > 3 ? `장비 ${gear.length}종` : gear.map((g) => GEAR_NAME[g].split('(')[0]).join('·');
}
