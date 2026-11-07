/** 기능 설명: the core features, one card each, with a way in. */
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { Button, Card, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useData } from '@/store/store';

const FEATURES: { title: string; lines: string[]; go: { label: string; href: Href } }[] = [
  {
    title: '오늘 할 운동 추천',
    lines: [
      '부위당 주간 세트(기본 12~18)와 부위별 회복도를 보고 오늘 할 운동을 골라요.',
      '정해진 루틴으로 쓰거나, 규칙만 두고 매일 자동으로 추천받을 수 있어요.',
      '컨디션이 안 좋거나 다른 부위를 하고 싶으면 오른쪽 위 "조정"을 누르세요.',
      '기록이 쌓이면 운동마다 권장 무게(kg × 회)를 보여 줘요.',
    ],
    go: { label: '오늘 탭', href: '/' },
  },
  {
    title: '웨이트 기록',
    lines: [
      '"운동 시작" → 운동별로 세트를 체크해요. 세트별 무게·횟수까지 적을 수도 있어요.',
      '세트 사이 휴식 타이머가 자동으로 돌아요.',
      '벤치·스쿼트·데드·오버헤드 목표 무게가 있으면 중량 프로그램이 주차별 무게를 짜 줘요.',
    ],
    go: { label: '중량 프로그램', href: '/program' },
  },
  {
    title: '유산소',
    lines: [
      '러닝·걷기·등산·자전거는 GPS로 거리·페이스·경로·고도를 기록해요.',
      '러닝은 자유 · 인터벌 · 스프린트(30~400m) 중에 골라요. 음성 안내와 목표 페이스 알림이 있어요.',
      '수영·로잉·HIIT 같은 실내 운동은 시간과 강도로 칼로리를 계산해요.',
    ],
    go: { label: '유산소 탭', href: '/run' },
  },
  {
    title: '영양',
    lines: [
      '체중·체성분·운동량으로 하루 칼로리와 단백질 목표를 계산해요.',
      '"+ 음식 추가"에서 최근 먹은 음식이 먼저 나와요. 끼니 옆 +를 누르면 그 끼니로 들어가요.',
      '매일 먹는 영양제·음식은 고정식단으로 두면 체크만 하면 돼요.',
      '과식한 날은 며칠에 나눠 갚고, 치팅데이를 정해 두면 덜 먹은 만큼 모아 둘 수 있어요.',
    ],
    go: { label: '영양 탭', href: '/food' },
  },
  {
    title: '하루 기록',
    lines: [
      '웨이트·유산소·걸음을 하루 타임라인으로 한눈에 봐요.',
      '맨 위 한 줄은 소모 vs 섭취 칼로리예요. 누르면 하루 회고가 열려요.',
    ],
    go: { label: '기록 탭', href: '/log' },
  },
  {
    title: 'MY · 추세',
    lines: [
      '체중, 주요 리프트 추정 1RM, 부위당 주 세트, 단백질을 주 단위 그래프로 봐요.',
      '카드를 누르면 자세한 숫자가 나와요. 목표에 따라 중요한 카드가 위로 와요.',
    ],
    go: { label: 'MY 탭', href: '/settings' },
  },
];

export default function Guide() {
  const c = usePalette();
  const dismissed = useData((s) => s.settings.dismissed);
  const update = useData((s) => s.updateSettings);
  // seen once → the MY tab stops pointing here
  useEffect(() => {
    if (!dismissed.includes('guide')) update({ dismissed: [...dismissed, 'guide'] });
  }, [dismissed, update]);

  return (
    <Page>
      {FEATURES.map((f, i) => (
        <Card key={f.title} style={{ gap: Space.sm }}>
          <T v="title" style={{ fontSize: 17 }}><T v="title" style={{ fontSize: 17, color: c.accent }}>{i + 1}</T>  {f.title}</T>
          <View style={{ gap: 6 }}>
            {f.lines.map((l) => (
              <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
                <T v="small" style={{ color: c.muted }}>•</T>
                <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{l}</T>
              </View>
            ))}
          </View>
          <Button label={`${f.go.label} ›`} kind="ghost" onPress={() => router.push(f.go.href)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ))}
      <T v="small">추천은 일반적인 운동·영양 가이드에 기반한 참고용이에요.</T>
    </Page>
  );
}
