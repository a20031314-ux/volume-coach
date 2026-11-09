/** 식단 추천: on/off (끼니 시간은 생활 시간에서). */
import { router } from 'expo-router';
import { Platform, View } from 'react-native';

import { SavePage } from '@/components/save-bar';
import { useToast } from '@/components/toast';
import { Button, Card, Row, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { usePreferredFoods } from '@/hooks/use-diet-report';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { hhmm, mealName, staples } from '@/lib/meal-plan';
import { enableMealReminders } from '@/store/meal-reminders';

export default function MealPlanPrefs() {
  const toast = useToast();
  const { s: draft, update, dirty, save, reset } = useSettingsDraft();
  const plan = draft.mealPlan;
  const prefer = usePreferredFoods();
  const { protein, carb } = staples(prefer);

  const set = (patch: Partial<typeof plan>) => update({ mealPlan: { ...plan, ...patch } });

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
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View style={{ flex: 1 }}>
              <T>끼니 시간</T>
              <T v="muted">{plan.times.map((m) => `${mealName(m)} ${hhmm(m)}`).join(' · ')}</T>
            </View>
            <Button label="생활 시간 ›" kind="ghost" onPress={() => router.push('/prefs/life')} />
          </Row>
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
