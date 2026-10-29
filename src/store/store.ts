import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_SETTINGS,
  type BodyComp, type Checkin, type Meal, type Run, type Session, type Settings, type SyncMeta, type WorkoutLog,
} from '@/lib/types';

export type Kind = 'log' | 'checkin' | 'meal' | 'body' | 'run' | 'session' | 'settings';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

type Table<T> = Record<string, T>;

export interface DataState {
  logs: Table<WorkoutLog>;
  checkins: Table<Checkin>;
  meals: Table<Meal>;
  bodyComps: Table<BodyComp>;
  runs: Table<Run>;
  sessions: Table<Session>;
  settings: Settings;
  /** "kind:id" keys changed locally and not yet pushed */
  dirty: string[];
  /** server cursor (ISO timestamp) for incremental pulls */
  pulledAt: string | null;
  hydrated: boolean;

  addLog: (l: Omit<WorkoutLog, keyof SyncMeta>) => void;
  removeLog: (id: string) => void;
  /** create or replace a log with a known id (used by workout sessions) */
  putLog: (l: Omit<WorkoutLog, 'updatedAt'>) => void;
  putSession: (s: Omit<Session, 'updatedAt'>) => void;
  setCheckin: (date: string, patch: Partial<Omit<Checkin, keyof SyncMeta | 'date'>>) => void;
  addMeal: (m: Omit<Meal, keyof SyncMeta>) => void;
  removeMeal: (id: string) => void;
  addBodyComp: (b: Omit<BodyComp, keyof SyncMeta>) => void;
  removeBodyComp: (id: string) => void;
  addRun: (r: Omit<Run, keyof SyncMeta>) => void;
  removeRun: (id: string) => void;
  updateSettings: (patch: Partial<Omit<Settings, 'updatedAt'>>) => void;
  /** merge records from the server; local wins when newer */
  mergeRemote: (rows: { kind: Kind; id: string; data: unknown; updated_at: number; deleted: boolean }[], cursor: string | null) => void;
  markPushed: (keys: { key: string; updatedAt: number }[]) => void;
  markAllDirty: () => void;
  resetAll: () => void;
}

const tableOf = { log: 'logs', checkin: 'checkins', meal: 'meals', body: 'bodyComps', run: 'runs', session: 'sessions' } as const;

const empty = {
  logs: {}, checkins: {}, meals: {}, bodyComps: {}, runs: {}, sessions: {},
  settings: DEFAULT_SETTINGS, dirty: [] as string[], pulledAt: null as string | null,
};

/** Fill in fields added in later app versions. */
function withDefaults(p: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS, ...(p ?? {}),
    profile: { ...DEFAULT_SETTINGS.profile, ...(p?.profile ?? {}) },
    session: { ...DEFAULT_SETTINGS.session, ...(p?.session ?? {}) },
    run: { ...DEFAULT_SETTINGS.run, ...(p?.run ?? {}), interval: { ...DEFAULT_SETTINGS.run.interval, ...(p?.run?.interval ?? {}) } },
  };
}

