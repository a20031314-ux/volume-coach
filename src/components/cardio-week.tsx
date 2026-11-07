/** 유산소 탭 아래: this week at a glance (minutes per day), tap a day for its records. */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TlNode } from '@/components/timeline';
import { Button, Card, Row, T } from '@/components/ui';
import { Radius, Space, usePalette } from '@/constants/theme';
import { INTENSITY_NAME } from '@/lib/cardio';
import { HARD, cardioWeek, weekMonday } from '@/lib/cardio-week';
import { DOW, addDays, fmt, parse, today } from '@/lib/dates';
import type { ActivityKind } from '@/lib/elevation';
import { fmtDuration, fmtKm, fmtRate, type RateUnit } from '@/lib/run';
import { fmtSprint, kmh } from '@/lib/sprint';
import { runTitle } from '@/lib/timeline';
import type { Run } from '@/lib/types';

const hm = (min: number) => { const m = Math.round(min); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`; };

export function CardioWeek({ runs, best, unitOf }: {
  runs: Run[];
  /** best sprint time per distance */
  best: Record<number, number>;
  unitOf: (k?: ActivityKind) => RateUnit;
}) {
  const c = usePalette();
  const d0 = today();
  const [monday, setMonday] = useState(() => weekMonday(d0));
  const w = useMemo(() => cardioWeek(runs, monday), [runs, monday]);
  const [pick, setPick] = useState<string | null>(() => (runs.some((r) => r.date === d0) ? d0 : null));
  const thisWeek = monday === weekMonday(d0);
  const top = Math.max(30, ...w.days.map((d) => d.hard + d.easy));
  const picked = w.days.find((d) => d.date === pick);
  const H = 72;

  return (
    <Card style={{ gap: Space.md }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="지난주" hitSlop={10} onPress={() => { setMonday(addDays(monday, -7)); setPick(null); }}>
          <Text style={{ color: c.muted, fontSize: 18, paddingHorizontal: 4 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="title" style={{ fontSize: 15 }}>{thisWeek ? '이번 주' : `${fmt(monday).replace(/\s*\(.*\)/, '')} 주`}</T>
          <T v="small">{w.count ? `${w.km.toFixed(1)}km · ${w.count}회 · ${hm(w.min)}` : '기록 없음'}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 주" hitSlop={10} disabled={thisWeek}
          onPress={() => { setMonday(addDays(monday, 7)); setPick(null); }}>
          <Text style={{ color: thisWeek ? c.line : c.muted, fontSize: 18, paddingHorizontal: 4 }}>›</Text>
        </Pressable>
      </Row>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {w.days.map((d) => {
          const on = d.date === pick;
          const future = d.date > d0;
          return (
            <Pressable key={d.date} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={`${DOW[parse(d.date).getDay()]}요일 ${Math.round(d.hard + d.easy)}분`}
              disabled={future} onPress={() => setPick(on ? null : d.date)} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ height: H, width: '100%', justifyContent: 'flex-end', borderRadius: Radius.sm, backgroundColor: on ? c.accentSoft : 'transparent' }}>
                <View style={{ marginHorizontal: 6, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: (d.hard / top) * (H - 6), backgroundColor: c.warn }} />
                  <View style={{ height: (d.easy / top) * (H - 6), backgroundColor: c.ok }} />
                </View>
              </View>
              <Text style={{ fontSize: 12, color: d.date === d0 ? c.accent : future ? c.line : c.muted, fontWeight: d.date === d0 ? '700' : '400' }}>{DOW[parse(d.date).getDay()]}</Text>
            </Pressable>
          );
        })}
      </View>

      {picked ? (
        picked.runs.length ? (
          <View>
            {[...picked.runs].sort((a, b) => a.startedAt - b.startedAt).map((r, i, arr) => (
              <TlNode key={r.id} time={new Date(r.startedAt).toTimeString().slice(0, 5)} color={HARD.includes(r.kind ?? 'run') ? c.warn : c.ok}
                title={r.sprint ? `스프린트 ${r.sprint.targetM}m · ${fmtSprint(r.sprint.timeS)}` : r.kind === 'other' ? `${runTitle(r)} · ${Math.round(r.movingS / 60)}분` : `${runTitle(r)} · ${fmtKm(r.distanceM)}km`}
                sub={r.sprint ? `최고 ${kmh(r.sprint.topV)}${best[r.sprint.targetM] === r.sprint.timeS ? ' · 최고 기록' : ''}`
                  : r.kind === 'other' ? [r.intensity ? INTENSITY_NAME[r.intensity] : null, `${r.kcal}kcal`, r.manual ? '직접 입력' : null].filter(Boolean).join(' · ')
                  : [fmtDuration(r.movingS), fmtRate(r.paceSecPerKm, unitOf(r.kind)), r.elev && r.elev.gainM >= 5 ? `↑${r.elev.gainM}m` : null].filter(Boolean).join(' · ')}
                onPress={() => router.push({ pathname: '/activity/run', params: { id: r.id } })} last={i === arr.length - 1} />
            ))}
          </View>
        ) : <T v="small" style={{ textAlign: 'center' }}>{fmt(picked.date)} · 기록 없음</T>
      ) : null}

      <Button label="전체 기록 ›" kind="ghost" onPress={() => router.push('/log')} style={{ alignSelf: 'flex-end' }} />
    </Card>
  );
}
