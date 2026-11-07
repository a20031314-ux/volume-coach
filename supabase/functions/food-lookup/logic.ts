/** Pure helpers for food-lookup (no Deno APIs, so the app's tests can run them). */

/** "BBQ 황금 올리브 치킨!" → "bbq황금올리브치킨" */
export const normalize = (s: string) => s.toLowerCase().replace(/[\s·,.!?()[\]{}'"~\-_/]+/g, '').slice(0, 80);

// calorie apps, blogs and communities: fine for the asker, never shared
const NOT_OFFICIAL = ['fatsecret', 'geniet', 'dietshin', 'myfitnesspal', 'blog.', 'tistory', 'naver.com', 'daum.net', 'brunch', 'instagram', 'youtube', 'namu.wiki', 'wikipedia', 'reddit', 'dcinside', 'ruliweb', 'clien'];

export function classify(url: string | null, claimed: string, cited: Set<string>): 'official' | 'public' | 'other' | 'estimate' {
  if (!url || !cited.has(url)) return 'estimate';
  let host = '';
  try { host = new URL(url).hostname; } catch { return 'estimate'; }
  if (host.endsWith('.go.kr') || host.endsWith('kca.go.kr')) return 'public';
  if (NOT_OFFICIAL.some((w) => host.includes(w) || url.includes(w))) return 'other';
  return claimed === 'official' ? 'official' : 'other';
}

export interface Parsed {
  name: string; brand: string | null; unit: string; base: number; g_per: number | null;
  k: number; p: number; c: number | null; f: number | null; sugar: number | null; sodium: number | null;
  source_url: string | null; source_kind: string;
}

const FAT_SHARE = 0.55;
/** Fill missing carbs/fat from kcal and protein; reject numbers that can't be food. */
export function validate(x: Parsed): (Parsed & { c: number; f: number; est_cf: boolean }) | null {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const k = n(x.k), p = n(x.p);
  if (k == null || p == null || k <= 0 || k > 5000 || p < 0 || p * 4 > k * 1.1) return null;
  if (!(n(x.base)! > 0) || !x.unit || !x.name) return null;
  let c = n(x.c), f = n(x.f), est = false;
  if (c == null || f == null) {
    const rest = Math.max(0, k - 4 * p);
    f = (rest * FAT_SHARE) / 9; c = (rest - f * 9) / 4; est = true;
  }
  if (c < 0 || f < 0) return null;
  const calc = p * 4 + c * 4 + f * 9;
  if (Math.abs(calc - k) / k > 0.3) return null; // numbers don't add up
  return { ...x, k, p, c: Math.round(c * 10) / 10, f: Math.round(f * 10) / 10, est_cf: est };
}

