/** 치팅데이: 언제, 얼마나 모을지, 넘쳤을 때 어떻게 상쇄할지. */
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { Button, Card, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { DOW, addDays, fmt, today } from '@/lib/dates';
import { cheatOf } from '@/lib/day-target';
import type { CheatSettings } from '@/lib/types';
import { useData } from '@/store/store';

export default function CheatPrefs() {
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const c = cheatOf(settings);
  const set = (patch: Partial<CheatSettings>) => update({ cheat: { ...c, ...patch } });
  const d0 = today();
  const date = c.date && c.date >= d0 ? c.date : addDays(d0, 6);

  return (
    <Page>
      <Card>
        <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: '치팅데이 쓰기' }]} value={c.on ? 'on' : 'off'}
          onChange={(v) => v && set({ on: v === 'on', since: v === 'on' ? d0 : c.since })} />
        {c.on ? <T v="small">치팅데이 전까지 목표보다 덜 먹은 만큼 게이지에 쌓이고, 그날 목표가 쌓인 만큼 늘어나요.</T> : null}
      </Card>

      {c.on ? (<>
        <T v="label">언제</T>
        <Card>
          <Segmented options={[{ v: 'weekly', n: '매주' }, { v: 'date', n: '날짜 지정' }]} value={c.mode}
            onChange={(v) => v && set(v === 'date' ? { mode: 'date', date, since: d0 } : { mode: 'weekly' })} />
          {c.mode === 'weekly' ? (
            <Pills options={DOW.map((d, i) => ({ k: String(i), n: d }))} value={String(c.dow)} onToggle={(k) => set({ dow: Number(k) })} />
          ) : (
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <Button label="−" onPress={() => set({ date: addDays(date, -1) < d0 ? d0 : addDays(date, -1) })} style={{ width: 44 }} />
              <T v="num">{fmt(date)}</T>
              <Button label="+" onPress={() => set({ date: addDays(date, 1) > addDays(d0, 13) ? addDays(d0, 13) : addDays(date, 1) })} style={{ width: 44 }} />
            </Row>
          )}
        </Card>

        <T v="label">얼마나</T>
        <Card>
          <Stepper label="치팅데이에 더 먹을 칼로리" value={c.budget} step={250} min={500} max={2000} format={(v) => `+${v}kcal`} onChange={(budget) => set({ budget })} />
          <View style={{ gap: 5 }}>
            <T v="small">모으는 방법</T>
            <Segmented options={[{ v: 0, n: '남는 만큼' }, { v: 100, n: '−100' }, { v: 200, n: '−200' }, { v: 300, n: '−300' }]} value={c.save}
              onChange={(v) => set({ save: v ?? 0 })} />
            <T v="small">{c.save ? `치팅데이 전까지 하루 목표를 ${c.save}kcal 낮춰 확실히 모아요.` : '목표는 그대로 두고, 덜 먹은 날의 남은 칼로리만 모아요.'} 하루에 쌓이는 양은 최대 400kcal이고, 기초대사량보다 적게 먹은 날은 쌓이지 않아요.</T>
          </View>
        </Card>

        <T v="label">넘쳤을 때 상쇄</T>
        <Card>
          <View style={{ gap: 5 }}>
            <T v="small">방법</T>
            <Segmented options={[{ v: 'diet' as const, n: '식단만' }, { v: 'mix' as const, n: '식단+운동' }, { v: 'move' as const, n: '운동만' }]} value={c.offsetMix}
              onChange={(v) => v && set({ offsetMix: v })} />
          </View>
          <T v="small">하루 목표보다 크게 넘친 날이 있으면 다음 날 영양 탭에서 상쇄 계획을 제안해요. 기간은 넘친 양에 맞춰 2~7일 중 가장 짧은 걸 추천하고, 7일로 여유 있게 고를 수도 있어요. 식단은 여러 상쇄를 합쳐도 하루 최대 300kcal까지만 줄이고 기초대사량 아래로는 내리지 않아요. 남는 부분은 걷기·러닝 시간으로 안내해요.</T>
        </Card>
      </>) : null}
    </Page>
  );
}
