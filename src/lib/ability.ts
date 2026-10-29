/** Which exercises this user can and wants to do. Pure functions shared by every recommender. */
import { MUSCLE_NAME, available, library, type Demand, type Exercise } from './exercises';
import type { Ability, MuscleKey, PainMove, Session, Settings, WorkoutLog } from './types';

export const PAIN_NAME: Record<PainMove, string> = {
  overhead: '머리 위로 밀기',
  deepKnee: '무릎 깊게 굽히기',
  spine: '허리 숙여 들기',
  wrist: '손목에 체중 싣기',
  deepShoulder: '어깨 뒤로 깊게 젖히기',
};

export type AbilityCtx = Pick<Settings, 'ability' | 'exercisePrefs' | 'customExercises' | 'profile'> & {
  /** exercises the user has logged before */
  known?: Set<string>;
};

export interface Verdict {
  ok: boolean;
  /** hard: never recommend (can't / pain / missing skill). soft: recommend only if done before. */
  kind?: 'hard' | 'soft';
  reason?: string;
}

const SKILL: Partial<Record<Demand, (a: Ability) => 'yes' | 'no' | 'unknown'>> = {
  pullup: (a) => (a.pullups === 'unknown' ? 'unknown' : a.pullups === '0' ? 'no' : 'yes'),
  pushup: (a) => (a.pushups === 'unknown' ? 'unknown' : a.pushups === '0-5' ? 'no' : 'yes'),
  dip: (a) => a.dips,
  bbSquat: (a) => a.bbSquat,
  bbHinge: (a) => a.bbHinge,
  bbPress: (a) => a.bbPress,
};
const SKILL_NO: Partial<Record<Demand, string>> = {
  pullup: '턱걸이를 아직 못 해요', pushup: '푸시업이 5개 이하예요', dip: '딥스를 못 해요',
  bbSquat: '바벨 스쿼트 경험이 없어요', bbHinge: '바벨 데드리프트 경험이 없어요', bbPress: '바벨 프레스 경험이 없어요',
};

/** Can this exercise go into a recommendation for this user? */
export function verdict(e: Exercise, ctx: AbilityCtx): Verdict {
  const pref = ctx.exercisePrefs[e.n];
  if (pref === 'cant') return { ok: false, kind: 'hard', reason: '못 함으로 표시했어요' };
  const pain = e.d.find((d) => (ctx.ability.pain as string[]).includes(d)) as PainMove | undefined;
  if (pain) return { ok: false, kind: 'hard', reason: `${PAIN_NAME[pain]}가 불편해요` };
  for (const d of e.d) {
    const f = SKILL[d];
    if (f && f(ctx.ability) === 'no' && !ctx.known?.has(e.n)) return { ok: false, kind: 'hard', reason: SKILL_NO[d] };
  }
  if (pref === 'dislike') return { ok: false, kind: 'soft', reason: '안 하고 싶음으로 표시했어요' };
  if (ctx.known?.has(e.n) || pref === 'fav') return { ok: true };
  // not checked yet, or a beginner: keep to exercises that are easy to start with
  // a skill left blank in the check counts as "not yet" until the log shows otherwise
  const unknownSkill = e.d.some((d) => SKILL[d]?.(ctx.ability) === 'unknown');
  if (unknownSkill) return { ok: false, kind: 'soft', reason: ctx.ability.checked ? '체크에서 비워둔 항목이라 쉬운 운동부터 추천해요' : '능력 체크 전이라 쉬운 운동부터 추천해요' };
  if (e.lv === 3 && (!ctx.ability.checked || ctx.profile.years === '0' || !ctx.profile.years)) {
    return { ok: false, kind: 'soft', reason: '익숙해진 뒤에 추천해요' };
  }
  return { ok: true };
}

/** Rank: favourites, then exercises done before, then the library's own order. */
function rank(e: Exercise, ctx: AbilityCtx): number {
  const pref = ctx.exercisePrefs[e.n];
  return pref === 'fav' ? 0 : ctx.known?.has(e.n) ? 1 : 2;
}

/** Recommendable exercises, best first. */
export function candidates(ctx: AbilityCtx, filter: (e: Exercise) => boolean = () => true): Exercise[] {
  const eq = ctx.profile.equipment ?? 'gym';
  const lib = library(ctx.customExercises).map((e, i) => ({ e, i }))
    .filter(({ e }) => filter(e) && available(e, eq) && verdict(e, ctx).ok);
  return lib.sort((a, b) => rank(a.e, ctx) - rank(b.e, ctx) || a.i - b.i).map(({ e }) => e);
}

export const candidatesFor = (muscle: MuscleKey, ctx: AbilityCtx) => candidates(ctx, (e) => e.m === muscle);

