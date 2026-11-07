/** 지금 할 일: one card for the most important thing; the rest wait behind "외 N개". */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';

export interface NowItem { key: string; node: ReactNode; label: string }

/** `items` in priority order; null entries are skipped. */
export function NowCard({ items }: { items: (NowItem | null | false | undefined)[] }) {
  const c = usePalette();
  const [all, setAll] = useState(false);
  const list = items.filter((x): x is NowItem => !!x);
  if (!list.length) return null;
  const rest = list.slice(1);
  return (
    <Card style={{ gap: Space.md, borderColor: c.accentSoft }}>
      {list[0].node}
      {all ? rest.map((x) => (
        <View key={x.key} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: Space.md }}>{x.node}</View>
      )) : null}
      {rest.length ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: all }} onPress={() => setAll(!all)} hitSlop={8}>
          <Text style={{ color: c.muted, fontSize: 13 }}>{all ? '접기' : `외 ${rest.length}개 · ${rest.map((x) => x.label).join(', ')} ›`}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}
