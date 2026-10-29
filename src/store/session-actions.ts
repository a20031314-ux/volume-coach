/** Mutations for the active workout session. Every change also keeps the session's WorkoutLogs in step. */
import { today } from '@/lib/dates';
import { logFields, newSession, type PlannedExercise } from '@/lib/session';
import type { MuscleKey, Session, SessionDetail, SessionExercise, SessionSet } from '@/lib/types';

import { newId, useData } from './store';

export function selectActiveSession(state: { sessions: Record<string, Session> }): Session | null {
  let best: Session | null = null;
  for (const s of Object.values(state.sessions)) {
    if (!s.deleted && s.endedAt == null && (!best || s.startedAt > best.startedAt)) best = s;
  }
  return best;
}

export const activeSession = () => selectActiveSession(useData.getState());

function save(s: Session, changed: SessionExercise[], now = Date.now()) {
  const d = useData.getState();
  for (const ex of changed) {
    const f = logFields(ex, s, now);
    if (f) d.putLog(f);
    else if (d.logs[ex.logId] && !d.logs[ex.logId].deleted) d.removeLog(ex.logId);
  }
  const { updatedAt: _u, ...rest } = s;
  d.putSession(rest);
}

function mutate(id: string, fn: (s: Session, now: number) => SessionExercise[] | void) {
  const cur = useData.getState().sessions[id];
  if (!cur) return;
  const s: Session = structuredClone(cur);
  const now = Date.now();
  const changed = fn(s, now) ?? [];
  s.lastActivityAt = now;
  save(s, changed, now);
}

const find = (s: Session, key: string) => s.exercises.find((e) => e.key === key);

/** Make the next pending exercise active when nothing is. */
function advance(s: Session, now: number) {
  if (s.exercises.some((e) => e.status === 'active')) return;
  const next = s.exercises.find((e) => e.status === 'pending');
  if (next) { next.status = 'active'; next.startedAt = now; }
}

export function startSession(plan: PlannedExercise[], detail: SessionDetail): string {
  const id = newId();
  const s = newSession(plan, detail, Date.now(), { session: id, log: newId }, today());
  useData.getState().putSession(s);
  return id;
}

export function setDetail(id: string, detail: SessionDetail) {
  mutate(id, (s) => { s.detail = detail; });
}

export function completeSet(id: string, key: string, set: Omit<SessionSet, 'at'>) {
  mutate(id, (s, now) => {
    const ex = find(s, key);
    if (!ex) return;
    if (!ex.sets.length && ex.doneSets) {
      // switching from 운동별 to 세트별 mid-exercise: keep the sets already counted
      ex.sets = Array.from({ length: ex.doneSets }, () => ({ at: ex.startedAt ?? now }));
      ex.doneSets = null;
    }
    ex.sets.push({ ...set, at: now });
    ex.status = 'active';
    ex.startedAt ??= now;
    return [ex];
  });
}

export function undoSet(id: string, key: string) {
  mutate(id, (s) => {
    const ex = find(s, key);
    if (!ex || !ex.sets.length) return;
    ex.sets.pop();
    return [ex];
  });
}

/** Finish an exercise. `count` is used in 운동별 mode. */
export function completeExercise(id: string, key: string, count?: number) {
  mutate(id, (s, now) => {
    const ex = find(s, key);
    if (!ex) return;
    if (count != null && !ex.sets.length) ex.doneSets = count;
    ex.status = 'done';
    ex.endedAt = now;
    ex.startedAt ??= now;
    advance(s, now);
    return [ex];
  });
}

export function reopenExercise(id: string, key: string) {
  mutate(id, (s, now) => {
    for (const e of s.exercises) if (e.status === 'active') e.status = setCount(e) ? 'done' : 'pending';
    const ex = find(s, key);
    if (!ex) return;
    ex.status = 'active';
    ex.endedAt = null;
    ex.startedAt ??= now;
  });
}

const setCount = (e: SessionExercise) => (e.sets.length ? e.sets.length : e.doneSets ?? 0);

export function skipExercise(id: string, key: string) {
  mutate(id, (s, now) => {
    const ex = find(s, key);
    if (!ex) return;
    ex.status = 'skipped';
    ex.endedAt = null;
    advance(s, now);
    return [ex];
  });
}

/** "지금 하기": the rack is free, do this one now; the current one goes back in the queue. */
export function makeActive(id: string, key: string) {
  mutate(id, (s, now) => {
    for (const e of s.exercises) {
      if (e.status === 'active' && e.key !== key) e.status = setCount(e) ? 'done' : 'pending';
    }
    const ex = find(s, key);
    if (!ex) return;
    ex.status = 'active';
    ex.startedAt ??= now;
    // move it right after the finished ones so the list reads in the order things happened
    s.exercises = [...s.exercises.filter((e) => e.key !== key && (e.status === 'done')), ex, ...s.exercises.filter((e) => e.key !== key && e.status !== 'done')];
  });
}

export function addExercise(id: string, name: string, muscle: MuscleKey, planned: number) {
  mutate(id, (s, now) => {
    s.exercises.push({
      key: `${s.exercises.length}-${name}-${now}`, name, muscle, planned, status: 'pending',
      startedAt: null, endedAt: null, sets: [], doneSets: null, logId: newId(),
    });
    advance(s, now);
  });
}

export function finishSession(id: string, opts: { rpe?: number | null; endedAt?: number; auto?: boolean } = {}) {
  mutate(id, (s, now) => {
    const end = opts.endedAt ?? now;
    const changed: SessionExercise[] = [];
    for (const e of s.exercises) {
      if (e.status === 'active') {
        if (setCount(e)) { e.status = 'done'; e.endedAt = e.sets[e.sets.length - 1]?.at ?? end; }
        else e.status = 'skipped';
        changed.push(e);
      } else if (e.status === 'pending') e.status = 'skipped';
    }
    s.endedAt = end;
    s.rpe = opts.rpe ?? s.rpe ?? null;
    s.autoEnded = !!opts.auto;
    return changed;
  });
}

export function setSessionRpe(id: string, rpe: number | null) {
  mutate(id, (s) => { s.rpe = rpe; });
}

/** Throw the session away together with the logs it wrote. */
export function discardSession(id: string) {
  const d = useData.getState();
  const s = d.sessions[id];
  if (!s) return;
  for (const e of s.exercises) if (d.logs[e.logId] && !d.logs[e.logId].deleted) d.removeLog(e.logId);
  const { updatedAt: _u, ...rest } = s;
  d.putSession({ ...rest, deleted: true });
}
