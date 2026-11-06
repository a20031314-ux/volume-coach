import { useMemo } from 'react';

import { moveSegments, type MovePoint, type MoveSegment } from '@/lib/movement';
import { live, useData } from '@/store/store';

import { useMove } from './tracker';

const EMPTY: MovePoint[] = [];

/** A day's movement, with recorded runs/walks/hikes cut out so nothing is counted twice. */
export function useDayMove(date: string): { enabled: boolean; points: MovePoint[]; segments: MoveSegment[] } {
  const enabled = useMove((s) => s.enabled);
  const raw = useMove((s) => s.days[date] ?? EMPTY);
  const runsT = useData((s) => s.runs);
  return useMemo(() => {
    const exclude = live(runsT).filter((r) => r.date === date).map((r) => [r.startedAt, r.endedAt] as [number, number]);
    return { enabled, ...moveSegments(raw, exclude) };
  }, [enabled, raw, runsT, date]);
}
