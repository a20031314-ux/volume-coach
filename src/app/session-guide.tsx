/**
 * 가이드로 쭉 하기: 운동 전에 종목별 세트·횟수·무게·휴식·자세 잡는 시간을 미리 설계하고,
 * 시작하면 끝까지 음성으로 이어서 진행한다. 진행 중엔 일시정지만, 멈췄을 때 이어서/처음부터/넘기기/끝내기.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ConfirmButton, Meter, NumField, Pills, Row, Stepper, T } from '@/components/ui';
import { TimelineRow } from '@/components/guide-timeline';
import { Space, usePalette } from '@/constants/theme';
import { library } from '@/lib/exercises';
import {
  buildRun, DEFAULT_GUIDE, describeTempo, repProgress, runSpans, GOAL_TEMPO, rhythmKind, setupFor, tempoFor, TEMPO_CHOICES, type RunAct, type RunItem,
} from '@/lib/guide';
import { fmtDuration } from '@/lib/run';
import { lastPerformance, prefill, restSeconds } from '@/lib/session';
import { canRestart, endRun, pauseRun, restartSet, resumeRun, skipAhead, startRun, stopRun, toggleFlag, useGuide } from '@/store/guide-player';
import { stopRest } from '@/store/rest-timer';
import { completeExercise, completeSet, editSets, finishSession, makeActive, setDetail } from '@/store/session-actions';
import { live, useData } from '@/store/store';

const mmss = (s: number) => fmtDuration(Math.max(0, Math.round(s)));
const restText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분${s % 60 ? ` ${s % 60}초` : ''}` : `${s}초`);

export default function SessionGuide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useData((s) => (id ? s.sessions[id] : undefined));
  const st = useGuide();
  const mine = st.sessionId === id && st.status !== 'idle';
  if (!session) return null;
  return mine ? <RunView id={session.id} /> : <PlanView id={session.id} />;
}

/* ---------- 설계 ---------- */

