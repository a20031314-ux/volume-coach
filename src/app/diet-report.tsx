/** 내 식습관: what gets eaten, where protein and carbs come from, when, and training-day protein. */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { Button, Card, Meter, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useDietReport } from '@/hooks/use-diet-report';
import { fmt } from '@/lib/dates';
import { CARB_NAME, MIN_DAYS, PROTEIN_NAME, SLOT_NAME, type Share } from '@/lib/diet-report';

const r = Math.round;

function ShareList<K extends string>({ list, names, perDay, days }: { list: Share<K>[]; names: Record<K, string>; perDay?: boolean; days: number }) {
  const c = usePalette();
  if (!list.length) return <T v="muted">기록이 없어요.</T>;
  const max = list[0].pct;
  return (
    <View style={{ gap: Space.sm }}>
      {list.slice(0, 6).map((s) => (
        <View key={s.k} style={{ gap: 3 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T style={{ fontSize: 14 }}>{names[s.k]}</T>
            <T v="small">{perDay ? `하루 ${r(s.g / Math.max(1, days))}g · ` : ''}<T v="small" style={{ color: c.ink, fontWeight: '700' }}>{r(s.pct)}%</T></T>
          </Row>
          <Meter pct={max ? (s.pct / max) * 100 : 0} color={s.k === 'other' ? c.rest : c.accent} height={8} />
        </View>
      ))}
    </View>
  );
}

export default function DietReportScreen() {
  const c = usePalette();
  const [days, setDays] = useState(28);
  const rep = useDietReport(days);

  if (rep.days < MIN_DAYS) {
    return (
      <Page>
        <Segmented options={[{ v: 7, n: '1주' }, { v: 28, n: '4주' }, { v: 84, n: '12주' }]} value={days} onChange={(v) => { if (v) setDays(v); }} />
        <Card>
          <T>음식을 기록한 날이 {MIN_DAYS}일 이상이면 보여드려요.</T>
          <Meter pct={(rep.days / MIN_DAYS) * 100} color={c.accent} height={8} />
          <T v="small">지금 {rep.days}일 / {MIN_DAYS}일</T>
          <Button label="음식 기록하러 가기" kind="primary" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
        </Card>
      </Page>
    );
  }

  const maxSlot = Math.max(1, ...rep.slots.map((s) => s.p));
  const tr = rep.training, rs = rep.rest;

  return (
    <Page>
      <Segmented options={[{ v: 7, n: '1주' }, { v: 28, n: '4주' }, { v: 84, n: '12주' }]} value={days} onChange={(v) => { if (v) setDays(v); }} />
      <T v="muted">{fmt(rep.from)} ~ {fmt(rep.to)} · 기록한 날 {rep.days}일 · {rep.meals}번</T>

      {rep.notes.length ? (
        <Card style={{ gap: Space.sm, backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
          {rep.notes.map((n) => <T key={n} style={{ fontSize: 14 }}>• {n}</T>)}
        </Card>
      ) : null}

      <T v="label">자주 먹는 음식</T>
      <Card style={{ gap: 0, paddingVertical: Space.sm }}>
        {rep.top.map((f, i) => (
          <Row key={f.name} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: c.line, flexWrap: 'nowrap' }}>
            <T v="num" style={{ fontSize: 14, width: 22, color: c.muted }}>{i + 1}</T>
            <T style={{ flex: 1 }} numberOfLines={1}>{f.name}</T>
            <T v="small">{f.days}일 · 1회 단백질 {r(f.p / f.times)}g</T>
          </Row>
        ))}
      </Card>

      <T v="label">단백질은 어디서</T>
      <Card><ShareList list={rep.protein} names={PROTEIN_NAME} perDay days={rep.days} /></Card>

      <T v="label">주식 탄수화물</T>
      <Card><ShareList list={rep.carbs} names={CARB_NAME} days={rep.days} /></Card>

      <T v="label">끼니별 단백질 (하루 평균)</T>
      <Card>
        <Row style={{ alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'nowrap', height: 120 }}>
          {rep.slots.map((s) => (
            <View key={s.slot} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T v="small" style={{ color: c.ink, fontWeight: '700' }}>{r(s.p)}g</T>
              <View style={{ width: 28, height: Math.max(2, (s.p / maxSlot) * 80), backgroundColor: rep.shortSlot === s.slot ? c.warn : c.accent, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
          ))}
        </Row>
        <Row style={{ flexWrap: 'nowrap', marginTop: -Space.sm }}>
          {rep.slots.map((s) => <T key={s.slot} v="small" style={{ flex: 1, textAlign: 'center' }}>{SLOT_NAME[s.slot]}</T>)}
        </Row>
        <T v="small">아침 4~11시 · 점심 ~15시 · 오후 ~17시 · 저녁 ~21시 · 밤 그 이후</T>
      </Card>

      <T v="label">운동한 날과 쉬는 날</T>
      <Card>
        {[{ n: '운동한 날', g: tr }, { n: '쉬는 날', g: rs }].map(({ n, g }) => (
          <View key={n} style={{ gap: 3 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T style={{ fontSize: 14 }}>{n} <T v="small">{g.days}일</T></T>
              <T v="small"><T v="small" style={{ color: c.ink, fontWeight: '700' }}>{g.days ? `${r(g.avgP)}g` : '–'}</T>{g.pct != null && g.days ? ` · 목표의 ${r(g.pct)}%` : ''}</T>
            </Row>
            <Meter pct={g.pct ?? 0} color={g.pct != null && g.pct < 85 ? c.warn : c.ok} height={8} />
          </View>
        ))}
        {tr.pct == null ? <T v="small">신체 정보를 입력하면 목표 대비 %가 나와요.</T> : null}
      </Card>

      {rep.prefer.length ? (
        <View style={{ gap: 2, paddingHorizontal: Space.xs }}>
          <T v="small">대체 식단·단백질 채우기에서 먼저 보여줘요</T>
          <T v="muted">{rep.prefer.slice(0, 6).join(' · ')}</T>
        </View>
      ) : null}
    </Page>
  );
}
