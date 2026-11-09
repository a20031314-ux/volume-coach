/**
 * 생활 시간: 기상 · 끼니 · 평소 운동 · 취침을 한 곳에서. 비워 두면 기록과 끼니로 추정.
 * 고정식단 시간 추천, 식단 추천(끼니 알림), 카페인 경고가 모두 이 값을 쓴다.
 */
import { useMemo } from 'react';
import { View } from 'react-native';

import { SavePage } from '@/components/save-bar';
import { Button, Card, Row, Stepper, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { bedTime, timingContext } from '@/lib/fixed-timing';
import { hhmm, mealName } from '@/lib/meal-plan';
import { live, useData } from '@/store/store';

const STEP = 30;
const MAX_MEALS = 6;

/** a time that can be left to 자동 */
function TimeRow({ label, value, auto, autoNote, onChange }: {
  label: string; value: number | null | undefined; auto: number | null; autoNote: string; onChange: (v: number | null) => void;
}) {
  if (value == null) {
    return (
      <Row style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <T>{label}</T>
          <T v="small">자동{auto != null ? ` · ${hhmm(auto)}` : ''} ({autoNote})</T>
        </View>
        <Button label="직접 정하기" kind="ghost" onPress={() => onChange(auto ?? 7 * 60)} />
      </Row>
    );
  }
  return (
    <Row gap={Space.md} style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <Stepper label={label} value={value} step={STEP} min={0} max={24 * 60 - STEP} format={hhmm} onChange={onChange} />
      </View>
      <Button label="자동" kind="ghost" onPress={() => onChange(null)} />
    </Row>
  );
}

export default function LifePrefs() {
  const { s, update, dirty, save, reset } = useSettingsDraft();
  const sessionsT = useData((x) => x.sessions);
  const life = s.life ?? {};
  const plan = s.mealPlan;
  const setLife = (patch: Partial<NonNullable<typeof s.life>>) => update({ life: { ...life, ...patch } });
  const setTimes = (times: number[]) => update({ mealPlan: { ...plan, times: [...times].sort((a, b) => a - b) } });
  // what 자동 would be (ignoring the overrides)
  const est = useMemo(() => timingContext({ mealPlan: plan }, live(sessionsT)), [plan, sessionsT]);

  return (
    <SavePage dirty={dirty} onSave={save} onReset={reset}>
      <T v="muted">고정식단 시간 추천, 끼니 알림, 카페인 경고가 이 시간을 기준으로 해요. 비워 두면 기록으로 추정해요.</T>

      <Card style={{ gap: Space.md }}>
        <TimeRow label="일어나는 시간" value={life.wake} auto={null} autoNote="아침 끼니 기준" onChange={(wake) => setLife({ wake })} />
      </Card>

      <T v="label">끼니 시간</T>
      <Card>
        {plan.times.map((m, i) => (
          <Row key={i} gap={Space.md} style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Stepper label={mealName(m)} value={m} step={STEP} min={0} max={24 * 60 - STEP} format={hhmm}
                onChange={(v) => setTimes(plan.times.map((t, j) => (j === i ? v : t)))} />
            </View>
            {plan.times.length > 1 ? <Button label="삭제" kind="ghost" onPress={() => setTimes(plan.times.filter((_, j) => j !== i))} /> : null}
          </Row>
        ))}
        {plan.times.length < MAX_MEALS ? (
          <Button label="+ 끼니 추가" onPress={() => setTimes([...plan.times, Math.min(23 * 60, (plan.times.at(-1) ?? 12 * 60) + 3 * 60)])} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Card>

      <Card style={{ gap: Space.md }}>
        <TimeRow label="평소 운동 시작" value={life.workout} auto={est.workout?.start ?? null} autoNote={est.workout ? '최근 운동 기록' : '기록이 쌓이면 추정'} onChange={(workout) => setLife({ workout })} />
        <TimeRow label="자는 시간" value={life.bed} auto={bedTime(est)} autoNote="저녁 끼니 + 3시간" onChange={(bed) => setLife({ bed })} />
      </Card>
    </SavePage>
  );
}
