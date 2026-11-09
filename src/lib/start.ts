/**
 * 시작하기: the four first choices, made on MY instead of a separate first-run screen.
 * Nothing is pre-selected; what isn't chosen shows as 미입력 and calculations use general
 * defaults (maintenance calories, general volume) until it is.
 */
import { focusLabel } from './focus';
import { gearOf, gearSummary } from './gear';
import { recommendedVolume } from './profile';
import { recommendRoutine } from './routine';
import type { Profile, Routine, Settings } from './types';

export type StartKey = 'goal' | 'schedule' | 'body' | 'ability' | 'mode';

export const GOAL_NAME = { hyp: '근비대', str: '근력', cut: '감량', fit: '건강·체력' } as const;

export interface StartRow {
  key: StartKey; title: string; done: boolean; summary: string | null;
  /** 필수(기본 루틴이 생기는 데 필요) or 더 정확하게(선택) */
  required: boolean;
  /** what choosing it makes */
  makes: string;
}

/** 몸 정보 is in when age, height and a weight (typed or from the latest 인바디) are known */
export const bodyDone = (p: Profile, inbodyWeight?: number | null) => !!p.age && !!p.height && !!(p.weight || inbodyWeight);

export function startRows(s: Settings, inbodyWeight?: number | null): StartRow[] {
  const p = s.profile;
  const w = p.weight || inbodyWeight;
  return [
    { key: 'goal', title: '목적', required: true, makes: '주간 볼륨·영양 방향', done: !!p.goal, summary: p.goal ? focusLabel(p) : null },
    {
      key: 'schedule', title: '운동 일정·장비', required: true, makes: '오늘 운동 추천', done: p.days != null,
      summary: p.days != null ? [`주 ${p.days}일`, p.sessionMin ? `${p.sessionMin}분` : null, gearSummary(gearOf(p))].filter(Boolean).join(' · ') : null,
    },
    {
      key: 'body', title: '몸 정보', required: true, makes: '칼로리·단백질 목표', done: bodyDone(p, inbodyWeight),
      summary: bodyDone(p, inbodyWeight) ? [`${p.age}세`, `${p.height}cm`, `${w}kg`].join(' · ') : null,
    },
    { key: 'ability', title: '할 수 있는 운동', required: false, makes: '어려운 종목도 추천', done: s.ability.checked, summary: s.ability.checked ? '체크 완료' : null },
    { key: 'mode', title: '운동 방식', required: false, makes: '자율형 또는 요일별 루틴', done: !!s.start?.mode, summary: s.start?.mode ? (s.planMode === 'routine' ? '루틴 따라 하기' : '자율형(규칙 기반)') : null },
  ];
}

/** No defaults: without a goal and a schedule there's nothing to recommend from. */
export const needsChoice = (s: Settings) => !s.profile.goal || s.profile.days == null;
/**
 * Shown while goal or schedule is missing (for anyone), and for new people until the other two are
 * chosen or they tap 나중에 (only offered once goal and schedule are in).
 */
export const startVisible = (s: Settings, inbodyWeight?: number | null) => needsChoice(s) || (!!s.start && !s.start.skipped && startRows(s, inbodyWeight).some((r) => !r.done));
export const missingChoices = (s: Settings) => [!s.profile.goal ? '목적' : null, s.profile.days == null ? '운동 일정' : null].filter((x): x is string => !!x);

/** 목적 saved: profile + the recommended weekly volume for it */
export function applyGoal(s: Settings, patch: Pick<Profile, 'goal'> & Partial<Profile>): Partial<Settings> {
  const profile = { ...s.profile, ...patch };
  const { rec } = recommendedVolume(profile);
  return { profile, min: rec.min, max: rec.max, minEx: rec.minEx, cap: rec.cap, mcap: rec.mcap };
}

export function applySchedule(s: Settings, patch: Partial<Profile>): Partial<Settings> {
  return { profile: { ...s.profile, ...patch } };
}

/** 운동 방식 saved: routine mode gets a recommended routine when there isn't one */
export function applyMode(s: Settings, mode: 'auto' | 'routine', known: Set<string>, hasRoutine: boolean):
  { patch: Partial<Settings>; routine: Omit<Routine, 'id' | 'updatedAt'> | null } {
  const patch: Partial<Settings> = { planMode: mode, start: { ...(s.start ?? {}), mode: true } };
  const routine = mode === 'routine' && !hasRoutine ? recommendRoutine({ profile: s.profile, settings: s, known }) : null;
  return { patch, routine };
}

/** "목적·일정 다시 고르기": clear the choices so the card comes back (records are untouched) */
export function restart(s: Settings): Partial<Settings> {
  return { profile: { ...s.profile, goal: '', days: null, sessionMin: null, equipment: undefined, gear: null, years: '' }, start: { mode: false, skipped: false } };
}
