import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { Button, Card, Pills, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { PAIN_NAME } from '@/lib/ability';
import type { Ability, PainMove, Tri } from '@/lib/types';
import { useData } from '@/store/store';

const TRI = [{ v: 'yes', n: '할 수 있어요' }, { v: 'no', n: '아직 못 해요' }] as { v: Exclude<Tri, 'unknown'>; n: string }[];

/** Quick check of what the user can do. Every question can be left blank. */
export default function AbilityCheck() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const a = s.ability;
  const set = (patch: Partial<Ability>) => update({ ability: { ...a, ...patch } });
  const tri = (v: Tri | null): Tri => v ?? 'unknown';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + Space.xl, gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
      <T v="muted">모르면 비워두세요. 비워둔 항목은 쉬운 운동부터 추천하고, 기록이 쌓이면 바꾸자고 알려드려요.</T>

      <T v="label">맨몸 동작</T>
      <Card>
        <View style={{ gap: 6 }}><T>턱걸이 몇 개 할 수 있어요?</T>
          <Segmented options={[{ v: '0', n: '0개' }, { v: '1-5', n: '1~5개' }, { v: '6+', n: '6개 이상' }]} value={a.pullups === 'unknown' ? null : a.pullups}
            onChange={(v) => set({ pullups: v ?? 'unknown' })} />
          <T v="small">0개면 풀업 대신 랫풀다운·보조 풀업을 추천해요.</T>
        </View>
        <View style={{ gap: 6 }}><T>푸시업은 몇 개?</T>
          <Segmented options={[{ v: '0-5', n: '0~5개' }, { v: '6-20', n: '6~20개' }, { v: '21+', n: '21개 이상' }]} value={a.pushups === 'unknown' ? null : a.pushups}
            onChange={(v) => set({ pushups: v ?? 'unknown' })} />
        </View>
        <View style={{ gap: 6 }}><T>딥스</T>
          <Segmented options={TRI} value={a.dips === 'unknown' ? null : a.dips} onChange={(v) => set({ dips: tri(v) })} />
        </View>
      </Card>

      <T v="label">바벨 운동 경험</T>
      <Card>
        <T v="small">자세를 잡고 혼자 할 수 있으면 &apos;할 수 있어요&apos;를 고르세요. 아직이면 머신·덤벨 버전부터 추천해요.</T>
        <View style={{ gap: 6 }}><T>바벨 스쿼트</T>
          <Segmented options={TRI} value={a.bbSquat === 'unknown' ? null : a.bbSquat} onChange={(v) => set({ bbSquat: tri(v) })} />
        </View>
        <View style={{ gap: 6 }}><T>바벨 데드리프트·로우</T>
          <Segmented options={TRI} value={a.bbHinge === 'unknown' ? null : a.bbHinge} onChange={(v) => set({ bbHinge: tri(v) })} />
        </View>
        <View style={{ gap: 6 }}><T>바벨 벤치프레스·오버헤드프레스</T>
          <Segmented options={TRI} value={a.bbPress === 'unknown' ? null : a.bbPress} onChange={(v) => set({ bbPress: tri(v) })} />
        </View>
      </Card>

      <T v="label">아프거나 불편한 동작</T>
      <Card>
        <Pills danger options={(Object.keys(PAIN_NAME) as PainMove[]).map((k) => ({ k, n: PAIN_NAME[k] }))} value={a.pain}
          onToggle={(k) => set({ pain: a.pain.includes(k) ? a.pain.filter((x) => x !== k) : [...a.pain, k] })} />
        <T v="small">고른 동작이 들어간 운동은 추천하지 않고 비슷한 다른 운동으로 바꿔요. 예: 머리 위로 밀기 → 오버헤드프레스 대신 랜드마인 프레스·레터럴 레이즈. 통증이 계속되면 전문가와 상의하세요.</T>
      </Card>

      <Row style={{ flexWrap: 'nowrap' }}>
        <Button label="운동별로 표시하기" style={{ flex: 1 }} onPress={() => router.push('/exercises')} />
        <Button label="완료" kind="primary" style={{ flex: 1, paddingVertical: 13 }} onPress={() => {
          update({ ability: { ...a, checked: true }, dismissed: [...new Set([...s.dismissed, 'ability-intro'])] });
          toast('할 수 있는 운동으로 추천을 맞췄어요');
          router.back();
        }} />
      </Row>
    </ScrollView>
  );
}
