/** Looking at part of a run: pick a time range on the speed timeline and get its numbers. */
import type { Run } from './types';

export type Range = [number, number];

/** bucket width of a saved timeline, from its spacing */
export function bucketOf(tl: [number, number][]): number {
  if (tl.length < 2) return 15;
  return Math.max(1, Math.round(tl[1][0] - tl[0][0]));
}

export interface RangeStats { durS: number; distanceM: number; paceS: number | null; maxV: number | null; minV: number | null }

/** Distance and pace between two moving seconds, integrating speed over the buckets it overlaps. */
export function rangeStats(tl: [number, number][], [from, to]: Range): RangeStats {
  const b = bucketOf(tl);
  let d = 0, maxV: number | null = null, minV: number | null = null;
  for (const [t, v] of tl) {
    const s = t - b / 2, e = t + b / 2;
    const overlap = Math.min(e, to) - Math.max(s, from);
    if (overlap <= 0) continue;
    d += v * overlap;
    if (v > 0.3) { maxV = maxV == null ? v : Math.max(maxV, v); minV = minV == null ? v : Math.min(minV, v); }
  }
  const durS = Math.max(0, to - from);
  return { durS, distanceM: Math.round(d), paceS: d > 20 ? durS / (d / 1000) : null, maxV, minV };
}

export interface NamedRange { key: string; label: string; range: Range }

/** Quick picks: interval phases if there are any, otherwise each km. */
export function presetRanges(r: Pick<Run, 'timeline' | 'phases' | 'movingS'>): NamedRange[] {
  const out: NamedRange[] = [];
  if (r.phases?.length) {
    let t = 0;
    for (const p of r.phases) {
      const name = p.kind === 'work' ? `달리기 ${p.rep}` : p.kind === 'rest' ? `회복 ${p.rep}` : p.kind === 'warmup' ? '워밍업' : '쿨다운';
      out.push({ key: `p${out.length}`, label: name, range: [t, Math.min(r.movingS, t + p.durS)] });
      t += p.durS;
    }
    return out.filter((x) => x.range[1] > x.range[0]);
  }
  const tl = r.timeline ?? [];
  const b = bucketOf(tl);
  let d = 0, km = 1, start = 0;
  for (const [t, v] of tl) {
    const before = d;
    d += v * b;
    while (d >= km * 1000) {
      const at = t - b / 2 + ((km * 1000 - before) / Math.max(0.01, v));
      out.push({ key: `k${km}`, label: `${km}km`, range: [start, at] });
      start = at; km++;
    }
  }
  const end = Math.max(r.movingS, tl.length ? tl[tl.length - 1][0] + b / 2 : 0);
  if (end - start > 30) out.push({ key: 'rest', label: `${km - 1}km~`, range: [start, end] });
  return out;
}
