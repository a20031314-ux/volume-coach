/** 오늘의 고정식단: tap to log / un-log. */
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { toggleFixed, useFixedToday } from '@/hooks/use-fixed';
import { amountLabel } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import { useData } from '@/store/store';

export function FixedCard({ date }: { date: string }) {
  const c = usePalette();
  const rows = useFixedToday(date);
  const mode = useData((s) => s.settings.fixed?.mode ?? 'check');
  if (!rows.length) return null;
  const done = rows.filter((r) => r.logged).length;
  const kcal = Math.round(rows.reduce((a, r) => a + r.macros.k, 0));
  return (
    <Card style={{ gap: Space.xs }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T v="title" style={{ fontSize: 15 }}>고정식단 {done}/{rows.length}<T v="small"> · {kcal}kcal{mode === 'auto' ? ' · 시간 되면 자동 기록' : ''}</T></T>
        <Button label="편집" kind="ghost" onPress={() => router.push('/prefs/fixed')} />
      </Row>
      {rows.map((r) => (
        <Pressable key={r.item.id} accessibilityRole="checkbox" accessibilityState={{ checked: !!r.logged }} disabled={!r.food}
          onPress={() => toggleFixed(r, date)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 7, borderTopWidth: 1, borderColor: c.line }}>
          <Text style={{ fontSize: 20, color: r.logged ? c.ok : c.muted }}>{r.logged ? '☑' : '☐'}</Text>
          <T v="small" style={{ width: 42 }}>{hhmm(r.item.time)}</T>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T numberOfLines={1} style={{ textDecorationLine: r.logged ? 'line-through' : 'none', color: r.logged ? c.muted : c.ink }}>
              {r.item.n} {r.food ? amountLabel(r.food, r.item.amt) : '(목록에 없음)'}
            </T>
          </View>
          <T v="small">{Math.round(r.macros.k)}kcal</T>
        </Pressable>
      ))}
    </Card>
  );
}
