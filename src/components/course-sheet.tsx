/** 식사 코스 기록: pick a course, check the stages eaten, set how many shared it, log my share. */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { MacroLine } from '@/components/swap-sheet';
import { useToast } from '@/components/toast';
import { Button, ConfirmButton, Field, Pills, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { COURSES, myShare, type SavedCourse, type ShareLine } from '@/lib/courses';
import { FOOD_DB, amountLabel } from '@/lib/foods';
import { useData } from '@/store/store';

const MAX_SAVED = 12;
const NONE: SavedCourse[] = [];
const fix = (v: number) => Math.round(v * 10) / 10;

function AmountRow({ name, amt, on, onAmt, onToggle, onRemove }: {
  name: string; amt: number; on: boolean; onAmt: (v: number) => void; onToggle: () => void; onRemove?: () => void;
}) {
  const c = usePalette();
  const d = FOOD_DB.find((x) => x.n === name);
  if (!d) return null;
  return (
    <Row style={{ flexWrap: 'nowrap', paddingVertical: 6, borderBottomWidth: 1, borderColor: c.line, opacity: on ? 1 : 0.55 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${name} 먹음`} onPress={onToggle} hitSlop={8}
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18, color: on ? c.accent : c.muted }}>{on ? '☑' : '☐'}</Text>
        <T numberOfLines={1} style={{ flexShrink: 1 }}>{name}</T>
      </Pressable>
      <Button label="−" accessibilityLabel={`${name} 줄이기`} onPress={() => onAmt(fix(Math.max(d.step, amt - d.step)))} style={{ width: 36, paddingHorizontal: 0 }} />
      <T v="num" style={{ fontSize: 14, minWidth: 82, textAlign: 'center' }}>{amountLabel(d, amt)}</T>
      <Button label="+" accessibilityLabel={`${name} 늘리기`} onPress={() => onAmt(fix(amt + d.step))} style={{ width: 36, paddingHorizontal: 0 }} />
      {onRemove ? <Button label="×" kind="ghost" accessibilityLabel={`${name} 빼기`} onPress={onRemove} style={{ width: 32, paddingHorizontal: 0 }} /> : null}
    </Row>
  );
}

export function CourseSheet({ open, onClose, onAdd, dayKcal }: {
  open: boolean; onClose: () => void; onAdd: (name: string, lines: ShareLine[]) => void; dayKcal?: number;
}) {
  const c = usePalette();
  const toast = useToast();
  const savedRaw = useData((s) => s.settings.courses);
  const saved = savedRaw ?? NONE;
  const update = useData((s) => s.updateSettings);
  const [cur, setCur] = useState<SavedCourse | null>(null);
  const [q, setQ] = useState('');

  const all = [...saved.map((x) => ({ k: `my:${x.name}`, n: `★ ${x.name}`, c: x })), ...COURSES.map((x) => ({ k: x.name, n: x.name, c: x }))];
  const share = useMemo(() => (cur ? myShare(cur) : null), [cur]);
  const matches = q.trim() ? FOOD_DB.filter((d) => d.n.includes(q.trim()) && !cur?.items.some((x) => x.n === d.n)).slice(0, 8) : [];

  const set = (patch: Partial<SavedCourse>) => cur && setCur({ ...cur, ...patch });
  const setItem = (i: number, patch: Partial<SavedCourse['items'][number]>) => cur && set({ items: cur.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const close = () => { setCur(null); setQ(''); onClose(); };

  const save = () => {
    if (!cur) return;
    const rest = saved.filter((x) => x.name !== cur.name);
    update({ courses: [cur, ...rest].slice(0, MAX_SAVED) });
    toast(`내 코스에 저장: ${cur.name}`);
  };

  return (
    <Sheet open={open} title={cur ? cur.name : '식사 코스'} onClose={close}>
      {!cur ? (
        <Pills options={all.map((x) => ({ k: x.k, n: x.n }))} value={null}
          onToggle={(k) => { const x = all.find((y) => y.k === k); if (x) setCur(JSON.parse(JSON.stringify(x.c))); }} />
      ) : (<>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <T>몇 명이서</T>
          <Row gap={6} style={{ flexWrap: 'nowrap' }}>
            <Button label="−" accessibilityLabel="인원 줄이기" onPress={() => set({ people: Math.max(1, cur.people - 1) })} style={{ width: 40 }} />
            <T v="num" style={{ minWidth: 48, textAlign: 'center' }}>{cur.people}명</T>
            <Button label="+" accessibilityLabel="인원 늘리기" onPress={() => set({ people: Math.min(12, cur.people + 1) })} style={{ width: 40 }} />
          </Row>
        </Row>
        <View>
          <T v="small">테이블 전체 양 · 먹은 것만 체크</T>
          {cur.items.map((x, i) => (
            <AmountRow key={x.n} name={x.n} amt={x.amt} on={x.on}
              onAmt={(amt) => setItem(i, { amt })} onToggle={() => setItem(i, { on: !x.on })}
              onRemove={() => set({ items: cur.items.filter((_, j) => j !== i) })} />
          ))}
        </View>
        <Field label="음식 더하기" value={q} onChangeText={setQ} placeholder="예: 계란찜" />
        {matches.length ? (
          <Pills options={matches.map((d) => ({ k: d.n, n: d.n }))} value={null}
            onToggle={(n) => { const d = FOOD_DB.find((x) => x.n === n)!; set({ items: [...cur.items, { n, amt: d.base, on: true }] }); setQ(''); }} />
        ) : null}

        {share ? (
          <View style={{ gap: 2, backgroundColor: c.accentSoft, borderRadius: 10, padding: Space.md }}>
            <T style={{ fontWeight: '700' }}>내 몫 {Math.round(share.total.k).toLocaleString('ko-KR')}kcal{dayKcal ? ` · 하루의 ${Math.round((share.total.k / dayKcal) * 100)}%` : ''}</T>
            <MacroLine m={share.total} small />
          </View>
        ) : null}
        <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
          <Button label="내 코스로 저장" onPress={save} style={{ flex: 1, paddingVertical: 12 }} />
          <Button label="먹은 음식에 추가" kind="primary" disabled={!share?.lines.length}
            onPress={() => { if (share) { onAdd(cur.name, share.lines); close(); } }} style={{ flex: 1.4, paddingVertical: 12 }} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Button label="← 다른 코스" kind="ghost" onPress={() => setCur(null)} />
          {saved.some((x) => x.name === cur.name) ? (
            <ConfirmButton label="내 코스에서 삭제" onConfirm={() => { update({ courses: saved.filter((x) => x.name !== cur.name) }); toast('삭제됨'); }} />
          ) : null}
        </Row>
      </>)}
    </Sheet>
  );
}
