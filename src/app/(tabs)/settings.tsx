import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useMemo } from 'react';

import { Group, ListRow } from '@/components/layout';
import { Screen, T } from '@/components/ui';
import { HEALTH_NAME } from '@/health/steps';
import { useHealth } from '@/health/use-steps';
import { useMove } from '@/move/tracker';
import { bodySource, latestBodyComp } from '@/lib/profile';
import type { Goal } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { live, useData } from '@/store/store';

const GOAL: Record<Goal, string> = { hyp: '근비대', str: '근력', cut: '감량', fit: '건강' };

export default function SettingsScreen() {
  const auth = useAuth();
  const s = useData((x) => x.settings);
  const bodyT = useData((x) => x.bodyComps);
  const routine = useData((x) => (x.settings.activeRoutineId ? x.routines[x.settings.activeRoutineId] : undefined));
  const p = s.profile;
  const bodyValue = useMemo(() => {
    const comps = live(bodyT);
    const src = bodySource(p, comps);
    const latest = latestBodyComp(comps);
    if (src === 'inbody') return latest ? `인바디 · ${latest.weight}kg` : '인바디 · 기록 없음';
    return p.weight ? `직접 입력 · ${p.weight}kg` : '직접 입력';
  }, [bodyT, p]);
  const health = useHealth((x) => x.enabled);
  const moving = useMove((x) => x.enabled);
  const marks = Object.keys(s.exercisePrefs).length;

  return (
    <Screen title="설정">
      <Group title="운동">
        <ListRow label="운동 방식" value={s.planMode === 'routine' && routine && !routine.deleted ? routine.name : '자율형'} onPress={() => router.push('/routine')} />
        <ListRow label="할 수 있는 운동" value={s.ability.checked ? '체크 완료' : '체크 전'} onPress={() => router.push('/ability')} />
        <ListRow label="운동 목록" value={marks ? `표시 ${marks}개` : undefined} onPress={() => router.push('/exercises')} />
        <ListRow label="운동 규칙" value={`주 ${s.min}~${s.max}세트${s.deload ? ' · 디로드' : ''}`} onPress={() => router.push('/prefs/rules')} />
        <ListRow label="기록 방식" value={s.session.detail === 'set' ? '세트별' : '운동별'} onPress={() => router.push('/prefs/workout')} />
        <ListRow label="걸음·이동" value={[health ? HEALTH_NAME : null, moving ? '이동 기록' : null].filter(Boolean).join(' · ') || '꺼짐'} onPress={() => router.push('/prefs/health')} last />
      </Group>

      <Group title="나">
        <ListRow label="내 정보" value={[p.age ? `${p.age}세` : null, GOAL[p.goal]].filter(Boolean).join(' · ')} onPress={() => router.push('/prefs/profile')} />
        <ListRow label="신체 정보" value={bodyValue} onPress={() => router.push('/prefs/body')} last />
      </Group>

      <Group title="계정">
        {!auth.configured
          ? <ListRow label="이 기기에만 저장 중" last />
          : <ListRow label={auth.session ? auth.email ?? '계정' : '로그인 / 회원가입'} value={auth.session ? (auth.syncing ? '동기화 중' : '동기화됨') : undefined}
              onPress={() => router.push(auth.session ? '/prefs/account' : '/account')} last />}
      </Group>

      <Group title="앱">
        <ListRow label="처음 설정 다시 하기" onPress={() => router.push('/setup')} />
        <ListRow label="앱 정보" value={Constants.expoConfig?.version} onPress={() => router.push('/prefs/app')} last />
      </Group>

      <T v="small">추천은 일반적인 운동·영양 가이드에 기반한 참고용이에요. 부상이나 질환이 있다면 전문가와 먼저 상의하세요.</T>
    </Screen>
  );
}
