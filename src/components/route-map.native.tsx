import { Camera, GeoJSONSource, Layer, Map, NativeUserLocation } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Radius, usePalette } from '@/constants/theme';
import { GRADE_COLORS, routeBounds, routeEnds, routeFeatures } from '@/lib/route-geo';

import type { RouteMapProps } from './route-map';

/** OpenFreeMap: OpenStreetMap vector tiles, free, no API key. */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function RouteMap({ route, grades, height = 200, interactive = false, follow = false }: RouteMapProps) {
  const c = usePalette();
  const lines = useMemo(() => routeFeatures(route, grades), [route, grades]);
  const ends = useMemo(() => routeEnds(route), [route]);
  const bounds = useMemo(() => routeBounds(route), [route]);
  const pad = { top: 28, right: 28, bottom: 28, left: 28 };

  return (
    <View style={[height === 'fill' ? { flex: 1 } : { height, borderRadius: Radius.md }, { overflow: 'hidden', backgroundColor: c.line }]}>
      <Map style={{ flex: 1 }} mapStyle={STYLE} logo={false} attribution attributionPosition={{ bottom: 4, right: 4 }}
        compass={interactive} scaleBar={false} dragPan={interactive || follow} touchZoom={interactive || follow}
        doubleTapZoom={interactive} doubleTapHoldZoom={interactive} touchRotate={false} touchPitch={false}>
        {follow
          ? <Camera trackUserLocation="course" initialViewState={{ zoom: 15 }} />
          : bounds ? <Camera initialViewState={{ bounds, padding: pad }} bounds={bounds} padding={pad} /> : null}
        <GeoJSONSource id="route" data={lines}>
          <Layer id="route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#ffffff', 'line-width': 7 }} />
          <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{
              'line-width': 4,
              'line-color': grades
                ? ['interpolate', ['linear'], ['get', 'g'], 2, GRADE_COLORS.flat ?? c.accent, 5, GRADE_COLORS.mild, 9, GRADE_COLORS.steep, 14, GRADE_COLORS.wall]
                : c.accent,
            }} />
        </GeoJSONSource>
        {!follow ? (
          <GeoJSONSource id="ends" data={ends}>
            <Layer id="ends-dot" type="circle"
              paint={{ 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-color': ['match', ['get', 'end'], 0, c.ok, c.bad] }} />
          </GeoJSONSource>
        ) : null}
        {follow ? <NativeUserLocation mode="course" /> : null}
      </Map>
    </View>
  );
}