/** Exercises for manual pickers: everything except "can't", favourites first. */
export function pickable(muscle: MuscleKey, ctx: AbilityCtx, equipmentOnly = false): Exercise[] {
  const eq = ctx.profile.equipment ?? 'gym';
  return library(ctx.customExercises).map((e, i) => ({ e, i }))
    .filter(({ e }) => e.m === muscle && ctx.exercisePrefs[e.n] !== 'cant' && (!equipmentOnly || available(e, eq)))
    .sort((a, b) => rank(a.e, ctx) - rank(b.e, ctx) || a.i - b.i)
    .map(({ e }) => e);
}

/** Substitutes for an exercise: same muscle, same movement pattern first. */
export function substitutes(name: string, muscle: MuscleKey, ctx: AbilityCtx): string[] {
  const me = library(ctx.customExercises).find((e) => e.n === name);
  const list = candidatesFor(muscle, ctx).filter((e) => e.n !== name);
  return [...list.filter((e) => e.p === me?.p), ...list.filter((e) => e.p !== me?.p)].map((e) => e.n);
}

export const knownExercises = (logs: WorkoutLog[]) => new Set(logs.filter((l) => !l.deleted).map((l) => l.exercise));

/* ---------- hints ---------- */

export interface Hint {
  key: string;
  text: string;
  action: { label: string; patch: Partial<Pick<Settings, 'ability' | 'exercisePrefs'>> } | { label: string; route: string };
}

export function abilityHints(s: Pick<Settings, 'ability' | 'exercisePrefs' | 'dismissed'>, sessions: Session[], now: number): Hint[] {
  const out: Hint[] = [];
  const dismissed = new Set(s.dismissed);
  if (!s.ability.checked && !dismissed.has('ability-intro')) {
    out.push({ key: 'ability-intro', text: '1분 체크하면 할 수 있는 운동만 골라서 추천해요. 턱걸이·푸시업 개수, 바벨 경험, 불편한 동작을 물어봐요.', action: { label: '체크하기', route: '/ability' } });
  }
  // exercises skipped 3+ times in 30 days
  const since = now - 30 * 864e5;
  const skips = new Map<string, number>();
  let bestPull = 0, bestAssisted = 0;
  for (const se of sessions) {
    if (se.deleted || se.startedAt < since) continue;
    for (const e of se.exercises) {
      if (e.status === 'skipped' && se.endedAt != null) skips.set(e.name, (skips.get(e.name) ?? 0) + 1);
      for (const st of e.sets) {
        if (e.name === '풀업' || e.name === '친업') bestPull = Math.max(bestPull, st.reps ?? 0);
        if (e.name === '밴드 보조 풀업' || e.name === '어시스트 풀업 머신') bestAssisted = Math.max(bestAssisted, st.reps ?? 0);
      }
    }
  }
  for (const [name, n] of skips) {
    const key = `skip:${name}`;
    if (n >= 3 && !s.exercisePrefs[name] && !dismissed.has(key)) {
      out.push({ key, text: `${name}을 최근 ${n}번 건너뛰었어요. 추천에서 뺄까요?`, action: { label: '추천에서 빼기', patch: { exercisePrefs: { ...s.exercisePrefs, [name]: 'dislike' } } } });
    }
  }
  const a = s.ability;
  if ((a.pullups === '0' || a.pullups === 'unknown') && bestPull >= 1 && !dismissed.has('pull:1-5')) {
    out.push({ key: 'pull:1-5', text: `턱걸이를 ${bestPull}개 했어요. 턱걸이 능력을 '1~5개'로 바꾸면 풀업도 추천해요.`, action: { label: '바꾸기', patch: { ability: { ...a, pullups: bestPull >= 6 ? '6+' : '1-5' } } } });
  } else if (a.pullups === '1-5' && bestPull >= 6 && !dismissed.has('pull:6+')) {
    out.push({ key: 'pull:6+', text: `턱걸이를 한 세트에 ${bestPull}개 했어요. '6개 이상'으로 바꿀까요?`, action: { label: '바꾸기', patch: { ability: { ...a, pullups: '6+' } } } });
  } else if (a.pullups === '0' && bestAssisted >= 10 && !dismissed.has('pull:try')) {
    out.push({ key: 'pull:try', text: `보조 풀업을 ${bestAssisted}개까지 했어요. 일반 풀업을 시도해 볼까요? 1개라도 되면 '1~5개'로 바꿔 주세요.`, action: { label: '1~5개로 바꾸기', patch: { ability: { ...a, pullups: '1-5' } } } });
  }
  return out;
}

export const muscleName = (m: MuscleKey) => MUSCLE_NAME[m];
