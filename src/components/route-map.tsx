// Web / fallback: no map tiles, just the route's shape. The native map is route-map.native.tsx.
import { RouteView } from '@/components/route-view';
import type { RoutePoint } from '@/lib/elevation';

export interface RouteMapProps {
  route: RoutePoint[];
  /** grade % per route point; colours the line */
  grades?: number[];
  /** px, or 'fill' to take the whole parent */
  height?: number | 'fill';
  /** pan and zoom; off inside scrolling lists */
  interactive?: boolean;
  /** show the phone's position and follow it (during a run) */
  follow?: boolean;
  /** highlighted spot, [lat, lng] */
  marker?: [number, number] | null;
  /** tap on the map → index of the nearest route point */
  onPick?: (index: number) => void;
}

export function RouteMap({ route, height = 200, marker, onPick }: RouteMapProps) {
  return <RouteView route={route.map((p) => [p[0], p[1], p[2]] as [number, number, number])} height={height === 'fill' ? 420 : height} marker={marker} onPick={onPick} />;
}
