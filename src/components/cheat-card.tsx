/** 치팅데이 게이지 + 과식 상쇄 제안 (영양 탭, 오늘). */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Meter, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { cutOn, dayCap, offsetChoices, offsetEnd, overDays, type Offset, type OffsetPlan } from '@/lib/cheat';
import { addDays, diffDays, fmt, today } from '@/lib/dates';
import { cheatBank, cheatOf, dayIntake, dayTarget, type DayInputs, type DayTarget } from '@/lib/day-target';
import { body } from '@/lib/profile';
import { live, useData } from '@/store/store';

const n = (x: number) => Math.round(x).toLocaleString('ko-KR');

export function CheatCard({ t }: { t: DayTarget | null }) {
  const c = usePalette();
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const update = useData((s) => s.updateSettings);
  const cheat = cheatOf(settings);
  const d0 = today();

  const v = useMemo(() => {
    if (!cheat.on) return null;
    const x: DayInputs = { settings, comps: live(bodyT), logs: live(logsT), meals: live(mealsT) };
    const b = cheatBank(x, d0);
    const over = overDays(cheat, d0, (d) => dayIntake(x, d), (d) => dayTarget(x, d, d0)?.kcal ?? 0);
    const weightKg = body(settings.profile, live(bodyT))?.weight || 70;
    const plans = over.map((o) => ({ ...o, choices: offsetChoices(o.over, { mix: cheat.offsetMix, target: t?.base ?? 2200, bmr: t?.bmr ?? 1500, weightKg, from: d0, existing: cheat.offsets }) }));
    const running = cheat.offsets.filter((o) => d0 >= o.from && d0 <= offsetEnd(o));
    return { b, plans, running };
  }, [cheat, settings, bodyT, logsT, mealsT, d0, t]);

  if (!v || !t) return null;
  const { b, plans, running } = v;

  const apply = (src: string, p: OffsetPlan) => {
    const keep = cheat.offsets.filter((o) => offsetEnd(o) >= addDays(d0, -7));
    const o: Offset = { src, from: d0, days: p.days, cut: p.cut, cuts: p.cuts, over: p.over, moveKcal: p.moveKcal, walkMin: p.walkMin, runMin: p.runMin };
    update({ cheat: { ...cheat, offsets: [...keep, o] } });
  };
  const dismiss = (src: string) => update({ cheat: { ...cheat, dismissed: [...cheat.dismissed.filter((d) => d >= addDays(d0, -7)), src] } });

  return (
    <>
      {b ? (
        <Card style={{ gap: Space.sm }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="title" style={{ fontSize: 15 }}>{b.cheatDay === d0 ? '오늘 치팅데이' : `치팅데이까지 ${b.daysLeft}일 · ${fmt(b.cheatDay)}`}</T>
            <Button label="설정" kind="ghost" onPress={() => router.push('/prefs/cheat')} />
          </Row>
          <Meter pct={b.pct} color={c.ok} height={12} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="num" style={{ fontSize: 16 }}>{n(b.banked)}<T v="small"> / {n(b.budget)}kcal 모음</T></T>
            {b.cheatDay === d0 ? <Chip label={`오늘 목표 +${n(b.banked)}`} tone="ok" /> : null}
          </Row>
          {b.cheatDay !== d0 ? (
            <T v="small">목표보다 덜 먹은 만큼 쌓여요 (하루 최대 {dayCap(t.base)}kcal){cheat.save ? ` · 지금은 하루 ${cheat.save}kcal씩 목표를 낮춰 모으는 중` : ''}</T>
          ) : null}
          {b.lowDays ? <T v="small" style={{ color: c.warn }}>기초대사량보다 적게 먹은 {b.lowDays}일은 저금되지 않아요. 굶어서 모으면 근손실이 커요.</T> : null}
        </Card>
      ) : null}

      {running.map((o) => {
        const total = o.cuts?.length ?? o.days;
        const cutToday = cutOn(o, d0);
        return (
          <Card key={o.src} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="title" style={{ fontSize: 15 }}>상쇄 중 · {diffDays(d0, o.from) + 1}/{total}일</T>
              <T v="small">{fmt(o.src)} +{n(o.over)}kcal · {fmt(offsetEnd(o))}까지</T>
            </Row>
            <T v="small">오늘 목표 {cutToday ? `−${cutToday}kcal (반영됨)` : '그대로'}{o.moveKcal ? ` · 기간 중 걷기 ${o.walkMin}분 또는 러닝 ${o.runMin}분 더 (약 ${n(o.moveKcal)}kcal)` : ''}</T>
          </Card>
        );
      })}

      {plans.map(({ date, over, choices }) => (
        <Card key={date} style={{ gap: Space.sm, borderColor: c.warn }}>
          <T v="title" style={{ fontSize: 15 }}>{fmt(date)} 목표보다 +{n(over)}kcal</T>
          <T v="small">하루 체중이 1~2kg 늘어도 대부분 수분이라 며칠이면 빠져요. 나눠서 갚을까요?</T>
          {choices.map(({ label, plan }) => (
            <View key={label} style={{ gap: 4, borderTopWidth: 1, borderColor: c.line, paddingTop: Space.sm }}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <View style={{ flexShrink: 1, gap: 2 }}>
                  <T style={{ fontWeight: '700' }}>{label}</T>
                  {plan.cut ? <T v="small">식단 하루 −{plan.cut}kcal{plan.cuts.length > plan.days ? ` (다른 상쇄와 겹쳐 ${plan.cuts.length}일)` : ''}</T> : null}
                  {plan.moveKcal ? <T v="small">운동 걷기 {plan.walkMin}분 또는 러닝 {plan.runMin}분 (약 {n(plan.moveKcal)}kcal)</T> : null}
                </View>
                <Button label="이걸로" kind="primary" onPress={() => apply(date, plan)} />
              </Row>
            </View>
          ))}
          <Button label="괜찮아요" kind="ghost" onPress={() => dismiss(date)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}
    </>
  );
}
