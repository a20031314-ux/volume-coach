import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExName } from '@/components/exercise-menu';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Chip, ConfirmButton, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Radius, Space, usePalette } from '@/constants/theme';
import { knownExercises, pickable } from '@/lib/ability';
import { MUSCLES, MUSCLE_NAME } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import { fmtDuration } from '@/lib/run';
import { lastPerformance, prefill, restSeconds, setCount, shouldAutoEnd, summarize } from '@/lib/session';
import type { MuscleKey, Session, SessionExercise } from '@/lib/types';
import { addRest, buzz, startRest, stopRest, useRest } from '@/store/rest-timer';
import {
  addExercise, completeExercise, completeSet, discardSession, finishSession, makeActive, reopenExercise,
  setDetail, setSessionRpe, skipExercise, undoSet,
} from '@/store/session-actions';
import { live, useData } from '@/store/store';

const clock = (t?: number | null) => (t ? new Date(t).toTimeString().slice(0, 5) : '');

export default function SessionScreen() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useData((s) => (id ? s.sessions[id] : undefined));
  const settings = useData((s) => s.settings);
  const sessionsT = useData((s) => s.sessions);
  const logsT = useData((s) => s.logs);
  const updateSettings = useData((s) => s.updateSettings);
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // end a session that was left open
  useEffect(() => {
    const check = () => {
      const s = id ? useData.getState().sessions[id] : undefined;
      if (s && shouldAutoEnd(s, Date.now(), useData.getState().settings.session.autoEndMin)) {
        finishSession(s.id, { endedAt: s.lastActivityAt, auto: true });
        void stopRest();
      }
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [id]);

  if (!session || session.deleted) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: Space.lg, paddingTop: insets.top + Space.xl, gap: Space.md }}>
        <T v="title">운동을 찾을 수 없어요</T>
        <Button label="오늘로 돌아가기" onPress={() => router.replace('/')} style={{ alignSelf: 'flex-start' }} />
      </View>
    );
  }

  const ended = session.endedAt != null;
  const sum = summarize(session, now);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + Space.md, paddingBottom: insets.bottom + Space.xl, paddingHorizontal: Math.max(Space.lg, insets.left), gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled">
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        <View>
          <T v="small">{clock(session.startedAt)} 시작{ended ? ` · ${clock(session.endedAt)} 끝` : ''}</T>
          <T v="big">{fmtDuration(sum.durationS)}</T>
          <T v="muted">{sum.totalSets}세트{sum.volumeKg ? ` · ${sum.volumeKg.toLocaleString()}kg` : ''}</T>
        </View>
        {ended
          ? <Button label="닫기" onPress={() => router.replace('/')} />
          : <ConfirmButton label="운동 끝" confirmLabel="끝내기" onConfirm={() => { finishSession(session.id); void stopRest(); }} style={{ borderWidth: 1, borderColor: c.line }} />}
      </Row>

      {ended ? <Summary session={session} now={now} /> : (
        <>
          <Segmented options={[{ v: 'exercise', n: '운동별로 기록' }, { v: 'set', n: '세트별로 기록' }]} value={session.detail}
            onChange={(v) => { if (v) { setDetail(session.id, v); updateSettings({ session: { ...settings.session, detail: v } }); } }} />
          <RestBar />
        </>
      )}

      <View>
        {session.exercises.map((ex, i) => (
          <TimelineItem key={ex.key} ex={ex} session={session} last={i === session.exercises.length - 1}
            lastPerf={lastPerformance(ex.name, live(sessionsT), live(logsT), session.id)} />
        ))}
      </View>

      {!ended ? (adding
        ? <AddExercise onAdd={(name, m) => { addExercise(session.id, name, m, 3); setAdding(false); toast(`${name} 추가됨`); }} onCancel={() => setAdding(false)} />
        : <Button label="+ 운동 추가" onPress={() => setAdding(true)} />) : null}

      {ended ? (
        <ConfirmButton label="이 운동 기록 삭제" confirmLabel="정말 삭제" style={{ alignSelf: 'center' }}
          onConfirm={() => { discardSession(session.id); toast('운동 기록을 삭제했어요'); router.replace('/'); }} />
      ) : (
        <T v="small">{settings.session.autoEndMin}분 동안 아무 기록이 없으면 마지막 세트 시각에 자동으로 끝나요. 기록은 세트마다 바로 저장돼서 오늘 추천에 반영돼요.</T>
      )}
    </ScrollView>
  );
}

