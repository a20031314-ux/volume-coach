import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { RouteView } from '@/components/route-view';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, ConfirmButton, Row, Screen, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/dates';
import { currentPace, fmtDuration, fmtKm, fmtPace, runKcal } from '@/lib/run';
import { body } from '@/lib/profile';
import {
  discardRun, elapsedS, finishRun, isTrackingAvailable, openSettings, pauseRun, reconcileRun, resumeRun, startRun, useRun,
  type StartResult,
} from '@/run/tracker';
import { live, useData } from '@/store/store';

export default function RunScreen() {
  const c = usePalette();
  const toast = useToast();
  const run = useRun();
  const runsT = useData((s) => s.runs);
  const removeRun = useData((s) => s.removeRun);
  const settings = useData((s) => s.settings);
  const bodyT = useData((s) => s.bodyComps);
  const [now, setNow] = useState(() => Date.now());
  const today = useNow();
  const [problem, setProblem] = useState<Extract<StartResult, { ok: false }> | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void isTrackingAvailable().then(setAvailable);
    void reconcileRun();
  }, []);
  useEffect(() => {
    if (run.status === 'idle') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run.status]);

  const runs = useMemo(() => live(runsT).sort((a, b) => b.startedAt - a.startedAt), [runsT]);
  const weekKm = useMemo(() => {
    const since = today.getTime() - 7 * 864e5;
    return runs.filter((r) => r.startedAt >= since).reduce((a, r) => a + r.distanceM, 0) / 1000;
  }, [runs, today]);
  const weight = body(settings.profile, live(bodyT))?.weight ?? 70;

  const secs = elapsedS(run, now);
  const avg = run.distanceM >= 50 ? secs / (run.distanceM / 1000) : null;
  const curPace = run.status === 'running' ? currentPace(run.points) : null;
  const gpsAge = run.lastFixAt ? (now - run.lastFixAt) / 1000 : null;
  const gpsWeak = run.status === 'running' && (gpsAge == null || gpsAge > 15 || (run.lastAccuracy ?? 0) > 35);

  const act = async (fn: () => Promise<StartResult>) => {
    setBusy(true); setProblem(null);
    try { const r = await fn(); if (!r.ok) setProblem(r); } finally { setBusy(false); }
  };

  return (
    <Screen title="러닝" sub={`최근 7일 ${weekKm.toFixed(1)}km`}>
      {available === false ? <Banner text="러닝 기록은 휴대폰 앱에서만 쓸 수 있어요. 웹이나 Expo Go에서는 화면이 꺼지면 기록이 멈춰요." /> : null}

      <Card style={{ gap: Space.lg }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="big" style={{ fontSize: 64, lineHeight: 70 }}>{fmtKm(run.distanceM)}</T>
          <T v="muted">킬로미터</T>
        </View>
        <Row style={{ justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtDuration(secs)}</T><T v="small">시간</T></View>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtPace(avg)}</T><T v="small">평균 페이스</T></View>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtPace(curPace)}</T><T v="small">현재 페이스</T></View>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{runKcal(run.distanceM, weight)}</T><T v="small">kcal</T></View>
        </Row>
        {run.status === 'paused' ? <T v="muted" style={{ textAlign: 'center' }}>일시정지 중 · 이 동안의 거리와 시간은 빼고 계산해요</T> : null}
        {gpsWeak ? <T v="small" style={{ textAlign: 'center', color: c.warn }}>GPS 신호를 찾는 중이에요. 하늘이 트인 곳에서 더 정확해요.</T> : null}

        {run.status === 'idle' ? (
          <Button label={busy ? '준비 중…' : '러닝 시작'} kind="primary" disabled={busy} onPress={() => void act(startRun)} style={{ paddingVertical: 16 }} />
        ) : (
          <Row style={{ flexWrap: 'nowrap' }}>
            {run.status === 'running'
              ? <Button label="일시정지" onPress={pauseRun} style={{ flex: 1, paddingVertical: 14 }} />
              : <Button label="재개" kind="primary" disabled={busy} onPress={() => void act(resumeRun)} style={{ flex: 1, paddingVertical: 14 }} />}
            <Button label="종료하고 저장" kind={run.status === 'paused' ? 'default' : 'primary'} disabled={busy} style={{ flex: 1, paddingVertical: 14 }}
              onPress={async () => {
                setBusy(true);
                const d = await finishRun();
                setBusy(false);
                toast(d == null ? '50m 미만이라 저장하지 않았어요' : `${(d / 1000).toFixed(2)}km 저장됨`);
              }} />
          </Row>
        )}
        {run.status !== 'idle' ? (
          <ConfirmButton label="기록 버리기" confirmLabel="정말 버리기" onConfirm={() => { void discardRun(); toast('기록을 버렸어요'); }} style={{ alignSelf: 'center' }} />
        ) : null}
        {problem ? (
          <View style={{ gap: Space.sm }}>
            <Banner text={problem.message} />
            {problem.openSettings ? <Button label="설정 열기" onPress={openSettings} style={{ alignSelf: 'flex-start' }} /> : null}
          </View>
        ) : null}
      </Card>

      {run.status === 'idle' ? (
        <T v="small">시작하면 화면을 끄고 주머니에 넣어도 계속 기록해요. 끝난 러닝은 다리 회복도에 반영돼서 다음 날 하체 추천이 조정돼요.</T>
      ) : null}

      <T v="label">기록</T>
      {!runs.length ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>아직 러닝 기록이 없어요.</T> : null}
      {runs.map((r) => {
        const expanded = open === r.id;
        return (
          <Card key={r.id} style={{ gap: Space.sm }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flexShrink: 1 }}>
                <T v="title">{fmtKm(r.distanceM)}km</T>
                <T v="small">{fmt(r.date)} · {new Date(r.startedAt).toTimeString().slice(0, 5)}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="num" style={{ fontSize: 17 }}>{fmtDuration(r.movingS)} · {fmtPace(r.paceSecPerKm)}</T>
                <T v="small">{r.kcal}kcal</T>
              </View>
            </Row>
            {expanded ? (
              <>
                <RouteView route={r.route} />
                {r.splits.length ? (
                  <View>
                    {r.splits.map((sp) => (
                      <Row key={sp.km} style={{ justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderColor: c.line }}>
                        <T v="muted">{sp.km}km</T><T v="num" style={{ fontSize: 15 }}>{fmtPace(sp.seconds)}</T>
                      </Row>
                    ))}
                  </View>
                ) : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Button label="접기" kind="ghost" onPress={() => setOpen(null)} />
                  <ConfirmButton label="삭제" onConfirm={() => { removeRun(r.id); toast('삭제됨'); }} />
                </Row>
              </>
            ) : (
              <Button label="경로·구간 보기" kind="ghost" onPress={() => setOpen(r.id)} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
