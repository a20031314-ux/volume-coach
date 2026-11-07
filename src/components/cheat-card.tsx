/** 치팅데이 저금통 + 과식 상쇄 (영양 탭, 오늘): state hook, summary chips, the offer card, and the detail sheet. */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { Button, Card, Chip, Meter, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { cutOn, dayCap, offsetChoices, offsetEnd, overDays, type Offset, type OffsetPlan } from '@/lib/cheat';
import { addDays, diffDays, fmt, today } from '@/lib/dates';
import { cheatBank, cheatOf, dayIntake, dayTarget, type DayInputs, type DayTarget } from '@/lib/day-target';
import { body } from '@/lib/profile';
import { live, useData } from '@/store/store';

const n = (x: number) => Math.round(x).toLocaleString('ko-KR');

export function useCheat(t: DayTarget | null) {
  const settings = useData((s) => s.settings);
  const mealsT = useData((s) => s.meals);
  const logsT = useData((s) => s.logs);
  const bodyT = useData((s) => s.bodyComps);
  const update = useData((s) => s.updateSettings);
  const cheat = cheatOf(settings);
  const d0 = today();

  const v = useMemo(() => {
    if (!cheat.on || !t) return null;
    const x: DayInputs = { settings, comps: live(bodyT), logs: live(logsT), meals: live(mealsT) };
    const b = cheatBank(x, d0);
    const over = overDays(cheat, d0, (d) => dayIntake(x, d), (d) => dayTarget(x, d, d0)?.kcal ?? 0);
    const weightKg = body(settings.profile, live(bodyT))?.weight || 70;
    const plans = over.map((o) => ({ ...o, choices: offsetChoices(o.over, { mix: cheat.offsetMix, target: t.base, bmr: t.bmr, weightKg, from: d0, existing: cheat.offsets }) }));
    const running = cheat.offsets.filter((o) => d0 >= o.from && d0 <= offsetEnd(o));
    return { b, plans, running };
  }, [cheat, settings, bodyT, logsT, mealsT, d0, t]);

  const apply = (src: string, p: OffsetPlan) => {
    const keep = cheat.offsets.filter((o) => offsetEnd(o) >= addDays(d0, -7));
    const o: Offset = { src, from: d0, days: p.days, cut: p.cut, cuts: p.cuts, over: p.over, moveKcal: p.moveKcal, walkMin: p.walkMin, runMin: p.runMin };
    update({ cheat: { ...cheat, offsets: [...keep, o] } });
  };
  const dismiss = (src: string) => update({ cheat: { ...cheat, dismissed: [...cheat.dismissed.filter((d) => d >= addDays(d0, -7)), src] } });

  return { on: !!v, bank: v?.b ?? null, plans: v?.plans ?? [], running: v?.running ?? [], apply, dismiss, save: cheat.save, base: t?.base ?? 0, d0 };
}
export type CheatState = ReturnType<typeof useCheat>;

/** Short state chips for the nutrition summary; tapping opens the sheet. */
export function CheatChips({ s, onOpen }: { s: CheatState; onOpen: () => void }) {
  if (!s.on) return null;
  const chips: { label: string; tone: 'ok' | 'accent' | 'warn' }[] = [];
  const b = s.bank;
  if (b) chips.push(b.cheatDay === s.d0 ? { label: `오늘 치팅데이 +${n(b.banked)}`, tone: 'ok' } : { label: `치팅까지 ${b.daysLeft}일 · ${n(b.banked)} 모음`, tone: 'accent' });
  for (const o of s.running) {
    const cut = cutOn(o, s.d0);
    chips.push({ label: `상쇄 ${diffDays(s.d0, o.from) + 1}/${o.cuts?.length ?? o.days}일${cut ? ` −${cut}` : ''}`, tone: 'warn' });
  }
  if (!chips.length) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="치팅데이·상쇄 자세히" onPress={onOpen} hitSlop={6}>
      <Row gap={6}>{chips.map((x) => <Chip key={x.label} label={x.label} tone={x.tone} />)}</Row>
    </Pressable>
  );
}

/** One line for the "지금 할 일" slot: an over-eaten day waiting for a decision. */
export function OffsetOffer({ s, onOpen }: { s: CheatState; onOpen: () => void }) {
  const c = usePalette();
  const p = s.plans[0];
  if (!p) return null;
  return (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
      <View style={{ flexShrink: 1 }}>
        <T v="title" style={{ fontSize: 15 }}>{fmt(p.date)} 목표보다 +{n(p.over)}kcal</T>
        <T v="small" style={{ color: c.muted }}>며칠에 나눠 갚을 수 있어요</T>
      </View>
      <Button label="나눠 갚기" kind="primary" onPress={onOpen} />
    </Row>
  );
}

/** Everything: bank gauge, running offsets, and the choices for over-eaten days. */
export function CheatSheet({ s, open, onClose }: { s: CheatState; open: boolean; onClose: () => void }) {
  const c = usePalette();
  const b = s.bank;
  return (
    <Sheet open={open} title="치팅데이 · 상쇄" onClose={onClose}>
      {b ? (
        <View style={{ gap: Space.sm }}>
          <T v="title" style={{ fontSize: 15 }}>{b.cheatDay === s.d0 ? '오늘 치팅데이' : `치팅데이까지 ${b.daysLeft}일 · ${fmt(b.cheatDay)}`}</T>
          <Meter pct={b.pct} color={c.ok} height={12} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="num" style={{ fontSize: 16 }}>{n(b.banked)}<T v="small"> / {n(b.budget)}kcal 모음</T></T>
            {b.cheatDay === s.d0 ? <Chip label={`오늘 목표 +${n(b.banked)}`} tone="ok" /> : null}
          </Row>
          {b.cheatDay !== s.d0 ? (
            <T v="small">목표보다 덜 먹은 만큼 쌓여요 (하루 최대 {dayCap(s.base)}kcal){s.save ? ` · 지금은 하루 ${s.save}kcal씩 목표를 낮춰 모으는 중` : ''}</T>
          ) : null}
          {b.lowDays ? <T v="small" style={{ color: c.warn }}>기초대사량보다 적게 먹은 {b.lowDays}일은 저금되지 않아요. 굶어서 모으면 근손실이 커요.</T> : null}
        </View>
      ) : null}

      {s.running.map((o) => {
        const total = o.cuts?.length ?? o.days;
        const cutToday = cutOn(o, s.d0);
        return (
          <View key={o.src} style={{ gap: 4, borderTopWidth: 1, borderColor: c.line, paddingTop: Space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="title" style={{ fontSize: 15 }}>상쇄 중 · {diffDays(s.d0, o.from) + 1}/{total}일</T>
              <T v="small">{fmt(o.src)} +{n(o.over)}kcal · {fmt(offsetEnd(o))}까지</T>
            </Row>
            <T v="small">오늘 목표 {cutToday ? `−${cutToday}kcal (반영됨)` : '그대로'}{o.moveKcal ? ` · 기간 중 걷기 ${o.walkMin}분 또는 러닝 ${o.runMin}분 더 (약 ${n(o.moveKcal)}kcal)` : ''}</T>
          </View>
        );
      })}

      {s.plans.map(({ date, over, choices }) => (
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
                <Button label="이걸로" kind="primary" onPress={() => s.apply(date, plan)} />
              </Row>
            </View>
          ))}
          <Button label="괜찮아요" kind="ghost" onPress={() => s.dismiss(date)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}

      <Button label="치팅데이 설정" onPress={() => { onClose(); router.push('/prefs/cheat'); }} style={{ alignSelf: 'flex-start' }} />
    </Sheet>
  );
}
