/** 식단 추천: meal times and on/off. */
import { Platform, View } from 'react-native';

import { SavePage } from '@/components/save-bar';
import { useToast } from '@/components/toast';
import { Button, Card, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { hhmm, mealName, staples } from '@/lib/meal-plan';
import { enableMealReminders } from '@/store/meal-reminders';

const STEP = 30;
const MAX_MEALS = 6;

export default function MealPlanPrefs() {
  const toast = useToast();
  const { s: draft, update, dirty, save, reset } = useSettingsDraft();
  const plan = draft.mealPlan;
  const prefer = usePreferredFoods();
  const { protein, carb } = staples(prefer);

  const set = (patch: Partial<typeof plan>) => update({ mealPlan: { ...plan, ...patch } });
  const setTime = (i: number, m: number) => set({ times: plan.times.map((t, j) => (j === i ? m : t)).sort((a, b) => a - b) });

  const turn = (on: boolean) => set({ on });
  // notification permission is asked when the change is saved
  const onSave = async () => {
    save();
    if (plan.on && Platform.OS !== 'web' && !(await enableMealReminders())) toast('알림 권한이 없어 영양 탭에만 보여요');
  };

  return (
    <SavePage dirty={dirty} onSave={onSave} onReset={reset}>
      <Card>
        <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: '끼니마다 추천' }]} value={plan.on ? 'on' : 'off'}
          onChange={(v) => v && turn(v === 'on')} />
        {plan.on ? <T v="small">정한 시간에 알림이 오고, 영양 탭 맨 위에 다음 끼니가 보여요.</T> : null}
      </Card>

      {plan.on ? (<>
        <T v="label">끼니 시간</T>
        <Card>
          {plan.times.map((m, i) => (
            <Row key={i} gap={Space.md} style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Stepper label={mealName(m)} value={m} step={STEP} min={0} max={24 * 60 - STEP} format={hhmm} onChange={(v) => setTime(i, v)} />
              </View>
              {plan.times.length > 1 ? (
                <Button label="삭제" kind="ghost" onPress={() => set({ times: plan.times.filter((_, j) => j !== i) })} />
              ) : null}
            </Row>
          ))}
          {plan.times.length < MAX_MEALS ? (
            <Button label="+ 끼니 추가" onPress={() => set({ times: [...plan.times, Math.min(23 * 60, (plan.times.at(-1) ?? 12 * 60) + 3 * 60)].sort((a, b) => a - b) })}
              style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </Card>

        <T v="label">추천에 쓰는 음식</T>
        <Card style={{ gap: Space.xs }}>
          <T>단백질 <T v="muted">{protein.slice(0, 4).map((d) => d.n).join(' · ')}</T></T>
          <T>주식 <T v="muted">{carb.slice(0, 3).map((d) => d.n).join(' · ')}</T></T>
          <T v="small">{prefer.length ? '최근 4주에 자주 먹은 순서예요. 없는 음식은 추천 카드에서 "없음"을 누르면 대체 식단으로 바뀌어요.'
            : '기록이 쌓이면 자주 먹는 음식으로 바뀌어요.'}</T>
        </Card>
      </>) : null}
    </SavePage>
  );
}
