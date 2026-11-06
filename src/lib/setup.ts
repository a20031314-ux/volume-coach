/** First-run setup: turns the answers (or none) into rules, a plan mode and possibly a routine. */
import { recommendedVolume } from './profile';
import { recommendRoutine } from './routine';
import type { Ability, Profile, Routine, Settings } from './types';

export interface SetupAnswers {
  profile: Profile;
  ability: Ability;
  /** null = use the recommended volume for this profile */
  volume: Pick<Settings, 'min' | 'max' | 'minEx' | 'gap'> | null;
  mode: 'auto' | 'routine';
}

export function applySetup(settings: Settings, a: SetupAnswers | null, known?: Set<string>, hasRoutine = false): {
  patch: Partial<Settings>;
  routine: Omit<Routine, 'id' | 'updatedAt'> | null;
} {
  // skipped: keep whatever is there and hand over a recommended routine to follow
  if (!a) {
    if (hasRoutine) return { patch: { onboarded: true, planMode: 'routine' }, routine: null };
    const routine = recommendRoutine({ profile: settings.profile, settings, known });
    return { patch: { onboarded: true, planMode: 'routine' }, routine };
  }
  const answered = (Object.keys(a.ability) as (keyof Ability)[])
    .some((k) => k !== 'checked' && (k === 'pain' ? a.ability.pain.length > 0 : a.ability[k] !== 'unknown'));
  const ability = { ...a.ability, checked: a.ability.checked || answered };
  const { rec } = recommendedVolume(a.profile);
  const vol = a.volume ?? { min: rec.min, max: rec.max, minEx: rec.minEx, gap: settings.gap };
  const patch: Partial<Settings> = {
    onboarded: true,
    profile: a.profile,
    ability,
    ...vol,
    cap: a.volume ? settings.cap : rec.cap,
    mcap: a.volume ? settings.mcap : rec.mcap,
    planMode: a.mode,
  };
  const routine = a.mode === 'routine'
    ? recommendRoutine({ profile: a.profile, settings: { ...settings, ability }, known })
    : null;
  return { patch, routine };
}
