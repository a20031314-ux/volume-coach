/** 고정식단: 매일(또는 요일마다) 먹는 음식·영양제. 체크하면 시간을 추천해서 넣는다. */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Disclosure } from '@/components/layout';
import { SavePage } from '@/components/save-bar';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, ConfirmButton, Field, NumField, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { DOW } from '@/lib/dates';
import { fixedOf, freeDef, itemLabel, type FixedItem } from '@/lib/fixed';
import { SUPP_SECTIONS, caffeineWarnings, suggestTimes, timingContext, type TimingContext } from '@/lib/fixed-timing';
import { useCloudFoods } from '@/lib/food-lookup';
import { FOOD_DB, amountLabel, type FoodDef } from '@/lib/foods';
import { hhmm } from '@/lib/meal-plan';
import { live, newId, useData } from '@/store/store';

const ALL_SUPPS = SUPP_SECTIONS.flatMap((s) => s.names);
const REGULAR = ['하루견과', '아몬드', '바나나', '사과', '그릭요거트 무가당', '계란'];
/** brands people often ask for; any other name can be typed */
const BRANDS = ['쏜리(Thorne)', '라이프익스텐션', '나우푸드(NOW)', '닥터스베스트', '솔가', '네이처메이드', '캘리포니아 골드', '자로우', '센트룸', '얼라이브', '고려은단', '종근당건강', '뉴트리원', '정관장', '옵티멈 뉴트리션', '마이프로틴'];
const UNITS = ['mg', 'μg', 'IU', 'g'] as const;
const days = (d: number[]) => (!d.length ? '매일' : d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x)) ? '평일' : d.slice().sort().map((x) => DOW[x]).join('·'));

