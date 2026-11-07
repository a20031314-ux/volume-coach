/** 다음 끼니 식단 추천: the person's usual foods, sized to what's left; "없음" swaps a food out. */
import { router } from 'expo-router';
import { View } from 'react-native';

import { MacroLine } from '@/components/swap-sheet';
import { Button, Card, Chip, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { today } from '@/lib/dates';
import { foodLabel } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import type { SwapPart } from '@/lib/swap';
import { markMissing, useMissing, type PlannedMeal } from '@/hooks/use-meal-plan';

export function MealRecCard({ meal, onEat }: { meal: PlannedMeal; onEat: (parts: SwapPart[]) => void }) {
  const c = usePalette();
  const missing = useMissing((s) => (s.date === today() ? s.foods.length : 0));
  const { rec } = meal;
  return (
    <Card style={{ gap: Space.sm }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T v="title" style={{ fontSize: 15 }}>{meal.name} 추천 · {hhmm(meal.min)}</T>
        <Button label="시간" kind="ghost" onPress={() => router.push('/prefs/meal-plan')} />
      </Row>
      <View>
        {rec.parts.map((p, i) => (
          <Row key={p.food.n} style={{ flexWrap: 'nowrap', paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
            <T style={{ flex: 1, fontSize: 16, fontWeight: i ? '400' : '600' }} numberOfLines={1}>{foodLabel(p.food, p.amt)}</T>
            <Button label="없음" kind="ghost" onPress={() => markMissing(p.food.n)} accessibilityLabel={`${p.food.n} 없음, 다른 음식으로 바꾸기`} />
          </Row>
        ))}
      </View>
      <MacroLine m={rec.total} small />
      {rec.swapped.length ? (
        <Row>
          <Chip label="대체 식단" />
          <T v="small">{rec.swapped.join(', ')} 대신</T>
        </Row>
      ) : null}
      <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
        {missing ? (
          <Button label="되돌리기" onPress={() => useMissing.setState({ foods: [] })} style={{ flex: 1, paddingVertical: 12 }} />
        ) : null}
        <Button label="먹은 음식에 추가" kind="primary" onPress={() => onEat(rec.parts)} style={{ flex: 2, paddingVertical: 12 }} />
      </Row>
    </Card>
  );
}
