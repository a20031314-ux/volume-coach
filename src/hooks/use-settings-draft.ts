/**
 * Settings screens edit a draft; nothing is stored until 저장. Screens read `s` and call `update`
 * exactly as they did with the store, so the change per screen is one line.
 */
import { useMemo, useState } from 'react';

import type { Settings } from '@/lib/types';
import { useData } from '@/store/store';

export type SettingsPatch = Partial<Omit<Settings, 'updatedAt'>>;

export function useSettingsDraft() {
  const saved = useData((x) => x.settings);
  const commit = useData((x) => x.updateSettings);
  const [patch, setPatch] = useState<SettingsPatch>({});
  const s = useMemo(() => ({ ...saved, ...patch }) as Settings, [saved, patch]);
  // only keys that really differ from what's stored count as a change
  const changed = useMemo(() => (Object.keys(patch) as (keyof SettingsPatch)[])
    .filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(saved[k])), [patch, saved]);
  return {
    s,
    update: (p: SettingsPatch) => setPatch((x) => ({ ...x, ...p })),
    dirty: changed.length > 0,
    save: () => { if (changed.length) commit(Object.fromEntries(changed.map((k) => [k, patch[k]])) as SettingsPatch); setPatch({}); },
    reset: () => setPatch({}),
  };
}