function PlanView({ id }: { id: string }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const session = useData((s) => s.sessions[id]);
  const settings = useData((s) => s.settings);
  const sessionsT = useData((s) => s.sessions);
  const logsT = useData((s) => s.logs);
  const g = { ...DEFAULT_GUIDE, ...(settings.guide ?? {}) };
  const goal = settings.profile.goal;
  const setMode = session.detail === 'set';
  const lib = useMemo(() => library(settings.customExercises), [settings.customExercises]);

  const [items, setItems] = useState<RunItem[]>(() => session.exercises
    .filter((e) => e.status === 'pending' || e.status === 'active')
    .map((e) => {
      const ex = lib.find((x) => x.n === e.name) ?? { n: e.name, p: 'core' as const };
      const done = setMode ? e.sets.length : 0;
      const p = prefill(e, lastPerformance(e.name, live(sessionsT), live(logsT), session.id));
      return {
        key: e.key, name: e.name, p: ex.p, first: done + 1, sets: Math.max(0, e.planned - done),
        reps: e.target?.reps ?? p.reps ?? 10, hold: 30, kg: e.target?.kg ?? p.kg ?? 0,
        tempo: tempoFor(g, e.name, goal), rest: restSeconds(e.name, goal || undefined),
        setup: g.setup ?? setupFor(ex), on: !g.only.length || g.only.includes(e.name),
      };
    }));
  const [move, setMove] = useState(g.move ?? 60);
  const [open, setOpen] = useState<string | null>(null);
  const opts = { countdown: g.countdown, rhythm: g.reps, restCues: g.rest, move };
  const run = buildRun(items, opts);
  const on = items.filter((i) => i.on && i.sets > 0);
  const spans = runSpans(run.cues, on.length);
  const edit = (key: string, patch: Partial<RunItem>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const start = () => {
    const byKey = new Map(items.map((i) => [i.key, i]));
    const act = (a: RunAct) => {
      if (a.k === 'finish') return;
      const it = byKey.get(a.key);
      if (!it) return;
      if (a.k === 'begin') makeActive(id, a.key);
      else if (a.k === 'set') {
        completeSet(id, a.key, { kg: it.kg || null, reps: rhythmKind({ n: it.name }) === 'hold' ? null : it.reps, rpe: null });
      } else if (a.k === 'done') completeExercise(id, a.key);
    };
    // the guide records every set (weights are checked after), so the session keeps 세트별 records
    if (!setMode) setDetail(id, 'set');
    void stopRest();
    startRun(id, run, { voice: g.voice, haptic: g.haptic }, act, { items: on, rhythm: g.reps });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.md, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
        <T v="muted">운동 전에 한 번 맞춰두면, 시작부터 끝까지 음성으로 이어서 안내해요. 진행 중엔 일시정지만 누르면 돼요.</T>
        <T v="small">무게는 지난 기록으로 채워져 있어요. 비어 있어도 시작할 수 있고, 끝나면 기록 확인 화면에서 실제로 든 무게·횟수만 고치면 돼요.</T>

        {items.length ? (
          <Card style={{ gap: 0, paddingRight: Space.md }}>
            <Row style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
              <T v="small" style={{ width: 104, fontSize: 11 }}>운동 (탭: 빼기)</T>
              <T v="small" style={{ width: 26, fontSize: 11, textAlign: 'center' }}>순서</T>
              <T v="small" style={{ flex: 1, fontSize: 11, paddingLeft: 6 }}>시간 → (점: 세트, 탭해서 고치기)</T>
            </Row>
            {items.map((it, i) => {
              const kind = rhythmKind({ n: it.name });
              const expanded = open === it.key;
              const idx = on.indexOf(it);
              return (
                <View key={it.key}>
                  <TimelineRow it={it} rhythm={g.reps} state={it.on ? (expanded ? 'now' : 'plan') : 'off'} last={i === items.length - 1}
                    span={idx >= 0 ? spans[idx] : null}
                    onToggle={() => edit(it.key, { on: !it.on })} onPress={() => setOpen(expanded ? null : it.key)} />
                  {expanded ? (
                    <View style={{ gap: Space.sm, marginLeft: 0, marginBottom: Space.md, padding: Space.md, borderRadius: 10, backgroundColor: c.bg }}>
                      <Row style={{ flexWrap: 'nowrap' }}>
                        <T style={{ fontWeight: '700', flex: 1 }}>{it.name}{it.first > 1 ? ` · ${it.first}세트부터` : ''}</T>
                        <Button label="닫기" kind="ghost" onPress={() => setOpen(null)} />
                      </Row>
                      <Row gap={Space.md}>
                        <Stepper label="세트" value={it.sets} onChange={(sets) => edit(it.key, { sets })} min={1} max={12} />
                        {kind === 'hold'
                          ? <Stepper label="버티기 (초)" value={it.hold} onChange={(hold) => edit(it.key, { hold })} step={5} min={10} max={180} />
                          : <Stepper label="반복" value={it.reps} onChange={(reps) => edit(it.key, { reps })} min={1} max={30} />}
                      </Row>
                      {kind !== 'hold' ? <Row gap={Space.md}><Stepper label="무게 kg" value={it.kg} onChange={(kg) => edit(it.key, { kg })} step={2.5} min={0} max={400} /></Row> : null}
                      <Row gap={Space.md}>
                        <Stepper label="세트 간 휴식" value={it.rest} onChange={(rest) => edit(it.key, { rest })} step={15} min={15} max={600} format={restText} />
                        <Stepper label="자세 잡는 시간" value={it.setup} onChange={(setup) => edit(it.key, { setup })} step={2} min={0} max={30} format={(v) => `${v}초`} />
                      </Row>
                      <T v="small">자세 잡는 시간: “준비, 자세 잡으세요” 뒤 이만큼 기다렸다가 3·2·1. 바벨은 랙에서 빼고 호흡 잡는 시간까지.</T>
                      {kind === 'rhythm' && g.reps ? (
                        <View style={{ gap: 6 }}>
                          <T v="muted">템포 · {describeTempo(it.tempo)}</T>
                          <Pills options={[GOAL_TEMPO[goal], ...TEMPO_CHOICES.filter((t) => t !== GOAL_TEMPO[goal])].map((t) => ({ k: t, n: t }))} value={it.tempo}
                            onToggle={(tempo) => edit(it.key, { tempo })} />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ) : <Card><T>남은 운동이 없어요</T></Card>}

        {items.length > 1 ? (
          <Card>
            <Stepper label="운동 사이 이동 (휴식보다 짧으면 휴식만큼)" value={move} onChange={setMove} step={15} min={15} max={300} format={restText} />
            <T v="small">“다음은 랫풀다운, 3세트…”를 알려주고 이 시간 뒤 다음 운동 1세트를 시작해요.</T>
          </Card>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => router.push('/prefs/guide')}>
          <T v="small">음성 {g.voice ? '켬' : '끔'} · 진동 {g.haptic ? '켬' : '끔'} · 카운트다운 {g.countdown ? '켬' : '끔'} · 반복 리듬 {g.reps ? '켬' : '끔'} · 휴식 안내 {g.rest ? '켬' : '끔'}  <T v="small" style={{ color: c.accent }}>기본값 바꾸기 ›</T></T>
        </Pressable>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.md, paddingBottom: insets.bottom + Space.md, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line, gap: 4 }}>
        <T v="small" style={{ textAlign: 'center' }}>{on.length}종목 · {on.reduce((a, i) => a + i.sets, 0)}세트 · 예상 {Math.round(run.length / 60)}분</T>
        <Button label="▶ 가이드 시작" kind="primary" onPress={start} disabled={!on.length} style={{ paddingVertical: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }} />
      </View>
    </View>
  );
}

/* ---------- 진행 ---------- */

function RunView({ id }: { id: string }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const st = useGuide();

  const left = st.until - st.at;
  const counting = st.mode === 'rest' || st.mode === 'move' || (st.timed && st.phase !== '준비' && st.phase !== '자세 잡기');
  const target = st.target;

  if (st.status === 'done') return <Review id={id} />;

  // 체크: the set in progress, or the one just done while resting
  const flagged = st.flags.includes(st.ref);
  const flagItem = st.items.find((x) => st.ref.startsWith(`${x.key}:`));
  const flagWhat = flagItem ? `${flagItem.name} ${st.ref.split(':').pop()}세트` : '이 세트';
  // the moving dot in the current set
  const cur = st.items[st.item];
  const inSet = cur && st.mode === 'set' && st.phase !== '준비' && st.phase !== '자세 잡기';
  const repPos = inSet ? repProgress({ it: cur, rep: st.rep, phase: st.phase, lastMove: st.lastMove, since: st.at - st.phaseAt }) : null;
  // the green flow down the rail while moving to the next exercise
  const dropOf = (i: number) => {
    const a = st.spans[i];
    const b = st.spans[i + 1];
    if (!a || !b) return 0;
    if (st.at <= a.end) return 0;
    return Math.min(1, (st.at - a.end) / Math.max(1, b.start - a.end));
  };
  const line = st.mode === 'set' ? `${st.label.split(' · ')[1] ?? ''} 진행 중`
    : st.mode === 'rest' ? `휴식 ${mmss(left)} · ${st.label.split('다음 ')[1] ?? ''} 준비` : st.mode === 'move' ? `이동 ${mmss(left)}` : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingBottom: insets.bottom + Space.lg }}>
      <View style={{ paddingHorizontal: Space.lg, paddingTop: Space.md, gap: 4 }}>
        <Meter pct={st.length ? (st.at / st.length) * 100 : 0} color={c.accent} />
        <T v="small">{mmss(st.at)} 지남 · 남은 시간 약 {Math.max(1, Math.round((st.length - st.at) / 60))}분</T>
      </View>

      <View style={{ alignItems: 'center', paddingVertical: Space.md, gap: 2 }}>
        <T v="title" style={{ textAlign: 'center' }}>{st.label}</T>
        {counting ? (
          <T v="big" style={{ fontSize: 64, lineHeight: 72, color: c.accent }}>{mmss(left)}</T>
        ) : (
          <T v="big" style={{ fontSize: 72, lineHeight: 80, color: c.accent }}>{st.rep}{target ? <T v="title" style={{ color: c.muted }}> / {target}</T> : null}</T>
        )}
        <T style={{ fontSize: 20, fontWeight: '700', minHeight: 26 }}>{st.phase}</T>
        {st.mode === 'move' && st.items[st.item + 1] ? <T v="muted">{st.items[st.item + 1].name}(으)로 이동하세요</T> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Space.lg, paddingTop: Space.sm }}>
        {st.items.map((it, i) => (
          <TimelineRow key={it.key} it={it} rhythm={st.rhythm} span={st.spans[i]} last={i === st.items.length - 1} at={st.at}
            state={i < st.item || (i === st.item && (st.mode === 'move' || st.mode === 'end')) ? 'done' : i === st.item ? 'now' : 'next'}
            live={i === st.item && st.mode !== 'move' ? { rep: repPos, line, counted: st.rep } : undefined} drop={dropOf(i)}
            flagged={st.flags.filter((f) => f.startsWith(`${it.key}:`)).map((f) => Number(f.split(':').pop()))} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: Space.lg, paddingTop: Space.sm }}>
      {st.status === 'paused' ? (
        <View style={{ gap: Space.sm }}>
          <T v="label" style={{ textAlign: 'center' }}>일시정지됨{st.flags.length ? ` · 체크 ${st.flags.length}개` : ''}</T>
          <Button label="▶ 이어서" kind="primary" onPress={resumeRun} style={{ paddingVertical: 16 }} />
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button label="이 세트 처음부터" onPress={() => { restartSet(); resumeRun(); }} disabled={!canRestart(st.at)} style={{ flex: 1 }} />
            <Button label="다음으로 넘기기" onPress={() => { skipAhead(); resumeRun(); }} style={{ flex: 1 }} />
          </Row>
          <T v="small" style={{ textAlign: 'center' }}>넘기기: 세트 중이면 설계대로 기록하고 휴식으로, 휴식 중이면 다음 세트로</T>
          <Button label={flagged ? `✓ ${flagWhat} 체크됨 · 해제` : `☐ ${flagWhat} 체크 (끝나고 고치기)`} onPress={toggleFlag}
            style={flagged ? { backgroundColor: c.warnSoft, borderColor: c.warn } : undefined} />
          <ConfirmButton label="가이드 끝내기" confirmLabel="끝내고 기록 확인" onConfirm={endRun} style={{ alignSelf: 'center' }} />
        </View>
      ) : (
        <Button label="❚❚ 일시정지" kind="primary" onPress={pauseRun} style={{ paddingVertical: 22 }} accessibilityLabel="일시정지" />
      )}
      </View>
    </View>
  );
}

/* ---------- 기록 확인 ---------- */

/** After the guide: every guided set as planned; fix only what was different (체크한 세트가 위에). */
function Review({ id }: { id: string }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const st = useGuide();
  const session = useData((s) => s.sessions[id]);
  const [edits, setEdits] = useState<Record<string, Record<number, { kg?: number | null; reps?: number | null }>>>({});
  const changed = Object.values(edits).some((e) => Object.keys(e).length);

  const rows = st.items.map((it) => {
    const ex = session?.exercises.find((e) => e.key === it.key);
    const sets = (ex?.sets ?? []).map((set, i) => ({ set, i, no: i + 1 })).filter((x) => x.no >= it.first);
    return { it, sets };
  }).filter((r) => r.sets.length);
  const flaggedFirst = [...rows].sort((a, b) => Number(b.sets.some((x) => st.flags.includes(`${b.it.key}:${x.no}`))) - Number(a.sets.some((x) => st.flags.includes(`${a.it.key}:${x.no}`))));

  const put = (key: string, i: number, p: { kg?: number | null; reps?: number | null }) =>
    setEdits((e) => ({ ...e, [key]: { ...(e[key] ?? {}), [i]: { ...(e[key]?.[i] ?? {}), ...p } } }));
  const apply = () => { for (const [key, p] of Object.entries(edits)) if (Object.keys(p).length) editSets(id, key, p); };
  const finish = (end: boolean) => {
    apply();
    if (end) finishSession(id);
    stopRun();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.md, paddingBottom: 170, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
        <T v="big">기록 확인</T>
        <T v="muted">설계한 무게·횟수로 기록돼 있어요. 실제로 다르게 한 칸만 고치세요.{st.flags.length ? ` 운동 중 체크한 세트 ${st.flags.length}개는 노란색이에요.` : ''}</T>
        {flaggedFirst.map(({ it, sets }) => {
          const hold = rhythmKind({ n: it.name }) === 'hold';
          return (
            <Card key={it.key} style={{ gap: 6 }}>
              <T style={{ fontWeight: '700' }}>{it.name}</T>
              {sets.map(({ set, i, no }) => {
                const flag = st.flags.includes(`${it.key}:${no}`);
                const e = edits[it.key]?.[i] ?? {};
                const kg = 'kg' in e ? e.kg : set.kg;
                const reps = 'reps' in e ? e.reps : set.reps;
                return (
                  <Row key={i} gap={Space.sm} style={{ flexWrap: 'nowrap', alignItems: 'flex-end', padding: flag ? 6 : 0, borderRadius: 8, backgroundColor: flag ? c.warnSoft : 'transparent' }}>
                    <View style={{ width: 52, paddingBottom: 12 }}>
                      <T style={{ fontWeight: '700' }}>{no}세트</T>
                      {flag ? <T v="small" style={{ color: c.warn, fontSize: 11 }}>체크함</T> : null}
                    </View>
                    {hold ? <T v="muted" style={{ flex: 1, paddingBottom: 12 }}>{it.hold}초 버티기</T> : (<>
                      <NumField label="kg" value={kg ?? null} decimal placeholder="무게" onCommit={(v) => put(it.key, i, { kg: v })} style={{ flex: 1 }} />
                      <NumField label="회" value={reps ?? null} placeholder="횟수" onCommit={(v) => put(it.key, i, { reps: v })} style={{ flex: 1 }} />
                    </>)}
                  </Row>
                );
              })}
            </Card>
          );
        })}
        {!rows.length ? <Card><T>가이드로 기록된 세트가 없어요</T></Card> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: Space.md, paddingBottom: insets.bottom + Space.md, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.line, gap: Space.sm }}>
        <Button label={changed ? '고친 기록 저장 · 운동 끝내기' : '모두 맞아요 · 운동 끝내기'} kind="primary" onPress={() => finish(true)} style={{ paddingVertical: 14 }} />
        <Button label={changed ? '저장하고 운동 화면으로 (더 하기)' : '운동 화면으로 (더 하기)'} onPress={() => finish(false)} />
      </View>
    </View>
  );
}
