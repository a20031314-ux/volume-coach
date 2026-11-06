/** One day's activities in time order: the top of 기록 → each item opens its own timeline. */
import { INTENSITY_NAME, cardioType } from './cardio';
import { KIND_NAME } from './elevation';
import type { MoveSegment } from './movement';
import { setCount } from './session';
import type { Run, Session, WorkoutLog } from './types';

export type TimelineKind = 'lift' | 'run' | 'walk' | 'hike' | 'ride' | 'other' | 'move';

export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  startMs: number;
  /** null while still going */
  endMs: number | null;
  title: string;
  /** short facts, e.g. "6개 운동 · 18세트" */
  sub: string;
  /** what to open: session id, run id, 'lifts' (logs without a session) or move segment index */
  target: { type: 'session'; id: string } | { type: 'run'; id: string } | { type: 'lifts'; date: string } | { type: 'move'; date: string; index: number };
}

export function dayTimeline(
  date: string,
  data: { logs: WorkoutLog[]; sessions: Session[]; runs: Run[]; walks: MoveSegment[] },
): TimelineItem[] {
  const items: TimelineItem[] = [];
  const sessions = data.sessions.filter((s) => s.date === date);
  const inSession = new Set(sessions.map((s) => s.id));

  for (const s of sessions) {
    const done = s.exercises.filter((e) => setCount(e) > 0);
    const sets = done.reduce((a, e) => a + setCount(e), 0);
    items.push({
      key: `s:${s.id}`, kind: 'lift', startMs: s.startedAt, endMs: s.endedAt,
      title: '웨이트', sub: `${done.length}개 운동 · ${sets}세트`,
      target: { type: 'session', id: s.id },
    });
  }

  const loose = data.logs.filter((l) => l.date === date && !(l.sessionId && inSession.has(l.sessionId))).sort((a, b) => a.at - b.at);
  if (loose.length) {
    items.push({
      key: `l:${date}`, kind: 'lift', startMs: loose[0].at, endMs: loose[loose.length - 1].at,
      title: '웨이트 기록', sub: `${loose.length}개 운동 · ${loose.reduce((a, l) => a + l.sets, 0)}세트`,
      target: { type: 'lifts', date },
    });
  }

  for (const r of data.runs.filter((x) => x.date === date)) {
    const kind = r.kind ?? 'run';
    const min = `${Math.round(r.movingS / 60)}분`;
    items.push({
      key: `r:${r.id}`, kind, startMs: r.startedAt, endMs: r.endedAt,
      title: runTitle(r),
      sub: kind === 'other'
        ? [min, r.intensity ? INTENSITY_NAME[r.intensity] : null, r.distanceM ? `${(r.distanceM / 1000).toFixed(2)}km` : null, `${r.kcal}kcal`].filter(Boolean).join(' · ')
        : [`${(r.distanceM / 1000).toFixed(2)}km`, min, r.elev && r.elev.gainM >= 5 ? `↑${r.elev.gainM}m` : null].filter(Boolean).join(' · '),
      target: { type: 'run', id: r.id },
    });
  }

  data.walks.forEach((w, index) => {
    if (w.kind !== 'walk') return;
    items.push({
      key: `m:${w.startMs}`, kind: 'move', startMs: w.startMs, endMs: w.endMs,
      title: '걷기', sub: `${(w.distanceM / 1000).toFixed(1)}km · ${Math.round((w.endMs - w.startMs) / 60e3)}분`,
      target: { type: 'move', date, index },
    });
  });

  return items.sort((a, b) => a.startMs - b.startMs);
}

export function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "18:02–19:05", or "18:02–" while running */
export function span(i: Pick<TimelineItem, 'startMs' | 'endMs'>): string {
  if (i.endMs == null) return `${clock(i.startMs)}–`;
  return clock(i.startMs) === clock(i.endMs) ? clock(i.startMs) : `${clock(i.startMs)}–${clock(i.endMs)}`;
}

/** "러닝 · 인터벌", "자전거", or the cardio activity's name */
export function runTitle(r: Pick<Run, 'kind' | 'activity' | 'intervalPlan'>): string {
  const kind = r.kind ?? 'run';
  if (kind === 'other') return cardioType(r.activity).name;
  return KIND_NAME[kind] + (r.intervalPlan ? ' · 인터벌' : '');
}
