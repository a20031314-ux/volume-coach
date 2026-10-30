import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Field, Pills, Row, Segmented, T } from '@/components/ui';
import { VolumeCheckView } from '@/components/volume-check';
import { Space, usePalette } from '@/constants/theme';
import { DOW } from '@/lib/dates';
import { MUSCLES, MUSCLE_NAME } from '@/lib/exercises';
import { knownExercises, pickable } from '@/lib/ability';
import { alternatives, defaultWeekdays, weeklyVolume } from '@/lib/routine';
import type { MuscleKey, Routine, RoutineDay } from '@/lib/types';
import { live, newId, useData } from '@/store/store';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function RoutineEditor() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stored = useData((x) => (id ? x.routines[id] : undefined));
  const settings = useData((x) => x.settings);
  const putRoutine = useData((x) => x.putRoutine);
  const logsT = useData((x) => x.logs);
  const known = useMemo(() => knownExercises(live(logsT)), [logsT]);
  const update = useData((x) => x.updateSettings);
  const [draft, setDraft] = useState<Routine | null>(() => (stored ? structuredClone(stored) : null));
  const [adding, setAdding] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const vol = useMemo(() => (draft ? weeklyVolume(draft, settings, settings.profile.days) : []), [draft, settings]);

  if (!draft) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: Space.lg, gap: Space.md }}>
        <T>루틴을 찾을 수 없어요.</T>
        <Button label="돌아가기" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  const change = (fn: (r: Routine) => void) => {
    const next = structuredClone(draft);
    fn(next);
    if (next.source === 'recommended') next.source = 'edited';
    setDraft(next);
    setDirty(true);
  };
  const day = (r: Routine, key: string) => r.days.find((d) => d.key === key)!;
  const eq = settings.profile.equipment ?? 'gym';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + 110, gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
        <Field label="루틴 이름" value={draft.name} onChangeText={(name) => change((r) => { r.name = name; })} />
        <Segmented options={[{ v: 'rotation', n: '순서대로 반복' }, { v: 'weekday', n: '요일 고정' }]} value={draft.schedule}
          onChange={(v) => v && change((r) => {
            r.schedule = v;
            if (v === 'weekday') { const wd = defaultWeekdays(r.days.length); r.days.forEach((d, i) => { if (!d.weekdays.length) d.weekdays = wd[i]; }); }
          })} />

        {draft.days.map((d, di) => (
          <Card key={d.key}>
            <Row style={{ flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}>
                <Field label={`Day ${di + 1}`} value={d.name} onChangeText={(name) => change((r) => { day(r, d.key).name = name; })} />
              </View>
              <ConfirmButton label="Day 삭제" onConfirm={() => change((r) => { r.days = r.days.filter((x) => x.key !== d.key); })} />
            </Row>
            {draft.schedule === 'weekday' ? (
              <Pills options={WEEK.map((w) => ({ k: String(w), n: DOW[w] }))} value={d.weekdays.map(String)}
                onToggle={(k) => change((r) => {
                  const w = Number(k);
                  // a weekday belongs to one day at most
                  r.days.forEach((x) => { if (x.key !== d.key) x.weekdays = x.weekdays.filter((y) => y !== w); });
                  const me = day(r, d.key);
                  me.weekdays = me.weekdays.includes(w) ? me.weekdays.filter((y) => y !== w) : [...me.weekdays, w].sort();
                })} />
            ) : null}

            {d.exercises.map((e, ei) => (
              <View key={`${e.name}-${ei}`} style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: Space.sm, gap: 6 }}>
                <Row style={{ flexWrap: 'nowrap' }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T>{e.name}</T>
                    <T v="small">{MUSCLE_NAME[e.muscle]}</T>
                  </View>
                  <Button label="−" accessibilityLabel={`${e.name} 세트 줄이기`} style={{ width: 38 }}
                    onPress={() => change((r) => { const x = day(r, d.key).exercises[ei]; x.sets = Math.max(1, x.sets - 1); })} />
                  <T v="num" style={{ width: 28, textAlign: 'center' }}>{e.sets}</T>
                  <Button label="+" accessibilityLabel={`${e.name} 세트 늘리기`} style={{ width: 38 }}
                    onPress={() => change((r) => { const x = day(r, d.key).exercises[ei]; x.sets = Math.min(10, x.sets + 1); })} />
                </Row>
                <Row>
                  <Button label="교체" kind="ghost" onPress={() => change((r) => {
                    const x = day(r, d.key).exercises[ei];
                    const alts = alternatives(x.name, x.muscle, { ...settings, profile: { ...settings.profile, equipment: eq }, known }).filter((n) => !day(r, d.key).exercises.some((y) => y.name === n));
                    if (alts.length) x.name = alts[0];
                  })} />
                  <Button label="↑" kind="ghost" accessibilityLabel="위로" disabled={ei === 0}
                    onPress={() => change((r) => { const xs = day(r, d.key).exercises; [xs[ei - 1], xs[ei]] = [xs[ei], xs[ei - 1]]; })} />
                  <Button label="↓" kind="ghost" accessibilityLabel="아래로" disabled={ei === d.exercises.length - 1}
                    onPress={() => change((r) => { const xs = day(r, d.key).exercises; [xs[ei + 1], xs[ei]] = [xs[ei], xs[ei + 1]]; })} />
                  <View style={{ flex: 1 }} />
                  <Button label="빼기" kind="ghost" onPress={() => change((r) => { day(r, d.key).exercises.splice(ei, 1); })} />
                </Row>
              </View>
            ))}
            {adding === d.key
              ? <AddPicker known={known} onAdd={(name, muscle) => { change((r) => { day(r, d.key).exercises.push({ name, muscle, sets: 3 }); }); setAdding(null); }} onCancel={() => setAdding(null)} />
              : <Button label="+ 운동 추가" onPress={() => setAdding(d.key)} />}
            <T v="small">{d.exercises.length}개 · {d.exercises.reduce((a, e) => a + e.sets, 0)}세트</T>
          </Card>
        ))}

        <Button label="+ Day 추가" onPress={() => change((r) => {
          const used = new Set(r.days.flatMap((x) => x.weekdays));
          const free = WEEK.find((w) => !used.has(w));
          r.days.push({ key: newId(), name: `Day ${r.days.length + 1}`, weekdays: r.schedule === 'weekday' && free != null ? [free] : [], exercises: [] } satisfies RoutineDay);
        })} />

        <Card>
          <T v="title">주간 볼륨 점검</T>
          <VolumeCheckView checks={vol} min={settings.min} max={settings.max} />
        </Card>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Space.lg, paddingTop: Space.md, paddingBottom: insets.bottom + Space.md, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line }}>
        <Row style={{ flexWrap: 'nowrap', maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          <Button label="취소" style={{ flex: 1 }} onPress={() => router.back()} />
          <Button label={dirty ? '저장하고 쓰기' : '이 루틴 쓰기'} kind="primary" style={{ flex: 2, paddingVertical: 13 }} onPress={() => {
            const { updatedAt: _u, ...rest } = draft;
            putRoutine({ ...rest, name: rest.name.trim() || '내 루틴' });
            update({ planMode: 'routine', activeRoutineId: draft.id });
            toast('루틴을 저장했어요');
            router.back();
          }} />
        </Row>
      </View>
    </View>
  );
}

function AddPicker({ known, onAdd, onCancel }: { known: Set<string>; onAdd: (name: string, m: MuscleKey) => void; onCancel: () => void }) {
  const settings = useData((x) => x.settings);
  const [m, setM] = useState<MuscleKey>('chest');
  const opts = pickable(m, { ...settings, known }, true);
  return (
    <View style={{ gap: Space.sm }}>
      <Pills options={MUSCLES} value={m} onToggle={setM} />
      <Pills options={opts.map((o) => ({ k: o.n, n: o.n }))} value={null} onToggle={(k) => onAdd(k, m)} />
      <Button label="취소" kind="ghost" onPress={onCancel} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}
