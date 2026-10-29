import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { PaceTimeline } from '@/components/pace-timeline';
import { RouteView } from '@/components/route-view';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Chip, ConfirmButton, Meter, Pills, Row, Screen, Segmented, Stepper, T } from '@/components/ui';
import { Radius, Space, usePalette } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { fmt } from '@/lib/dates';
import { PHASE_NAME, buildPhases, phaseAt, planTotalS, type PhaseKind } from '@/lib/interval';
import { body } from '@/lib/profile';
import { fmtDuration, fmtKm, fmtPace, runKcal } from '@/lib/run';
import type { IntervalPlanData, RunOptions } from '@/lib/types';
import {
  discardRun, elapsedS, finishRun, isTrackingAvailable, livePace, openSettings, pauseRun, phasesOf, reconcileRun,
  resumeRun, startRun, tickCues, useRun, type StartResult,
} from '@/run/tracker';
import { live, useData } from '@/store/store';

const PRESETS: { n: string; p: Partial<IntervalPlanData> }[] = [
  { n: '4분/3분 ×5', p: { workS: 240, restS: 180, repeats: 5 } },
  { n: '1분/1분 ×10', p: { workS: 60, restS: 60, repeats: 10 } },
  { n: '3분/2분 ×6', p: { workS: 180, restS: 120, repeats: 6 } },
  { n: '30초/30초 ×12', p: { workS: 30, restS: 30, repeats: 12 } },
];

