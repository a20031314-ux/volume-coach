/**
 * 페이스메이커 UI: 고르는 시트(직접 설계 / 지난 기록), 달리는 중 트랙(나 vs 페이스메이커), 기록 상세 결과.
 */
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Sheet } from '@/components/layout';
import { Card, Pills, Row, Segmented, Stepper, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import {
  bestAround, fmtKmShort, gapNow, ghostCandidates, planLegs, STRATEGY_NAME, STRATEGY_NOTE,
  type Pacer, type PacerChoice, type PacerResult, type PacerStrategy,
} from '@/lib/pacer';
import { fmtDuration, fmtPace } from '@/lib/run';
import type { Run } from '@/lib/types';

const DISTANCES = [3000, 5000, 10000, 21097.5, 42195];
const DIST_NAME: Record<number, string> = { 3000: '3km', 5000: '5km', 10000: '10km', 21097.5: '하프', 42195: '풀' };
const pct = (x: number) => `${Math.max(0, Math.min(100, x * 100))}%` as const;
const fmtT = (s: number) => fmtDuration(Math.round(s));
const date = (ms: number) => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };

export function pacerSummary(p: PacerChoice | null | undefined, runs: Record<string, Run>): string {
  if (!p) return '없음';
  if (p.kind === 'plan') return `${fmtKmShort(p.distanceM)} ${fmtT(p.targetS)} · ${STRATEGY_NAME[p.strategy]}`;
  const r = runs[p.runId];
  return r ? `지난 기록 ${date(r.startedAt)} ${fmtKmShort(r.distanceM)} ${fmtT(r.movingS)}` : '없음';
}

/** stretches of the plan as a bar: width by distance, pace written in */
function LegsBar({ distanceM, targetS, strategy }: { distanceM: number; targetS: number; strategy: PacerStrategy }) {
  const c = usePalette();
  const legs = planLegs(distanceM, targetS, strategy);
  const avg = targetS / (distanceM / 1000);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {legs.map((l, i) => (
          <View key={i} style={{ flex: l.toM - l.fromM, height: 30, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
            backgroundColor: l.paceS > avg + 1 ? c.band : l.paceS < avg - 1 ? c.accent : c.accentSoft }}>
            <T numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: l.paceS < avg - 1 ? c.accentInk : c.accent }}>{fmtPace(l.paceS)}</T>
          </View>
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small">0</T>
        {legs.length > 1 ? <T v="small">{fmtKmShort(legs[0].toM)}</T> : null}
        <T v="small">{fmtKmShort(distanceM)}</T>
      </Row>
    </View>
  );
}

