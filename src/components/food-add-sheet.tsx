/** 음식 추가 시트: search first, recent and usual foods before categories, amount and add in the same sheet. */
import { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { CourseSheet } from '@/components/course-sheet';
import { Sheet } from '@/components/layout';
import { SwapSheet, type SwapTarget } from '@/components/swap-sheet';
import { Button, ConfirmButton, Field, NumField, Pills, Row, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { addDays } from '@/lib/dates';
import { BRAND_SOURCES } from '@/lib/brands';
import { LOOKUP_MESSAGE, SOURCE_NAME, aiLookup, keepCloudFood, reportFood, searchShared, useCloudFoods } from '@/lib/food-lookup';
import { FOOD_DB, GROUP_NAME, amountLabel, findFood, foodLabel, macrosOf, type FoodDef, type FoodGroup } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import type { SwapPart } from '@/lib/swap';
import type { Food } from '@/lib/types';
import { live, useData } from '@/store/store';

const r1 = (x: number) => Math.round(x * 10) / 10;
/** called from handlers only */
const nowMs = () => Date.now();

type Tab = FoodGroup | 'recent' | 'mine' | 'course';

/** Timestamp for a food added to `date`: the meal's minute when given, else now. */
export function addTime(date: string, min: number | null): number {
  if (min == null) return nowMs();
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).getTime();
}

/** Log foods as separate meals at one time. */
export function logParts(date: string, parts: SwapPart[], at: number) {
  const add = useData.getState().addMeal;
  for (const p of parts) {
    const m = macrosOf(p.food, p.amt);
    add({ date, name: foodLabel(p.food, p.amt), qty: 1, kcal: r1(m.k), p: r1(m.p), c: r1(m.c), f: r1(m.f), at });
  }
}

/** Mount with a new `key` each time it opens so it starts fresh. */
export function FoodAddSheet({ open, onClose, date, min, mealName, dayKcal }: {
  open: boolean; onClose: () => void; date: string; dayKcal?: number;
  /** add into this meal (minute of day); null = now */
  min: number | null; mealName?: string;
}) {
  const c = usePalette();
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const updateSettings = useData((s) => s.updateSettings);
  const addMeal = useData((s) => s.addMeal);
  const prefer = usePreferredFoods();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState<{ n: string; k: number | null; p: number | null; c: number | null; f: number | null }>({ n: '', k: null, p: null, c: null, f: null });
  const [keep, setKeep] = useState(false);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>('recent');
  const [amt, setAmt] = useState(100);
  const [courseOpen, setCourseOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<SwapTarget | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

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

  /** foods eaten in the last two weeks (newest first), then the usual ones */
  const recent = useMemo(() => {
    const from = addDays(date, -14);
    const names: string[] = [];
    for (const m of [...live(mealsT)].filter((x) => x.date >= from).sort((a, b) => b.at - a.at)) {
      const d = findFood(m.name);
      const n = d ? d.n : mine.some((f) => f.n === m.name) ? `my:${m.name}` : null;
      if (n && !names.includes(n)) names.push(n);
    }
    for (const n of prefer) if (!names.includes(n) && FOOD_DB.some((d) => d.n === n)) names.push(n);
    return names.slice(0, 18);
  }, [mealsT, prefer, mine, date]);

  const shown: { k: string; n: string }[] = q
    ? [...FOOD_DB.filter((d) => d.n.includes(q)).map((d) => ({ k: d.n, n: d.n })),
      ...online.filter((d) => d.n.includes(q) || remote.includes(d)).map((d) => ({ k: `cloud:${d.n}`, n: `☁ ${d.n}` })),
      ...mine.filter((f) => f.n.includes(q)).map((f) => ({ k: `my:${f.n}`, n: f.n }))]
    : tab === 'recent' ? recent.map((k) => ({ k, n: k.startsWith('my:') ? k.slice(3) : k }))
      : tab === 'mine' ? mine.map((f) => ({ k: `my:${f.n}`, n: f.n }))
        : tab === 'brand'
          ? [...FOOD_DB, ...cloudFoods].filter((d) => d.g === 'brand' && (d.brand ?? '기타') === brandSel)
            .map((d) => ({ k: d.cloud ? `cloud:${d.n}` : d.n, n: `${d.cloud ? '☁ ' : ''}${d.brand ? d.n.replace(`${d.brand} `, '') : d.n}` }))
          : tab === 'course' ? []
            : FOOD_DB.filter((d) => d.g === tab).map((d) => ({ k: d.n, n: d.n }));
  const brands = [...new Set([...FOOD_DB, ...cloudFoods].filter((d) => d.g === 'brand').map((d) => d.brand ?? '기타'))];
  const tabs: { k: Tab; n: string }[] = [
    ...(recent.length ? [{ k: 'recent' as const, n: '최근·자주' }] : []),
    ...(Object.keys(GROUP_NAME) as FoodGroup[]).map((g) => ({ k: g as Tab, n: GROUP_NAME[g] })),
    ...(mine.length ? [{ k: 'mine' as const, n: '내 음식' }] : []),
    { k: 'course' as const, n: '+ 식사 코스' },
  ];
  const activeTab: Tab = tab === 'recent' && !recent.length ? 'protein' : tab;

  const findDef = (k: string | null): FoodDef | null => {
    if (!k || k.startsWith('my:')) return null;
    if (k.startsWith('cloud:')) return online.find((d) => `cloud:${d.n}` === k) ?? null;
    return FOOD_DB.find((d) => d.n === k) ?? null;
  };
  const def: FoodDef | null = !custom ? findDef(picked) : null;
  const myFood: Food | null = !custom && picked?.startsWith('my:') ? mine.find((f) => `my:${f.n}` === picked) ?? null : null;
  const current: Food | null = custom ? { n: cf.n.trim(), k: cf.k ?? 0, p: cf.p ?? 0, c: cf.c ?? 0, f: cf.f ?? 0 } : myFood;
  const preview = def ? macrosOf(def, amt) : current ? { k: current.k * qty, p: current.p * qty, c: current.c * qty, f: current.f * qty } : null;

  const pick = (k: string) => {
    if (k === '__new') { setCustom(true); return; }
    setPicked(k === picked ? null : k); setQty(1); setNote(null);
    const d = findDef(k);
    if (d) setAmt(d.base);
  };

  const lookup = async () => {
    setLooking(true);
    const r = await aiLookup(q);
    setLooking(false);
    if (!r.ok) { setNote(LOOKUP_MESSAGE[r.reason]); return; }
    keepCloudFood(r.food);
    setRemote((x) => [r.food, ...x.filter((d) => d.n !== r.food.n)]);
    setPicked(`cloud:${r.food.n}`); setAmt(r.food.base); setQty(1);
    setNote(r.cached ? `${r.food.n} — 저장된 값` : `${r.food.n} 찾음`);
  };

  const done = (label: string) => { setAdded((a) => [...a, label]); setPicked(null); setNote(null); };

  const save = () => {
    const at = addTime(date, min);
    if (def) {
      if (def.cloud) keepCloudFood(def);
      logParts(date, [{ food: def, amt }], at);
      done(foodLabel(def, amt));
      return;
    }
    if (!current || !current.n) { setNote(custom ? '음식 이름을 입력하세요' : '음식을 고르세요'); return; }
    if (!current.k) { setNote('칼로리를 입력하세요'); return; }
    if (custom && keep && !mine.some((f) => f.n === current.n)) updateSettings({ foods: [...mine, current] });
    addMeal({ date, name: current.n, qty, kcal: r1(current.k * qty), p: r1(current.p * qty), c: r1(current.c * qty), f: r1(current.f * qty), at });
    done(qty !== 1 ? `${current.n} × ${qty}` : current.n);
    setQty(1); setCustom(false); setKeep(false); setCf({ n: '', k: null, p: null, c: null, f: null });
  };

  const title = mealName ? `${mealName}${min != null ? ` · ${hhmm(min)}` : ''}에 추가` : '음식 추가';

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {added.length ? <T v="small" style={{ color: c.ok }}>추가됨: {added.join(', ')}</T> : null}
      {!custom ? (
        <>
          <Field label="음식 찾기" value={query} onChangeText={setQuery} placeholder="예: 연어" />
          {!q ? (
            <Pills options={tabs} value={activeTab}
              onToggle={(g) => (g === 'course' ? setCourseOpen(true) : setTab(g))} />
          ) : null}
          {!q && activeTab === 'brand' ? (
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

      {def || current ? (<>
        {def ? (
          <Stepper label={`먹은 양 (${def.unit})`} value={amt} onChange={setAmt} step={def.step} min={def.step} max={def.step * 100} format={(v) => amountLabel(def, v)} />
        ) : (
          <Stepper label="먹은 양 (인분)" value={qty} onChange={setQty} step={0.5} min={0.5} max={20} />
        )}
        {preview && preview.k ? (
          <T v="muted">{Math.round(preview.k)}kcal · 단백질 {Math.round(preview.p)}g · 탄수화물 {Math.round(preview.c)}g · 지방 {Math.round(preview.f)}g</T>
        ) : null}
        {def?.cloud ? (
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="small" style={{ flexShrink: 1, color: def.cloud.kind === 'official' || def.cloud.kind === 'public' ? c.muted : c.warn }}>
              {SOURCE_NAME[def.cloud.kind]} ({def.cloud.checked} 확인){def.estCF ? ' · 탄수화물·지방은 추정' : ''}{def.cloud.shared ? ' · 다른 사용자와 공유됨' : ''}
            </T>
            <ConfirmButton label="값이 이상해요" confirmLabel="신고" onConfirm={() => { void reportFood(def.cloud!.id).then((ok) => setNote(ok ? '신고했어요' : '신고하려면 로그인하세요')); }} />
          </Row>
        ) : null}
        {def?.src && BRAND_SOURCES[def.src] ? (
          <T v="small">{BRAND_SOURCES[def.src].brand} 공개값 ({BRAND_SOURCES[def.src].checked} 확인){def.estCF ? ' · 탄수화물·지방은 추정' : ''}{BRAND_SOURCES[def.src].note ? ` · ${BRAND_SOURCES[def.src].note}` : ''}</T>
        ) : null}
        <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
          {def ? (
            <Button label="대체 식단" style={{ flex: 1, paddingVertical: 13 }}
              onPress={() => setSwapFor({ label: foodLabel(def, amt), macros: macrosOf(def, amt), def })} />
          ) : null}
          <Button label="추가" kind="primary" onPress={save} style={{ flex: 2, paddingVertical: 13 }} />
        </Row>
      </>) : null}
      {note ? <T v="small" style={{ color: c.warn }}>{note}</T> : null}

      <CourseSheet open={courseOpen} onClose={() => setCourseOpen(false)} dayKcal={dayKcal}
        onAdd={(name, lines) => { logParts(date, lines.map((l) => ({ food: l.food, amt: l.amt })), addTime(date, min)); setCourseOpen(false); done(`${name} 내 몫`); }} />
      <SwapSheet target={swapFor} action="이걸로 추가" onClose={() => setSwapFor(null)}
        onApply={(parts) => { logParts(date, parts, addTime(date, min)); setSwapFor(null); done(parts.map((p) => p.food.n).join(' + ')); }} />
    </Sheet>
  );
}
