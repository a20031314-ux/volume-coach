/**
 * 끼니 타임라인: each meal shows its name and calories; tap a meal for its share of the day and warnings,
 * tap a food for its macros and actions. 고정식단 items sit in their meal as checkboxes, and the
 * recommended next meal shows as a faint row where it will be eaten.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, ConfirmButton, Row, T, segOpacity } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { toggleFixed } from '@/hooks/use-fixed';
import type { PlannedMeal } from '@/hooks/use-meal-plan';
import { itemLabel, type FixedRow } from '@/lib/fixed';
import { amountLabel, foodLabel } from '@/lib/foods';
import { mealTimeline, warnText, type MealGroup } from '@/lib/meal-groups';
import { hhmm } from '@/lib/meal-plan';
import type { Meal } from '@/lib/types';

interface Props {
  date: string;
  groups: MealGroup[];
  fixed: FixedRow[];
  rec: PlannedMeal | null;
  times?: number[];
  onAdd: (min: number, name: string) => void;
  onSwap: (m: Meal) => void;
  onRemove: (m: Meal) => void;
}

export function MealTimeline({ date, groups, fixed, rec, times, onAdd, onSwap, onRemove }: Props) {
  const c = usePalette();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const flip = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const pending = fixed.filter((r) => !r.logged).map((row) => ({ min: row.item.time, row }));
  const meals = mealTimeline(groups, pending, rec, times);
  const fixedOf = (m: Meal) => (m.fixed ? fixed.find((r) => r.item.id === m.fixed) : undefined);
  const line = { borderBottomWidth: 1, borderColor: c.line } as const;

  if (!meals.length) return <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>아직 기록한 음식이 없어요.</T>;

  return (
    <View>
      {meals.map((meal, gi) => {
        const g = meal.group;
        const warn = g?.warns.length ? (g.warns.some((w) => w.kind === 'over') ? c.bad : c.warn) : null;
        const mk = `m:${meal.key}`;
        return (
          <View key={meal.key}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', paddingTop: Space.md, paddingBottom: 6, ...line }}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!open[mk] }} disabled={!g}
                onPress={() => flip(mk)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.ink, opacity: g ? segOpacity(gi) : 0.15 }} />
                <T v="title" style={{ fontSize: 15 }}>{meal.name}{times?.length ? <T v="small"> {hhmm(meal.min)}</T> : null}</T>
                {warn ? <Badge color={warn} /> : null}
                <View style={{ flex: 1 }} />
                {g ? <T v="num" style={{ fontSize: 15 }}>{Math.round(g.sum.k)}kcal</T> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${meal.name}에 음식 추가`} hitSlop={10}
                onPress={() => onAdd(meal.min, meal.name)} style={{ paddingLeft: Space.md }}>
                <Text style={{ color: c.accent, fontSize: 22, lineHeight: 24, fontWeight: '600' }}>+</Text>
              </Pressable>
            </Row>

            {g && open[mk] ? (
              <View style={{ gap: 4, paddingVertical: 6, paddingLeft: 16, ...line }}>
                {g.pct ? (
                  <T v="small">하루의 {Math.round(g.pct.k)}% · 단백질 {Math.round(g.sum.p)}g ({Math.round(g.pct.p)}%) · 탄수화물 {Math.round(g.sum.c)}g ({Math.round(g.pct.c)}%) · 지방 {Math.round(g.sum.f)}g ({Math.round(g.pct.f)}%)</T>
                ) : (
                  <T v="small">단백질 {Math.round(g.sum.p)}g · 탄수화물 {Math.round(g.sum.c)}g · 지방 {Math.round(g.sum.f)}g</T>
                )}
                {g.warns.map((w) => (
                  <T key={warnText(w)} v="small" style={{ color: w.kind === 'over' ? c.bad : c.warn, fontWeight: '600' }}>{warnText(w)}</T>
                ))}
              </View>
            ) : null}

            {g?.items.map((m) => {
              const fx = fixedOf(m);
              const k = `i:${m.id}`;
              return (
                <View key={m.id} style={line}>
                  <Row style={{ flexWrap: 'nowrap', paddingVertical: 9, paddingLeft: 16 }}>
                    {fx ? (
                      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: true }} accessibilityLabel={`${m.name} 기록 취소`}
                        onPress={() => toggleFixed(fx, date)} hitSlop={8}>
                        <Text style={{ fontSize: 18, color: c.ok }}>☑</Text>
                      </Pressable>
                    ) : null}
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!open[k] }} onPress={() => flip(k)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.sm, minWidth: 0 }}>
                      <T style={{ flex: 1 }} numberOfLines={open[k] ? undefined : 1}>{m.name}{m.qty !== 1 ? ` × ${m.qty}` : ''}</T>
                      {m.kcal ? <T v="num" style={{ fontSize: 15 }}>{Math.round(m.kcal)}kcal</T> : null}
                    </Pressable>
                  </Row>
                  {open[k] ? (
                    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', paddingLeft: 16, paddingBottom: 8 }}>
                      <T v="small" style={{ flexShrink: 1 }}>단백질 {Math.round(m.p)}g · 탄수화물 {Math.round(m.c)}g · 지방 {Math.round(m.f)}g</T>
                      <Row gap={4} style={{ flexWrap: 'nowrap' }}>
                        <Button label="바꾸기" kind="ghost" onPress={() => onSwap(m)} />
                        <ConfirmButton label="삭제" onConfirm={() => onRemove(m)} />
                      </Row>
                    </Row>
                  ) : null}
                </View>
              );
            })}

            {meal.pending.map(({ row }) => (
              <Pressable key={row.item.id} accessibilityRole="checkbox" accessibilityState={{ checked: false }} disabled={!row.food}
                onPress={() => toggleFixed(row, date)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 9, paddingLeft: 16, ...line }}>
                <Text style={{ fontSize: 18, color: c.muted }}>☐</Text>
                <T numberOfLines={1} style={{ flex: 1, color: c.muted }}>
                  {itemLabel(row.item)} <T v="small">{row.food ? amountLabel(row.food, row.item.amt) : '(목록에 없음)'} · {hhmm(row.item.time)}</T>
                </T>
                {row.macros.k ? <T v="small">{Math.round(row.macros.k)}kcal</T> : null}
              </Pressable>
            ))}

            {meal.rec ? (
              <Row style={{ flexWrap: 'nowrap', paddingVertical: 9, paddingLeft: 16, ...line }}>
                <T numberOfLines={1} style={{ flex: 1, color: c.muted }}>추천 · {meal.rec.rec.parts.map((p) => foodLabel(p.food, p.amt)).join(' + ')}</T>
                <T v="small">{Math.round(meal.rec.rec.total.k)}kcal</T>
              </Row>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Badge({ color }: { color: string }) {
  const c = usePalette();
  return (
    <View accessibilityLabel="경고" style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.surface, fontSize: 11, fontWeight: '800', lineHeight: 14 }}>!</Text>
    </View>
  );
}
