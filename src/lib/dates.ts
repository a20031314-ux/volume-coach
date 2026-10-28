const pad = (n: number) => String(n).padStart(2, '0');

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [a, b, c] = s.split('-').map(Number);
  return new Date(a, b - 1, c);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const utc = (s: string) => {
  const [a, b, c] = s.split('-').map(Number);
  return Date.UTC(a, b - 1, c);
};
/** whole days a − b */
export const diffDays = (a: string, b: string) => Math.round((utc(a) - utc(b)) / 864e5);

export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const dow = (s: string) => DOW[parse(s).getDay()];
export const fmt = (s: string) => {
  const d = parse(s);
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`;
};
export const today = (now = new Date()) => iso(now);
