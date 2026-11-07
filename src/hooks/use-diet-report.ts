import { useMemo } from 'react';

import { today } from '@/lib/dates';
import { dietReport, type DietReport } from '@/lib/diet-report';
import { nutritionTargets } from '@/lib/nutrition';
import { live, useData } from '@/store/store';

/** 식습관 리포트 over the last `days` days, ending today. */
export function useDietReport(days = 28): DietReport {
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const profile = useData((s) => s.settings.profile);
  const to = today();
  return useMemo(() => {
    const logs = live(logsT);
    // the protein target depends on the body, not the day
    const p = nutritionTargets(profile, live(bodyT), logs, to)?.p ?? null;
    return dietReport(live(mealsT), { to, days, targetP: () => p, trainingDates: new Set(logs.map((l) => l.date)) });
  }, [mealsT, logsT, bodyT, profile, to, days]);
}

/** Foods this person eats most (last 4 weeks), for ranking swaps. */
export function usePreferredFoods(): string[] {
  return useDietReport(28).prefer;
}
