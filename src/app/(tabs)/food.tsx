import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Disclosure } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, DayNav, Field, Meter, NumField, Pills, Row, Screen, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { addDays, fmt, today } from '@/lib/dates';
import { FOODS, nutritionTargets } from '@/lib/nutrition';
import type { Food } from '@/lib/types';
import { live, useData } from '@/store/store';

const r1 = (x: number) => Math.round(x * 10) / 10;

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

  const [date, setDate] = useState(today());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [cf, setCf] = useState<{ n: string; k: number | null; p: number | null; c: number | null; f: number | null }>({ n: '', k: null, p: null, c: null, f: null });
  const [keep, setKeep] = useState(false);
  const [qty, setQty] = useState(1);

  const foods = useMemo(() => FOODS.concat(settings.foods), [settings.foods]);
  const shown = foods.filter((f) => !query.trim() || f.n.includes(query.trim()));
  const t = useMemo(() => nutritionTargets(settings.profile, live(bodyT), live(logsT), date), [settings.profile, bodyT, logsT, date]);
  const eaten = useMemo(() => live(mealsT).filter((m) => m.date === date).sort((a, b) => a.at - b.at), [mealsT, date]);
  const sum = eaten.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), { k: 0, p: 0, c: 0, f: 0 });

  const current: Food | null = custom
    ? { n: cf.n.trim(), k: cf.k ?? 0, p: cf.p ?? 0, c: cf.c ?? 0, f: cf.f ?? 0 }
    : foods.find((f) => f.n === picked) ?? null;

  const save = () => {
    if (!current || !current.n) return toast(custom ? '음식 이름을 입력하세요' : '음식을 고르세요');
    if (!current.k) return toast('칼로리를 입력하세요');
    if (custom && keep && !foods.some((f) => f.n === current.n)) updateSettings({ foods: [...settings.foods, current] });
    addMeal({ date, name: current.n, qty, kcal: r1(current.k * qty), p: r1(current.p * qty), c: r1(current.c * qty), f: r1(current.f * qty), at: Date.now() });
    toast(`${current.n} 추가됨`);
    setQty(1); setCustom(false); setKeep(false); setCf({ n: '', k: null, p: null, c: null, f: null });
  };

  const macro = (name: string, got: number, goal: number, color: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md }}>
      <T style={{ width: 60, fontSize: 14 }}>{name}</T>
      <View style={{ flex: 1 }}><Meter pct={goal ? (got / goal) * 100 : 0} color={got > goal * 1.1 ? c.warn : color} height={10} /></View>
      <T v="num" style={{ fontSize: 16, width: 92, textAlign: 'right' }}>{Math.round(got)}<T v="small"> / {goal}g</T></T>
    </View>
  );
  const left = t ? t.kcal - Math.round(sum.k) : 0;

  return (
    <Screen title="영양">
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
          <T>설정에서 나이·키·체중을 입력하면 하루 목표 칼로리와 영양소를 계산해요.</T>
          <Button label="내 정보 입력하기" kind="primary" onPress={() => router.navigate('/settings')} style={{ alignSelf: 'flex-start' }} />
          <T v="small">지금 먹은 양: {Math.round(sum.k)}kcal · 단백질 {Math.round(sum.p)}g · 탄수화물 {Math.round(sum.c)}g · 지방 {Math.round(sum.f)}g</T>
        </Card>
      )}
      {t && sum.p < t.p && date === today() && new Date().getHours() >= 17 ? (
        <T v="muted">단백질이 {Math.round(t.p - sum.p)}g 남았어요. 닭가슴살 100g이면 약 23g이에요.</T>
      ) : null}

      <Card>
        {!custom ? (
          <>
            <Field label="음식 찾기" value={query} onChangeText={setQuery} placeholder="예: 닭가슴살" />
            <Pills options={[...shown.map((f) => ({ k: f.n, n: f.n })), { k: '__new', n: '+ 직접 입력' }]} value={picked}
              onToggle={(k) => (k === '__new' ? setCustom(true) : setPicked(k))} />
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
        <Row gap={Space.md}><Stepper label="먹은 양 (인분)" value={qty} onChange={setQty} step={0.5} min={0.5} max={20} /></Row>
        {current && current.k ? (
          <T v="muted">{Math.round(current.k * qty)}kcal · 단백질 {Math.round(current.p * qty)}g · 탄수화물 {Math.round(current.c * qty)}g · 지방 {Math.round(current.f * qty)}g</T>
        ) : null}
        <Button label="먹은 음식 추가" kind="primary" onPress={save} style={{ paddingVertical: 13 }} />
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
          <ConfirmButton label="삭제" onConfirm={() => { removeMeal(m.id); toast('삭제됨'); }} />
        </View>
      ))}
    </Screen>
  );
}
