import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CheatChips, CheatSheet, OffsetOffer, useCheat } from '@/components/cheat-card';
import { FoodAddSheet, addTime, logParts } from '@/components/food-add-sheet';
import { MealRecCard } from '@/components/meal-rec';
import { MealTimeline } from '@/components/meal-timeline';
import { NowCard } from '@/components/now-card';
import { MacroLine, SwapSheet, type SwapTarget } from '@/components/swap-sheet';
import { useToast } from '@/components/toast';
import { Button, Card, DayNav, Row, Screen, SegMeter, T, segOpacity } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { toggleFixed, useFixedToday } from '@/hooks/use-fixed';
import { useNextMeal } from '@/hooks/use-meal-plan';
import { useNow } from '@/hooks/use-now';
import { addDays, fmt, today } from '@/lib/dates';
import { dayTarget } from '@/lib/day-target';
import { itemLabel } from '@/lib/fixed';
import { amountLabel, findFood, foodLabel } from '@/lib/foods';
import { groupMeals } from '@/lib/meal-groups';
import { hhmm } from '@/lib/meal-plan';
import { swaps, type SwapPart } from '@/lib/swap';
import type { Meal } from '@/lib/types';
import { live, useData } from '@/store/store';

/** 고정식단 items count as "now" from this many minutes before their time */
const DUE_AHEAD = 30;

