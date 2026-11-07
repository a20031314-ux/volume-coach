import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CourseSheet } from '@/components/course-sheet';
import { Disclosure } from '@/components/layout';
import { MealRecCard } from '@/components/meal-rec';
import { SwapOption, SwapSheet, type SwapTarget } from '@/components/swap-sheet';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, DayNav, Field, NumField, Pills, Row, Screen, SegMeter, Stepper, T, segOpacity } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useNextMeal } from '@/hooks/use-meal-plan';
import { addDays, fmt, today } from '@/lib/dates';
import { BRAND_SOURCES } from '@/lib/brands';
import { LOOKUP_MESSAGE, SOURCE_NAME, aiLookup, keepCloudFood, reportFood, searchShared, useCloudFoods } from '@/lib/food-lookup';
import { FOOD_DB, GROUP_NAME, amountLabel, findFood, foodLabel, macrosOf, type FoodDef, type FoodGroup } from '@/lib/foods';
import { groupMeals, warnText } from '@/lib/meal-groups';
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
  const [courseOpen, setCourseOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<{ target: SwapTarget; replace?: Meal } | null>(null);

  const q = query.trim();
  const mine = settings.foods;
  const cloudFoods = useCloudFoods((x) => x.foods);
  const [remote, setRemote] = useState<FoodDef[]>([]);
  const [looking, setLooking] = useState(false);
  const [brandSel, setBrandSel] = useState('맥도날드');
  // shared cache: what other people already looked up (debounced, no AI cost)
  useEffect(() => {
    if (q.length < 2) return;
    let alive = true;
    const tm = setTimeout(() => { void searchShared(q).then((r) => { if (alive) setRemote(r); }); }, 400);
    return () => { alive = false; clearTimeout(tm); };
  }, [q]);
  const online = [...cloudFoods, ...(q.length >= 2 ? remote : [])].filter((d, i, a) => a.findIndex((x) => x.n === d.n) === i && !FOOD_DB.some((x) => x.n === d.n));
  const shown: { k: string; n: string }[] = q
    ? [...FOOD_DB.filter((d) => d.n.includes(q)).map((d) => ({ k: d.n, n: d.n })),
      ...online.filter((d) => d.n.includes(q) || remote.includes(d)).map((d) => ({ k: `cloud:${d.n}`, n: `☁ ${d.n}` })),
      ...mine.filter((f) => f.n.includes(q)).map((f) => ({ k: `my:${f.n}`, n: f.n }))]
    : group === 'mine' ? mine.map((f) => ({ k: `my:${f.n}`, n: f.n }))
      : group === 'brand'
        ? [...FOOD_DB, ...cloudFoods].filter((d) => d.g === 'brand' && (d.brand ?? '기타') === brandSel)
          .map((d) => ({ k: d.cloud ? `cloud:${d.n}` : d.n, n: `${d.cloud ? '☁ ' : ''}${d.brand ? d.n.replace(`${d.brand} `, '') : d.n}` }))
        : FOOD_DB.filter((d) => d.g === group).map((d) => ({ k: d.n, n: d.n }));
  const brands = [...new Set([...FOOD_DB, ...cloudFoods].filter((d) => d.g === 'brand').map((d) => d.brand ?? '기타'))];
  const findDef = (k: string | null): FoodDef | null => {
    if (!k || k.startsWith('my:')) return null;
    if (k.startsWith('cloud:')) return online.find((d) => `cloud:${d.n}` === k) ?? null;
    return FOOD_DB.find((d) => d.n === k) ?? null;
  };
  const def: FoodDef | null = !custom ? findDef(picked) : null;
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
    const d = findDef(k);
    if (d) setAmt(d.base);
  };

  const lookup = async () => {
    setLooking(true);
    const r = await aiLookup(q);
    setLooking(false);
    if (!r.ok) { toast(LOOKUP_MESSAGE[r.reason]); return; }
    keepCloudFood(r.food);
    setRemote((x) => [r.food, ...x.filter((d) => d.n !== r.food.n)]);
    setPicked(`cloud:${r.food.n}`); setAmt(r.food.base); setQty(1);
    toast(r.cached ? `${r.food.n} — 저장된 값` : `${r.food.n} 찾음`);
  };

  const addParts = (parts: SwapPart[], at: number) => {
    for (const p of parts) {
      const m = macrosOf(p.food, p.amt);
      addMeal({ date, name: foodLabel(p.food, p.amt), qty: 1, kcal: r1(m.k), p: r1(m.p), c: r1(m.c), f: r1(m.f), at });
    }
  };

  const save = () => {
    if (def) {
      if (def.cloud) keepCloudFood(def);
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

  const groups = useMemo(() => groupMeals(eaten, t, settings.mealPlan.on ? settings.mealPlan.times : undefined),
    [eaten, t, settings.mealPlan.on, settings.mealPlan.times]);
  const macro = (name: string, key: 'k' | 'p' | 'c' | 'f', got: number, goal: number, color: string, unit = 'g') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
      <T style={{ width: 60, fontSize: 14 }}>{name}</T>
      <View style={{ flex: 1 }}><SegMeter parts={groups.map((g) => g.sum[key])} goal={goal} color={color} /></View>
      <T v="num" style={{ fontSize: 16, width: 104, textAlign: 'right', color: key !== 'p' && got > goal * 1.1 ? c.bad : c.ink }}>{Math.round(got)}<T v="small"> / {goal}{unit}</T></T>
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
          {macro('칼로리', 'k', sum.k, t.kcal, c.ink, '')}
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
              <Pills options={[...(Object.keys(GROUP_NAME) as FoodGroup[]).map((g) => ({ k: g as FoodGroup | 'mine' | 'course', n: GROUP_NAME[g] })), ...(mine.length ? [{ k: 'mine' as const, n: '내 음식' }] : []), { k: 'course' as const, n: '+ 식사 코스' }]}
                value={group} onToggle={(g) => (g === 'course' ? setCourseOpen(true) : setGroup(g))} />
            ) : null}
            {!q && group === 'brand' ? (
              <Pills options={brands.map((b) => ({ k: b, n: b }))} value={brandSel} onToggle={setBrandSel} />
            ) : null}
            <Pills options={[...shown, { k: '__new', n: '+ 직접 입력' }]} value={picked} onToggle={pick} />
            {q.length >= 2 && !FOOD_DB.some((d) => d.n === q) ? (
              <Button label={looking ? 'AI가 찾는 중…' : `AI로 영양정보 찾기: "${q}"`} disabled={looking} onPress={lookup} style={{ alignSelf: 'flex-start' }} />
            ) : null}
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
        {def?.cloud ? (
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="small" style={{ flexShrink: 1, color: def.cloud.kind === 'official' || def.cloud.kind === 'public' ? c.muted : c.warn }}>
              {SOURCE_NAME[def.cloud.kind]} ({def.cloud.checked} 확인){def.estCF ? ' · 탄수화물·지방은 추정' : ''}{def.cloud.shared ? ' · 다른 사용자와 공유됨' : ''}
            </T>
            <ConfirmButton label="값이 이상해요" confirmLabel="신고" onConfirm={() => { void reportFood(def.cloud!.id).then((ok) => toast(ok ? '신고했어요' : '신고하려면 로그인하세요')); }} />
          </Row>
        ) : null}
        {def?.src && BRAND_SOURCES[def.src] ? (
          <T v="small">{BRAND_SOURCES[def.src].brand} 공개값 ({BRAND_SOURCES[def.src].checked} 확인){def.estCF ? ' · 탄수화물·지방은 추정' : ''}{BRAND_SOURCES[def.src].note ? ` · ${BRAND_SOURCES[def.src].note}` : ''}</T>
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
      {groups.map((g, gi) => (
        <View key={g.key} style={{ gap: 0 }}>
          <View style={{ gap: 4, paddingTop: Space.sm, paddingBottom: 6, borderBottomWidth: 1, borderColor: c.line }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Row gap={6}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.ink, opacity: segOpacity(gi) }} />
                <T v="title" style={{ fontSize: 15 }}>{g.name}</T>
              </Row>
              <T v="num" style={{ fontSize: 15 }}>{Math.round(g.sum.k)}kcal{g.pct ? <T v="small"> · 하루의 {Math.round(g.pct.k)}%</T> : null}</T>
            </Row>
            {g.pct ? (
              <T v="small">단백질 {Math.round(g.sum.p)}g ({Math.round(g.pct.p)}%) · 탄수화물 {Math.round(g.sum.c)}g ({Math.round(g.pct.c)}%) · 지방 {Math.round(g.sum.f)}g ({Math.round(g.pct.f)}%)</T>
            ) : null}
            {g.warns.map((w) => (
              <Row key={warnText(w)} gap={6} style={{ flexWrap: 'nowrap' }}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: w.kind === 'over' ? c.bad : c.warn, alignItems: 'center', justifyContent: 'center' }}>
                  <T style={{ color: c.surface, fontSize: 11, fontWeight: '800', lineHeight: 14 }}>!</T>
                </View>
                <T v="small" style={{ color: w.kind === 'over' ? c.bad : c.warn, fontWeight: '600', flexShrink: 1 }}>{warnText(w)}</T>
              </Row>
            ))}
          </View>
          {g.items.map((m) => (
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
        </View>
      ))}
      <CourseSheet open={courseOpen} onClose={() => setCourseOpen(false)} dayKcal={t?.kcal}
        onAdd={(name, lines) => { addParts(lines.map((l) => ({ food: l.food, amt: l.amt })), nowMs()); toast(`${name} 내 몫 추가됨`); }} />
      <SwapSheet target={swapFor?.target ?? null} action={swapFor?.replace ? '이걸로 바꾸기' : '이걸로 추가'}
        onClose={() => setSwapFor(null)} onApply={applySwap} />
    </Screen>
  );
}
