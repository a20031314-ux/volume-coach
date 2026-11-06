import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { ElevationChart } from '@/components/elevation-chart';
import { Disclosure, Page } from '@/components/layout';
import { PaceTimeline } from '@/components/pace-timeline';
import { RouteMap } from '@/components/route-map';
import { TlNode } from '@/components/timeline';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, Row, Segmented, T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { fmt } from '@/lib/dates';
import { KIND_NAME, gradeAdjustedPace } from '@/lib/elevation';
import { PHASE_NAME } from '@/lib/interval';
import { RATE_NAME, fmtDuration, fmtKm, fmtRate, type RateUnit } from '@/lib/run';
import { clock } from '@/lib/timeline';
import { weatherFactor } from '@/lib/weather';
import { enrichElevation } from '@/run/elevation-fetch';
import { useData } from '@/store/store';

/** One run / walk / hike: 시작 → 시간대별 페이스 (구간) → 끝, then map and hills. */
export default function RunDetail() {
  const c = usePalette();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useData((s) => (id ? s.runs[id] : undefined));
  const removeRun = useData((s) => s.removeRun);
  const runOpts = useData((s) => s.settings.run);
  const update = useData((s) => s.updateSettings);
  const unit: RateUnit = runOpts.unit ?? 'pace';
  const setUnit = (u: RateUnit) => update({ run: { ...runOpts, unit: u } });
  const rate = (sec: number | null) => fmtRate(sec, unit);
  /** how far off the target a work phase was: seconds per km, or km/h */
  const diff = (sec: number, tgt: number) => unit === 'speed'
    ? `${3600 / sec - 3600 / tgt >= 0 ? '+' : '−'}${Math.abs(3600 / sec - 3600 / tgt).toFixed(1)}`
    : `${sec - tgt > 0 ? '+' : '−'}${Math.abs(Math.round(sec - tgt))}초`;

  useEffect(() => {
    if (r && r.elev?.source !== 'dem') void enrichElevation(r);
    // only on open; enrichElevation updates the run itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!r || r.deleted) return <Page><T v="muted">기록을 찾을 수 없어요.</T></Page>;
  const kind = r.kind ?? 'run';
  const phases = r.phases ?? [];
  const works = phases.filter((p) => p.kind === 'work');
  const target = r.intervalPlan?.targetPaceS ?? null;

  return (
    <Page>
      <Card>
        <T v="small">{fmt(r.date)} · {KIND_NAME[kind]}{r.intervalPlan ? ' · 인터벌' : ''}</T>
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

      <Card>
        <TlNode time={clock(r.startedAt)} title="시작" small />
        {r.timeline?.length ? (
          <TlNode title={`시간대별 ${RATE_NAME[unit]}`} sub={phases.length ? '색칠된 곳이 달리기 구간 · 점선은 평균' : '점선은 평균'} color={c.warn}>
            <Segmented options={[{ v: 'pace', n: '페이스 (분/km)' }, { v: 'speed', n: '속도 (km/h)' }]} value={unit} onChange={(v) => v && setUnit(v)} />
            <PaceTimeline run={r} unit={unit} />
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

      {r.route.length > 1 ? (
        <View style={{ gap: 4 }}>
          <RouteMap route={r.route} grades={r.elev?.pointGrade} height={240} />
          <Button label="지도 크게 보기" kind="ghost" onPress={() => router.push({ pathname: '/run-map', params: { id: r.id } })} style={{ alignSelf: 'flex-start' }} />
        </View>
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
