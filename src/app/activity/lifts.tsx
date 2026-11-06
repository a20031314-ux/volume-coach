import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { ConfirmButton, T } from '@/components/ui';
import { fmt } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { clock } from '@/lib/timeline';
import { live, useData } from '@/store/store';

/** Exercises logged without a workout session on one day. */
export default function LiftsDetail() {
  const toast = useToast();
  const { date } = useLocalSearchParams<{ date: string }>();
  const logsT = useData((s) => s.logs);
  const sessionsT = useData((s) => s.sessions);
  const removeLog = useData((s) => s.removeLog);
  const rows = useMemo(() => {
    const inSession = new Set(live(sessionsT).map((s) => s.id));
    return live(logsT).filter((l) => l.date === date && !(l.sessionId && inSession.has(l.sessionId))).sort((a, b) => a.at - b.at);
  }, [logsT, sessionsT, date]);

  return (
    <Page>
      <T v="small">{date ? fmt(date) : ''} · {rows.reduce((a, l) => a + l.sets, 0)}세트</T>
      {!rows.length ? <T v="muted">기록이 없어요.</T> : null}
      <View>
        {rows.map((l, i) => (
          <TlNode key={l.id} time={clock(l.at)} title={l.exercise} last={i === rows.length - 1}
            sub={`${MUSCLE_NAME[l.muscle]} · ${l.sets}세트${l.kg ? ` · ${l.kg}kg` : ''}${l.reps ? ` × ${l.reps}` : ''}`}
            right={<ConfirmButton label="삭제" onConfirm={() => { removeLog(l.id); toast('삭제됨'); }} />} />
        ))}
      </View>
    </Page>
  );
}
