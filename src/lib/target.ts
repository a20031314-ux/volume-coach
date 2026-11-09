/**
 * 목표(기한 있는 구체 목표)와 다각형(평소 방향)이 시간을 나누는 규칙. 지금은 중량 목표(1RM) — 중량 프로그램을 감싼다.
 *
 * 우선순위(목표마다 고름):
 *  - 목표 우선: 목표에 필요한 횟수를 먼저 잡고, 남은 시간을 다각형 비율로.
 *  - 균형: 일정이 넘치면 목표가 한 번 양보(주 1회 줄임), 기한이 조금 밀림.
 *  - 다각형 우선: 다각형을 먼저 채우고 남는 시간으로 목표(최소 주 1회).
 * 어느 쪽이든 유지량: 다각형에서 고른 축은 최소 1단계, 목표는 최소 주 1회.
 */
import { NO_FOCUS, planWork, primary, effectLevel, FOCUS_NAME, type Focus, type FocusKey } from './focus';
import type { StrengthProgram } from './progression';
import type { Profile } from './types';

export type Priority = 'goal' | 'balance' | 'focus';
export const PRIORITY_NAME: Record<Priority, string> = { goal: '목표 우선', balance: '균형', focus: '다각형 우선' };
export const PRIORITY_NOTE: Record<Priority, string> = {
  goal: '기한 안에 달성하도록 목표 운동을 먼저 잡아요. 다각형은 남는 시간만큼.',
  balance: '일정이 넘치면 목표가 한 번 양보해요. 기한이 조금 밀려요.',
  focus: '평소 운동을 먼저 채우고 남는 시간으로 목표. 달성 예상일만 알려줘요.',
};

/** one program session for the lift, warm-ups included */
export const LIFT_SESSION_MIN = 25;
/** what a lifter of this experience can usually add to a 1RM per month, % (training it 3×/week) */
const RATE: Record<string, number> = { '0': 4, '1': 2.5, '3': 1.5, '': 2.5 };
/** fewer sessions a week → slower */
const FREQ: Record<1 | 2 | 3, number> = { 1: 0.6, 2: 0.85, 3: 1 };
const WEEKS_PER_MONTH = 4.345;

export const weeksUntil = (from: string, to: string) => Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / (7 * 86400000)));

export function liftEta(start1rm: number, target1rm: number, perWeek: 1 | 2 | 3, years: Profile['years']): number {
  const need = (target1rm / start1rm - 1) * 100;
  const rate = (RATE[years ?? ''] ?? 2.5) * FREQ[perWeek];
  return Math.max(2, Math.ceil((need / rate) * WEEKS_PER_MONTH));
}

/** every chosen axis down to 1 — what keeps the polygon from slipping */
export const maintenanceOf = (f: Focus): Focus => {
  const out = { ...NO_FOCUS };
  for (const k of Object.keys(f) as FocusKey[]) out[k] = f[k] ? 1 : 0;
  return out;
};

export interface PriorityOption {
  priority: Priority;
  perWeek: 1 | 2 | 3;
  /** weeks until the target, at this pace */
  weeks: number;
  /** meets the deadline */
  onTime: boolean;
  /** minutes a week the goal takes / the polygon gets */
  goalMin: number;
  focusMin: number;
  /** the polygon's lead axis, as it ends up (0~3) */
  lead: { k: FocusKey; level: number } | null;
  /** even the maintenance doses don't fit */
  tooTight: boolean;
}

/** the three ways to share the week, worked out so the user can pick by the numbers */
export function priorityOptions(x: {
  focus: Focus; budget: number | null; years: Profile['years'];
  start1rm: number; target1rm: number; deadlineWeeks: number;
}): PriorityOption[] {
  const { focus, budget, years } = x;
  const top = primary(focus);
  // the lift sessions are heavy work: they count toward 근력 (and some 근비대) too
  const prior = (pw: number) => ({ heavy: pw * LIFT_SESSION_MIN });
  const fullFor = (pw: number) => planWork(focus, null, prior(pw)).total;
  const keepFor = (pw: number) => planWork(maintenanceOf(focus), null, prior(pw)).total;
  const eta = (pw: 1 | 2 | 3) => liftEta(x.start1rm, x.target1rm, pw, years);
  // the fewest sessions that make the deadline (3 if none does)
  const needPw = ([1, 2, 3] as const).find((pw) => eta(pw) <= x.deadlineWeeks) ?? 3;
  const option = (priority: Priority, perWeek: 1 | 2 | 3): PriorityOption => {
    const goalMin = perWeek * LIFT_SESSION_MIN;
    const full = fullFor(perWeek), keep = keepFor(perWeek);
    const left = budget == null ? full : Math.max(0, budget - goalMin);
    // the polygon gets what's left (never below its maintenance dose); priorities differ in how many goal sessions
    const focusMin = Math.min(full, Math.max(left, keep));
    const plan = planWork(focus, focusMin || null, prior(perWeek));
    const weeks = eta(perWeek);
    return {
      priority, perWeek, weeks, onTime: weeks <= x.deadlineWeeks, goalMin, focusMin,
      lead: top ? { k: top, level: Math.min(3, effectLevel(top, plan.effect[top])) } : null,
      tooTight: budget != null && goalMin + keep > budget,
    };
  };
  const over = (pw: number) => budget != null && pw * LIFT_SESSION_MIN + fullFor(pw) > budget;
  const balancePw = (over(needPw) ? Math.max(1, needPw - 1) : needPw) as 1 | 2 | 3;
  // 다각형 우선: as many sessions as fit next to the full polygon (at least 1)
  const focusPw = (budget == null ? needPw : ([3, 2, 1] as const).find((pw) => pw <= needPw && !over(pw)) ?? 1) as 1 | 2 | 3;
  return [option('goal', needPw), option('balance', balancePw), option('focus', focusPw)];
}

/** default: a deadline within 12 weeks → 목표 우선, otherwise 균형 */
export const defaultPriority = (deadlineWeeks: number): Priority => (deadlineWeeks <= 12 ? 'goal' : 'balance');

/** the polygon floor a goal sets: 근력 2 (목표 우선·균형) or 1 (다각형 우선) */
export const floorFor = (priority: Priority): Partial<Focus> => ({ str: priority === 'focus' ? 1 : 2 });

export function withFloor(f: Focus, floor: Partial<Focus>): Focus {
  const out = { ...f };
  for (const [k, v] of Object.entries(floor) as [FocusKey, number][]) if (out[k] < v) out[k] = v as Focus[FocusKey];
  return out;
}

/** "근비대 2.2단계" */
export const leadText = (o: PriorityOption) => (o.lead ? `${FOCUS_NAME[o.lead.k]} ${Math.round(o.lead.level * 10) / 10}단계` : '');

/** program fields for the chosen option (weeks clamped to what the program supports) */
export function programFor(o: PriorityOption, base: Pick<StrengthProgram, 'lift' | 'start' | 'start1rm' | 'target1rm'>, deadline: string, deadlineWeeks: number): StrengthProgram {
  const weeks = Math.max(4, Math.min(24, o.priority === 'goal' ? deadlineWeeks : Math.max(deadlineWeeks, o.weeks)));
  return { ...base, weeks, perWeek: o.perWeek, deadline, priority: o.priority, startAt: Date.now() };
}
