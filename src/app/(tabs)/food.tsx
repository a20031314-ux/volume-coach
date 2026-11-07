import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Disclosure } from '@/components/layout';
import { MealRecCard } from '@/components/meal-rec';
import { SwapOption, SwapSheet, type SwapTarget } from '@/components/swap-sheet';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, DayNav, Field, Meter, NumField, Pills, Row, Screen, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useNextMeal } from '@/hooks/use-meal-plan';
import { addDays, fmt, today } from '@/lib/dates';
import { FOOD_DB, GROUP_NAME, amountLabel, findFood, foodLabel, macrosOf, type FoodDef, type FoodGroup } from '@/lib/foods';
import { nutritionTargets } from '@/lib/nutrition';
import { swaps, type SwapPart } from '@/lib/swap';
import type { Food, Meal } from '@/lib/types';
import { live, useData } from '@/store/store';

const r1 = (x: number) => Math.round(x * 10) / 10;
/** called from handlers only */
const nowMs = () => Date.now();

export default function FoodScreen() {
  const c = usePalette();
  const toast = useToast();
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const addMeal = useData((s) => s.addMeal);
  const removeMeal = useData((s) => s.removeMeal);
  const updateSettings = useData((s) => s.updateSettings);
  const prefer = usePreferredFoods();
  const next = useNextMeal();

  const [date, setDate] = useState(today());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState<{ n: string; k: number | null; p: number | null; c: number | null; f: number | null }>({ n: '', k: null, p: null, c: null, f: null });
  const [keep, setKeep] = useState(false);
  const [qty, setQty] = useState(1);
  const [group, setGroup] = useState<FoodGroup | 'mine'>('protein');
  /** amount in the picked built-in food's own unit (g, 개, 공기…) */
  const [amt, setAmt] = useState(100);
  const [swapFor, setSwapFor] = useState<{ target: SwapTarget; replace?: Meal } | null>(null);

  const q = query.trim();
  const mine = settings.foods;
  const shown: { k: string; n: string }[] = q
    ? [...FOOD_DB.filter((d) => d.n.includes(q)).map((d) => ({ k: d.n, n: d.n })), ...mine.filter((f) => f.n.includes(q)).map((f) => ({ k: `my:${f.n}`, n: f.n }))]
    : group === 'mine' ? mine.map((f) => ({ k: `my:${f.n}`, n: f.n }))
      : FOOD_DB.filter((d) => d.g === group).map((d) => ({ k: d.n, n: d.n }));
  const def: FoodDef | null = !custom && picked && !picked.startsWith('my:') ? FOOD_DB.find((d) => d.n === picked) ?? null : null;
  const myFood: Food | null = !custom && picked?.startsWith('my:') ? mine.find((f) => `my:${f.n}` === picked) ?? null : null;
  const t = useMemo(() => nutritionTargets(settings.profile, live(bodyT), live(logsT), date), [settings.profile, bodyT, logsT, date]);
  const eaten = useMemo(() => live(mealsT).filter((m) => m.date === date).sort((a, b) => a.at - b.at), [mealsT, date]);
  const sum = eaten.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });

  const current: Food | null = custom
    ? { n: cf.n.trim(), k: cf.k ?? 0, p: cf.p ?? 0, c: cf.c ?? 0, f: cf.f ?? 0 }
    : myFood;
  /** what's about to be added, already scaled */
  const preview = def ? macrosOf(def, amt) : current ? { k: current.k * qty, p: current.p * qty, c: current.c * qty, f: current.f * qty } : null;

  const pick = (k: string) => {
    if (k === '__new') { setCustom(true); return; }
    setPicked(k); setQty(1);
    const d = FOOD_DB.find((x) => x.n === k);
    if (d) setAmt(d.base);
  };

  const addParts = (parts: SwapPart[], at: number) => {
    for (const p of parts) {
      const m = macrosOf(p.food, p.amt);
      addMeal({ date, name: foodLabel(p.food, p.amt), qty: 1, kcal: r1(m.k), p: r1(m.p), c: r1(m.c), f: r1(m.f), at });
    }
  };

  const save = () => {
    if (def) {
      addParts([{ food: def, amt }], nowMs());
      toast(`${foodLabel(def, amt)} 추가됨`);
      return;
    }
    if (!current || !current.n) return toast(custom ? '음식 이름을 입력하세요' : '음식을 고르세요');
    if (!current.k) return toast('칼로리를 입력하세요');
    if (custom && keep && !mine.some((f) => f.n === current.n)) updateSettings({ foods: [...mine, current] });
    addMeal({ date, name: current.n, qty, kcal: r1(current.k * qty), p: r1(current.p * qty), c: r1(current.c * qty), f: r1(current.f * qty), at: nowMs() });
    toast(`${current.n} 추가됨`);
    setQty(1); setCustom(false); setKeep(false); setCf({ n: '', k: null, p: null, c: null, f: null });
  };

  const applySwap = (parts: SwapPart[]) => {
    if (!swapFor) return;
    const old = swapFor.replace;
    if (old) removeMeal(old.id);
    addParts(parts, old?.at ?? nowMs());
    toast(old ? `${old.name} → ${parts.map((p) => p.food.n).join(' + ')}` : '추가됨');
    setSwapFor(null);
  };

  // evening: what would fill the protein still missing, within the calories left
  const fill = useMemo(() => {
    if (!t || date !== today() || new Date(nowMs()).getHours() < 17) return [];
    const p = t.p - sum.p, k = t.kcal - sum.k;
    if (p < 15 || k < 150) return [];
    // one meal's worth at most: ~40g protein, ~450kcal
    return swaps({ p: Math.min(p, 40), k: Math.min(k, 450), c: Math.min(Math.max(0, t.c - sum.c), 50), f: Math.min(Math.max(0, t.f - sum.f), 12) }, { primary: 'p', loose: true, limit: 2, prefer });
  }, [t, date, sum.p, sum.k, sum.c, sum.f, prefer]);

  const macro = (name: string, got: number, goal: number, color: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
      <T style={{ width: 60, fontSize: 14 }}>{name}</T>
      <View style={{ flex: 1 }}><Meter pct={goal ? (got / goal) * 100 : 0} color={got > goal * 1.1 ? c.warn : color} height={10} /></View>
      <T v="num" style={{ fontSize: 16, width: 92, textAlign: 'right' }}>{Math.round(got)}<T v="small"> / {goal}g</T></T>
    </View>
  );
  const left = t ? t.kcal - Math.round(sum.k) : 0;

  return (
    <Screen title="영양" right={<Button label="식습관" kind="ghost" onPress={() => router.push('/diet-report')} />}>
      <DayNav date={date} label={date === today() ? `오늘 · ${fmt(date)}` : fmt(date)}
        onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />

      {t ? (
        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Row gap={4} style={{ alignItems: 'baseline' }}><T v="big">{Math.abs(left)}</T><T v="muted">kcal {left >= 0 ? '남음' : '초과'}</T></Row>
            <T v="muted">목표 {t.kcal} · 먹은 {Math.round(sum.k)}</T>
          </Row>
          {macro('단백질', sum.p, t.p, c.accent)}
          {macro('탄수화물', sum.c, t.c, c.ok)}
          {macro('지방', sum.f, t.f, c.rest)}
          <Disclosure title="계산 근거">
            <T v="small">{t.adjustLabel} · 유지 약 {t.tdee}kcal · {t.trainingDay ? '운동한 날 +100' : '쉬는 날 −100'}</T>
            <T v="small">단백질 {t.proteinBasis}</T>
          </Disclosure>
        </Card>
      ) : (
        <Card>
          <T>나이·키·체중을 입력하면 목표를 계산해요.</T>
          <Button label={settings.profile.age ? '신체 정보 입력하기' : '내 정보 입력하기'} kind="primary" onPress={() => router.push(settings.profile.age ? '/prefs/body' : '/prefs/profile')} style={{ alignSelf: 'flex-start' }} />
          <T v="small">지금 먹은 양: {Math.round(sum.k)}kcal · 단백질 {Math.round(sum.p)}g · 탄수화물 {Math.round(sum.c)}g · 지방 {Math.round(sum.f)}g</T>
        </Card>
      )}
      {next && date === today() ? (
        <MealRecCard meal={next} onEat={(parts) => { addParts(parts, nowMs()); toast('추가됨'); }} />
      ) : null}
      {!next && fill.length && t ? (<>
        <T v="muted">단백질이 {Math.round(t.p - sum.p)}g 남았어요. 한 끼로 채우면:</T>
        {fill.map((s) => (
          <SwapOption key={s.parts.map((p) => p.food.n).join('|')} s={s} action="먹은 음식에 추가" onPick={() => { addParts(s.parts, nowMs()); toast('추가됨'); }} />
        ))}
      </>) : null}

      <Card>
        {!custom ? (
          <>
            <Field label="음식 찾기" value={query} onChangeText={setQuery} placeholder="예: 연어" />
            {!q ? (
              <Pills options={[...(Object.keys(GROUP_NAME) as FoodGroup[]).map((g) => ({ k: g as FoodGroup | 'mine', n: GROUP_NAME[g] })), ...(mine.length ? [{ k: 'mine' as const, n: '내 음식' }] : [])]}
                value={group} onToggle={(g) => setGroup(g)} />
            ) : null}
            <Pills options={[...shown, { k: '__new', n: '+ 직접 입력' }]} value={picked} onToggle={pick} />
          </>
        ) : (
          <>
            <Field label="음식 이름" value={cf.n} onChangeText={(n) => setCf({ ...cf, n })} placeholder="예: 편의점 닭가슴살 도시락" />
            <Row gap={Space.md}>
              <NumField label="칼로리 kcal" value={cf.k} onCommit={(k) => setCf((x) => ({ ...x, k }))} decimal />
              <NumField label="단백질 g" value={cf.p} onCommit={(p) => setCf((x) => ({ ...x, p }))} decimal />
            </Row>
            <Row gap={Space.md}>
              <NumField label="탄수화물 g" value={cf.c} onCommit={(cc) => setCf((x) => ({ ...x, c: cc }))} decimal />
              <NumField label="지방 g" value={cf.f} onCommit={(f) => setCf((x) => ({ ...x, f }))} decimal />
            </Row>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: keep }} onPress={() => setKeep(!keep)}>
              <T v="muted">{keep ? '☑' : '☐'} 자주 먹는 음식으로 저장</T>
            </Pressable>
            <Button label="목록에서 고르기" kind="ghost" onPress={() => setCustom(false)} style={{ alignSelf: 'flex-start' }} />
          </>
        )}
        {def ? (
          <Row gap={Space.md}><Stepper label={`먹은 양 (${def.unit})`} value={amt} onChange={setAmt} step={def.step} min={def.step} max={def.step * 100} format={(v) => amountLabel(def, v)} /></Row>
        ) : (
          <Row gap={Space.md}><Stepper label="먹은 양 (인분)" value={qty} onChange={setQty} step={0.5} min={0.5} max={20} /></Row>
        )}
        {preview && preview.k ? (
          <T v="muted">{Math.round(preview.k)}kcal · 단백질 {Math.round(preview.p)}g · 탄수화물 {Math.round(preview.c)}g · 지방 {Math.round(preview.f)}g</T>
        ) : null}
        <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
          {def ? (
            <Button label="대체 식단" style={{ flex: 1, paddingVertical: 13 }}
              onPress={() => setSwapFor({ target: { label: foodLabel(def, amt), macros: macrosOf(def, amt), def } })} />
          ) : null}
          <Button label="먹은 음식 추가" kind="primary" onPress={save} style={{ flex: 2, paddingVertical: 13 }} />
        </Row>
      </Card>

      <T v="label">먹은 음식</T>
      {!eaten.length ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>아직 기록한 음식이 없어요.</T> : null}
      {eaten.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T>{m.name}{m.qty !== 1 ? ` × ${m.qty}` : ''}</T>
            <T v="small">단백질 {Math.round(m.p)}g · 탄수화물 {Math.round(m.c)}g · 지방 {Math.round(m.f)}g</T>
          </View>
          <T v="num" style={{ fontSize: 16 }}>{Math.round(m.kcal)}kcal</T>
          <Button label="바꾸기" onPress={() => setSwapFor({
            target: { label: m.qty !== 1 ? `${m.name} × ${m.qty}` : m.name, macros: { k: m.kcal, p: m.p, c: m.c, f: m.f }, def: findFood(m.name) },
            replace: m,
          })} />
          <ConfirmButton label="삭제" onConfirm={() => { removeMeal(m.id); toast('삭제됨'); }} />
        </View>
      ))}
      <SwapSheet target={swapFor?.target ?? null} action={swapFor?.replace ? '이걸로 바꾸기' : '이걸로 추가'}
        onClose={() => setSwapFor(null)} onApply={applySwap} />
    </Screen>
  );
}