const addDirty = (dirty: string[], key: string) => (dirty.includes(key) ? dirty : [...dirty, key]);

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      ...empty,
      hydrated: false,

      addLog: (l) => {
        const rec: WorkoutLog = { ...l, id: newId(), updatedAt: Date.now() };
        set((s) => ({ logs: { ...s.logs, [rec.id]: rec }, dirty: addDirty(s.dirty, `log:${rec.id}`) }));
      },
      removeLog: (id) => {
        const cur = get().logs[id];
        if (!cur) return;
        set((s) => ({ logs: { ...s.logs, [id]: { ...cur, deleted: true, updatedAt: Date.now() } }, dirty: addDirty(s.dirty, `log:${id}`) }));
      },
      putLog: (l) => {
        const rec: WorkoutLog = { ...l, updatedAt: Date.now() };
        set((s) => ({ logs: { ...s.logs, [rec.id]: rec }, dirty: addDirty(s.dirty, `log:${rec.id}`) }));
      },
      putSession: (x) => {
        const rec: Session = { ...x, updatedAt: Date.now() };
        set((s) => ({ sessions: { ...s.sessions, [rec.id]: rec }, dirty: addDirty(s.dirty, `session:${rec.id}`) }));
      },
      setCheckin: (date, patch) => {
        const cur = get().checkins[date] ?? { id: date, date, sore: [], updatedAt: 0 };
        const rec: Checkin = { ...cur, ...patch, deleted: false, updatedAt: Date.now() };
        set((s) => ({ checkins: { ...s.checkins, [date]: rec }, dirty: addDirty(s.dirty, `checkin:${date}`) }));
      },
      addMeal: (m) => {
        const rec: Meal = { ...m, id: newId(), updatedAt: Date.now() };
        set((s) => ({ meals: { ...s.meals, [rec.id]: rec }, dirty: addDirty(s.dirty, `meal:${rec.id}`) }));
      },
      removeMeal: (id) => {
        const cur = get().meals[id];
        if (!cur) return;
        set((s) => ({ meals: { ...s.meals, [id]: { ...cur, deleted: true, updatedAt: Date.now() } }, dirty: addDirty(s.dirty, `meal:${id}`) }));
      },
      addBodyComp: (b) => {
        const rec: BodyComp = { ...b, id: newId(), updatedAt: Date.now() };
        set((s) => ({ bodyComps: { ...s.bodyComps, [rec.id]: rec }, dirty: addDirty(s.dirty, `body:${rec.id}`) }));
      },
      removeBodyComp: (id) => {
        const cur = get().bodyComps[id];
        if (!cur) return;
        set((s) => ({ bodyComps: { ...s.bodyComps, [id]: { ...cur, deleted: true, updatedAt: Date.now() } }, dirty: addDirty(s.dirty, `body:${id}`) }));
      },
      addRun: (r) => {
        const rec: Run = { ...r, id: newId(), updatedAt: Date.now() };
        set((s) => ({ runs: { ...s.runs, [rec.id]: rec }, dirty: addDirty(s.dirty, `run:${rec.id}`) }));
      },
      removeRun: (id) => {
        const cur = get().runs[id];
        if (!cur) return;
        set((s) => ({ runs: { ...s.runs, [id]: { ...cur, deleted: true, updatedAt: Date.now() } }, dirty: addDirty(s.dirty, `run:${id}`) }));
      },
      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch, updatedAt: Date.now() }, dirty: addDirty(s.dirty, 'settings:main') }));
      },

      mergeRemote: (rows, cursor) => {
        set((s) => {
          const next: Partial<DataState> = {
            logs: { ...s.logs }, checkins: { ...s.checkins }, meals: { ...s.meals }, bodyComps: { ...s.bodyComps }, runs: { ...s.runs }, sessions: { ...s.sessions },
          };
          let settings = s.settings;
          for (const r of rows) {
            if (r.kind === 'settings') {
              if (r.updated_at > settings.updatedAt) settings = { ...withDefaults(r.data as Partial<Settings>), updatedAt: r.updated_at };
              continue;
            }
            const t = next[tableOf[r.kind]] as Table<SyncMeta>;
            const local = t[r.id];
            if (local && local.updatedAt >= r.updated_at) continue;
            t[r.id] = { ...(r.data as SyncMeta), id: r.id, updatedAt: r.updated_at, deleted: r.deleted };
          }
          return { ...next, settings, pulledAt: cursor ?? s.pulledAt };
        });
      },
      markPushed: (keys) => {
        const s = get();
        const still = new Set(s.dirty);
        for (const { key, updatedAt } of keys) {
          const [kind, id] = key.split(':') as [Kind, string];
          const cur = kind === 'settings' ? s.settings : (s[tableOf[kind]] as Table<SyncMeta>)[id];
          if (!cur || cur.updatedAt <= updatedAt) still.delete(key);
        }
        set({ dirty: [...still] });
      },
      markAllDirty: () => {
        const s = get();
        const keys = [
          ...Object.keys(s.logs).map((id) => `log:${id}`),
          ...Object.keys(s.checkins).map((id) => `checkin:${id}`),
          ...Object.keys(s.meals).map((id) => `meal:${id}`),
          ...Object.keys(s.bodyComps).map((id) => `body:${id}`),
          ...Object.keys(s.runs).map((id) => `run:${id}`),
          ...Object.keys(s.sessions).map((id) => `session:${id}`),
          ...(s.settings.updatedAt ? ['settings:main'] : []),
        ];
        set({ dirty: keys });
      },
      resetAll: () => set({ ...empty }),
    }),
    {
      name: 'volume-coach-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<DataState>;
        return { ...current, ...p, settings: withDefaults(p.settings) };
      },
      onRehydrateStorage: () => () => useData.setState({ hydrated: true }),
    },
  ),
);

/** Lookup a record for pushing. */
export function recordFor(s: DataState, key: string): { kind: Kind; id: string; data: unknown; updatedAt: number; deleted: boolean } | null {
  const [kind, id] = key.split(':') as [Kind, string];
  if (kind === 'settings') return { kind, id: 'main', data: s.settings, updatedAt: s.settings.updatedAt, deleted: false };
  const rec = (s[tableOf[kind]] as Table<SyncMeta>)[id];
  if (!rec) return null;
  const { id: _id, updatedAt, deleted, ...data } = rec;
  return { kind, id, data, updatedAt, deleted: !!deleted };
}

/* ---------- selectors ---------- */
export const live = <T extends SyncMeta>(t: Table<T>) => Object.values(t).filter((x) => !x.deleted);