export function PacerSheet({ open, onClose, value, onChange, runs }: {
  open: boolean; onClose: () => void; value: PacerChoice | null | undefined; onChange: (p: PacerChoice | null) => void; runs: Run[];
}) {
  const c = usePalette();
  const mode = value?.kind ?? 'off';
  const plan = value?.kind === 'plan' ? value : null;
  const cands = useMemo(() => ghostCandidates(runs).slice(0, 12), [runs]);
  const lastRun = cands[0];
  const toPlan = (patch: Partial<Extract<PacerChoice, { kind: 'plan' }>> = {}) => {
    const base = plan ?? { kind: 'plan' as const, distanceM: 5000, targetS: lastRun ? Math.round((lastRun.movingS / lastRun.distanceM) * 5000 / 15) * 15 : 1800, strategy: 'even' as const };
    const next = { ...base, ...patch };
    // keep the pace when the distance changes
    if (patch.distanceM && !patch.targetS) next.targetS = Math.round(((base.targetS / base.distanceM) * patch.distanceM) / 15) * 15;
    onChange(next);
  };
  return (
    <Sheet open={open} title="페이스메이커" onClose={onClose}>
      <Segmented options={[{ v: 'off', n: '없음' }, { v: 'plan', n: '직접 설계' }, { v: 'ghost', n: '지난 기록' }]} value={mode}
        onChange={(v) => {
          if (v === 'off') onChange(null);
          else if (v === 'plan') toPlan();
          else if (v === 'ghost' && lastRun) onChange({ kind: 'ghost', runId: lastRun.id });
        }} />
      {mode === 'off' ? <T v="small">가상의 러너와 같이 달려요. 순간 속도가 아니라 지금까지 달린 거리로 몇 m·몇 초 앞섰는지 알려줘요.</T> : null}

      {plan ? (<>
        <T v="muted">거리</T>
        <Pills options={DISTANCES.map((d) => ({ k: String(d), n: DIST_NAME[d] }))} value={DISTANCES.includes(plan.distanceM) ? String(plan.distanceM) : null}
          onToggle={(k) => toPlan({ distanceM: Number(k) })} />
        <Row gap={Space.md}>
          <Stepper label="거리 km" value={Math.round(plan.distanceM / 100) / 10} step={0.5} min={1} max={50} format={(v) => `${v}`}
            onChange={(v) => toPlan({ distanceM: Math.round(v * 1000) })} />
          <Stepper label="목표 기록" value={plan.targetS} step={plan.distanceM > 15000 ? 60 : 15} min={Math.round(plan.distanceM * 0.15)} max={Math.round(plan.distanceM * 1.2)} format={fmtT}
            onChange={(targetS) => toPlan({ targetS })} />
        </Row>
        <T>평균 <T style={{ fontWeight: '800' }}>{fmtPace(plan.targetS / (plan.distanceM / 1000))}</T>/km
          {lastRun ? <T v="small">  · 최근 {fmtPace(lastRun.movingS / (lastRun.distanceM / 1000))}/km</T> : null}</T>
        <T v="muted">구간 전략</T>
        <Segmented options={(['even', 'negative', 'easyStart'] as const).map((s) => ({ v: s, n: STRATEGY_NAME[s] }))} value={plan.strategy}
          onChange={(v) => v && toPlan({ strategy: v })} />
        <T v="small">{STRATEGY_NOTE[plan.strategy]}</T>
        <LegsBar distanceM={plan.distanceM} targetS={plan.targetS} strategy={plan.strategy} />
        <T v="small">달리는 중엔 지금 구간의 페이스가 목표 띠로 그래프에 보여요. 1km마다 “페이스메이커보다 n초 앞서요”, 10초 이상 뒤처지면 알려줘요.</T>
      </>) : null}

      {mode === 'ghost' ? (
        cands.length ? (
          <View style={{ gap: 6 }}>
            <T v="small">그날 실제로 달린 그대로(빨라지고 느려진 것까지) 같이 달려요.</T>
            {cands.map((r) => {
              const sel = value?.kind === 'ghost' && value.runId === r.id;
              const best = bestAround(runs, r.distanceM)?.id === r.id;
              return (
                <Pressable key={r.id} accessibilityRole="radio" accessibilityState={{ checked: sel }} onPress={() => onChange({ kind: 'ghost', runId: r.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, padding: Space.sm, borderRadius: 10, borderWidth: sel ? 2 : 1, borderColor: sel ? c.accent : c.line, backgroundColor: sel ? c.accentSoft : c.surface }}>
                  <T style={{ width: 44, fontWeight: '700' }}>{date(r.startedAt)}</T>
                  <T style={{ flex: 1 }}>{fmtKmShort(r.distanceM)} · {fmtT(r.movingS)}</T>
                  <T v="small">{fmtPace(r.movingS / (r.distanceM / 1000))}/km</T>
                  {best ? <T style={{ fontSize: 11, fontWeight: '800', color: c.warn }}>최고</T> : null}
                </Pressable>
              );
            })}
          </View>
        ) : <T v="small">1km 넘게 달린 러닝 기록이 생기면 고를 수 있어요.</T>
      ) : null}
    </Sheet>
  );
}

/** 달리는 중: 가로 트랙 위 페이스메이커(회색)와 나(파랑) */
export function PacerTrack({ pacer, t, myM, reachedS }: { pacer: Pacer; t: number; myM: number; reachedS: number | null }) {
  const c = usePalette();
  const g = gapNow(pacer, t, myM);
  const pm = g?.pacerM ?? Math.min(pacer.distanceM, (pacer.distanceM * t) / pacer.targetS);
  const end = Math.max(pacer.distanceM, myM);
  const ahead = g ? g.s >= 0 : true;
  const color = !g ? c.muted : Math.abs(g.s) < 3 ? c.accent : ahead ? c.ok : c.warn;
  const name = pacer.kind === 'ghost' ? '지난 기록' : '페이스메이커';
  const kms = Math.floor(pacer.distanceM / 1000);
  return (
    <Card style={{ gap: Space.sm }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T v="small" numberOfLines={1} style={{ flex: 1 }}>{name} · {pacer.label}</T>
      </Row>
      {reachedS != null ? (
        <View style={{ gap: 2 }}>
          <T v="big" style={{ fontSize: 34, lineHeight: 40, color: reachedS <= pacer.targetS ? c.ok : c.warn }}>{fmtT(reachedS)}</T>
          <T>{fmtKmShort(pacer.distanceM)} 도착 · {Math.abs(pacer.targetS - reachedS) < 1 ? '딱 맞춤' : `${fmtT(Math.abs(pacer.targetS - reachedS))} ${reachedS < pacer.targetS ? '빠름' : '늦음'}`}</T>
        </View>
      ) : (
        <Row style={{ alignItems: 'flex-end', gap: Space.md }}>
          <T v="big" style={{ fontSize: 40, lineHeight: 46, color }}>{g ? `${g.m >= 0 ? '+' : '−'}${Math.round(Math.abs(g.m))}m` : '–'}</T>
          <View style={{ paddingBottom: 6 }}>
            <T style={{ fontWeight: '800', color }}>{g ? (Math.abs(g.s) < 2 ? '나란히' : `${Math.round(Math.abs(g.s))}초 ${ahead ? '앞섬' : '뒤처짐'}`) : '100m부터 비교해요'}</T>
            {g && pacer.kind === 'plan' ? <T v="small">이대로면 {fmtT(g.projectedS)}</T> : g ? <T v="small">그날 {fmtKmShort(pm)} 지점</T> : null}
          </View>
        </Row>
      )}
      {/* track */}
      <View style={{ height: 40, justifyContent: 'center', marginHorizontal: 10 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: c.line }} />
        <View style={{ position: 'absolute', left: 0, width: pct(myM / end), height: 4, borderRadius: 2, backgroundColor: c.accent }} />
        {Array.from({ length: kms }, (_, i) => (
          <View key={i} style={{ position: 'absolute', left: pct(((i + 1) * 1000) / end), marginLeft: -1, top: 15, width: 2, height: 10, backgroundColor: c.band }} />
        ))}
        <View style={{ position: 'absolute', left: pct(pacer.distanceM / end), marginLeft: -1, top: 8, width: 3, height: 24, backgroundColor: c.ink }} />
        <View style={{ position: 'absolute', left: pct(pm / end), marginLeft: -8, top: 0, alignItems: 'center' }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c.muted, borderWidth: 2, borderColor: c.surface }} />
        </View>
        <View style={{ position: 'absolute', left: pct(myM / end), marginLeft: -10, top: 18, width: 20, height: 20, borderRadius: 10, backgroundColor: c.accent, borderWidth: 3, borderColor: c.surface }} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small"><T v="small" style={{ color: c.muted, fontWeight: '800' }}>●</T> {name} {(pm / 1000).toFixed(2)}km</T>
        <T v="small"><T v="small" style={{ color: c.accent, fontWeight: '800' }}>●</T> 나 {(myM / 1000).toFixed(2)}km</T>
      </Row>
    </Card>
  );
}

/** 기록 상세: 결과 한 장 */
export function PacerResultCard({ p }: { p: PacerResult }) {
  const c = usePalette();
  const name = p.kind === 'ghost' ? '지난 기록' : '페이스메이커';
  const win = p.gapS != null && p.gapS >= 0;
  return (
    <Card style={{ gap: 4 }}>
      <T v="small">{name} · {p.label}</T>
      {p.reachedS != null ? (
        <T style={{ fontSize: 18, fontWeight: '800', color: win ? c.ok : c.warn }}>
          {fmtKmShort(p.distanceM)} {fmtT(p.reachedS)} · {Math.abs(p.targetS - p.reachedS) < 1 ? '딱 맞춤' : `${fmtT(Math.abs(p.targetS - p.reachedS))} ${p.reachedS < p.targetS ? '빠름' : '늦음'}`}
        </T>
      ) : (
        <T style={{ fontSize: 16, fontWeight: '700' }}>{fmtKmShort(p.distanceM)} 전에 멈춤{p.gapS != null ? ` · 멈출 때 ${Math.round(Math.abs(p.gapS))}초 ${p.gapS >= 0 ? '앞섬' : '뒤처짐'}` : ''}</T>
      )}
      <T v="small">목표 {fmtT(p.targetS)}</T>
    </Card>
  );
}
