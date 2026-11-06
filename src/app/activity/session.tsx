import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Row, T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { fmtDuration } from '@/lib/run';
import { setCount, summarize } from '@/lib/session';
import { clock } from '@/lib/timeline';
import { discardSession } from '@/store/session-actions';
import { useData } from '@/store/store';

/** One workout: 시작 → 운동별 → 세트별 → 끝. */
export default function SessionDetail() {
  const c = usePalette();
  const toast = useToast();
  const now = useNow(30e3).getTime();
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useData((st) => (id ? st.sessions[id] : undefined));
  if (!s || s.deleted) return <Page><T v="muted">기록을 찾을 수 없어요.</T></Page>;

  const sum = summarize(s, now);
  const going = s.endedAt == null;
  const exercises = s.exercises
    .filter((e) => e.status !== 'pending' || setCount(e) > 0)
    .sort((a, b) => (a.startedAt ?? a.sets[0]?.at ?? Infinity) - (b.startedAt ?? b.sets[0]?.at ?? Infinity));
  const pending = s.exercises.filter((e) => e.status === 'pending' && setCount(e) === 0);

  return (
    <Page>
      <Card>
        <T v="small">{fmt(s.date)}{going ? ' · 진행 중' : s.autoEnded ? ' · 자동 종료' : ''}</T>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <T v="big" style={{ fontSize: 34, lineHeight: 40 }}>{sum.totalSets}세트</T>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="num" style={{ fontSize: 18 }}>{fmtDuration(sum.durationS)}</T>
            <T v="small">{[sum.volumeKg ? `${sum.volumeKg.toLocaleString('ko-KR')}kg` : null, sum.avgRestS ? `평균 휴식 ${fmtDuration(sum.avgRestS)}` : null].filter(Boolean).join(' · ') || ' '}</T>
          </View>
        </Row>
        {sum.perMuscle.length ? <T v="small">{sum.perMuscle.map((m) => `${MUSCLE_NAME[m.muscle]} ${m.sets}`).join(' · ')}</T> : null}
        {going ? <Button label="이어서 하기" kind="primary" onPress={() => router.push('/session')} /> : null}
      </Card>

      <Card>
        <TlNode time={clock(s.startedAt)} title="시작" small />
        {exercises.map((e) => {
          const n = setCount(e);
          const skipped = e.status === 'skipped' && !n;
          return (
            <TlNode key={e.key} time={e.startedAt ? clock(e.startedAt) : undefined} title={e.name}
              sub={skipped ? '건너뜀' : `${MUSCLE_NAME[e.muscle]} · ${n}/${e.planned}세트${e.startedAt && e.endedAt ? ` · ${Math.max(1, Math.round((e.endedAt - e.startedAt) / 60e3))}분` : ''}`}
              color={skipped ? c.rest : c.accent}>
              {e.sets.length ? (
                <View style={{ marginTop: 6 }}>
                  {e.sets.map((st, i) => {
                    const rest = i > 0 ? Math.round((st.at - e.sets[i - 1].at) / 1000) : null;
                    return (
                      <TlNode key={i} small time={clock(st.at)} title={`${i + 1}세트${st.kg ? ` · ${st.kg}kg` : ''}${st.reps ? ` × ${st.reps}` : ''}`}
                        sub={rest && rest < 15 * 60 ? `휴식 ${fmtDuration(rest)}` : undefined}
                        right={st.rpe ? <T v="small">RPE {st.rpe}</T> : undefined} last={i === e.sets.length - 1} />
                    );
                  })}
                </View>
              ) : null}
            </TlNode>
          );
        })}
        <TlNode time={s.endedAt ? clock(s.endedAt) : undefined} title={going ? '진행 중' : '끝'} small last />
      </Card>

      {pending.length ? <T v="small">하지 않은 운동: {pending.map((e) => e.name).join(', ')}</T> : null}

      <ConfirmButton label="이 운동 삭제" onConfirm={() => { discardSession(s.id); toast('삭제됨'); router.back(); }} />
    </Page>
  );
}
