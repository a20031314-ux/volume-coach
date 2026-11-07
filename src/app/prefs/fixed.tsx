/** 고정식단: 매일(또는 요일마다) 먹는 음식·영양제. */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Field, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { DOW } from '@/lib/dates';
import { fixedOf, type FixedItem } from '@/lib/fixed';
import { suggestTimes, usualWorkout, type TimingContext } from '@/lib/fixed-timing';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useCloudFoods } from '@/lib/food-lookup';
import { FOOD_DB, amountLabel, type FoodDef } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import { live, newId, useData } from '@/store/store';

const QUICK = ['종합비타민', '오메가3', '비타민D', '마그네슘', '유산균', '크레아틴', '단백질 보충제', '아몬드', '하루견과', '바나나', '사과', '그릭요거트 무가당', '계란'];
const SUPPS = FOOD_DB.filter((d) => d.g === 'supp').map((d) => d.n);
const REGULAR = ['단백질 보충제', '하루견과', '아몬드', '바나나', '사과', '그릭요거트 무가당', '계란'];
const days = (d: number[]) => (!d.length ? '매일' : d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x)) ? '평일' : d.slice().sort().map((x) => DOW[x]).join('·'));

export default function FixedPrefs() {
  const c = usePalette();
  const toast = useToast();
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const cloud = useCloudFoods((s) => s.foods);
  const f = fixedOf(settings.fixed);
  const [edit, setEdit] = useState<FixedItem | null>(null);
  const [q, setQ] = useState('');
  const sessionsT = useData((s) => s.sessions);
  const prefer = usePreferredFoods();
  const ctx: TimingContext = useMemo(() => ({ meals: [...settings.mealPlan.times].sort((a, b) => a - b), workout: usualWorkout(live(sessionsT)) }), [settings.mealPlan.times, sessionsT]);
  const chosen = f.items.map((x) => x.n);
  // chosen items are timed together (so clashes stay apart); the rest as if added now
  const sugg = { ...suggestTimes([...new Set([...SUPPS, ...REGULAR])], ctx), ...suggestTimes(chosen, ctx) };
  const regular = [...new Set([...REGULAR, ...prefer.filter((n) => ['fruit', 'fat', 'dairy', 'protein'].includes(FOOD_DB.find((d) => d.n === n)?.g ?? ''))])].slice(0, 10);
  /** check = add with the suggested time (every day); uncheck = remove; then re-time everything so clashes stay apart */
  const toggleName = (n: string) => {
    const has = f.items.some((x) => x.n === n);
    const d = FOOD_DB.find((x) => x.n === n);
    if (!has && !d) return;
    const items = has ? f.items.filter((x) => x.n !== n) : [...f.items, { id: newId(), n, amt: d!.base, time: 8 * 60, dows: [] }];
    const t = suggestTimes(items.map((x) => x.n), ctx);
    save(items.map((x) => (x.custom ? x : { ...x, time: t[x.n]?.time ?? x.time })));
  };
  const retime = () => {
    const t = suggestTimes(chosen, ctx);
    save(f.items.map((x) => ({ ...x, time: t[x.n]?.time ?? x.time, custom: false })));
    toast('추천 시간으로 맞췄어요');
  };
  const checkRow = (n: string) => {
    const item = f.items.find((y) => y.n === n);
    const on = !!item;
    const x = sugg[n];
    if (!x) return null;
    const time = item?.time ?? x.time;
    return (
      <Pressable key={n} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleName(n)}
        style={{ flexDirection: 'row', gap: Space.sm, paddingVertical: 7, borderTopWidth: 1, borderColor: c.line, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 20, color: on ? c.accent : c.muted, lineHeight: 22 }}>{on ? '☑' : '☐'}</Text>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T style={{ fontWeight: on ? '700' : '400' }}>{n}</T>
            <T v="small" style={{ fontWeight: on ? '700' : '400' }}>{hhmm(time)}</T>
          </Row>
          <T v="small">{item?.custom ? `직접 정한 시간 · 추천 ${hhmm(x.time)}` : `${x.reason}${x.moved ? ` · ${x.moved}` : ''}`}</T>
        </View>
      </Pressable>
    );
  };

  const all: FoodDef[] = [...FOOD_DB, ...cloud];
  const defOf = (n: string) => all.find((d) => d.n === n);
  const matches = q.trim() ? all.filter((d) => d.n.includes(q.trim())).slice(0, 12) : QUICK.map(defOf).filter((d): d is FoodDef => !!d);
  const save = (items: FixedItem[]) => update({ fixed: { ...f, items } });

  const commit = () => {
    if (!edit) return;
    const exists = f.items.some((x) => x.id === edit.id);
    save(exists ? f.items.map((x) => (x.id === edit.id ? edit : x)) : [...f.items, edit]);
    toast(exists ? '수정됨' : `${edit.n} 추가됨`);
    setEdit(null); setQ('');
  };
  const pickFood = (n: string) => {
    const d = defOf(n);
    if (!d) return;
    setEdit((e) => ({ id: e?.id ?? newId(), n, amt: d.base, time: e?.time ?? 8 * 60, dows: e?.dows ?? [] }));
  };
  const editDef = edit ? defOf(edit.n) : undefined;

  return (
    <Page>
      <Card>
        <Segmented options={[{ v: 'check' as const, n: '체크해서 기록' }, { v: 'auto' as const, n: '시간 되면 자동 기록' }]} value={f.mode}
          onChange={(v) => v && update({ fixed: { ...f, mode: v } })} />
        <T v="small">{f.mode === 'auto' ? '정한 시간이 지나면 앱을 열 때 자동으로 기록돼요. 안 먹었으면 영양 탭에서 체크를 풀면 돼요.' : '영양 탭의 고정식단 목록에서 먹은 걸 체크하면 기록돼요.'} 아직 안 먹은 고정식단은 식단 추천 양에서 미리 빼고 계산해요.</T>
      </Card>

      <T v="label">체크해서 추가 · 시간은 추천</T>
      <Card style={{ gap: 0, paddingVertical: Space.sm }}>
        <T v="small" style={{ paddingBottom: 6 }}>끼니 시간 {ctx.meals.map(hhmm).join(' · ')}{ctx.workout ? ` · 평소 운동 ${hhmm(ctx.workout.start)}~${hhmm(ctx.workout.start + ctx.workout.minutes)}` : ' · 운동 기록이 쌓이면 운동 시간에 맞춰요'} 기준이에요. 제품 안내나 의사 지시가 있으면 그쪽을 따르세요.</T>
        <T v="small" style={{ fontWeight: '700', paddingVertical: 4 }}>영양제</T>
        {SUPPS.map(checkRow)}
        <T v="small" style={{ fontWeight: '700', paddingTop: 10, paddingBottom: 4 }}>자주 먹는 음식</T>
        {regular.map(checkRow)}
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">내 고정식단</T>
        {f.items.length ? <Button label="추천 시간으로 다시 맞추기" kind="ghost" onPress={retime} /> : null}
      </Row>
      {f.items.length ? (
        <Card style={{ gap: 0, paddingVertical: Space.sm }}>
          {[...f.items].sort((a, b) => a.time - b.time).map((x, i) => {
            const d = defOf(x.n);
            return (
              <Row key={x.id} style={{ flexWrap: 'nowrap', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
                <T v="small" style={{ width: 42 }}>{hhmm(x.time)}</T>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={1}>{x.n} {d ? amountLabel(d, x.amt) : ''}</T>
                  <T v="small">{days(x.dows)}</T>
                </View>
                <Button label="수정" kind="ghost" onPress={() => { setEdit(x); setQ(''); }} />
                <ConfirmButton label="삭제" onConfirm={() => save(f.items.filter((y) => y.id !== x.id))} />
              </Row>
            );
          })}
        </Card>
      ) : null}

      {!edit ? (
        <Button label="+ 목록에 없는 음식 추가" kind="primary" onPress={() => setEdit({ id: newId(), n: '', amt: 1, time: 8 * 60, dows: [] })} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Card>
          <T v="title" style={{ fontSize: 15 }}>{f.items.some((x) => x.id === edit.id) ? '수정' : '추가'}</T>
          <Field label="음식·영양제 찾기" value={q} onChangeText={setQ} placeholder="예: 오메가3, 아몬드" />
          <Pills options={matches.map((d) => ({ k: d.n, n: d.n }))} value={edit.n || null} onToggle={pickFood} />
          {editDef ? (<>
            <Stepper label={`양 (${editDef.unit})`} value={edit.amt} step={editDef.step} min={editDef.step} max={editDef.step * 100}
              format={(v) => amountLabel(editDef, v)} onChange={(amt) => setEdit({ ...edit, amt })} />
            <Stepper label="시간" value={edit.time} step={30} min={0} max={24 * 60 - 30} format={hhmm} onChange={(time) => setEdit({ ...edit, time, custom: true })} />
            <View style={{ gap: 5 }}>
              <T v="small">요일</T>
              <Pills options={[{ k: 'all', n: '매일' }, ...DOW.map((d, i) => ({ k: String(i), n: d }))]}
                value={edit.dows.length ? edit.dows.map(String) : ['all']}
                onToggle={(k) => {
                  if (k === 'all') return setEdit({ ...edit, dows: [] });
                  const n = Number(k);
                  const next = edit.dows.includes(n) ? edit.dows.filter((x) => x !== n) : [...edit.dows, n];
                  setEdit({ ...edit, dows: next.length === 7 ? [] : next });
                }} />
            </View>
          </>) : null}
          <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
            <Button label="취소" onPress={() => { setEdit(null); setQ(''); }} style={{ flex: 1 }} />
            <Button label="저장" kind="primary" disabled={!editDef} onPress={commit} style={{ flex: 2 }} />
          </Row>
        </Card>
      )}
    </Page>
  );
}
