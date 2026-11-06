import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { RouteMap } from '@/components/route-map';
import { TlNode } from '@/components/timeline';
import { Card, Row, T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { fmt } from '@/lib/dates';
import type { RoutePoint } from '@/lib/elevation';
import { fmtDuration, fmtPace } from '@/lib/run';
import { clock } from '@/lib/timeline';
import { useDayMove } from '@/move/use-move';

/** One walk found by all-day movement recording. */
export default function MoveDetail() {
  const c = usePalette();
  const { date, index } = useLocalSearchParams<{ date: string; index: string }>();
  const move = useDayMove(date ?? '');
  const seg = move.segments[Number(index)];
  const route = useMemo<RoutePoint[]>(
    () => (seg ? move.points.slice(seg.from, seg.to + 1).map((p) => [p[1], p[2], 0]) : []),
    [move.points, seg],
  );
  if (!seg) return <Page><T v="muted">기록을 찾을 수 없어요.</T></Page>;
  const durS = Math.round((seg.endMs - seg.startMs) / 1000);

  return (
    <Page>
      <Card>
        <T v="small">{fmt(date!)} · 걷기 · 이동 기록</T>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <T v="big" style={{ fontSize: 34, lineHeight: 40 }}>{(seg.distanceM / 1000).toFixed(2)}km</T>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="num" style={{ fontSize: 18 }}>{fmtDuration(durS)}</T>
            <T v="small">{fmtPace(seg.distanceM > 50 ? durS / (seg.distanceM / 1000) : null)}</T>
          </View>
        </Row>
      </Card>
      <Card>
        <TlNode time={clock(seg.startMs)} title="출발" small color={c.ok} />
        <TlNode time={clock(seg.endMs)} title="도착" small color={c.ok} last />
      </Card>
      {route.length > 1 ? <RouteMap route={route} height={280} /> : null}
    </Page>
  );
}
