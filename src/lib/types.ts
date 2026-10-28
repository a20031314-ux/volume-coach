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
}

export interface Settings {
  min: number; max: number; minEx: number; gap: number;
  cap: number; mcap: number; weekStart: 0 | 1; sec: number;
  ready: number; deload: boolean;
  off: MuscleKey[];
  customExercises: CustomExercise[];
  foods: Food[];
  profile: Profile;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  min: 12, max: 18, minEx: 2, gap: 1, cap: 24, mcap: 10, weekStart: 1, sec: 0.5,
  ready: 70, deload: false, off: [], customExercises: [], foods: [],
  profile: { goal: 'hyp', act: '1' },
  updatedAt: 0,
};
