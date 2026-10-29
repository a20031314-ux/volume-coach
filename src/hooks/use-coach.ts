import { useMemo } from 'react';

import { compute, type CoachInput } from '@/lib/coach';
import { live, useData } from '@/store/store';

export function useCoachInput(now: Date): CoachInput {
  const logs = useData((s) => s.logs);
  const checkins = useData((s) => s.checkins);
  const settings = useData((s) => s.settings);
  const runs = useData((s) => s.runs);
  return useMemo(() => ({ settings, logs: live(logs), checkins, runs: live(runs), now }), [settings, logs, checkins, runs, now]);
}

export function useCoach(now: Date) {
  const input = useCoachInput(now);
  const result = useMemo(() => compute(input), [input]);
  return { input, result };
}
