/** Routines: recommended splits, weekly volume checks, and which day is up today. Pure functions. */
import { candidates, substitutes, type AbilityCtx } from './ability';
import { HEAVY, MUSCLES, MUSCLE_NAME, library, type Equipment, type Exercise } from './exercises';
import { recommendedVolume } from './profile';
import type { Goal, MuscleKey, Profile, Routine, RoutineDay, Session, Settings } from './types';

interface Slot { m: MuscleKey; pref?: string[] }
interface DayTemplate { name: string; slots: Slot[] }

const LATERAL = ['사이드 레터럴 레이즈', '케이블 레터럴 레이즈'];
const REAR = ['리어델트 플라이', '페이스풀'];

const T = {
  fullA: { name: '전신 A', slots: [{ m: 'quad' }, { m: 'chest' }, { m: 'back' }, { m: 'ham' }, { m: 'shoulder', pref: LATERAL }, { m: 'abs' }] },
  fullB: { name: '전신 B', slots: [{ m: 'ham' }, { m: 'back' }, { m: 'chest' }, { m: 'quad' }, { m: 'shoulder' }, { m: 'bi' }, { m: 'tri' }] },
  fullC: { name: '전신 C', slots: [{ m: 'quad' }, { m: 'chest' }, { m: 'back' }, { m: 'shoulder', pref: REAR }, { m: 'calf' }, { m: 'bi' }, { m: 'tri' }] },
  upperA: { name: '상체 A', slots: [{ m: 'chest' }, { m: 'back' }, { m: 'shoulder' }, { m: 'tri' }, { m: 'bi' }] },
  upperB: { name: '상체 B', slots: [{ m: 'back' }, { m: 'chest' }, { m: 'shoulder', pref: LATERAL }, { m: 'bi' }, { m: 'tri' }] },
  lowerA: { name: '하체 A', slots: [{ m: 'quad' }, { m: 'ham' }, { m: 'calf' }, { m: 'abs' }] },
  lowerB: { name: '하체 B', slots: [{ m: 'ham' }, { m: 'quad' }, { m: 'calf' }, { m: 'abs' }] },
  push: { name: '밀기', slots: [{ m: 'chest' }, { m: 'shoulder' }, { m: 'shoulder', pref: LATERAL }, { m: 'tri' }] },
  pull: { name: '당기기', slots: [{ m: 'back' }, { m: 'shoulder', pref: REAR }, { m: 'bi' }] },
  legs: { name: '하체', slots: [{ m: 'quad' }, { m: 'ham' }, { m: 'calf' }, { m: 'abs' }] },
} satisfies Record<string, DayTemplate>;

/** The split for a number of training days and experience level. */
export function splitFor(days: number, years: Profile['years']): { label: string; days: DayTemplate[] } {
  const d = Math.max(2, Math.min(6, Math.round(days)));
  if (d === 2) return { label: '주 2일 전신', days: [T.fullA, T.fullB] };
  if (d === 3) {
    return years === '0' || !years
      ? { label: '주 3일 전신', days: [T.fullA, T.fullB, T.fullC] }
      : { label: '주 3일 상체·하체·전신', days: [T.upperA, T.lowerA, T.fullC] };
  }
  if (d === 4) return { label: '주 4일 상체·하체', days: [T.upperA, T.lowerA, T.upperB, T.lowerB] };
  if (d === 5) return { label: '주 5일 상하체 + 밀기·당기기·하체', days: [T.upperA, T.lowerA, T.push, T.pull, T.legs] };
  return {
    label: '주 6일 밀기·당기기·하체 ×2',
    days: [T.push, T.pull, T.legs, { ...T.push, name: '밀기 B' }, { ...T.pull, name: '당기기 B' }, { ...T.legs, name: '하체 B' }],
  };
}

