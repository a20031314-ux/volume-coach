import type { ActivityKind, Elevation, RoutePoint } from './elevation';
import type { StrengthProgram } from './progression';
import type { Weather } from './weather';
export type MuscleKey =
  | 'chest' | 'back' | 'shoulder' | 'quad' | 'ham' | 'bi' | 'tri' | 'calf' | 'abs';

export type Goal = 'hyp' | 'str' | 'cut' | 'fit';
export type Sex = 'm' | 'f' | '';

/** Every synced record carries these. `deleted` is a tombstone so deletes sync too. */
export interface SyncMeta {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface WorkoutLog extends SyncMeta {
  date: string;          // YYYY-MM-DD (local)
  exercise: string;
  muscle: MuscleKey;
  sets: number;
  kg?: number | null;
  reps?: string;
  at: number;            // epoch ms when logged
  /** set when the log was written by a workout session */
  sessionId?: string;
}

export interface Checkin extends SyncMeta {
  /** id === date */
  date: string;
  sleep?: 0 | 1 | 2 | null;
  energy?: 0 | 1 | 2 | null;
  sore: MuscleKey[];
  /** the day's one-line review note */
  note?: string;
}

export interface Meal extends SyncMeta {
  date: string;
  name: string;
  qty: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  at: number;
  /** logged from 고정식단 item with this id */
  fixed?: string;
}

/** InBody-style body composition measurement. */
export interface BodyComp extends SyncMeta {
  date: string;
  weight: number;            // kg
  smm?: number | null;       // skeletal muscle mass, kg
  fatPct?: number | null;    // body fat %
  /** fat-free mass as measured, kg (InBody 제지방량) */
  ffm?: number | null;
  /** basal metabolic rate as measured, kcal (InBody 기초대사량) */
  bmr?: number | null;
  /** visceral fat level */
  visceral?: number | null;
}

/** A finished GPS run. */
export interface Run extends SyncMeta {
  date: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  movingS: number;
  paceSecPerKm: number | null;
  kcal: number;
  splits: { km: number; seconds: number }[];
  /** run (default), walk, hike, ride (GPS) or other (time-based) */
  kind?: ActivityKind;
  /** kind 'other': which activity (cardio.ts key) */
  activity?: string;
  /** kind 'other': 1 가볍게 / 2 보통 / 3 힘들게 */
  intensity?: 1 | 2 | 3;
  /** entered by hand rather than recorded */
  manual?: boolean;
  /** leg load in running-km for time-based cardio */
  legKmEq?: number;
  /** simplified route as [lat, lng, segment, gps altitude?] */
  route: RoutePoint[];
  /** moving second at each route point (newer runs) */
  routeT?: number[];
  /** climb, descent and grade; GPS-based at save time, replaced by terrain data when online */
  elev?: Elevation | null;
  /** weather at the start, fetched right after saving; already folded into kcal */
  weather?: Weather | null;
  /** speed over time as [moving second, m/s] */
  timeline?: [number, number][];
  intervalPlan?: IntervalPlanData | null;
  phases?: { kind: 'warmup' | 'work' | 'rest' | 'cooldown'; rep: number; durS: number; distanceM: number; paceS: number | null }[];
  /** sprint result, timed from the go signal by GPS speed */
  sprint?: SprintResult | null;
}

export interface SprintResult {
  targetM: number;
  /** seconds, hundredths */
  timeS: number;
  /** top speed, m/s, and where it happened */
  topV: number;
  topAtM: number;
  splits: { m: number; s: number }[];
  /** GPS accuracy at the start, m */
  accM: number | null;
}

export interface IntervalPlanData {
  warmupS: number; workS: number; restS: number; repeats: number; cooldownS: number; targetPaceS?: number | null;
}

export interface RunOptions {
  /** spoken guidance */
  voice: boolean;
  /** announce every km */
  kmAlert: boolean;
  /** announce every N minutes (0 = off) */
  everyMin: number;
  mode: 'free' | 'interval' | 'sprint';
  /** sprint distance, m */
  sprintM?: number;
  /** free-run target pace, sec/km (null = none) */
  targetPaceS?: number | null;
  /** voice nudge when off target */
  paceAlert?: boolean;
  /** seconds shown in the live speed chart */
  liveWindowS?: number;
  /** keep the screen on while the run screen is open and recording */
  keepAwake?: boolean;
  /** show pace (min/km, default) or speed (km/h) */
  unit?: 'pace' | 'speed';
  /** seconds counted down before recording starts (0 = start immediately) */
  countdown?: number;
  /** what to record; interval mode applies to running only */
  kind?: ActivityKind;
  /** kind 'other': last picked activity (cardio.ts key) and intensity */
  cardio?: string;
  cardioIntensity?: 1 | 2 | 3;
  /** last used interval plan */
  interval: IntervalPlanData;
}

export type SessionDetail = 'exercise' | 'set';

export interface SessionSet {
  at: number;
  kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

export type ExerciseStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface SessionExercise {
  key: string;
  name: string;
  muscle: MuscleKey;
  planned: number;
  status: ExerciseStatus;
  startedAt?: number | null;
  endedAt?: number | null;
  /** per-set detail (세트별 모드) */
  sets: SessionSet[];
  /** set count confirmed in 운동별 모드 */
  doneSets?: number | null;
  /** WorkoutLog this exercise writes to */
  logId: string;
  /** prescribed weight × reps for each set (strength program, or a suggestion from estimated 1RM) */
  target?: { kg: number; reps: number; program?: boolean } | null;
}

/** A workout from 시작 to 끝, with a timeline per exercise and per set. */
export interface Session extends SyncMeta {
  date: string;
  startedAt: number;
  endedAt: number | null;
  lastActivityAt: number;
  detail: SessionDetail;
  rpe?: number | null;
  autoEnded?: boolean;
  /** set when the session followed a routine day */
  routineId?: string | null;
  dayKey?: string | null;
  exercises: SessionExercise[];
}

export interface SessionOptions {
  /** default detail level for new sessions */
  detail: SessionDetail;
  /** ask weight and reps for each set (prefilled from last time) */
  setInputs: boolean;
  /** ask RPE after each set */
  setRpe: boolean;
  /** count down rest between sets and notify when it's over */
  restTimer: boolean;
  /** end a forgotten session after this many idle minutes (0 = off, the default) */
  autoEndMin: number;
  /** set once the user picks a value; the old default (90) is reset to off until then */
  autoEndChosen?: boolean;
}

export type PainMove = 'overhead' | 'deepKnee' | 'spine' | 'wrist' | 'deepShoulder';
export type Tri = 'unknown' | 'yes' | 'no';

/** What the user can do, from the quick check. 'unknown' = not answered. */
export interface Ability {
  checked: boolean;
  pullups: 'unknown' | '0' | '1-5' | '6+';
  pushups: 'unknown' | '0-5' | '6-20' | '21+';
  dips: Tri;
  bbSquat: Tri;
  bbHinge: Tri;
  bbPress: Tri;
  pain: PainMove[];
}

export type ExercisePref = 'fav' | 'dislike' | 'cant';

export interface CheckinOptions {
  sleep: boolean;
  energy: boolean;
  sore: boolean;
  /** lower today's volume after several heavy days */
  systemic: boolean;
}

export interface Food { n: string; k: number; p: number; c: number; f: number }
export interface CustomExercise { n: string; m: MuscleKey }

export interface Profile {
  age?: number | null;
  sex?: Sex;
  height?: number | null;
  weight?: number | null;
  /** body fat % entered by hand (직접 입력) */
  fatPct?: number | null;
  /** where body numbers come from. Unset = InBody records if there are any, else manual. */
  bodySource?: 'inbody' | 'manual';
  years?: '' | '0' | '1' | '3';
  act?: '0' | '1' | '2';
  goal: Goal;
  /** training days per week, 2-6 */
  days?: number | null;
  /** minutes per session */
  sessionMin?: number | null;
  equipment?: 'gym' | 'dumbbell' | 'bodyweight';
  /** muscles to keep out of plans (injury etc.) */
  avoid?: MuscleKey[];
}

export interface RoutineExercise { name: string; muscle: MuscleKey; sets: number }
export interface RoutineDay {
  key: string;
  name: string;
  /** weekdays (0 = Sun) this day is done on, when the routine is weekday-based */
  weekdays: number[];
  exercises: RoutineExercise[];
}
/** A fixed plan to follow: days with exercises and sets. */
export interface Routine extends SyncMeta {
  name: string;
  /** where it came from: a recommendation as-is, an edited recommendation, or built from scratch */
  source: 'recommended' | 'edited' | 'custom';
  goal?: Goal;
  schedule: 'weekday' | 'rotation';
  days: RoutineDay[];
}

export interface Settings {
  min: number; max: number; minEx: number; gap: number;
  cap: number; mcap: number; weekStart: 0 | 1; sec: number;
  ready: number; deload: boolean;
  off: MuscleKey[];
  customExercises: CustomExercise[];
  foods: Food[];
  profile: Profile;
  session: SessionOptions;
  run: RunOptions;
  ability: Ability;
  /** per-exercise marks: favourite, rather not, can't do */
  exercisePrefs: Record<string, ExercisePref>;
  /** hint cards the user dismissed */
  dismissed: string[];
  /** which readiness signals adjust the plan; all off hides the check-in card */
  checkin: CheckinOptions;
  /** 자율형: rules + daily recommendation · 루틴형: follow a routine */
  planMode: 'auto' | 'routine';
  activeRoutineId: string | null;
  /** first-run setup done (or skipped) */
  onboarded?: boolean;
  /** active strength program for one main lift */
  program?: StrengthProgram | null;
  /** 1RMs the user typed in, by exercise (override estimates from logs) */
  oneRm?: Partial<Record<string, number>>;
  /** 식단 추천 at set meal times */
  mealPlan: MealPlanSettings;
  /** 식사 코스 the user saved (고깃집 + 볶음밥 …) */
  courses?: SavedCourse[];
  /** 치팅데이 저금통 + 상쇄 */
  cheat?: CheatSettings;
  /** 고정식단: foods / supplements eaten on a schedule */
  fixed?: FixedSettings;
  updatedAt: number;
}

/** A payback plan for one day that went over: `cut` kcal/day off the target for `days` days from `from`. */
export interface Offset {
  src: string; from: string; days: number; cut: number; over: number; moveKcal: number; walkMin: number; runMin: number;
  /** kcal off each day from `from` (newer plans) */
  cuts?: number[];
}

export interface CheatSettings {
  on: boolean;
  mode: 'weekly' | 'date';
  /** weekly: 0 = Sunday … 6 = Saturday */
  dow: number;
  /** date mode: the planned day, and when saving for it started */
  date: string | null;
  since: string | null;
  /** extra kcal the gauge fills toward */
  budget: number;
  /** kcal taken off the target each day before the cheat day (0 = just bank what's left) */
  save: number;
  offsetDays: number;
  offsetMix: 'diet' | 'mix' | 'move';
  offsets: Offset[];
  /** overeating days the user chose not to offset */
  dismissed: string[];
}

export interface FixedItem {
  id: string;
  /** built-in food name */
  n: string;
  amt: number;
  /** minutes after midnight */
  time: number;
  /** 0 = Sunday … 6 = Saturday; empty = every day */
  dows: number[];
  /** time set by hand (kept when suggestions are re-applied on check/uncheck) */
  custom?: boolean;
  /** brand and product, e.g. 쏜리 · Basic Nutrients 2/Day */
  brand?: string;
  product?: string;
  /** amount of the active ingredient per unit, e.g. 200 (mg) */
  dose?: number | null;
  doseUnit?: 'mg' | 'μg' | 'IU' | 'g' | null;
  /** a supplement that isn't in the food list (named by the user, no calories) */
  free?: boolean;
}
export interface FixedSettings {
  items: FixedItem[];
  /** check: tap to log · auto: logged by itself once its time has passed */
  mode: 'check' | 'auto';
}

export interface CourseItem {
  /** built-in food name */
  n: string;
  /** amount for the whole table, in the food's unit */
  amt: number;
  /** eaten this time */
  on: boolean;
}
export interface SavedCourse { name: string; people: number; items: CourseItem[] }

export interface MealPlanSettings {
  on: boolean;
  /** minutes after midnight, ascending */
  times: number[];
}

export const DEFAULT_SETTINGS: Settings = {
  min: 12, max: 18, minEx: 2, gap: 1, cap: 24, mcap: 10, weekStart: 1, sec: 0.5,
  ready: 70, deload: false, off: [], customExercises: [], foods: [],
  profile: { goal: 'hyp', act: '1' },
  session: { detail: 'exercise', setInputs: true, setRpe: false, restTimer: true, autoEndMin: 0 },
  checkin: { sleep: true, energy: true, sore: true, systemic: true },
  ability: { checked: false, pullups: 'unknown', pushups: 'unknown', dips: 'unknown', bbSquat: 'unknown', bbHinge: 'unknown', bbPress: 'unknown', pain: [] },
  exercisePrefs: {},
  dismissed: [],
  planMode: 'auto',
  activeRoutineId: null,
  mealPlan: { on: false, times: [8 * 60, 12 * 60 + 30, 19 * 60] },
  run: {
    voice: true, kmAlert: true, everyMin: 0, mode: 'free',
    interval: { warmupS: 300, workS: 240, restS: 180, repeats: 5, cooldownS: 300, targetPaceS: null },
  },
  updatedAt: 0,
};
