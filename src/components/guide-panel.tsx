/**
 * 가이드 모드 inside the active exercise: ▶ n세트 시작 → countdown → rep rhythm → 세트 끝 (recorded)
 * → rest with "30초 남았어요 … n세트 준비 3, 2, 1, 시작" → next set, until the planned sets are done.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { library } from '@/lib/exercises';
import { appliesTo, describeTempo, restCues, rhythmKind, setCues, tempoFor } from '@/lib/guide';
import type { Session, SessionExercise } from '@/lib/types';
import { beginRest, beginSet, play, say, stopGuide, useGuide } from '@/store/guide-player';
import { startRest, stopRest, useRest } from '@/store/rest-timer';
import { completeExercise, completeSet } from '@/store/session-actions';
import { useData } from '@/store/store';

const COUNTDOWN_S = 4.6;

export function GuidePanel({ ex, session, kg, reps, rest, next }: {
  ex: SessionExercise; session: Session; kg: number; reps: number; rest: number; next: SessionExercise | null;
}) {
  const c = usePalette();
  const settings = useData((s) => s.settings);
  const g = settings.guide;
  const st = useGuide();
  const restUntil = useRest((s) => s.until);
  const setMode = session.detail === 'set';
  // 운동별 기록: count guided sets here and record the exercise at the end
  const [counted, setCounted] = useState(0);
  const mine = st.exKey === ex.key;
  const done = setMode ? ex.sets.length : counted;
  const countRef = useRef(0);

  useEffect(() => () => { if (useGuide.getState().exKey === ex.key) stopGuide(); }, [ex.key]);
  // rest stopped from the rest bar (건너뛰기/닫기): stop the guided countdown too
  // (startRest is async: only react once the rest has actually started and then gone)
  const prevRest = useRef<number | null>(null);
  useEffect(() => {
    if (mine && st.mode === 'rest' && prevRest.current && !restUntil) stopGuide();
    prevRest.current = restUntil;
  }, [restUntil, mine, st.mode]);

  if (!g) {
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push('/prefs/guide')}
        style={{ backgroundColor: c.accentSoft, borderRadius: 10, padding: Space.md, gap: 2 }}>
        <T style={{ color: c.accent, fontWeight: '700' }}>가이드 모드 들어보기 ›</T>
        <T v="small">준비 3·2·1, 반복 리듬, 휴식 끝 알림을 음성으로 안내해요</T>
      </Pressable>
    );
  }
  if (!appliesTo(g, ex.name)) return null;

  const lib = library(settings.customExercises).find((e) => e.n === ex.name) ?? { n: ex.name, p: 'core' as const };
  const tempo = tempoFor(g, ex.name, settings.profile.goal);
  const out = { voice: g.voice, haptic: g.haptic };
  const target = ex.target?.reps ?? reps;
  const kind = rhythmKind(lib);

  const runSet = (setNo: number, withCountdown: boolean) => {
    beginSet(ex.key, setNo);
    const { cues } = setCues({ setNo, reps: target, tempo, ex: lib, countdown: withCountdown, rhythm: g.reps });
    // with no rhythm (or a hold) the set ends when the user taps 세트 끝
    play(cues, out, { onEnd: () => endSet(target) });
  };

  const endSet = (count: number) => {
    const now = useData.getState().sessions[session.id]?.exercises.find((e) => e.key === ex.key);
    const setNo = (setMode ? now?.sets.length ?? 0 : countRef.current) + 1;
    if (setMode) completeSet(session.id, ex.key, { kg: kg || null, reps: count || null, rpe: null });
    else { countRef.current = setNo; setCounted(setNo); }
    const left = ex.planned - setNo;
    if (left <= 0) {
      stopGuide();
      void stopRest();
      if (!setMode) completeExercise(session.id, ex.key, setNo);
      say(next ? `운동 끝. 다음은 ${next.name}, ${next.planned}세트` : '오늘 운동 끝. 수고했어요', out);
      return;
    }
    void startRest(rest, ex.name);
    if (!g.rest) { stopGuide(); return; }
    beginRest(ex.key, setNo + 1);
    play(restCues(rest, setNo + 1, g.countdown), out);
    // the next set's countdown ends on 시작 exactly when the rest is over
    const lead = g.countdown ? COUNTDOWN_S : 0;
    play([], out, { offset: Math.max(0, rest - lead), endAt: 0, onEnd: () => runSet(setNo + 1, g.countdown) });
  };

  const setNo = done + 1;
  if (!mine || st.mode === 'idle') {
    return (
      <View style={{ gap: 4 }}>
        <Button label={`▶ ${setNo}세트 시작 · 가이드`} kind="primary" onPress={() => runSet(setNo, g.countdown)} style={{ paddingVertical: 14 }} />
        <T v="small">{target}회 · {kind === 'rhythm' && g.reps ? `템포 ${tempo.replace(/-0$/, '')} (${describeTempo(tempo)})` : kind === 'hold' ? '버티는 동작 · 끝나면 세트 끝' : '빠른 동작 · 박자 없이 횟수만'} · 휴식 {rest}초</T>
      </View>
    );
  }

  if (st.mode === 'rest') {
    return (
      <View style={{ backgroundColor: c.accentSoft, borderRadius: 10, padding: Space.md, gap: Space.sm }}>
        <T style={{ color: c.accent, fontWeight: '700' }}>휴식 중 · 다음 {st.setNo}세트는 자동으로 시작해요</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Button label="바로 시작" kind="primary" onPress={() => { void stopRest(); runSet(st.setNo, g.countdown); }} style={{ flex: 2 }} />
          <Button label="가이드 멈춤" onPress={stopGuide} style={{ flex: 1 }} />
        </Row>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: c.accentSoft, borderRadius: 10, padding: Space.md, gap: Space.sm, alignItems: 'center' }}>
      <T v="small" style={{ color: c.accent }}>{st.setNo}세트 · 목표 {target}회</T>
      <T v="big" style={{ fontSize: 56, lineHeight: 64, color: c.accent }}>{st.rep}</T>
      <T style={{ fontWeight: '700', minHeight: 22 }}>{st.phase}</T>
      <Row style={{ flexWrap: 'nowrap', alignSelf: 'stretch' }}>
        <Button label="세트 끝" kind="primary" onPress={() => { const n = useGuide.getState().rep; stopGuide(); endSet(n || target); }} style={{ flex: 2, paddingVertical: 14 }} />
        <Button label="취소" onPress={stopGuide} style={{ flex: 1 }} />
      </Row>
      <T v="small">덜 했거나 더 했으면 세트 끝 뒤 기록에서 고칠 수 있어요</T>
    </View>
  );
}