export default function FixedPrefs() {
  const c = usePalette();
  const toast = useToast();
  const { s: settings, update, dirty, save: saveDraft, reset } = useSettingsDraft();
  const cloud = useCloudFoods((s) => s.foods);
  const sessionsT = useData((s) => s.sessions);
  const prefer = usePreferredFoods();
  const f = fixedOf(settings.fixed);
  const [edit, setEdit] = useState<FixedItem | null>(null);
  const [q, setQ] = useState('');
  const [find, setFind] = useState('');

  const ctx: TimingContext = useMemo(() => timingContext(settings, live(sessionsT)), [settings, sessionsT]);
  const chosen = f.items.map((x) => x.n);
  // chosen items are timed together (so clashes stay apart); the rest as if added now
  const timed = suggestTimes(chosen, ctx);
  // each unchosen row: as if it were added to what's chosen now (60-odd tiny calculations)
  const sugg = { ...Object.fromEntries([...ALL_SUPPS, ...REGULAR].filter((n) => !timed[n]).map((n) => [n, suggestTimes([...chosen, n], ctx)[n]])), ...timed };
  const regular = [...new Set([...REGULAR, ...prefer.filter((n) => ['fruit', 'fat', 'dairy', 'protein'].includes(FOOD_DB.find((d) => d.n === n)?.g ?? ''))])].slice(0, 10);
  const warns = caffeineWarnings(f.items, ctx);

  const all: FoodDef[] = [...FOOD_DB, ...cloud];
  const defOf = (x: Pick<FixedItem, 'n' | 'free'>) => all.find((d) => d.n === x.n) ?? (x.free ? freeDef(x.n) : undefined);
  const save = (items: FixedItem[]) => update({ fixed: { ...f, items } });
  const retimed = (items: FixedItem[]) => {
    const t = suggestTimes(items.map((x) => x.n), ctx);
    return items.map((x) => (x.custom ? x : { ...x, time: t[x.n]?.time ?? x.time }));
  };

  /** check = add with the suggested time (every day); uncheck = remove */
  const toggleName = (n: string) => {
    const has = f.items.some((x) => x.n === n);
    const d = FOOD_DB.find((x) => x.n === n);
    if (!has && !d) return;
    save(retimed(has ? f.items.filter((x) => x.n !== n) : [...f.items, { id: newId(), n, amt: d!.base, time: 8 * 60, dows: [] }]));
  };
  const retime = () => {
    save(retimed(f.items.map((x) => ({ ...x, custom: false }))));
    toast('추천 시간으로 맞췄어요 · 저장을 눌러 주세요');
  };

  const checkRow = (n: string) => {
    const item = f.items.find((y) => y.n === n);
    const x = sugg[n];
    if (!x) return null;
    const on = !!item;
    return (
      <Pressable key={n} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={n} onPress={() => toggleName(n)}
        style={{ flexDirection: 'row', gap: Space.sm, paddingVertical: 7, borderTopWidth: 1, borderColor: c.line, alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 20, color: on ? c.accent : c.muted, lineHeight: 22 }}>{on ? '☑' : '☐'}</Text>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T style={{ fontWeight: on ? '700' : '400', flexShrink: 1 }} numberOfLines={1}>{item ? itemLabel(item) : n}</T>
            <T v="small" style={{ fontWeight: on ? '700' : '400' }}>{hhmm(item?.time ?? x.time)}</T>
          </Row>
          <T v="small">{item?.custom ? `직접 정한 시간 · 추천 ${hhmm(x.time)}` : `${x.reason}${x.moved ? ` · ${x.moved}` : ''}`}</T>
        </View>
      </Pressable>
    );
  };

  const term = find.trim();
  const found = term ? ALL_SUPPS.filter((n) => n.toLowerCase().includes(term.toLowerCase())) : [];

  const commit = () => {
    if (!edit) return;
    const exists = f.items.some((x) => x.id === edit.id);
    save(retimed(exists ? f.items.map((x) => (x.id === edit.id ? edit : x)) : [...f.items, edit]));
    toast(`${exists ? '수정' : `${edit.n} 추가`} · 저장을 눌러 주세요`);
    setEdit(null); setQ('');
  };
  const matches = q.trim() ? all.filter((d) => d.n.includes(q.trim())).slice(0, 12) : [];
  const editDef = edit ? defOf(edit) : undefined;
  const isSupp = editDef?.g === 'supp';

  return (
    <SavePage dirty={dirty} onSave={saveDraft} onReset={reset}>
      <Card>
        <Segmented options={[{ v: 'check' as const, n: '체크해서 기록' }, { v: 'auto' as const, n: '시간 되면 자동 기록' }]} value={f.mode}
          onChange={(v) => v && update({ fixed: { ...f, mode: v } })} />
        <T v="small">{f.mode === 'auto' ? '정한 시간이 지나면 앱을 열 때 자동으로 기록돼요. 안 먹었으면 영양 탭에서 체크를 풀면 돼요.' : '영양 탭의 고정식단 목록에서 먹은 걸 체크하면 기록돼요.'} 아직 안 먹은 고정식단은 식단 추천 양에서 미리 빼고 계산해요.</T>
      </Card>

      {warns.map((w) => <Banner key={w} text={w} />)}

      <T v="label">체크해서 추가 · 시간은 추천</T>
      <Card style={{ gap: Space.sm }}>
        <T v="small">끼니 시간 {ctx.meals.map(hhmm).join(' · ')}{ctx.workout ? ` · 평소 운동 ${hhmm(ctx.workout.start)}~${hhmm(ctx.workout.start + ctx.workout.minutes)}` : ' · 운동 기록이 쌓이면 운동 시간에 맞춰요'} 기준이에요. 제품 안내나 의사 지시가 있으면 그쪽을 따르세요.</T>
        <Field label="영양제 찾기" value={find} onChangeText={setFind} placeholder="예: 벤포티아민, 시트룰린" />
        {term ? (
          <View>
            {found.map(checkRow)}
            {!found.length ? (
              <Button label={`"${term}" 직접 추가 (열량 0)`} onPress={() => {
                save(retimed([...f.items, { id: newId(), n: term, amt: 1, time: 8 * 60, dows: [], free: true }]));
                toast(`${term} 추가 · 저장을 눌러 주세요`); setFind('');
              }} style={{ alignSelf: 'flex-start' }} />
            ) : null}
          </View>
        ) : (<>
          {SUPP_SECTIONS.map((s) => {
            const n = s.names.filter((x) => chosen.includes(x)).length;
            return (
              <Disclosure key={s.title} title={s.title} meta={n ? `${n}개 선택` : `${s.names.length}종`} initiallyOpen={s.title === '비타민' && !f.items.length}>
                <View>{s.names.map(checkRow)}</View>
              </Disclosure>
            );
          })}
          <Disclosure title="자주 먹는 음식" meta={`${regular.filter((x) => chosen.includes(x)).length || regular.length}${regular.some((x) => chosen.includes(x)) ? '개 선택' : '종'}`}>
            <View>{regular.map(checkRow)}</View>
          </Disclosure>
        </>)}
      </Card>

      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">내 고정식단</T>
        {f.items.length ? <Button label="추천 시간으로 다시 맞추기" kind="ghost" onPress={retime} /> : null}
      </Row>
      {f.items.length ? (
        <Card style={{ gap: 0, paddingVertical: Space.sm }}>
          {[...f.items].sort((a, b) => a.time - b.time).map((x, i) => {
            const d = defOf(x);
            return (
              <Row key={x.id} style={{ flexWrap: 'nowrap', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: c.line }}>
                <T v="small" style={{ width: 42 }}>{hhmm(x.time)}</T>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T numberOfLines={2}>{itemLabel(x)}</T>
                  <T v="small">{d ? amountLabel(d, x.amt) : ''} · {days(x.dows)}</T>
                </View>
                <Button label="수정" kind="ghost" onPress={() => { setEdit(x); setQ(''); }} />
                <ConfirmButton label="삭제" onConfirm={() => save(f.items.filter((y) => y.id !== x.id))} />
              </Row>
            );
          })}
        </Card>
      ) : <T v="muted">위에서 체크하면 여기에 쌓여요.</T>}

      {!edit ? (
        <Button label="+ 목록에 없는 음식 추가" onPress={() => setEdit({ id: newId(), n: '', amt: 1, time: 8 * 60, dows: [] })} style={{ alignSelf: 'flex-start' }} />
      ) : (
        <Card>
          <T v="title" style={{ fontSize: 15 }}>{f.items.some((x) => x.id === edit.id) ? `수정 · ${edit.n}` : '추가'}</T>
          {!f.items.some((x) => x.id === edit.id) ? (<>
            <Field label="음식 찾기" value={q} onChangeText={setQ} placeholder="예: 그래놀라, 두유" />
            <Pills options={matches.map((d) => ({ k: d.n, n: d.n }))} value={edit.n || null}
              onToggle={(n) => { const d = all.find((x) => x.n === n); if (d) setEdit({ ...edit, n, amt: d.base }); }} />
          </>) : null}
          {editDef ? (<>
            <Stepper label={`양 (${editDef.unit})`} value={edit.amt} step={editDef.step} min={editDef.step} max={editDef.step * 100}
              format={(v) => amountLabel(editDef, v)} onChange={(amt) => setEdit({ ...edit, amt })} />
            {isSupp ? (<>
              <View style={{ gap: 5 }}>
                <T v="small">브랜드 (선택)</T>
                <Pills options={BRANDS.map((b) => ({ k: b, n: b }))} value={edit.brand ?? null}
                  onToggle={(b) => setEdit({ ...edit, brand: edit.brand === b ? undefined : b })} />
                <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
                  <Field label="목록에 없는 브랜드" value={BRANDS.includes(edit.brand ?? '') ? '' : edit.brand ?? ''} style={{ flex: 1 }}
                    onChangeText={(v) => setEdit({ ...edit, brand: v.trim() ? v : undefined })} placeholder="예: 스포츠리서치" />
                  <Field label="제품명" value={edit.product ?? ''} style={{ flex: 1.3 }}
                    onChangeText={(v) => setEdit({ ...edit, product: v.trim() ? v : undefined })} placeholder="예: Basic Nutrients 2/Day" />
                </Row>
              </View>
              <Row gap={Space.md} style={{ alignItems: 'flex-end' }}>
                <NumField label="1개당 함량 (선택)" value={edit.dose ?? null} onCommit={(dose) => setEdit({ ...edit, dose })} decimal style={{ flex: 1 }} />
                <View style={{ flex: 1 }}>
                  <Segmented options={UNITS.map((u) => ({ v: u, n: u }))} value={edit.doseUnit ?? 'mg'} onChange={(u) => u && setEdit({ ...edit, doseUnit: u })} />
                </View>
              </Row>
            </>) : null}
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
    </SavePage>
  );
}
