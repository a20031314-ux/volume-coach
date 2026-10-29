import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { LogSheet, type LogDraft } from '@/components/log-sheet';
import { RoutineToday } from '@/components/routine-today';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Chip, Meter, Pills, Row, Screen, Segmented, T, fmtN, toneColor } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useCoach } from '@/hooks/use-coach';
import { useNow } from '@/hooks/use-now';
import { buildPlan, deloadHint, suggestExercises } from '@/lib/coach';
import { dow, fmt } from '@/lib/dates';
import { MUSCLES } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import { selectActiveSession, startSession } from '@/store/session-actions';
import { live, useData } from '@/store/store';

export default function Today() {
  const c = usePalette();
  const toast = useToast();
  const now = useNow();
  const { input, result } = useCoach(now);
  const settings = input.settings;
  const logs = useData((s) => s.logs);
  const checkin = useData((s) => s.checkins[result.T]);
  const setCheckin = useData((s) => s.setCheckin);
  const updateSettings = useData((s) => s.updateSettings);
  const ck = settings.checkin;
  const [swaps, setSwaps] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<LogDraft | null>(null);
  const running = useData(selectActiveSession);
  const routine = useData((s) => (s.settings.activeRoutineId ? s.routines[s.settings.activeRoutineId] : undefined));
  const routineMode = settings.planMode === 'routine' && !!routine && !routine.deleted;

  const plan = useMemo(() => buildPlan(result, live(logs)), [result, logs]);
  const hint = useMemo(() => deloadHint(result, input), [result, input]);
  const total = plan.plan.reduce((a, s) => a + s.remaining, 0);
  const rd = result.readiness;
  const activeMuscles = MUSCLES.filter((m) => !settings.off.includes(m.k));
  const sore = checkin?.sore ?? [];

  return (
    <Screen title="오늘" sub={`${fmt(result.W)} – ${fmt(result.E)} · 남은 ${result.daysLeft}일${settings.deload ? ' · 디로드' : ''}`}>
      {hint ? <Banner text={hint} /> : null}

      {ck.sleep || ck.energy || ck.sore ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="title" style={{ fontSize: 15 }}>오늘 컨디션</T>
            <Button label="숨기기" kind="ghost" onPress={() => {
              updateSettings({ checkin: { ...ck, sleep: false, energy: false, sore: false } });
              toast('컨디션 체크를 숨겼어요. 설정에서 다시 켤 수 있어요');
            }} />
          </Row>
          {ck.sleep ? (
            <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
              <T v="muted" style={{ width: 52 }}>수면</T>
              <Segmented options={[{ v: 0, n: '부족' }, { v: 1, n: '보통' }, { v: 2, n: '충분' }]} value={checkin?.sleep ?? null}
                onChange={(v) => setCheckin(result.T, { sleep: v as 0 | 1 | 2 | null })} />
            </Row>
          ) : null}
          {ck.energy ? (
            <Row gap={Space.md} style={{ flexWrap: 'nowrap' }}>
              <T v="muted" style={{ width: 52 }}>컨디션</T>
              <Segmented options={[{ v: 0, n: '처짐' }, { v: 1, n: '보통' }, { v: 2, n: '좋음' }]} value={checkin?.energy ?? null}
                onChange={(v) => setCheckin(result.T, { energy: v as 0 | 1 | 2 | null })} />
            </Row>
          ) : null}
          {ck.sore ? (
            <View style={{ gap: 6 }}>
              <T v="muted">근육통 있는 부위</T>
              <Pills danger options={activeMuscles} value={sore}
                onToggle={(k) => setCheckin(result.T, { sore: sore.includes(k) ? sore.filter((x) => x !== k) : [...sore, k] })} />
            </View>
          ) : null}
          <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.line, paddingTop: Space.md, gap: 2 }}>
            <Row style={{ alignItems: 'baseline' }}><T v="muted">오늘 권장 볼륨</T><T v="num">{rd.cap}</T><T v="muted">세트</T></Row>
            <T v="small">{rd.why.length ? `${rd.why.join(' · ')} 반영` : rd.hasCheckin ? '평소대로 진행' : ck.sleep || ck.energy ? '수면·컨디션을 고르면 볼륨을 조정해요' : '근육통 부위는 회복도를 낮춰 계산해요'}</T>
          </View>
        </Card>
      ) : rd.why.length ? (
        <T v="small">오늘 권장 볼륨 {rd.cap}세트 · {rd.why.join(' · ')} 반영</T>
      ) : null}

      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T v="small" style={{ flexShrink: 1 }}>운동 방식 · {routineMode ? `루틴형 (${routine!.name})` : '자율형 (규칙 기반 추천)'}</T>
        <Button label="바꾸기" kind="ghost" onPress={() => router.push('/routine')} />
      </Row>

      {routineMode ? <RoutineToday routine={routine!} result={result} running={running} /> : (<>
      <Row gap={Space.lg} style={{ alignItems: 'baseline' }}>
        <Row gap={4} style={{ alignItems: 'baseline' }}><T v="big">{total}</T><T v="muted">세트 남음</T></Row>
        <Row gap={4} style={{ alignItems: 'baseline' }}><T v="big">{plan.plan.length}</T><T v="muted">부위</T></Row>
      </Row>

      {running ? (
        <Card style={{ borderColor: c.accent, borderWidth: 2 }}>
          <T v="title">운동 진행 중</T>
          <T v="muted">
            {new Date(running.startedAt).toTimeString().slice(0, 5)} 시작 · 운동 {running.exercises.filter((e) => e.status === 'done').length}/{running.exercises.length}개
          </T>
          <Button label="이어서 하기" kind="primary" onPress={() => router.push({ pathname: '/session', params: { id: running.id } })} style={{ paddingVertical: 13 }} />
        </Card>
      ) : (
        <Button label={plan.plan.length ? '운동 시작' : '빈 운동으로 시작'} kind="primary" style={{ paddingVertical: 15 }}
          onPress={() => {
            const list = plan.plan.flatMap((s) => suggestExercises(s, result, settings, swaps).map((e) => ({ name: e.name, muscle: s.k, sets: e.sets })));
            const sid = startSession(list, settings.session.detail);
            router.push({ pathname: '/session', params: { id: sid } });
          }} />
      )}

      {!plan.plan.length ? (
        <Card><T v="muted" style={{ textAlign: 'center' }}>오늘 채울 부위가 없어요. 이번 주 최소치를 채웠거나 남은 부위가 아직 회복 중이에요.</T></Card>
      ) : null}

      {plan.plan.map((s) => {
        const ex = suggestExercises(s, result, settings, swaps);
        return (
          <Card key={s.k}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="title">{s.n}</T>
              <Chip label={s.status.label} tone={s.status.tone} />
            </Row>
            <T v="muted">
              회복 <T v="muted" style={{ color: toneColor(c, s.recPre, settings.ready), fontWeight: '700' }}>{s.recPre}%</T>
              {` · 이번 주 ${fmtN(s.done)} / ${result.min}~${result.max}세트 · 운동 ${s.names.length}/${settings.minEx}종 · 남은 기회 ${s.opp}회`}
              {s.todayS ? ` · 오늘 ${fmtN(s.todayS)}세트 함` : ''}
            </T>
            {s.mode === 'light' ? <T v="small">회복이 덜 됐지만 이번 주 목표가 급해요. 세트를 줄이고 고중량 복합 운동은 뒤로 뺐어요.</T> : null}
            {ex.map((e) => (
              <View key={e.slot} style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: c.line, paddingTop: Space.sm, flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T>{e.name}</T>
                  <T v="small">{[repRange(e.name, settings.profile), e.isNew && s.names.length < settings.minEx ? '이번 주 새 종류' : e.heavy ? '고중량 복합' : ''].filter(Boolean).join(' · ')}</T>
                </View>
                <T v="num">{e.sets}<T v="small">세트</T></T>
                <Button label="교체" kind="ghost" accessibilityLabel={`${e.name} 대신 다른 운동`}
                  onPress={() => setSwaps((w) => ({ ...w, [`${s.k}:${e.slot}`]: (w[`${s.k}:${e.slot}`] || 0) + 1 }))} />
                <Button label="기록" kind="primary" onPress={() => setDraft({ exercise: e.name, muscle: s.k, sets: e.sets })} />
              </View>
            ))}
          </Card>
        );
      })}

      {plan.later.length ? (
        <>
          <T v="label">시간 남으면</T>
          <Row>
            {plan.later.map((s) => (
              <Button key={s.k} label={`${s.n} +${s.remaining}`} onPress={() => router.navigate({ pathname: '/log', params: { muscle: s.k } })} />
            ))}
          </Row>
        </>
      ) : null}

      {plan.doneToday.length ? (
        <>
          <T v="label">오늘 완료</T>
          <Row>{plan.doneToday.map((s) => <Chip key={s.k} tone="ok" label={`${s.n} ${fmtN(s.todayS)}세트`} />)}</Row>
        </>
      ) : null}

      </>)}

      <T v="label">부위별 회복도</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {result.stats.map((s) => (
          <View key={s.k} style={{ flexBasis: '31%', flexGrow: 1, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 8, padding: 8, gap: 3 }}>
            <T v="small" numberOfLines={1}>{s.n}{s.sore ? ' · 근육통' : ''}</T>
            <T v="num">{s.recNow}%</T>
            <Meter pct={s.recNow} color={toneColor(c, s.recNow, settings.ready)} height={4} />
            {s.mode === 'rest' && s.nextOK ? <T v="small">{s.nextOK === result.T ? '오늘' : dow(s.nextOK)}부터 가능</T> : null}
          </View>
        ))}
      </View>

      {!settings.profile.age && !settings.profile.years ? (
        <Button label="설정에서 나이·경력을 입력하면 내 몸에 맞춰 추천해요" onPress={() => router.navigate('/settings')} />
      ) : null}
      <T v="small">
        회복도 {settings.ready}% 이상인 부위만 정상 추천해요. 렉이 차 있으면 교체, 부위를 바꾸려면 &apos;시간 남으면&apos;에서 고르세요.
      </T>

      <LogSheet draft={draft} onClose={() => setDraft(null)} onSaved={toast} />
    </Screen>
  );
}