export default function FoodScreen() {
  const c = usePalette();
  const toast = useToast();
  const now = useNow(60e3);
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const removeMeal = useData((s) => s.removeMeal);
  const prefer = usePreferredFoods();
  const next = useNextMeal();

  const [date, setDate] = useState(today());
  const isToday = date === today();
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState<{ min: number | null; name?: string; n: number } | null>(null);
  const [addN, setAddN] = useState(0);
  const openAdd = (min: number | null, name?: string) => { setAdding({ min, name, n: addN + 1 }); setAddN(addN + 1); };
  const [cheatOpen, setCheatOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<{ target: SwapTarget; replace: Meal } | null>(null);

  const t = useMemo(() => dayTarget({ settings, comps: live(bodyT), logs: live(logsT), meals: live(mealsT) }, date, today()), [settings, bodyT, logsT, mealsT, date]);
  const cheat = useCheat(isToday ? t : null);
  const fixed = useFixedToday(date);
  const eaten = useMemo(() => live(mealsT).filter((m) => m.date === date).sort((a, b) => a.at - b.at), [mealsT, date]);
  const sum = eaten.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });
  const times = settings.mealPlan.on ? settings.mealPlan.times : undefined;
  const groups = useMemo(() => groupMeals(eaten, t, times), [eaten, t, times]);
  const rec = next && isToday ? next : null;

  // evening: what would fill the protein still missing, within the calories left
  const fill = useMemo(() => {
    if (!t || !isToday || now.getHours() < 17) return [];
    const p = t.p - sum.p, k = t.kcal - sum.k;
    if (p < 15 || k < 150) return [];
    // one meal's worth at most: ~40g protein, ~450kcal
    return swaps({ p: Math.min(p, 40), k: Math.min(k, 450), c: Math.min(Math.max(0, t.c - sum.c), 50), f: Math.min(Math.max(0, t.f - sum.f), 12) }, { primary: 'p', loose: true, limit: 1, prefer });
  }, [t, isToday, now, sum.p, sum.k, sum.c, sum.f, prefer]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = isToday ? fixed.filter((r) => !r.logged && r.food && r.item.time <= nowMin + DUE_AHEAD) : [];
  const eat = (parts: SwapPart[]) => { logParts(date, parts, addTime(date, null)); toast('추가됨'); };

  const applySwap = (parts: SwapPart[]) => {
    if (!swapFor) return;
    const old = swapFor.replace;
    removeMeal(old.id);
    logParts(date, parts, old.at);
    toast(`${old.name} → ${parts.map((p) => p.food.n).join(' + ')}`);
    setSwapFor(null);
  };

  const left = t ? t.kcal - Math.round(sum.k) : 0;
  const macro = (name: string, key: 'k' | 'p' | 'c' | 'f', got: number, goal: number, color: string, unit = 'g') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
      <T style={{ width: 60, fontSize: 14 }}>{name}</T>
      <View style={{ flex: 1 }}><SegMeter parts={groups.map((g) => g.sum[key])} goal={goal} color={color} /></View>
      <T v="num" style={{ fontSize: 15, width: 100, textAlign: 'right', color: key !== 'p' && got > goal * 1.1 ? c.bad : c.ink }}>{Math.round(got)}<T v="small"> / {goal}{unit}</T></T>
    </View>
  );

  return (
    <Screen title="영양" right={<Button label="식습관" kind="ghost" onPress={() => router.push('/diet-report')} />}>
      <DayNav date={date} label={isToday ? `오늘 · ${fmt(date)}` : fmt(date)}
        onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />

      {/* 1 요약 */}
      {t ? (
        <Card style={{ gap: Space.sm }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: more }} accessibilityLabel="영양 자세히" onPress={() => setMore(!more)} style={{ gap: Space.sm }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'nowrap' }}>
              <Row gap={4} style={{ alignItems: 'baseline' }}>
                <T v="big" style={{ color: left < 0 ? c.bad : c.ink }}>{Math.abs(left).toLocaleString('ko-KR')}</T>
                <T v="muted">kcal {left >= 0 ? '남음' : '초과'}</T>
              </Row>
              <T v="muted">단백질 <T v="num" style={{ fontSize: 16, color: c.accent }}>{Math.round(sum.p)}</T> / {t.p}g</T>
            </Row>
            <SegMeter parts={groups.map((g) => g.sum.k)} goal={t.kcal} color={c.ink} />
            {more ? (
              <View style={{ gap: Space.sm, paddingTop: Space.xs }}>
                <T v="small">목표 {t.kcal} · 먹은 {Math.round(sum.k)}kcal{t.cheat.label ? ` · ${t.cheat.label} (기본 ${t.base})` : ''}</T>
                {macro('단백질', 'p', sum.p, t.p, c.accent)}
                {macro('탄수화물', 'c', sum.c, t.c, c.ok)}
                {macro('지방', 'f', sum.f, t.f, c.rest)}
                {groups.length > 1 ? (
                  <Row gap={Space.md}>
                    {groups.map((g, i) => (
                      <Row key={g.key} gap={4}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.ink, opacity: segOpacity(i) }} />
                        <T v="small">{g.name}</T>
                      </Row>
                    ))}
                  </Row>
                ) : null}
                <T v="small">{t.adjustLabel} · 유지 약 {t.tdee}kcal · {t.trainingDay ? '운동한 날 +100' : '쉬는 날 −100'}</T>
                <T v="small">단백질 {t.proteinBasis}</T>
              </View>
            ) : null}
          </Pressable>
          <CheatChips s={cheat} onOpen={() => setCheatOpen(true)} />
        </Card>
      ) : (
        <Card>
          {!settings.profile.goal ? (<>
            <T>목적을 고르면 칼로리·단백질 목표를 계산해요.</T>
            <Button label="MY에서 목적 고르기" kind="primary" onPress={() => router.navigate('/settings')} style={{ alignSelf: 'flex-start' }} />
          </>) : (<>
            <T>나이·키·체중을 입력하면 목표를 계산해요.</T>
            <Button label={settings.profile.age ? '신체 정보 입력하기' : '내 정보 입력하기'} kind="primary" onPress={() => router.push(settings.profile.age ? '/prefs/body' : '/prefs/profile')} style={{ alignSelf: 'flex-start' }} />
          </>)}
          <T v="small">지금 먹은 양: {Math.round(sum.k)}kcal · 단백질 {Math.round(sum.p)}g · 탄수화물 {Math.round(sum.c)}g · 지방 {Math.round(sum.f)}g</T>
        </Card>
      )}

      {/* 2 지금 할 일 */}
      <NowCard items={[
        isToday && cheat.plans.length ? { key: 'offset', label: '과식 상쇄', node: <OffsetOffer s={cheat} onOpen={() => setCheatOpen(true)} /> } : null,
        due.length ? {
          key: 'fixed', label: '고정식단', node: (
            <View style={{ gap: Space.xs }}>
              <T v="title" style={{ fontSize: 15 }}>지금 먹을 고정식단</T>
              {due.map((r) => (
                <Row key={r.item.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <T numberOfLines={1} style={{ flex: 1 }}>{itemLabel(r.item)} <T v="small">{r.food ? amountLabel(r.food, r.item.amt) : ''} · {hhmm(r.item.time)}</T></T>
                  <Button label="먹었어요" onPress={() => toggleFixed(r, date)} />
                </Row>
              ))}
            </View>
          ),
        } : null,
        rec ? { key: 'rec', label: `${rec.name} 추천`, node: <MealRecCard meal={rec} bare onEat={eat} /> } : null,
        !rec && fill.length && t ? {
          key: 'fill', label: '단백질 채우기', node: (
            <View style={{ gap: Space.xs }}>
              <T v="title" style={{ fontSize: 15 }}>단백질 {Math.round(t.p - sum.p)}g 남음 · 한 끼로 채우면</T>
              <T>{fill[0].parts.map((p) => foodLabel(p.food, p.amt)).join(' + ')}</T>
              <MacroLine m={fill[0].total} small />
              <Button label="먹은 음식에 추가" kind="primary" onPress={() => eat(fill[0].parts)} style={{ alignSelf: 'flex-start' }} />
            </View>
          ),
        } : null,
      ]} />

      <Button label="+ 음식 추가" kind="primary" onPress={() => openAdd(null)} style={{ paddingVertical: 14 }} />

      {/* 3 끼니 타임라인 */}
      <MealTimeline date={date} groups={groups} fixed={fixed} rec={rec} times={times}
        onAdd={(min, name) => openAdd(min, name)}
        onSwap={(m) => setSwapFor({
          target: { label: m.qty !== 1 ? `${m.name} × ${m.qty}` : m.name, macros: { k: m.kcal, p: m.p, c: m.c, f: m.f }, def: findFood(m.name) },
          replace: m,
        })}
        onRemove={(m) => { removeMeal(m.id); toast('삭제됨'); }} />
      {fixed.length ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/prefs/fixed')} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: c.muted, fontSize: 13 }}>고정식단 편집 ›</Text>
        </Pressable>
      ) : null}

      <FoodAddSheet key={addN} open={!!adding} onClose={() => setAdding(null)} date={date} dayKcal={t?.kcal}
        min={adding?.min ?? null} mealName={adding?.name} />
      <CheatSheet s={cheat} open={cheatOpen} onClose={() => setCheatOpen(false)} />
      <SwapSheet target={swapFor?.target ?? null} action="이걸로 바꾸기" onClose={() => setSwapFor(null)} onApply={applySwap} />
    </Screen>
  );
}