function TimelineItem({ ex, session, last, lastPerf }: {
  ex: SessionExercise; session: Session; last: boolean; lastPerf: ReturnType<typeof lastPerformance>;
}) {
  const c = usePalette();
  const ended = session.endedAt != null;
  const color = ex.status === 'active' ? c.accent : ex.status === 'done' ? c.ok : c.line;
  const n = setCount(ex);
  return (
    <View style={{ flexDirection: 'row', gap: Space.md }}>
      {/* timeline rail */}
      <View style={{ width: 16, alignItems: 'center' }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 18, backgroundColor: ex.status === 'pending' || ex.status === 'skipped' ? c.bg : color, borderWidth: 2, borderColor: color }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: c.line, marginTop: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: Space.md, opacity: ex.status === 'skipped' ? 0.55 : 1 }}>
        {ex.status === 'active' && !ended ? <ActiveExercise ex={ex} session={session} lastPerf={lastPerf} /> : (
          <View style={{ paddingVertical: Space.md, gap: 4 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flexShrink: 1 }}>
                <ExName v="title" style={{ fontSize: 16 }} name={ex.name} />
                <T v="small">
                  {MUSCLE_NAME[ex.muscle]} · {ex.status === 'done' ? `${n}세트` : ex.status === 'skipped' ? '건너뜀' : `${ex.planned}세트 예정`}
                  {ex.startedAt && ex.endedAt ? ` · ${clock(ex.startedAt)}–${clock(ex.endedAt)}` : ''}
                </T>
                {ex.sets.length ? <T v="small">{ex.sets.map((s) => (s.kg ? `${s.kg}×${s.reps ?? '-'}` : `${s.reps ?? '-'}회`)).join(' · ')}</T> : null}
              </View>
              {!ended ? (
                ex.status === 'done'
                  ? <Button label="다시 열기" kind="ghost" onPress={() => reopenExercise(session.id, ex.key)} />
                  : <Row style={{ flexWrap: 'nowrap' }}>
                      {ex.status === 'pending' ? <Button label="건너뛰기" kind="ghost" onPress={() => skipExercise(session.id, ex.key)} /> : null}
                      <Button label="지금 하기" onPress={() => makeActive(session.id, ex.key)} />
                    </Row>
              ) : null}
            </Row>
          </View>
        )}
      </View>
    </View>
  );
}

