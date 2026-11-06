import { useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { usePalette } from '@/constants/theme';

/** Draws a GPS track scaled to fit the box. No map tiles; the shape of the route only. */
export function RouteView({ route, height = 180, marker, onPick }: {
  route: [number, number, number][]; height?: number; marker?: [number, number] | null; onPick?: (index: number) => void;
}) {
  const c = usePalette();
  const [box, setBox] = useState({ w: 320, h: height });
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
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
  const mk = marker ? [ox + (marker[1] * kx - minX) * s, H - (oy + (marker[0] - minY) * s)] : null;
  // tap: convert to viewBox units (the SVG keeps aspect ratio, centred) and pick the closest point
  const pick = (px: number, py: number) => {
    if (!onPick) return;
    const k = Math.min(box.w / W, box.h / H);
    const vx = (px - (box.w - W * k) / 2) / k, vy = (py - (box.h - H * k) / 2) / k;
    let best = 0, bd = Infinity;
    route.forEach((_, i) => { const [x, y] = pt(i); const d = (x - vx) ** 2 + (y - vy) ** 2; if (d < bd) { bd = d; best = i; } });
    onPick(best);
  };

  return (
    <Pressable disabled={!onPick} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      ref={ref}
      // locationX/Y can be relative to the tapped SVG child; measure against the whole box instead
      onPress={(e) => { const { pageX, pageY } = e.nativeEvent; ref.current?.measure((_x, _y, _w, _h, px, py) => pick(pageX - px, pageY - py)); }}>
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel="러닝 경로">
      {segments.map((pts, i) => (
        <Polyline key={i} points={pts} fill="none" stroke={c.accent} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
      ))}
      <Circle cx={sx} cy={sy} r={5} fill={c.ok} />
      <Circle cx={ex} cy={ey} r={5} fill={c.bad} />
      {mk ? <Circle cx={mk[0]} cy={mk[1]} r={7} fill={c.ink} stroke="#fff" strokeWidth={3} /> : null}
    </Svg>
    </Pressable>
  );
}