export default function RunScreen() {
  const c = usePalette();
  const toast = useToast();
  const run = useRun();
  const runsT = useData((s) => s.runs);
  const removeRun = useData((s) => s.removeRun);
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const bodyT = useData((s) => s.bodyComps);
  const [now, setNow] = useState(() => Date.now());
  const today = useNow();
  const [problem, setProblem] = useState<Extract<StartResult, { ok: false }> | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const opts = settings.run;
  const setOpts = (patch: Partial<RunOptions>) => update({ run: { ...opts, ...patch } });
  const setPlan = (patch: Partial<IntervalPlanData>) => setOpts({ interval: { ...opts.interval, ...patch } });

  useEffect(() => {
    void isTrackingAvailable().then(setAvailable);
    void reconcileRun();
  }, []);
  useEffect(() => {
    if (run.status === 'idle') return;
    const t = setInterval(() => { setNow(Date.now()); tickCues(); }, 1000);
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
  const curPace = livePace(run, now);
  const gpsAge = run.lastFixAt ? (now - run.lastFixAt) / 1000 : null;
  const gpsWeak = run.status === 'running' && (gpsAge == null || gpsAge > 15 || (run.lastAccuracy ?? 0) > 35);
  const phases = phasesOf(run);
  const pos = phases ? phaseAt(phases, secs) : null;
  const planPhases = useMemo(() => buildPhases(opts.interval), [opts.interval]);

  const act = async (fn: () => Promise<StartResult>) => {
    setBusy(true); setProblem(null);
    try { const r = await fn(); if (!r.ok) setProblem(r); } finally { setBusy(false); }
  };
  const start = () => act(() => startRun({
    plan: opts.mode === 'interval' ? opts.interval : null,
    voice: opts.voice,
    kmAlert: opts.mode === 'interval' ? false : opts.kmAlert,
    everyMin: opts.mode === 'interval' ? 0 : opts.everyMin,
  }));
  const phaseColor = (k: PhaseKind) => (k === 'work' ? c.accent : k === 'rest' ? c.ok : c.rest);

  return (
    <Screen title="러닝" sub={`최근 7일 ${weekKm.toFixed(1)}km`}>
      {available === false ? <Banner text="러닝 기록은 휴대폰 앱에서만 쓸 수 있어요. 웹이나 Expo Go에서는 화면이 꺼지면 기록이 멈춰요." /> : null}

      {run.status === 'idle' ? (
        <Card>
          <Segmented options={[{ v: 'free', n: '자유 러닝' }, { v: 'interval', n: '인터벌' }]} value={opts.mode} onChange={(v) => v && setOpts({ mode: v })} />
          {opts.mode === 'interval' ? (
            <>
              <Pills options={PRESETS.map((p) => ({ k: p.n, n: p.n }))} value={null}
                onToggle={(k) => setPlan(PRESETS.find((p) => p.n === k)!.p)} />
              <Row gap={Space.md}>
                <Stepper label="달리기 (분)" value={opts.interval.workS / 60} step={0.5} min={0.5} max={30} onChange={(v) => setPlan({ workS: Math.round(v * 60) })} />
                <Stepper label="회복 (분)" value={opts.interval.restS / 60} step={0.5} min={0} max={30} onChange={(v) => setPlan({ restS: Math.round(v * 60) })} />
              </Row>
              <Row gap={Space.md}>
                <Stepper label="반복" value={opts.interval.repeats} min={1} max={30} onChange={(v) => setPlan({ repeats: v })} />
                <Stepper label="목표 페이스 /km" value={opts.interval.targetPaceS ?? 0} step={5} min={0} max={900}
                  format={(v) => (v ? fmtPace(v) : '없음')}
                  onChange={(v) => setPlan({ targetPaceS: v ? (opts.interval.targetPaceS ? v : 330) : null })} />
              </Row>
              <Row gap={Space.md}>
                <Stepper label="워밍업 (분)" value={opts.interval.warmupS / 60} min={0} max={30} onChange={(v) => setPlan({ warmupS: v * 60 })} />
                <Stepper label="쿨다운 (분)" value={opts.interval.cooldownS / 60} min={0} max={30} onChange={(v) => setPlan({ cooldownS: v * 60 })} />
              </Row>
              {/* the plan as a strip of phases, proportional to time */}
              <View style={{ flexDirection: 'row', height: 14, borderRadius: Radius.sm, overflow: 'hidden', gap: 1 }}>
                {planPhases.map((p, i) => (
                  <View key={i} style={{ flex: p.endS - p.startS, backgroundColor: phaseColor(p.kind), opacity: p.kind === 'work' ? 1 : 0.45 }} />
                ))}
              </View>
              <T v="small">총 {fmtDuration(planTotalS(planPhases))} · 구간이 바뀔 때, 달리기 절반에서, 끝나기 10초 전에 음성으로 알려줘요</T>
            </>
          ) : (
            <View style={{ gap: 6 }}>
              <T v="muted">음성 안내</T>
              <Pills options={[{ k: 'km', n: '1km마다' }, { k: '5', n: '5분마다' }, { k: '10', n: '10분마다' }]}
                value={[...(opts.kmAlert ? ['km'] : []), ...(opts.everyMin ? [String(opts.everyMin)] : [])]}
                onToggle={(k) => (k === 'km' ? setOpts({ kmAlert: !opts.kmAlert }) : setOpts({ everyMin: opts.everyMin === Number(k) ? 0 : Number(k) }))} />
            </View>
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="muted">음성 안내 {opts.voice ? '켜짐' : '꺼짐'}</T>
            <Button label={opts.voice ? '끄기' : '켜기'} kind="ghost" onPress={() => setOpts({ voice: !opts.voice })} />
          </Row>
        </Card>
      ) : null}

      {pos && run.status !== 'idle' ? (
        <View style={{ backgroundColor: pos.phase ? (pos.phase.kind === 'work' ? c.accentSoft : pos.phase.kind === 'rest' ? c.okSoft : c.restSoft) : c.okSoft, borderRadius: Radius.md, padding: Space.lg, gap: Space.sm }}>
          {pos.phase ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="title" style={{ color: phaseColor(pos.phase.kind) }}>
                  {PHASE_NAME[pos.phase.kind]}{pos.phase.kind === 'work' ? ` ${pos.phase.rep}/${phases!.filter((p) => p.kind === 'work').length}` : ''}
                </T>
                {run.plan?.targetPaceS && pos.phase.kind === 'work' ? <Chip label={`목표 ${fmtPace(run.plan.targetPaceS)}`} /> : null}
              </Row>
              <T v="big" style={{ fontSize: 56, lineHeight: 62, color: phaseColor(pos.phase.kind) }}>{fmtDuration(Math.ceil(pos.remainingS))}</T>
              <Meter pct={(pos.elapsedS / (pos.phase.endS - pos.phase.startS)) * 100} color={phaseColor(pos.phase.kind)} height={6} />
              <T v="small">{phases![pos.index + 1] ? `다음: ${PHASE_NAME[phases![pos.index + 1].kind]} ${fmtDuration(phases![pos.index + 1].endS - phases![pos.index + 1].startS)}` : '마지막 구간'}</T>
            </>
          ) : <T v="title" style={{ color: c.ok }}>인터벌 완료 · 계속 기록 중</T>}
        </View>
      ) : null}

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
          <Button label={busy ? '준비 중…' : opts.mode === 'interval' ? '인터벌 시작' : '러닝 시작'} kind="primary" disabled={busy} onPress={() => void start()} style={{ paddingVertical: 16 }} />
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
        const works = (r.phases ?? []).filter((p) => p.kind === 'work');
        return (
          <Card key={r.id} style={{ gap: Space.sm }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flexShrink: 1 }}>
                <T v="title">{fmtKm(r.distanceM)}km{r.intervalPlan ? ' · 인터벌' : ''}</T>
                <T v="small">{fmt(r.date)} · {new Date(r.startedAt).toTimeString().slice(0, 5)}–{new Date(r.endedAt).toTimeString().slice(0, 5)}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="num" style={{ fontSize: 17 }}>{fmtDuration(r.movingS)} · {fmtPace(r.paceSecPerKm)}</T>
                <T v="small">{r.kcal}kcal</T>
              </View>
            </Row>
            {expanded ? (
              <>
                {r.timeline?.length ? (
                  <View style={{ gap: 4 }}>
                    <T v="muted">시간대별 페이스{r.phases?.length ? ' · 색칠된 곳이 달리기 구간' : ''} · 점선은 평균</T>
                    <PaceTimeline run={r} />
                  </View>
                ) : null}
                {works.length ? (
                  <View>
                    <T v="muted">달리기 구간</T>
                    {works.map((p) => (
                      <Row key={p.rep} style={{ justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderColor: c.line, flexWrap: 'nowrap' }}>
                        <T v="muted">{p.rep}회 · {fmtDuration(p.durS)}</T>
                        <T>{p.distanceM}m</T>
                        <T v="num" style={{ fontSize: 15 }}>{fmtPace(p.paceS)}
                          {r.intervalPlan?.targetPaceS && p.paceS ? <T v="small"> {p.paceS - r.intervalPlan.targetPaceS > 0 ? '+' : '−'}{Math.abs(Math.round(p.paceS - r.intervalPlan.targetPaceS))}초</T> : null}
                        </T>
                      </Row>
                    ))}
                  </View>
                ) : null}
                <RouteView route={r.route} />
                {r.splits.length ? (
                  <View>
                    <T v="muted">1km 구간</T>
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
              <Button label="페이스·경로·구간 보기" kind="ghost" onPress={() => setOpen(r.id)} style={{ alignSelf: 'flex-start' }} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
