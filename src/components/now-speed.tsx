import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';

import { Space, usePalette } from '@/constants/theme';

import { Button, Row, T } from './ui';

/**
 * Current moving speed while this screen is open. Uses while-in-use location only and stops as
 * soon as the screen loses focus — nothing is recorded or stored.
 */
export function NowSpeed() {
  const c = usePalette();
  const [on, setOn] = useState(false);
  const [speed, setSpeed] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (!on) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    const recent: number[] = [];
    void (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      if (p.status !== 'granted') { setMsg('위치 권한이 필요해요'); setOn(false); return; }
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (l) => {
        const v = l.coords.speed;
        if (v == null || v < 0) return;
        recent.push(v);
        if (recent.length > 4) recent.shift();
        setSpeed(recent.reduce((a, b) => a + b, 0) / recent.length);
      });
      if (!alive) sub.remove();
    })();
    return () => { alive = false; sub?.remove(); setSpeed(null); };
  }, [on]));

  if (Platform.OS === 'web') return null;
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: Space.md }}>
      {on ? (
        <View>
          <T v="num" style={{ fontSize: 22, color: speed != null && speed > 0.5 ? c.ok : c.muted }}>
            {speed == null ? '…' : speed < 0.3 ? '멈춤' : `${(speed * 3.6).toFixed(1)}km/h`}
          </T>
          <T v="small">지금 이동 속도 · 이 화면을 보는 동안만</T>
        </View>
      ) : <T v="small">{msg ?? '지금 이동 속도'}</T>}
      <Button label={on ? '끄기' : '보기'} kind="ghost" onPress={() => { setMsg(null); setOn(!on); }} />
    </Row>
  );
}
