/** 고정식단: 매일(또는 요일마다) 먹는 음식·영양제. */
import { useState } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Field, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { DOW } from '@/lib/dates';
import { fixedOf, type FixedItem } from '@/lib/fixed';
import { useCloudFoods } from '@/lib/food-lookup';
import { FOOD_DB, amountLabel, type FoodDef } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import { newId, useData } from '@/store/store';

const QUICK = ['종합비타민', '오메가3', '비타민D', '마그네슘', '유산균', '크레아틴', '단백질 보충제', '아몬드', '하루견과', '바나나', '사과', '그릭요거트 무가당', '계란'];
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
        <Button label="+ 고정식단 추가" kind="primary" onPress={() => setEdit({ id: newId(), n: '', amt: 1, time: 8 * 60, dows: [] })} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Card>
          <T v="title" style={{ fontSize: 15 }}>{f.items.some((x) => x.id === edit.id) ? '수정' : '추가'}</T>
          <Field label="음식·영양제 찾기" value={q} onChangeText={setQ} placeholder="예: 오메가3, 아몬드" />
          <Pills options={matches.map((d) => ({ k: d.n, n: d.n }))} value={edit.n || null} onToggle={pickFood} />
          {editDef ? (<>
            <Stepper label={`양 (${editDef.unit})`} value={edit.amt} step={editDef.step} min={editDef.step} max={editDef.step * 100}
              format={(v) => amountLabel(editDef, v)} onChange={(amt) => setEdit({ ...edit, amt })} />
            <Stepper label="시간" value={edit.time} step={30} min={0} max={24 * 60 - 30} format={hhmm} onChange={(time) => setEdit({ ...edit, time })} />
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
