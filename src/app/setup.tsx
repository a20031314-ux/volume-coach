import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { PAIN_NAME, knownExercises } from '@/lib/ability';
import { recommendedVolume } from '@/lib/profile';
import { recommendRoutine } from '@/lib/routine';
import { applySetup, type SetupAnswers } from '@/lib/setup';
import type { Ability, Goal, PainMove, Profile, Tri } from '@/lib/types';
import { live, newId, useData } from '@/store/store';

const STEPS = ['나', '일정·장비', '할 수 있는 운동', '볼륨', '운동 방식'] as const;
const TRI = [{ v: 'yes', n: '해봤어요' }, { v: 'no', n: '아직' }] as { v: Exclude<Tri, 'unknown'>; n: string }[];

/** First-run setup. Every step can be skipped; skipping all of it starts with a recommended routine. */
export default function Setup() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const settings = useData((s) => s.settings);
  const logsT = useData((s) => s.logs);
  const update = useData((s) => s.updateSettings);
  const putRoutine = useData((s) => s.putRoutine);
  const routinesT = useData((s) => s.routines);
  const known = useMemo(() => knownExercises(live(logsT)), [logsT]);
  const hasRoutine = !!settings.activeRoutineId && !!routinesT[settings.activeRoutineId] && !routinesT[settings.activeRoutineId].deleted;

  const [step, setStep] = useState(-1);
  const [profile, setProfile] = useState<Profile>({ days: 4, sessionMin: 60, equipment: 'gym', ...settings.profile });
  const [ability, setAbility] = useState<Ability>(settings.ability);
  const [ownVolume, setOwnVolume] = useState(false);
  const [vol, setVol] = useState({ min: settings.min, max: settings.max, minEx: settings.minEx, gap: settings.gap });
  const [mode, setMode] = useState<'auto' | 'routine'>(settings.planMode);

  const setP = (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch }));
  const setA = (patch: Partial<Ability>) => setAbility((a) => ({ ...a, ...patch }));
  const { rec } = recommendedVolume(profile);
  const preview = useMemo(
    () => (step === 4 ? recommendRoutine({ profile, settings: { ...settings, ability }, known }) : null),
    [step, profile, settings, ability, known],
  );

  const finish = (answers: SetupAnswers | null) => {
    const { patch, routine } = applySetup(settings, answers, known, hasRoutine);
    if (routine) {
      const id = newId();
      putRoutine({ ...routine, id });
      patch.activeRoutineId = id;
    }
    update(patch);
    router.replace('/');
  };
  const done = () => finish({ profile, ability, volume: ownVolume ? vol : null, mode });

  const tri = (v: Tri | null): Tri => v ?? 'unknown';
  const q = (label: string, el: React.ReactNode) => <View style={{ gap: 6 }}><T>{label}</T>{el}</View>;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Space.lg, paddingBottom: Space.xl, gap: Space.lg, maxWidth: 680, width: '100%', alignSelf: 'center', flexGrow: 1 }}>
        {step === -1 ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: Space.xl, paddingVertical: Space.xl }}>
            <View style={{ gap: Space.sm }}>
              <T v="big" style={{ fontSize: 30, lineHeight: 38 }}>볼륨 코치</T>
              <T v="muted">할 수 있는 운동, 운동하는 날, 볼륨을 알려주면 거기에 맞춰 추천해요.</T>
            </View>
            <View style={{ gap: Space.md }}>
              <Button label="내게 맞게 설정하기" kind="primary" onPress={() => setStep(0)} style={{ paddingVertical: 16 }} />
              <Button label="건너뛰고 추천 루틴으로 시작" onPress={() => finish(null)} style={{ paddingVertical: 14 }} />
            </View>
            <T v="small" style={{ textAlign: 'center' }}>나중에 설정에서 언제든 바꿀 수 있어요.</T>
          </View>
        ) : (
          <>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {STEPS.map((_, i) => <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? c.accent : c.line }} />)}
              </View>
              <Button label="건너뛰기" kind="ghost" onPress={() => finish(null)} />
            </Row>
            <T v="big" style={{ fontSize: 26, lineHeight: 32 }}>{STEPS[step]}</T>

            {step === 0 ? (
              <Card style={{ gap: Space.lg }}>
                {q('목표', <Pills options={[{ k: 'hyp', n: '근비대' }, { k: 'str', n: '근력' }, { k: 'cut', n: '체지방 감량' }, { k: 'fit', n: '건강·체력' }] as { k: Goal; n: string }[]}
                  value={profile.goal} onToggle={(goal) => setP({ goal })} />)}
                {q('웨이트 경력', <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]}
                  value={profile.years || null} onChange={(v) => setP({ years: (v ?? '') as Profile['years'] })} />)}
                {q('성별', <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={profile.sex || null}
                  onChange={(v) => setP({ sex: (v ?? '') as Profile['sex'] })} />)}
                <Stepper label="나이" value={profile.age ?? 30} min={14} max={90} onChange={(age) => setP({ age })} />
              </Card>
            ) : null}

            {step === 1 ? (
              <Card style={{ gap: Space.lg }}>
                {q('주 몇 번 운동해요?', <Segmented options={[2, 3, 4, 5, 6].map((n) => ({ v: String(n), n: `${n}일` }))}
                  value={String(profile.days ?? 4)} onChange={(v) => v && setP({ days: Number(v) })} />)}
                {q('한 번에 몇 분?', <Segmented options={[45, 60, 75, 90].map((n) => ({ v: String(n), n: `${n}분` }))}
                  value={String(profile.sessionMin ?? 60)} onChange={(v) => v && setP({ sessionMin: Number(v) })} />)}
                {q('어디서 운동해요?', <Segmented options={[{ v: 'gym', n: '헬스장' }, { v: 'dumbbell', n: '덤벨만' }, { v: 'bodyweight', n: '맨몸' }]}
                  value={profile.equipment ?? 'gym'} onChange={(v) => v && setP({ equipment: v })} />)}
              </Card>
            ) : null}

            {step === 2 ? (
              <>
                <T v="muted">모르면 비워두세요.</T>
                <Card style={{ gap: Space.lg }}>
                  {q('턱걸이', <Segmented options={[{ v: '0', n: '0개' }, { v: '1-5', n: '1~5개' }, { v: '6+', n: '6개 이상' }]}
                    value={ability.pullups === 'unknown' ? null : ability.pullups} onChange={(v) => setA({ pullups: v ?? 'unknown' })} />)}
                  {q('푸시업', <Segmented options={[{ v: '0-5', n: '0~5개' }, { v: '6-20', n: '6~20개' }, { v: '21+', n: '21개 이상' }]}
                    value={ability.pushups === 'unknown' ? null : ability.pushups} onChange={(v) => setA({ pushups: v ?? 'unknown' })} />)}
                  {q('딥스', <Segmented options={TRI} value={ability.dips === 'unknown' ? null : ability.dips} onChange={(v) => setA({ dips: tri(v) })} />)}
                </Card>
                <Card style={{ gap: Space.lg }}>
                  {q('바벨 스쿼트', <Segmented options={TRI} value={ability.bbSquat === 'unknown' ? null : ability.bbSquat} onChange={(v) => setA({ bbSquat: tri(v) })} />)}
                  {q('바벨 데드리프트·로우', <Segmented options={TRI} value={ability.bbHinge === 'unknown' ? null : ability.bbHinge} onChange={(v) => setA({ bbHinge: tri(v) })} />)}
                  {q('바벨 벤치·오버헤드프레스', <Segmented options={TRI} value={ability.bbPress === 'unknown' ? null : ability.bbPress} onChange={(v) => setA({ bbPress: tri(v) })} />)}
                </Card>
                <Card>
                  <T>아프거나 불편한 동작</T>
                  <Pills danger options={(Object.keys(PAIN_NAME) as PainMove[]).map((k) => ({ k, n: PAIN_NAME[k] }))} value={ability.pain}
                    onToggle={(k) => setA({ pain: ability.pain.includes(k) ? ability.pain.filter((x) => x !== k) : [...ability.pain, k] })} />
                </Card>
              </>
            ) : null}

            {step === 3 ? (
              <Card style={{ gap: Space.lg }}>
                <Segmented options={[{ v: 'rec', n: `추천 ${rec.min}~${rec.max}세트` }, { v: 'own', n: '직접 정하기' }]}
                  value={ownVolume ? 'own' : 'rec'} onChange={(v) => v && setOwnVolume(v === 'own')} />
                {ownVolume ? (
                  <>
                    <Row gap={Space.md}>
                      <Stepper label="부위당 주 최소 세트" value={vol.min} min={4} max={vol.max} onChange={(min) => setVol((x) => ({ ...x, min }))} />
                      <Stepper label="최대 세트" value={vol.max} min={vol.min} max={30} onChange={(max) => setVol((x) => ({ ...x, max }))} />
                    </Row>
                    <Row gap={Space.md}>
                      <Stepper label="부위당 운동 종류" value={vol.minEx} min={1} max={4} onChange={(minEx) => setVol((x) => ({ ...x, minEx }))} />
                      <Stepper label="같은 부위 휴식 (일)" value={vol.gap} min={0} max={3} onChange={(gap) => setVol((x) => ({ ...x, gap }))} />
                    </Row>
                  </>
                ) : (
                  <T v="small">경력과 목표에 맞춘 값이에요. 부위당 주 {rec.min}~{rec.max}세트, 하루 최대 {rec.cap}세트.</T>
                )}
              </Card>
            ) : null}

            {step === 4 ? (
              <>
                <Card style={{ gap: Space.md }}>
                  <Segmented options={[{ v: 'routine', n: '정해진 루틴' }, { v: 'auto', n: '규칙대로 매일 추천' }]}
                    value={mode} onChange={(v) => v && setMode(v)} />
                  <T v="small">{mode === 'routine'
                    ? '아래 루틴을 순서대로 따라가요. 오늘 할 일에 루틴의 다음 날이 나와요.'
                    : '루틴 없이, 회복과 주간 볼륨을 보고 그날 할 부위와 운동을 추천해요.'}</T>
                </Card>
                {mode === 'routine' && preview ? (
                  <Card style={{ gap: Space.sm }}>
                    <T v="title" style={{ fontSize: 15 }}>{preview.name}</T>
                    {preview.days.map((d) => (
                      <View key={d.key} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: c.line }}>
                        <T>{d.name}</T>
                        <T v="small">{d.exercises.map((e) => `${e.name} ${e.sets}`).join(' · ')}</T>
                      </View>
                    ))}
                  </Card>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {step >= 0 ? (
        <Row style={{ padding: Space.lg, paddingBottom: insets.bottom + Space.md, flexWrap: 'nowrap', maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          <Button label="이전" onPress={() => setStep(step - 1)} style={{ flex: 1, paddingVertical: 14 }} />
          {step < STEPS.length - 1
            ? <Button label="다음" kind="primary" onPress={() => setStep(step + 1)} style={{ flex: 2, paddingVertical: 14 }} />
            : <Button label="시작하기" kind="primary" onPress={done} style={{ flex: 2, paddingVertical: 14 }} />}
        </Row>
      ) : null}
    </View>
  );
}
