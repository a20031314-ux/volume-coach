import Svg, { Circle, Polyline } from 'react-native-svg';

import { usePalette } from '@/constants/theme';

/** Draws a GPS track scaled to fit the box. No map tiles; the shape of the route only. */
export function RouteView({ route, height = 180 }: { route: [number, number, number][]; height?: number }) {
  const c = usePalette();
  if (route.length < 2) return null;
  const W = 320, H = height, pad = 12;
  const lat0 = route.reduce((a, p) => a + p[0], 0) / route.length;
  const kx = Math.cos((lat0 * Math.PI) / 180); // shrink longitude so the shape isn't stretched
  const xs = route.map((p) => p[1] * kx);
  const ys = route.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const s = Math.min((W - pad * 2) / Math.max(maxX - minX, span * 0.01), (H - pad * 2) / Math.max(maxY - minY, span * 0.01));
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const pt = (i: number) => [ox + (xs[i] - minX) * s, H - (oy + (ys[i] - minY) * s)] as const;

  const segments: string[] = [];
  let cur: string[] = [];
  route.forEach((p, i) => {
    if (i > 0 && route[i - 1][2] !== p[2]) { segments.push(cur.join(' ')); cur = []; }
    const [x, y] = pt(i);
    cur.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  segments.push(cur.join(' '));
  const [sx, sy] = pt(0);
  const [ex, ey] = pt(route.length - 1);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="러닝 경로">
      {segments.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={c.accent} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <Circle cx={sx} cy={sy} r={5} fill={c.ok} />
      <Circle cx={ex} cy={ey} r={5} fill={c.bad} />
    </Svg>
  );
}
