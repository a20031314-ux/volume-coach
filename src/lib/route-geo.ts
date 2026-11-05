/** GeoJSON for drawing a stored route on a map. */
import type { RoutePoint } from './elevation';

export const GRADE_COLORS = { flat: null as string | null, mild: '#e8a317', steep: '#d9443a', wall: '#7a1f1f' };

/** One small line per pair of points, carrying that stretch's grade % as `g`. */
export function routeFeatures(route: RoutePoint[], grades?: number[]): GeoJSON.FeatureCollection<GeoJSON.LineString, { g: number }> {
  const features: GeoJSON.Feature<GeoJSON.LineString, { g: number }>[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    if (a[2] !== b[2]) continue;
    features.push({
      type: 'Feature',
      properties: { g: grades?.[i] ?? 0 },
      geometry: { type: 'LineString', coordinates: [[a[1], a[0]], [b[1], b[0]]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function routeEnds(route: RoutePoint[]): GeoJSON.FeatureCollection<GeoJSON.Point, { end: number }> {
  if (!route.length) return { type: 'FeatureCollection', features: [] };
  const f = (p: RoutePoint, end: number): GeoJSON.Feature<GeoJSON.Point, { end: number }> =>
    ({ type: 'Feature', properties: { end }, geometry: { type: 'Point', coordinates: [p[1], p[0]] } });
  return { type: 'FeatureCollection', features: [f(route[0], 0), f(route[route.length - 1], 1)] };
}

/** [west, south, east, north] with a little margin; null for an empty route. */
export function routeBounds(route: RoutePoint[]): [number, number, number, number] | null {
  if (!route.length) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of route) { w = Math.min(w, p[1]); e = Math.max(e, p[1]); s = Math.min(s, p[0]); n = Math.max(n, p[0]); }
  const pad = 0.0005;
  return [w - pad, s - pad, e + pad, n + pad];
}