function ActiveExercise({ ex, session, lastPerf }: { ex: SessionExercise; session: Session; lastPerf: ReturnType<typeof lastPerformance> }) {
  const c = usePalette();
  const opts = useData((s) => s.settings.session);
  const goal = useData((s) => s.settings.profile.goal);
  const profile = useData((s) => s.settings.profile);
  const p = prefill(ex, lastPerf);
  const [kg, setKg] = useState<number>(p.kg ?? 0);
  const [reps, setReps] = useState<number>(p.reps ?? 10);
  const [rpe, setRpe] = useState<number | null>(null);
  const [count, setCountState] = useState(ex.doneSets ?? ex.planned);
  // re-seed inputs when the active exercise changes
  const [seed, setSeed] = useState(ex.key);
  if (seed !== ex.key) { setSeed(ex.key); setKg(p.kg ?? 0); setReps(p.reps ?? 10); setRpe(null); setCountState(ex.doneSets ?? ex.planned); }

  const rest = restSeconds(ex.name, goal);
  const setMode = session.detail === 'set';
  const n = ex.sets.length;

  const doneSet = () => {
    completeSet(session.id, ex.key, opts.setInputs ? { kg: kg || null, reps: reps || null, rpe: opts.setRpe ? rpe : null } : { rpe: opts.setRpe ? rpe : null });
    setRpe(null);
    if (opts.restTimer && n + 1 < ex.planned) void startRest(rest, ex.name);
    else void stopRest();
  };

  return (
    <Card style={{ borderColor: c.accent, borderWidth: 2, marginTop: Space.xs }}>
      <View>
        <Row style={{ justifyContent: 'space-between' }}>
          <ExName v="title" name={ex.name} />
          <Chip label={setMode ? `${n} / ${ex.planned}세트` : `${ex.planned}세트 예정`} tone="accent" />
        </Row>
        <T v="small">{MUSCLE_NAME[ex.muscle]} · {repRange(ex.name, profile)}</T>
        {lastPerf ? (
          <T v="small">지난번 {lastPerf.date.slice(5).replace('-', '/')} · {lastPerf.sets.length
            ? lastPerf.sets.map((s) => (s.kg ? `${s.kg}×${s.reps ?? '-'}` : `${s.reps ?? '-'}회`)).join(' · ')
            : `${lastPerf.count}세트${lastPerf.kg ? ` · ${lastPerf.kg}kg` : ''}${lastPerf.reps ? ` × ${lastPerf.reps}` : ''}`}</T>
        ) : <T v="small">처음 하는 운동이에요</T>}
      </View>

      {setMode ? (
        <>
          {ex.sets.map((s, i) => (
            <View key={i}>
              {i > 0 ? <T v="small" style={{ marginLeft: 28 }}>휴식 {fmtDuration(Math.round((s.at - ex.sets[i - 1].at) / 1000))}</T> : null}
              <Row style={{ flexWrap: 'nowrap', paddingVertical: 4 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.okSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="small" style={{ color: c.ok, fontWeight: '700' }}>{i + 1}</T>
                </View>
                <T style={{ flex: 1 }}>{s.kg ? `${s.kg}kg × ${s.reps ?? '-'}회` : s.reps ? `${s.reps}회` : '완료'}{s.rpe ? ` · RPE ${s.rpe}` : ''}</T>
                <T v="small">{clock(s.at)}</T>
              </Row>
            </View>
          ))}
          {opts.setInputs ? (
            <Row gap={Space.md}>
              <Stepper label="중량 kg" value={kg} onChange={setKg} step={2.5} min={0} max={500} />
              <Stepper label="반복" value={reps} onChange={setReps} step={1} min={0} max={100} />
            </Row>
          ) : null}
          {opts.setRpe ? (
            <View style={{ gap: 6 }}>
              <T v="muted">RPE (10 = 한계)</T>
              <Pills options={[6, 7, 8, 9, 10].map((v) => ({ k: String(v), n: String(v) }))} value={rpe ? String(rpe) : null}
                onToggle={(k) => setRpe(rpe === Number(k) ? null : Number(k))} />
            </View>
          ) : null}
          <Button label={`${n + 1}세트 완료`} kind="primary" onPress={doneSet} style={{ paddingVertical: 14 }} />
          <Row>
            {n ? <Button label="마지막 세트 취소" kind="ghost" onPress={() => undoSet(session.id, ex.key)} /> : null}
            <View style={{ flex: 1 }} />
            <Button label="건너뛰기" kind="ghost" onPress={() => skipExercise(session.id, ex.key)} />
            <Button label="운동 완료" onPress={() => { completeExercise(session.id, ex.key); void stopRest(); }} disabled={!n} />
          </Row>
        </>
      ) : (
        <>
          <Row gap={Space.md}><Stepper label="세트 수" value={count} onChange={setCountState} min={1} max={20} /></Row>
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button label="건너뛰기" onPress={() => skipExercise(session.id, ex.key)} style={{ flex: 1 }} />
            <Button label="완료" kind="primary" onPress={() => completeExercise(session.id, ex.key, count)} style={{ flex: 2, paddingVertical: 13 }} />
          </Row>
        </>
      )}
    </Card>
  );
}

function RestBar() {
  const c = usePalette();
  const rest = useRest();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (!rest.until) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.until]);
  const left = rest.until ? Math.ceil((rest.until - now) / 1000) : 0;
  useEffect(() => {
    if (rest.until && left <= 0 && fired.current !== rest.until) { fired.current = rest.until; buzz(); }
  }, [left, rest.until]);
  if (!rest.until) return null;
  const over = left <= 0;
  const pct = rest.total ? Math.max(0, Math.min(100, (left / rest.total) * 100)) : 0;
  return (
    <View style={{ backgroundColor: over ? c.okSoft : c.accentSoft, borderRadius: Radius.md, padding: Space.md, gap: Space.sm }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View>
          <T v="small" style={{ color: over ? c.ok : c.accent }}>{over ? '휴식 끝 · 다음 세트' : `휴식 중 · ${rest.label}`}</T>
          <T v="big" style={{ color: over ? c.ok : c.accent }}>{over ? `+${fmtDuration(-left)}` : fmtDuration(left)}</T>
        </View>
        <Row style={{ flexWrap: 'nowrap' }}>
          {!over ? <Button label="+30초" onPress={() => void addRest(30)} /> : null}
          <Button label={over ? '닫기' : '건너뛰기'} onPress={() => void stopRest()} />
        </Row>
      </Row>
      {!over ? (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surface, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${pct}%`, backgroundColor: c.accent }} />
        </View>
      ) : null}
    </View>
  );
}

function AddExercise({ onAdd, onCancel }: { onAdd: (name: string, m: MuscleKey) => void; onCancel: () => void }) {
  const settings = useData((s) => s.settings);
  const logsT = useData((s) => s.logs);
  const [m, setM] = useState<MuscleKey>('chest');
  const opts = useMemo(() => pickable(m, { ...settings, known: knownExercises(live(logsT)) }), [settings, logsT, m]);
  return (
    <Card>
      <T v="title">운동 추가</T>
      <Pills options={MUSCLES} value={m} onToggle={setM} />
      <Pills options={opts.map((o) => ({ k: o.n, n: o.n }))} value={null} onToggle={(k) => onAdd(k, m)} />
      <Button label="취소" kind="ghost" onPress={onCancel} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

function Summary({ session, now }: { session: Session; now: number }) {
  const sum = summarize(session, now);
  return (
    <Card>
      <T v="title">운동 끝 · 수고했어요</T>
      {session.autoEnded ? <Banner text={`한동안 기록이 없어서 마지막 세트 시각(${clock(session.endedAt)})에 자동으로 끝냈어요.`} /> : null}
      <Row gap={Space.xl}>
        <View><T v="small">시간</T><T v="num">{fmtDuration(sum.durationS)}</T></View>
        <View><T v="small">세트</T><T v="num">{sum.totalSets}</T></View>
        {sum.volumeKg ? <View><T v="small">볼륨</T><T v="num">{sum.volumeKg.toLocaleString()}kg</T></View> : null}
        {sum.avgRestS ? <View><T v="small">평균 휴식</T><T v="num">{fmtDuration(sum.avgRestS)}</T></View> : null}
      </Row>
      <Row>{sum.perMuscle.map((p) => <Chip key={p.muscle} tone="ok" label={`${MUSCLE_NAME[p.muscle]} ${p.sets}세트`} />)}</Row>
      <T v="small">운동 {sum.done}개 완료{sum.skipped ? ` · ${sum.skipped}개 건너뜀` : ''}</T>
      <View style={{ gap: 6 }}>
        <T v="muted">오늘 운동 강도 (세션 RPE)</T>
        <Pills options={[5, 6, 7, 8, 9, 10].map((v) => ({ k: String(v), n: String(v) }))} value={session.rpe ? String(session.rpe) : null}
          onToggle={(k) => setSessionRpe(session.id, session.rpe === Number(k) ? null : Number(k))} />
      </View>
    </Card>
  );
}
