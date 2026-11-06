/** Weather during an outdoor activity and how much it is assumed to change energy cost. */
export interface Weather {
  tempC: number;
  /** "feels like" — heat index / wind chill */
  feelsC: number;
  humidity: number;
  windKmh: number;
}

/**
 * Multiplier on calories for conditions. Moving in heat costs a little more (cooling, higher heart
 * rate), and so does real cold; mild weather changes nothing. Kept deliberately small: studies
 * find a few percent, and without heart rate the phone can't measure the difference directly.
 */
export function weatherFactor(w: Pick<Weather, 'feelsC'> | null | undefined): number {
  if (!w || !Number.isFinite(w.feelsC)) return 1;
  const t = w.feelsC;
  if (t > 24) return 1 + Math.min(0.08, (t - 24) * 0.01);
  if (t < 0) return 1 + Math.min(0.05, -t * 0.005);
  return 1;
}