/** Default weekdays (0 = Sun) for n training days. */
export function defaultWeekdays(n: number): number[][] {
  const pattern: Record<number, number[]> = { 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  const days = pattern[Math.max(1, Math.min(7, n))];
  return Array.from({ length: n }, (_, i) => (days[i] != null ? [days[i]] : []));
}

const SMALL = new Set<MuscleKey>(['bi', 'tri', 'calf', 'abs']);

export interface RecommendOptions {
  profile: Profile;
  settings: Pick<Settings, 'customExercises' | 'ability' | 'exercisePrefs'>;
  schedule?: Routine['schedule'];
  /** exercises logged before */
  known?: Set<string>;
}

/** Build a recommended routine from the profile: split by days and experience, sets by goal and age, exercises by equipment. */
export function recommendRoutine({ profile, settings, schedule = 'rotation', known }: RecommendOptions): Omit<Routine, 'id' | 'updatedAt'> {
  const days = profile.days ?? 4;
  const split = splitFor(days, profile.years);
  const { rec } = recommendedVolume(profile);
  const eq: Equipment = profile.equipment ?? 'gym';
  const avoid = new Set(profile.avoid ?? []);
  // only exercises this user can and wants to do, favourites and familiar ones first
  const lib = candidates({ ability: settings.ability, exercisePrefs: settings.exercisePrefs, customExercises: settings.customExercises, profile: { ...profile, equipment: eq }, known });
  // per-session set budget: about 3 minutes per working set including rest
  const budget = Math.min(rec.cap, Math.max(8, Math.floor((profile.sessionMin ?? 60) / 3)));

  // weekly direct sets per muscle: big muscles mid-range, small ones (that also get indirect work) low end
  // arms get plenty of indirect work from presses and rows, so they need fewer direct sets
  const target = (m: MuscleKey) => (m === 'bi' || m === 'tri' ? Math.round(rec.min * 0.7) : SMALL.has(m) ? rec.min : Math.round((rec.min + rec.max) / 2));
  const freq = new Map<MuscleKey, number>();
  for (const d of split.days) for (const m of new Set(d.slots.map((s) => s.m))) freq.set(m, (freq.get(m) ?? 0) + 1);

  const used = new Map<MuscleKey, number>(); // rotate exercise choice across the week
  const pick = (slot: Slot, taken: Set<string>, lightOnly: boolean): Exercise | null => {
    let pool = lib.filter((e) => e.m === slot.m && !taken.has(e.n));
    // one heavy compound per muscle per day is enough; the second exercise is an accessory
    if (lightOnly && pool.some((e) => !HEAVY.has(e.n))) pool = pool.filter((e) => !HEAVY.has(e.n));
    const preferred = slot.pref ? pool.filter((e) => slot.pref!.includes(e.n)) : [];
    const list = preferred.length ? preferred : pool;
    if (!list.length) return null;
    const i = used.get(slot.m) ?? 0;
    used.set(slot.m, i + 1);
    return list[i % list.length];
  };

  const weekdays = defaultWeekdays(split.days.length);
  const out: RoutineDay[] = split.days.map((d, di) => {
    const slots = d.slots.filter((s) => !avoid.has(s.m));
    const perSlot = new Map<Slot, number>();
    for (const s of slots) {
      const sameMuscle = slots.filter((x) => x.m === s.m).length;
      perSlot.set(s, target(s.m) / (freq.get(s.m) ?? 1) / sameMuscle);
    }
    const exercises: Routine['days'][number]['exercises'] = [];
    const taken = new Set<string>();
    for (const s of slots) {
      let sets = Math.round(perSlot.get(s) ?? 0);
      if (sets < 2) sets = 2;
      // big blocks become two exercises so the week gets variety
      const parts = sets >= 6 && !SMALL.has(s.m) ? 2 : 1;
      for (let k = 0; k < parts; k++) {
        const heavyAlready = exercises.some((e) => e.muscle === s.m && HEAVY.has(e.name));
        const ex = pick(s, taken, k > 0 || heavyAlready);
        if (!ex) continue;
        taken.add(ex.n);
        exercises.push({ name: ex.n, muscle: s.m, sets: Math.min(SMALL.has(s.m) ? 6 : 5, Math.round(sets / parts)) });
      }
    }
    // fit the time budget: trim from the end (accessories), never below 2 sets
    let total = exercises.reduce((a, e) => a + e.sets, 0);
    for (let guard = 0; total > budget && guard < 100; guard++) {
      const i = [...exercises.keys()].reverse().find((j) => exercises[j].sets > 2);
      if (i == null) { exercises.pop(); } else exercises[i].sets -= 1;
      total = exercises.reduce((a, e) => a + e.sets, 0);
    }
    return { key: `d${di + 1}`, name: d.name, weekdays: weekdays[di], exercises };
  });

  const goalName: Record<Goal, string> = { hyp: '근비대', str: '근력', cut: '감량', fit: '건강' };
  return {
    name: `${goalName[profile.goal]} · ${split.label}`,
    source: 'recommended', goal: profile.goal, schedule, days: out,
  };
}

export interface VolumeCheck { muscle: MuscleKey; name: string; sets: number; status: 'low' | 'ok' | 'high' | 'off' }

/** Weekly sets per muscle the routine produces, against the settings' range. */
export function weeklyVolume(r: Pick<Routine, 'days' | 'schedule'>, s: Pick<Settings, 'min' | 'max' | 'sec' | 'customExercises' | 'off'>, daysPerWeek?: number | null): VolumeCheck[] {
  const lib = library(s.customExercises);
  const perCycle = new Map<MuscleKey, number>();
  let timesPerWeek: (d: RoutineDay) => number;
  if (r.schedule === 'weekday') timesPerWeek = (d) => d.weekdays.length;
  else {
    const f = (daysPerWeek ?? r.days.length) / Math.max(1, r.days.length);
    timesPerWeek = () => f;
  }
  for (const d of r.days) {
    const times = timesPerWeek(d);
    for (const e of d.exercises) {
      perCycle.set(e.muscle, (perCycle.get(e.muscle) ?? 0) + e.sets * times);
      for (const m of lib.find((x) => x.n === e.name)?.s ?? []) perCycle.set(m, (perCycle.get(m) ?? 0) + e.sets * s.sec * times);
    }
  }
  return MUSCLES.map(({ k }) => {
    const sets = Math.round((perCycle.get(k) ?? 0) * 10) / 10;
    const status: VolumeCheck['status'] = s.off.includes(k) ? 'off' : sets < s.min ? 'low' : sets > s.max ? 'high' : 'ok';
    return { muscle: k, name: MUSCLE_NAME[k], sets, status };
  });
}

export interface TodayDay {
  day: RoutineDay | null;
  index: number;
  reason: 'weekday' | 'rest' | 'next' | 'done' | 'first';
}

/** Which routine day is up today. Weekday routines follow the calendar; rotations continue from the last session. */
export function todayDay(r: Routine, sessions: Session[], todayIso: string, weekday: number): TodayDay {
  if (!r.days.length) return { day: null, index: -1, reason: 'rest' };
  const mine = sessions
    .filter((s) => !s.deleted && s.routineId === r.id && s.dayKey && s.exercises.some((e) => e.sets.length || e.doneSets))
    .sort((a, b) => b.startedAt - a.startedAt);
  const doneToday = mine.find((s) => s.date === todayIso);
  if (r.schedule === 'weekday') {
    const i = r.days.findIndex((d) => d.weekdays.includes(weekday));
    if (i < 0) return { day: null, index: -1, reason: 'rest' };
    return { day: r.days[i], index: i, reason: doneToday?.dayKey === r.days[i].key ? 'done' : 'weekday' };
  }
  if (doneToday) {
    const i = r.days.findIndex((d) => d.key === doneToday.dayKey);
    if (i >= 0) return { day: r.days[i], index: i, reason: 'done' };
  }
  const last = mine[0];
  if (!last) return { day: r.days[0], index: 0, reason: 'first' };
  const li = r.days.findIndex((d) => d.key === last.dayKey);
  const i = (li + 1) % r.days.length;
  return { day: r.days[i], index: i, reason: 'next' };
}

/** Muscles of a day that aren't recovered enough. */
export function underRecovered(day: RoutineDay, recovery: Partial<Record<MuscleKey, number>>, ready: number): MuscleKey[] {
  const ms = [...new Set(day.exercises.map((e) => e.muscle))];
  return ms.filter((m) => (recovery[m] ?? 100) < ready);
}

/** The best-recovered other day, for when today's muscles need more rest. */
export function betterDay(r: Routine, current: number, recovery: Partial<Record<MuscleKey, number>>, ready: number): number | null {
  let best: number | null = null;
  let bestScore = -1;
  r.days.forEach((d, i) => {
    if (i === current || !d.exercises.length) return;
    if (underRecovered(d, recovery, ready).length) return;
    const ms = [...new Set(d.exercises.map((e) => e.muscle))];
    const score = ms.reduce((a, m) => a + (recovery[m] ?? 100), 0) / ms.length;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** Same-muscle alternatives for swapping an exercise: what the user can do, same movement first. */
export function alternatives(name: string, muscle: MuscleKey, ctx: AbilityCtx): string[] {
  return substitutes(name, muscle, ctx);
}
