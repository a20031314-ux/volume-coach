import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ElevationChart } from '@/components/elevation-chart';
import { Disclosure, Page } from '@/components/layout';
import { PaceTimeline } from '@/components/pace-timeline';
import { RouteMap } from '@/components/route-map';
import { TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Pills, Row, Segmented, T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { fmt } from '@/lib/dates';
import { INTENSITY_NAME, cardioKcal, cardioType } from '@/lib/cardio';
import { gradeAdjustedPace } from '@/lib/elevation';
import { PHASE_NAME } from '@/lib/interval';
import { RATE_NAME, fmtDuration, fmtKm, fmtRate, type RateUnit } from '@/lib/run';
import { fmtSprint, kmh, splitSpeeds } from '@/lib/sprint';
import { presetRanges, rangeStats, type Range } from '@/lib/range';
import { momentAt, routeTimes } from '@/lib/scrub';
import { clock, runTitle } from '@/lib/timeline';
import { weatherFactor } from '@/lib/weather';
import { enrichElevation } from '@/run/elevation-fetch';
import type { Run } from '@/lib/types';
import { useData } from '@/store/store';

/** One run / walk / hike: 시작 → 시간대별 페이스 (구간) → 끝, then map and hills. */
export default function RunDetail() {
  const c = usePalette();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useData((s) => (id ? s.runs[id] : undefined));
  const removeRun = useData((s) => s.removeRun);
  const [range, setRange] = useState<Range | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const times = useMemo(() => (r ? routeTimes(r) : []), [r]);
  const moment = r && cursor != null && times.length ? momentAt(r, times, cursor) : null;
  const runOpts = useData((s) => s.settings.run);
  const update = useData((s) => s.updateSettings);
  /** rides read in km/h unless switched here; the others follow the saved unit */
  const [unitHere, setUnitHere] = useState<RateUnit | null>(null);
  const unit: RateUnit = unitHere ?? (r?.kind === 'ride' ? 'speed' : runOpts.unit ?? 'pace');
  const setUnit = (u: RateUnit) => { setUnitHere(u); if (r?.kind !== 'ride') update({ run: { ...runOpts, unit: u } }); };
  const rate = (sec: number | null) => fmtRate(sec, unit);
  /** how far off the target a work phase was: seconds per km, or km/h */
  const diff = (sec: number, tgt: number) => unit === 'speed'
    ? `${3600 / sec - 3600 / tgt >= 0 ? '+' : '−'}${Math.abs(3600 / sec - 3600 / tgt).toFixed(1)}`
    : `${sec - tgt > 0 ? '+' : '−'}${Math.abs(Math.round(sec - tgt))}초`;

  useEffect(() => {
    if (r && r.route.length > 1 && r.elev?.source !== 'dem') void enrichElevation(r);
    // only on open; enrichElevation updates the run itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!r || r.deleted) return <Page><T v="muted">기록을 찾을 수 없어요.</T></Page>;
  if (r.kind === 'other') return <CardioDetail r={r} onDelete={() => { removeRun(r.id); toast('삭제됨'); router.back(); }} />;
  const presets = presetRanges(r);
  const sel = range && r.timeline ? rangeStats(r.timeline, range) : null;
  const kind = r.kind ?? 'run';
  const phases = r.phases ?? [];
  const works = phases.filter((p) => p.kind === 'work');
  const target = r.intervalPlan?.targetPaceS ?? null;

  return (
    <Page>
      {r.sprint ? <SprintCard sprint={r.sprint} date={fmt(r.date)} /> : (
        <Card>
          <T v="small">{fmt(r.date)} · {runTitle(r)}</T>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <T v="big" style={{ fontSize: 34, lineHeight: 40 }}>{fmtKm(r.distanceM)}km</T>
            <View style={{ alignItems: 'flex-end' }}>
              <T v="num" style={{ fontSize: 18 }}>{fmtDuration(r.movingS)} · {rate(r.paceSecPerKm)}</T>
              <T v="small">{r.elev && r.elev.gainM >= 5 ? `↑${r.elev.gainM}m · ` : ''}{r.kcal}kcal</T>
            </View>
          </Row>
          {r.weather ? (
            <T v="small">
              {`기온 ${Math.round(r.weather.tempC)}° · 체감 ${Math.round(r.weather.feelsC)}° · 습도 ${r.weather.humidity}% · 바람 ${r.weather.windKmh}km/h`}
              {weatherFactor(r.weather) > 1 ? ` · 칼로리 +${Math.round((weatherFactor(r.weather) - 1) * 100)}% 반영` : ''}
            </T>
          ) : null}
        </Card>
      )}

      {r.route.length > 1 ? (
        <View style={{ gap: 6 }}>
          <RouteMap route={r.route} grades={r.elev?.pointGrade} height={240} interactive
            marker={moment ? [r.route[moment.index][0], r.route[moment.index][1]] : null}
            onPick={(i) => { const t = times[i]; setCursor(t); if (range && (t < range[0] || t > range[1])) setRange(null); }} />
          {moment ? (
            <Row style={{ justifyContent: 'space-between', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 10, flexWrap: 'nowrap' }}>
              <View style={{ flexShrink: 1 }}>
                <T v="num" style={{ fontSize: 17 }}>{fmtDuration(moment.t)} · {(moment.distanceM / 1000).toFixed(2)}km</T>
                <T v="small">{[rate(moment.speed ? 1000 / moment.speed : null), moment.altM != null ? `고도 ${moment.altM}m` : null,
                  moment.gradePct != null && Math.abs(moment.gradePct) >= 1 ? `경사 ${moment.gradePct > 0 ? '+' : ''}${moment.gradePct}%` : null].filter(Boolean).join(' · ')}</T>
              </View>
              <Button label="✕" kind="ghost" onPress={() => setCursor(null)} />
            </Row>
          ) : (
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small">지도나 그래프를 누르면 그 지점을 서로 짚어줘요</T>
              <Button label="크게 보기" kind="ghost" onPress={() => router.push({ pathname: '/run-map', params: { id: r.id } })} />
            </Row>
          )}
        </View>
      ) : null}

      <Card>
        <TlNode time={clock(r.startedAt)} title="시작" small />
        {r.timeline?.length ? (
          <TlNode title={`시간대별 ${RATE_NAME[unit]}`} sub={phases.length ? '색칠된 곳이 달리기 구간 · 점선은 평균' : '점선은 평균'} color={c.warn}>
            <Segmented options={[{ v: 'pace', n: '페이스 (분/km)' }, { v: 'speed', n: '속도 (km/h)' }]} value={unit} onChange={(v) => v && setUnit(v)} />
            <PaceTimeline run={r} unit={unit} range={range} onSelect={setRange} cursor={cursor} onCursor={setCursor} />
            <Pills options={[{ k: 'all', n: '전체' }, ...presets.map((p) => ({ k: p.key, n: p.label }))]}
              value={range ? presets.find((p) => p.range[0] === range[0] && p.range[1] === range[1])?.key ?? 'custom' : 'all'}
              onToggle={(k) => setRange(k === 'all' ? null : presets.find((p) => p.key === k)?.range ?? null)} />
            {range && sel ? (
              <View style={{ backgroundColor: c.accentSoft, borderRadius: 8, padding: 10, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="small">{fmtDuration(range[0])}–{fmtDuration(range[1])} · {fmtDuration(sel.durS)}</T>
                  <T v="small">최고 {rate(sel.maxV ? 1000 / sel.maxV : null)}</T>
                </Row>
                <T v="num" style={{ fontSize: 18 }}>{sel.distanceM.toLocaleString('ko-KR')}m · {rate(sel.paceS)}</T>
              </View>
            ) : <T v="small">그래프를 옆으로 드래그하면 그 구간만 크게 봐요</T>}
          </TlNode>
        ) : null}
        {phases.map((p, i) => (
          <TlNode key={i} small title={`${PHASE_NAME[p.kind]}${p.kind === 'work' ? ` ${p.rep}` : ''} · ${fmtDuration(p.durS)}`}
            color={p.kind === 'work' ? c.accent : c.ok}
            right={<T v="num" style={{ fontSize: 15 }}>{p.distanceM}m · {rate(p.paceS)}
              {p.kind === 'work' && target && p.paceS ? <T v="small"> {diff(p.paceS, target)}</T> : null}
            </T>} />
        ))}
        {!phases.length && r.splits.length ? r.splits.map((sp) => (
          <TlNode key={sp.km} small title={`${sp.km}km`} color={c.warn} right={<T v="num" style={{ fontSize: 15 }}>{rate(sp.seconds)}</T>} />
        )) : null}
        <TlNode time={clock(r.endedAt)} title="끝" small last />
      </Card>

      {works.length && r.splits.length ? (
        <Disclosure title="1km 구간" meta={`${r.splits.length}개`}>
          {r.splits.map((sp) => (
            <Row key={sp.km} style={{ justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderColor: c.line }}>
              <T v="muted">{sp.km}km</T><T v="num" style={{ fontSize: 15 }}>{rate(sp.seconds)}</T>
            </Row>
          ))}
        </Disclosure>
      ) : null}


      {r.elev ? (
        <Card style={{ gap: 4 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="muted">고도{r.elev.source === 'gps' ? ' · GPS' : ''}</T>
            <T v="num" style={{ fontSize: 15 }}>↑{r.elev.gainM}m ↓{r.elev.lossM}m · 최고 {r.elev.maxM}m</T>
          </Row>
          <ElevationChart elev={r.elev} />
          {kind === 'run' && r.elev.gainM >= 10 ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="muted">경사 보정 {RATE_NAME[unit]}</T>
              <T v="num" style={{ fontSize: 15 }}>{rate(gradeAdjustedPace(r.movingS, r.elev))}</T>
            </Row>
          ) : null}
          {r.elev.climbs.map((cl, i) => (
            <Row key={i} style={{ justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderColor: c.line, flexWrap: 'nowrap' }}>
              <T v="muted">오르막 {(cl.startM / 1000).toFixed(1)}km</T>
              <T>{cl.lengthM}m · +{cl.gainM}m</T>
              <T v="num" style={{ fontSize: 15, color: cl.gradePct >= 8 ? c.bad : c.warn }}>{cl.gradePct}%</T>
            </Row>
          ))}
          {r.elev.source === 'dem' ? <T v="small">고도 데이터: Copernicus DEM · Open-Meteo</T> : null}
        </Card>
      ) : null}

      <ConfirmButton label="이 기록 삭제" onConfirm={() => { removeRun(r.id); toast('삭제됨'); router.back(); }} />
    </Page>
  );
}

/** Time-based cardio: no route or pace, just when, how long, how hard and what it cost. */
function CardioDetail({ r, onDelete }: { r: Run; onDelete: () => void }) {
  const c = usePalette();
  const weight = useData((s) => s.settings.profile.weight) ?? 70;
  const type = cardioType(r.activity);
  const min = Math.round(r.movingS / 60);
  const estimated = r.intensity ? cardioKcal(type.key, r.intensity, r.movingS / 60, weight) : null;
  const fromMachine = estimated != null && Math.abs(estimated - r.kcal) > 1;
  return (
    <Page>
      <Card>
        <T v="small">{fmt(r.date)} · {clock(r.startedAt)}–{clock(r.endedAt)}{r.manual ? ' · 직접 입력' : ''}</T>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <T v="big" style={{ fontSize: 30, lineHeight: 36, flexShrink: 1 }}>{type.name}</T>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="num" style={{ fontSize: 18 }}>{min}분{r.distanceM ? ` · ${fmtKm(r.distanceM)}km` : ''}</T>
            <T v="small">{r.kcal}kcal{fromMachine ? ' · 기계 값' : ''}</T>
          </View>
        </Row>
      </Card>
      <Card style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}><T v="muted">강도</T><T>{r.intensity ? INTENSITY_NAME[r.intensity] : '–'}</T></Row>
        {fromMachine && estimated != null ? (
          <Row style={{ justifyContent: 'space-between' }}><T v="muted">시간·강도로 계산하면</T><T>{estimated}kcal</T></Row>
        ) : null}
        {r.legKmEq ? (
          <Row style={{ justifyContent: 'space-between' }}><T v="muted">다리 부담</T><T>러닝 {r.legKmEq.toFixed(1)}km 정도</T></Row>
        ) : null}
        <T v="small" style={{ color: c.muted }}>칼로리는 운동 강도표(MET) × 체중 × 시간으로 계산해요. 실제와 ±20% 정도 차이가 날 수 있어요.</T>
      </Card>
      <ConfirmButton label="이 기록 삭제" onConfirm={onDelete} />
    </Page>
  );
}

/** Sprint result: the time, top speed, and how fast each stretch went. */
function SprintCard({ sprint, date }: { sprint: NonNullable<Run['sprint']>; date: string }) {
  const c = usePalette();
  const parts = splitSpeeds(sprint.splits);
  const top = Math.max(0.1, ...parts.map((p) => p.v));
  return (
    <Card>
      <T v="small">{date} · 스프린트 {sprint.targetM}m</T>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <T v="big" style={{ fontSize: 40, lineHeight: 46 }}>{fmtSprint(sprint.timeS)}</T>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="num" style={{ fontSize: 18 }}>최고 {kmh(sprint.topV)}</T>
          <T v="small">{sprint.topAtM}m 지점</T>
        </View>
      </Row>
      <View style={{ gap: 6 }}>
        {parts.map((p) => (
          <Row key={p.to} style={{ flexWrap: 'nowrap', gap: 10 }}>
            <T v="small" style={{ width: 72, fontVariant: ['tabular-nums'] }}>{p.from}–{p.to}m</T>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.restSoft, overflow: 'hidden' }}>
              <View style={{ width: `${(p.v / top) * 100}%`, height: 8, borderRadius: 4, backgroundColor: p.v === top ? c.accent : c.band }} />
            </View>
            <T v="small" style={{ width: 92, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{p.s.toFixed(2)}초 · {(p.v * 3.6).toFixed(0)}</T>
          </Row>
        ))}
      </View>
      <T v="small">GPS 속도로 잰 기록이라 실제와 0.5초 안팎 차이 날 수 있어요{sprint.accM != null ? ` · 출발 때 GPS ±${sprint.accM}m` : ''}</T>
    </Card>
  );
}
