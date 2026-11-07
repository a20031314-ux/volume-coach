/**
 * 시작하기: the four first choices, made on MY instead of a separate first-run screen.
 * Nothing is pre-selected; what isn't chosen shows as 미입력 and calculations use general
 * defaults (maintenance calories, general volume) until it is.
 */
import { recommendedVolume } from './profile';
import { recommendRoutine } from './routine';
import type { Profile, Routine, Settings } from './types';

export type StartKey = 'goal' | 'schedule' | 'ability' | 'mode';

export const GOAL_NAME = { hyp: '근비대', str: '근력', cut: '감량', fit: '건강·체력' } as const;
const EQUIP = { gym: '헬스장', dumbbell: '덤벨만', bodyweight: '맨몸' } as const;
const YEARS = { '0': '1년 미만', '1': '1~3년', '3': '3년 이상' } as const;

export interface StartRow { key: StartKey; title: string; done: boolean; summary: string | null }

export function startRows(s: Settings): StartRow[] {
  const p = s.profile;
  return [
    { key: 'goal', title: '목적', done: !!p.goal, summary: p.goal ? [GOAL_NAME[p.goal], p.years ? YEARS[p.years] : null].filter(Boolean).join(' · ') : null },
    {
      key: 'schedule', title: '운동 일정·장비', done: p.days != null,
      summary: p.days != null ? [`주 ${p.days}일`, p.sessionMin ? `${p.sessionMin}분` : null, p.equipment ? EQUIP[p.equipment] : null].filter(Boolean).join(' · ') : null,
    },
    { key: 'ability', title: '할 수 있는 운동', done: s.ability.checked, summary: s.ability.checked ? '체크 완료' : null },
    { key: 'mode', title: '운동 방식', done: !!s.start?.mode, summary: s.start?.mode ? (s.planMode === 'routine' ? '루틴 따라 하기' : '자율형(규칙 기반)') : null },
  ];
}

/** shown for new people until they finish or tap 나중에 (people from the old setup never see it) */
export const startVisible = (s: Settings) => !!s.start && !s.start.skipped && startRows(s).some((r) => !r.done);
/** today runs on defaults: goal or schedule still missing */
export const onDefaults = (s: Settings) => !!s.start && (!s.profile.goal || s.profile.days == null);

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
  return { profile: { ...s.profile, goal: '', days: null, sessionMin: null, equipment: undefined, years: '' }, start: { mode: false, skipped: false } };
}
