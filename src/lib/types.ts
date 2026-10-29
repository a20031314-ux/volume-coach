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
}

/** InBody-style body composition measurement. */
export interface BodyComp extends SyncMeta {
  date: string;
  weight: number;            // kg
  smm?: number | null;       // skeletal muscle mass, kg
  fatPct?: number | null;    // body fat %
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
  /** simplified route as [lat, lng, segment] */
  route: [number, number, number][];
  /** speed over time as [moving second, m/s] */
  timeline?: [number, number][];
  intervalPlan?: IntervalPlanData | null;
  phases?: { kind: 'warmup' | 'work' | 'rest' | 'cooldown'; rep: number; durS: number; distanceM: number; paceS: number | null }[];
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
  mode: 'free' | 'interval';
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
  /** end a forgotten session after this many idle minutes */
  autoEndMin: number;
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
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  min: 12, max: 18, minEx: 2, gap: 1, cap: 24, mcap: 10, weekStart: 1, sec: 0.5,
  ready: 70, deload: false, off: [], customExercises: [], foods: [],
  profile: { goal: 'hyp', act: '1' },
  session: { detail: 'exercise', setInputs: true, setRpe: false, restTimer: true, autoEndMin: 90 },
  checkin: { sleep: true, energy: true, sore: true, systemic: true },
  ability: { checked: false, pullups: 'unknown', pushups: 'unknown', dips: 'unknown', bbSquat: 'unknown', bbHinge: 'unknown', bbPress: 'unknown', pain: [] },
  exercisePrefs: {},
  dismissed: [],
  planMode: 'auto',
  activeRoutineId: null,
  run: {
    voice: true, kmAlert: true, everyMin: 0, mode: 'free',
    interval: { warmupS: 300, workS: 240, restS: 180, repeats: 5, cooldownS: 300, targetPaceS: null },
  },
  updatedAt: 0,
};
