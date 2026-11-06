/**
 * Cardio without GPS (or where distance isn't the point): calories from time × intensity.
 * MET values follow the Compendium of Physical Activities; three levels per activity
 * (가볍게 = can talk in sentences, 보통 = short phrases, 힘들게 = hard to talk).
 */
export type Intensity = 1 | 2 | 3;

export interface CardioType {
  key: string;
  name: string;
  /** MET at 가볍게 / 보통 / 힘들게 */
  met: [number, number, number];
  /** leg load as running-km per hour at 보통 (for recovery) */
  legKmH: number;
  /** a distance the machine shows is worth asking for */
  distance?: boolean;
}

export const CARDIO: CardioType[] = [
  { key: 'indoor_cycle', name: '실내 사이클·스피닝', met: [4.0, 6.8, 8.8], legKmH: 2.5, distance: true },
  { key: 'swim', name: '수영', met: [5.8, 8.3, 10.0], legKmH: 0.5, distance: true },
  { key: 'stairs', name: '계단 오르기·스텝밀', met: [5.0, 8.0, 9.5], legKmH: 4 },
  { key: 'rowing', name: '로잉머신', met: [4.8, 7.0, 8.5], legKmH: 2, distance: true },
  { key: 'elliptical', name: '일립티컬', met: [4.0, 5.5, 7.0], legKmH: 2, distance: true },
  { key: 'jumprope', name: '줄넘기', met: [8.3, 10.0, 12.3], legKmH: 3 },
  { key: 'kettlebell', name: '케틀벨 서킷', met: [6.0, 8.0, 9.8], legKmH: 1.5 },
  { key: 'hiit', name: '서킷·HIIT·크로스핏', met: [5.0, 8.0, 10.0], legKmH: 2 },
  { key: 'battle_rope', name: '배틀로프', met: [6.0, 8.0, 10.3], legKmH: 0.5 },
  { key: 'boxing', name: '복싱·킥복싱', met: [5.5, 7.8, 10.0], legKmH: 1 },
  { key: 'soccer', name: '축구·풋살', met: [5.0, 7.0, 10.0], legKmH: 4 },
  { key: 'basketball', name: '농구', met: [4.5, 6.5, 8.0], legKmH: 3 },
  { key: 'badminton', name: '배드민턴', met: [4.5, 5.5, 7.0], legKmH: 2 },
  { key: 'tennis', name: '테니스', met: [5.0, 7.3, 8.0], legKmH: 2 },
  { key: 'table_tennis', name: '탁구', met: [3.0, 4.0, 5.0], legKmH: 0.5 },
  { key: 'climbing', name: '클라이밍', met: [5.8, 7.3, 8.0], legKmH: 0 },
  { key: 'skating', name: '인라인·스케이트', met: [6.0, 7.5, 9.8], legKmH: 2.5 },
  { key: 'dance', name: '댄스·에어로빅', met: [4.5, 6.5, 7.8], legKmH: 1.5 },
  { key: 'yoga', name: '요가', met: [2.5, 3.0, 4.0], legKmH: 0 },
  { key: 'pilates', name: '필라테스', met: [2.8, 3.5, 4.5], legKmH: 0.5 },
  { key: 'other', name: '기타', met: [3.5, 5.0, 7.0], legKmH: 1 },
];

export const INTENSITY_NAME: Record<Intensity, string> = { 1: '가볍게', 2: '보통', 3: '힘들게' };

export function cardioType(key: string | undefined): CardioType {
  return CARDIO.find((c) => c.key === key) ?? CARDIO[CARDIO.length - 1];
}

/** kcal = MET × kg × hours. A number the machine showed wins if given. */
export function cardioKcal(key: string, intensity: Intensity, minutes: number, weightKg: number, machineKcal?: number | null): number {
  if (machineKcal && machineKcal > 0) return Math.round(machineKcal);
  return Math.round(cardioType(key).met[intensity - 1] * weightKg * (minutes / 60));
}

/** Leg load in running-km, scaled by intensity. */
export function cardioLegKm(key: string, intensity: Intensity, minutes: number): number {
  const scale = intensity === 1 ? 0.6 : intensity === 3 ? 1.3 : 1;
  return Math.round(cardioType(key).legKmH * scale * (minutes / 60) * 10) / 10;
}

/** Outdoor cycling MET by average moving speed (Compendium). */
export function rideMet(kmh: number): number {
  if (kmh < 16) return 4.0;
  if (kmh < 19) return 6.8;
  if (kmh < 22) return 8.0;
  if (kmh < 25) return 10.0;
  if (kmh < 30) return 12.0;
  return 15.8;
}

export function rideKcal(distanceM: number, movingS: number, weightKg: number): number {
  if (movingS <= 0) return 0;
  return Math.round(rideMet((distanceM / 1000) / (movingS / 3600)) * weightKg * (movingS / 3600));
}
