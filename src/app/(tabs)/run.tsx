import { router, useFocusEffect } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { Disclosure, Sheet } from '@/components/layout';
import { LiveSpeedChart } from '@/components/live-speed';
import { CardioPanel } from '@/components/cardio-panel';
import { RouteMap } from '@/components/route-map';
import { TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { Banner, Button, Card, Chip, ConfirmButton, Meter, Pills, Row, Screen, Segmented, Stepper, T } from '@/components/ui';
import { Radius, Space, usePalette } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { INTENSITY_NAME } from '@/lib/cardio';
import { fmt } from '@/lib/dates';
import { runTitle } from '@/lib/timeline';
import { PHASE_NAME, buildPhases, phaseAt, planTotalS, type PhaseKind } from '@/lib/interval';
import { paceStatus, targetBand } from '@/lib/live';
import { body } from '@/lib/profile';
import { KIND_NAME, activityKcal, type ActivityKind, type RoutePoint } from '@/lib/elevation';
import { RATE_NAME, fmtDuration, fmtKm, fmtPace, fmtRate } from '@/lib/run';
import { SPRINT_DISTANCES, fmtSprint, kmh, sprintProgress } from '@/lib/sprint';
import { smoothSpeed } from '@/lib/interval';
import type { IntervalPlanData, RunOptions } from '@/lib/types';
import {
  coolGps, discardRun, dismissSaved, elapsedS, finishRun, isTrackingAvailable, livePace, openSettings, pauseRun, phasesOf, reconcileRun,
  prepareRun, resumeRun, targetNow, sayCount, startRun, tickCues, useRun, warmGps, type StartResult,
} from '@/run/tracker';
import { live, useData } from '@/store/store';

const KINDS: { k: ActivityKind; n: string }[] = [
  { k: 'run', n: '러닝' }, { k: 'walk', n: '걷기' }, { k: 'hike', n: '등산' }, { k: 'ride', n: '자전거' }, { k: 'other', n: '실내·기타 유산소' },
];

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
  const settings = useData((s) => s.settings);
  const update = useData((s) => s.updateSettings);
  const bodyT = useData((s) => s.bodyComps);
  const [now, setNow] = useState(() => Date.now());
  const today = useNow();
  const [problem, setProblem] = useState<Extract<StartResult, { ok: false }> | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(true);
  /** leaving the screen while getting set for a sprint calls it off */
  const onLeave = useRef<() => void>(() => undefined);
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); onLeave.current(); }; }, []));
  /** seconds left before recording starts; null when not counting */
  const [count, setCount] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [voiceSheet, setVoiceSheet] = useState(false);
  /** sprint: GPS is on, waiting for a good fix before the countdown */
  const [gpsWait, setGpsWait] = useState(false);
  const opts = settings.run;
  const setOpts = (patch: Partial<RunOptions>) => update({ run: { ...opts, ...patch } });
  const setPlan = (patch: Partial<IntervalPlanData>) => setOpts({ interval: { ...opts.interval, ...patch } });

  useEffect(() => {
    void isTrackingAvailable().then(setAvailable);
    void reconcileRun();
  }, []);
  const sprinting = run.status === 'running' && !!run.sprintM;
  useEffect(() => {
    if (run.status === 'idle' && !gpsWait) return;
    // a sprint clock shows tenths
    const t = setInterval(() => { setNow(Date.now()); tickCues(); }, sprinting ? 100 : 1000);
    return () => clearInterval(t);
  }, [run.status, gpsWait, sprinting]);

  const runs = useMemo(() => live(runsT).sort((a, b) => b.startedAt - a.startedAt), [runsT]);
  const weekKm = useMemo(() => {
    const since = today.getTime() - 7 * 864e5;
    return runs.filter((r) => r.startedAt >= since && ['run', 'walk', 'hike'].includes(r.kind ?? 'run')).reduce((a, r) => a + r.distanceM, 0) / 1000;
  }, [runs, today]);
  const weight = body(settings.profile, live(bodyT))?.weight ?? 70;

  const secs = elapsedS(run, now);
  const avg = run.distanceM >= 50 ? secs / (run.distanceM / 1000) : null;
  const curPace = livePace(run, now);
  const liveWindow = opts.liveWindowS ?? 60;
  const liveTarget = run.status !== 'idle' ? targetNow(run, secs) : null;
  const liveStatus = paceStatus(curPace ? 1000 / curPace : null, liveTarget ? targetBand(liveTarget) : null);
  const liveColor = liveStatus === 'slow' ? c.bad : liveStatus === 'fast' ? c.warn : liveStatus === 'ok' ? c.ok : c.ink;
  const keepAwake = run.status === 'running' && (opts.keepAwake ?? true) && focused;
  useEffect(() => {
    if (!keepAwake || Platform.OS === 'web') return;
    void activateKeepAwakeAsync('run');
    return () => { void deactivateKeepAwake('run'); };
  }, [keepAwake]);
  const gpsAge = run.lastFixAt ? (now - run.lastFixAt) / 1000 : null;
  const gpsWeak = run.status === 'running' && (gpsAge == null || gpsAge > 15 || (run.lastAccuracy ?? 0) > 35);
  const phases = phasesOf(run);
  const pos = phases ? phaseAt(phases, secs) : null;
  const planPhases = useMemo(() => buildPhases(opts.interval), [opts.interval]);

  const act = async (fn: () => Promise<StartResult>) => {
    setBusy(true); setProblem(null);
    try { const r = await fn(); if (!r.ok) setProblem(r); } finally { setBusy(false); }
  };
  const kind: ActivityKind = opts.kind ?? 'run';
  const interval = kind === 'run' && opts.mode === 'interval';
  const sprint = kind === 'run' && opts.mode === 'sprint';
  const sprintM = opts.sprintM ?? 100;
  /** rides read in km/h; everything else follows the chosen unit */
  const unit = (run.status !== 'idle' ? run.kind : kind) === 'ride' ? 'speed' as const : opts.unit ?? 'pace';
  const runUnit = (k?: ActivityKind) => (k === 'ride' ? 'speed' as const : opts.unit ?? 'pace');
  const best = useMemo(() => {
    const out: Record<number, number> = {};
    for (const r of runs) if (r.sprint) out[r.sprint.targetM] = Math.min(out[r.sprint.targetM] ?? Infinity, r.sprint.timeS);
    return out;
  }, [runs]);
  const begin = () => act(() => startRun({
    kind,
    plan: interval ? opts.interval : null,
    voice: opts.voice,
    kmAlert: interval || sprint ? false : opts.kmAlert,
    everyMin: interval || sprint ? 0 : opts.everyMin,
    unit: unit,
    targetPaceS: interval || sprint ? null : opts.targetPaceS ?? null,
    paceAlert: sprint ? false : opts.paceAlert ?? true,
    sprintM: sprint ? sprintM : null,
  }));
  const countdown = opts.countdown ?? 3;
  const start = async () => {
    setBusy(true); setProblem(null); setGranted(false);
    let r: Awaited<ReturnType<typeof prepareRun>>;
    try { r = await prepareRun(); } finally { setBusy(false); }
    if (!r.ok) { setProblem(r); return; }
    // permission was just granted: stop here so the run starts only when the user is ready
    if (r.asked) { setGranted(true); return; }
    dismissSaved();
    if (sprint) {
      const w = await warmGps(kind);
      if (!w.ok) { setProblem(w); return; }
      setGpsWait(true);
      return;
    }
    go();
  };
  const go = () => {
    if (countdown > 0) { setCount(countdown); if (opts.voice) sayCount(countdown); }
    else void begin();
  };
  const cancel = () => {
    setCount(null); setGpsWait(false);
    if (sprint) void coolGps();
  };
  useEffect(() => {
    onLeave.current = () => { if (gpsWait || count != null) cancel(); };
  });
  // start the countdown as soon as the fix is good enough
  useEffect(() => {
    if (!gpsWait) return;
    return useRun.subscribe((st) => {
      const ok = st.lastAccuracy != null && st.lastAccuracy <= 8 && st.lastFixAt != null && Date.now() - st.lastFixAt < 3000;
      if (ok) { setGpsWait(false); go(); }
    });
    // go is recreated every render; this only reacts to fixes arriving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsWait]);
  const spr = run.sprintM ? sprintProgress(run.speeds, run.sprintM) : null;
  const sprintClock = run.status === 'running' ? Math.max(0, (now - run.startedAt) / 1000) : 0;
  const sprintV = run.sprintM ? smoothSpeed(run.speeds, secs, 2) : null;
  const saved = run.status === 'idle' && run.justSaved ? runsT[run.justSaved] : undefined;
  useEffect(() => {
    if (count == null) return;
    const t = setTimeout(() => {
      const n = count - 1;
      if (n <= 0) { setCount(null); void begin(); return; }
      if (opts.voice) sayCount(n);
      setCount(n);
    }, 1000);
    return () => clearTimeout(t);
    // begin is recreated every render; the countdown only depends on the number
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  const liveRoute = useMemo<RoutePoint[]>(() => run.points.map((p) => [p.lat, p.lng, p.seg]), [run.points]);
  const phaseColor = (k: PhaseKind) => (k === 'work' ? c.accent : k === 'rest' ? c.ok : c.rest);

  return (
    <Screen title="유산소" sub={`최근 7일 ${weekKm.toFixed(1)}km`}>
      {available === false ? <Banner text="GPS 기록은 설치한 앱에서만 쓸 수 있어요." /> : null}

      {saved?.sprint ? (
        <Card style={{ gap: Space.sm, backgroundColor: c.accentSoft, borderColor: c.accentSoft }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="small">{saved.sprint.targetM}m 스프린트{best[saved.sprint.targetM] === saved.sprint.timeS ? ' · 최고 기록' : ''}</T>
            <Button label="✕" kind="ghost" onPress={dismissSaved} />
          </Row>
          <T v="big" style={{ fontSize: 48, lineHeight: 54, color: c.accent }}>{fmtSprint(saved.sprint.timeS)}</T>
          <T v="small">최고 {kmh(saved.sprint.topV)} · {saved.sprint.topAtM}m 지점</T>
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button label="자세히" onPress={() => router.push({ pathname: '/activity/run', params: { id: saved.id } })} style={{ flex: 1 }} />
            <Button label="한 번 더" kind="primary" disabled={busy} onPress={() => void start()} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : null}

      {run.status === 'idle' ? (
        <Card style={{ gap: Space.lg }}>
          <Pills options={KINDS} value={kind} onToggle={(k) => setOpts({ kind: k })} />
          {kind === 'other' ? <CardioPanel weightKg={weight} /> : (<>
          {kind === 'run' ? (
            <Segmented options={[{ v: 'free', n: '자유' }, { v: 'interval', n: '인터벌' }, { v: 'sprint', n: '스프린트' }]} value={opts.mode} onChange={(v) => v && setOpts({ mode: v })} />
          ) : null}
          {interval ? (
            <View style={{ gap: Space.sm }}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <View style={{ flexShrink: 1 }}>
                  <T v="title">{fmtDuration(opts.interval.workS)} / {fmtDuration(opts.interval.restS)} × {opts.interval.repeats}</T>
                  <T v="small">총 {fmtDuration(planTotalS(planPhases))}{opts.interval.targetPaceS ? ` · 목표 ${fmtRate(opts.interval.targetPaceS, unit)}` : ''}</T>
                </View>
                <Button label="편집" kind="ghost" onPress={() => setEditing(true)} />
              </Row>
              <View style={{ flexDirection: 'row', height: 10, borderRadius: Radius.sm, overflow: 'hidden', gap: 1 }}>
                {planPhases.map((p, i) => (
                  <View key={i} style={{ flex: p.endS - p.startS, backgroundColor: phaseColor(p.kind), opacity: p.kind === 'work' ? 1 : 0.45 }} />
                ))}
              </View>
            </View>
          ) : null}
          {sprint ? (
            <View style={{ gap: Space.sm }}>
              <Segmented options={SPRINT_DISTANCES.map((m) => ({ v: String(m), n: `${m}m` }))} value={String(sprintM)}
                onChange={(v) => v && setOpts({ sprintM: Number(v) })} />
              <T v="small">{best[sprintM] ? `최고 기록 ${fmtSprint(best[sprintM])}` : '아직 기록 없음'}</T>
            </View>
          ) : null}
          {gpsWait ? (
            <View style={{ alignItems: 'center', gap: Space.md, paddingVertical: Space.md }}>
              <T v="title">GPS 맞추는 중</T>
              <T v="num" style={{ fontSize: 32, color: c.warn }}>{run.lastAccuracy != null ? `±${Math.round(run.lastAccuracy)}m` : '–'}</T>
              <T v="small" style={{ textAlign: 'center' }}>±8m 안으로 들어오면 카운트다운을 시작해요</T>
              <Row gap={Space.md}>
                <Button label="취소" onPress={cancel} style={{ minWidth: 110 }} />
                <Button label="그래도 시작" onPress={() => { setGpsWait(false); go(); }} style={{ minWidth: 110 }} />
              </Row>
            </View>
          ) : count != null ? (
            <View style={{ alignItems: 'center', gap: Space.md, paddingVertical: Space.md }}>
              <T v="big" style={{ fontSize: 72, lineHeight: 80, color: c.accent }}>{count}</T>
              <Row gap={Space.md}>
                <Button label="취소" onPress={cancel} style={{ minWidth: 110 }} />
                <Button label="바로 시작" kind="primary" onPress={() => { setCount(null); void begin(); }} style={{ minWidth: 110 }} />
              </Row>
            </View>
          ) : (
            <Button label={busy ? '준비 중…' : interval ? '인터벌 시작' : sprint ? `${sprintM}m 스프린트 준비` : `${KIND_NAME[kind]} 시작`} kind="primary" disabled={busy} onPress={() => void start()} style={{ paddingVertical: 16 }} />
          )}
          {granted && count == null ? <T v="small" style={{ textAlign: 'center' }}>위치 허용 완료. 준비되면 시작을 누르세요.</T> : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small">음성 안내 {opts.voice ? (interval ? '켜짐' : [opts.kmAlert ? '1km마다' : null, opts.everyMin ? `${opts.everyMin}분마다` : null].filter(Boolean).join(' · ') || '켜짐') : '꺼짐'}</T>
            <Button label="옵션" kind="ghost" onPress={() => setVoiceSheet(true)} />
          </Row>
          {problem ? (
            <View style={{ gap: Space.sm }}>
              <Banner text={problem.message} />
              {problem.openSettings ? <Button label="설정 열기" onPress={openSettings} style={{ alignSelf: 'flex-start' }} /> : null}
            </View>
          ) : null}
          </>)}
        </Card>
      ) : null}

      <Sheet open={editing} title="인터벌" onClose={() => setEditing(false)}>
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
      </Sheet>

      <Sheet open={voiceSheet} title="시작 옵션" onClose={() => setVoiceSheet(false)}>
        {!interval && !sprint ? (
          <>
            <T v="muted">목표 페이스</T>
            <Stepper label="분/km" value={opts.targetPaceS ?? 0} step={5} min={0} max={900}
              format={(v) => (v ? fmtPace(v) : '없음')}
              onChange={(v) => setOpts({ targetPaceS: v ? (opts.targetPaceS ? v : 330) : null })} />
          </>
        ) : null}
        <Segmented options={[{ v: 'on', n: '목표 벗어나면 알림' }, { v: 'off', n: '알림 끔' }]} value={opts.paceAlert ?? true ? 'on' : 'off'}
          onChange={(v) => v && setOpts({ paceAlert: v === 'on' })} />
        <Segmented options={[{ v: 'on', n: '기록 중 화면 켜두기' }, { v: 'off', n: '자동 꺼짐' }]} value={opts.keepAwake ?? true ? 'on' : 'off'}
          onChange={(v) => v && setOpts({ keepAwake: v === 'on' })} />
        <T v="muted">표시 단위</T>
        <Segmented options={[{ v: 'pace', n: '페이스 (분/km)' }, { v: 'speed', n: '속도 (km/h)' }]} value={unit}
          onChange={(v) => v && setOpts({ unit: v })} />
        <T v="muted">카운트다운</T>
        <Segmented options={[{ v: '0', n: '없음' }, { v: '3', n: '3초' }, { v: '5', n: '5초' }, { v: '10', n: '10초' }]} value={String(countdown)}
          onChange={(v) => v && setOpts({ countdown: Number(v) })} />
        <T v="muted">음성 안내</T>
        <Segmented options={[{ v: 'on', n: '켜기' }, { v: 'off', n: '끄기' }]} value={opts.voice ? 'on' : 'off'} onChange={(v) => v && setOpts({ voice: v === 'on' })} />
        {opts.voice && !interval ? (
          <Pills options={[{ k: 'km', n: '1km마다' }, { k: '5', n: '5분마다' }, { k: '10', n: '10분마다' }]}
            value={[...(opts.kmAlert ? ['km'] : []), ...(opts.everyMin ? [String(opts.everyMin)] : [])]}
            onToggle={(k) => (k === 'km' ? setOpts({ kmAlert: !opts.kmAlert }) : setOpts({ everyMin: opts.everyMin === Number(k) ? 0 : Number(k) }))} />
        ) : null}
      </Sheet>

      {pos && run.status !== 'idle' ? (
        <View style={{ backgroundColor: pos.phase ? (pos.phase.kind === 'work' ? c.accentSoft : pos.phase.kind === 'rest' ? c.okSoft : c.restSoft) : c.okSoft, borderRadius: Radius.md, padding: Space.lg, gap: Space.sm }}>
          {pos.phase ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="title" style={{ color: phaseColor(pos.phase.kind) }}>
                  {PHASE_NAME[pos.phase.kind]}{pos.phase.kind === 'work' ? ` ${pos.phase.rep}/${phases!.filter((p) => p.kind === 'work').length}` : ''}
                </T>
                {run.plan?.targetPaceS && pos.phase.kind === 'work' ? <Chip label={`목표 ${fmtRate(run.plan.targetPaceS, unit)}`} /> : null}
              </Row>
              <T v="big" style={{ fontSize: 56, lineHeight: 62, color: phaseColor(pos.phase.kind) }}>{fmtDuration(Math.ceil(pos.remainingS))}</T>
              <Meter pct={(pos.elapsedS / (pos.phase.endS - pos.phase.startS)) * 100} color={phaseColor(pos.phase.kind)} height={6} />
              <T v="small">{phases![pos.index + 1] ? `다음: ${PHASE_NAME[phases![pos.index + 1].kind]} ${fmtDuration(phases![pos.index + 1].endS - phases![pos.index + 1].startS)}` : '마지막 구간'}</T>
            </>
          ) : <T v="title" style={{ color: c.ok }}>인터벌 완료 · 계속 기록 중</T>}
        </View>
      ) : null}

      {run.sprintM && run.status !== 'idle' && spr ? (
        <Card style={{ gap: Space.lg }}>
          <View style={{ alignItems: 'center', gap: 2 }}>
            <T v="big" style={{ fontSize: 72, lineHeight: 80, fontVariant: ['tabular-nums'] }}>{sprintClock.toFixed(1)}</T>
            <T v="muted">초</T>
          </View>
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="num" style={{ fontSize: 20 }}>{Math.min(run.sprintM, Math.floor(spr.distanceM))} / {run.sprintM}m</T>
              <T v="small">지금 {sprintV != null ? kmh(sprintV) : '–'} · 최고 {kmh(spr.topV)}</T>
            </Row>
            <Meter pct={(spr.distanceM / run.sprintM) * 100} color={c.accent} height={10} />
          </View>
          {gpsWeak ? <T v="small" style={{ textAlign: 'center', color: c.warn }}>GPS 신호가 약해요. 기록이 부정확할 수 있어요.</T> : null}
          <ConfirmButton label="중단" confirmLabel="기록 버리고 중단" onConfirm={() => { void discardRun(); toast('스프린트를 중단했어요'); }} style={{ alignSelf: 'center' }} />
        </Card>
      ) : null}

      {run.status === 'running' && !run.sprintM ? (
        <Card style={{ gap: Space.sm }}>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <View>
              <T v="num" style={{ fontSize: 40, lineHeight: 46, color: liveColor }}>{fmtRate(curPace, unit)}</T>
              <T v="small">{liveStatus === 'slow' ? '목표보다 느려요' : liveStatus === 'fast' ? '목표보다 빨라요' : liveStatus === 'ok' ? '목표 페이스' : `현재 ${RATE_NAME[unit]}`}
                {liveTarget ? ` · 목표 ${fmtRate(liveTarget, unit)}` : ''}</T>
            </View>
            <Segmented options={[{ v: '60', n: '1분' }, { v: '180', n: '3분' }, { v: '300', n: '5분' }]} value={String(liveWindow)}
              onChange={(v) => v && setOpts({ liveWindowS: Number(v) })} />
          </Row>
          <LiveSpeedChart samples={run.speeds} nowS={secs} windowS={liveWindow} targetPaceS={liveTarget} unit={unit} />
        </Card>
      ) : null}

      {run.status !== 'idle' && !run.sprintM ? (
      <Card style={{ gap: Space.lg }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T v="big" style={{ fontSize: 64, lineHeight: 70 }}>{fmtKm(run.distanceM)}</T>
          <T v="muted">킬로미터</T>
        </View>
        <Row style={{ justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtDuration(secs)}</T><T v="small">시간</T></View>
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtRate(avg, unit)}</T><T v="small">평균 {RATE_NAME[unit]}</T></View>
          {run.status !== 'running' ? <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{fmtRate(curPace, unit)}</T><T v="small">현재 {RATE_NAME[unit]}</T></View> : null}
          <View style={{ alignItems: 'center' }}><T v="num" style={{ fontSize: 24 }}>{activityKcal(run.kind ?? 'run', run.distanceM, weight, null, secs)}</T><T v="small">kcal</T></View>
        </Row>
        {run.status === 'paused' ? <T v="muted" style={{ textAlign: 'center' }}>일시정지 중 · 이 동안의 거리와 시간은 빼고 계산해요</T> : null}
        {gpsWeak ? <T v="small" style={{ textAlign: 'center', color: c.warn }}>GPS 신호를 찾는 중이에요. 하늘이 트인 곳에서 더 정확해요.</T> : null}

        {(
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
        <ConfirmButton label="기록 버리기" confirmLabel="정말 버리기" onConfirm={() => { void discardRun(); toast('기록을 버렸어요'); }} style={{ alignSelf: 'center' }} />
        {problem ? <Banner text={problem.message} /> : null}
      </Card>
      ) : null}

      {run.status !== 'idle' && !run.sprintM ? (
        <Disclosure title="지도">
          <RouteMap route={liveRoute} height={260} follow />
        </Disclosure>
      ) : null}


      <T v="label">기록</T>
      {!runs.length ? <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>아직 기록이 없어요.</T> : null}
      {runs.length ? (
        <View>
          {runs.slice(0, 10).map((r, i, arr) => (
            <TlNode key={r.id} time={fmt(r.date).replace(/\s*\(.*\)/, '')} color={['run', 'ride', 'other'].includes(r.kind ?? 'run') ? c.warn : c.ok}
              title={r.sprint ? `스프린트 ${r.sprint.targetM}m · ${fmtSprint(r.sprint.timeS)}` : r.kind === 'other' ? `${runTitle(r)} · ${Math.round(r.movingS / 60)}분` : `${runTitle(r)} · ${fmtKm(r.distanceM)}km`}
              sub={r.sprint ? `최고 ${kmh(r.sprint.topV)}${best[r.sprint.targetM] === r.sprint.timeS ? ' · 최고 기록' : ''}`
                : r.kind === 'other' ? [r.intensity ? INTENSITY_NAME[r.intensity] : null, `${r.kcal}kcal`, r.manual ? '직접 입력' : null].filter(Boolean).join(' · ')
                : [fmtDuration(r.movingS), fmtRate(r.paceSecPerKm, runUnit(r.kind)), r.elev && r.elev.gainM >= 5 ? `↑${r.elev.gainM}m` : null].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/activity/run', params: { id: r.id } })} last={i === arr.length - 1} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
