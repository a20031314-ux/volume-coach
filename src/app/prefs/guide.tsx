/**
 * 가이드 모드 설정: 기본값을 먼저 들려주고(들어보기) 사용자가 고른다.
 * 켜기/끄기 · 템포 · 음성/진동 · 시작 카운트다운 / 반복 리듬 / 세트 사이 휴식 안내 · 적용 종목.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { SavePage } from '@/components/save-bar';
import { Button, Card, Field, Pills, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useSettingsDraft } from '@/hooks/use-settings-draft';
import { library } from '@/lib/exercises';
import { DEFAULT_GUIDE, GOAL_TEMPO, TEMPO_CHOICES, describeTempo, restCues, setCues, type GuideSettings } from '@/lib/guide';
import { preview, stopGuide } from '@/store/guide-player';
import { live, useData } from '@/store/store';

const GOAL_WORD: Record<string, string> = { hyp: '근비대', str: '근력', cut: '감량', fit: '체력', '': '목적 미선택' };
const TEMPO_NOTE: Record<string, string> = {
  '2-0-2-0': '일정한 속도 · 처음 배우기 좋아요',
  '3-0-1-0': '천천히 내리고 힘있게 · 근비대',
  '4-0-1-0': '아주 천천히 내리기 · 자극 위주',
  '2-0-X-0': '내리고 폭발적으로 · 근력',
  '3-1-1-1': '바닥·꼭대기에서 1초씩 멈춤',
};
const SAMPLE = { n: '벤치프레스', p: 'hpush' as const };

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => onChange(!on)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {sub ? <T v="small">{sub}</T> : null}
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: on ? c.accent : c.line, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.surface }} />
      </View>
    </Pressable>
  );
}

export default function GuidePrefs() {
  const c = usePalette();
  const { s: draft, update, dirty, save, reset } = useSettingsDraft();
  const sessionsT = useData((s) => s.sessions);
  const g: GuideSettings = { ...DEFAULT_GUIDE, ...(draft.guide ?? {}) };
  const set = (patch: Partial<GuideSettings>) => update({ guide: { ...g, ...patch } });
  const goal = draft.profile.goal;
  const goalTempo = GOAL_TEMPO[goal];
  const tempo = g.tempo ?? goalTempo;
  const [q, setQ] = useState('');
  const [pickMode, setPickMode] = useState(g.only.length > 0);
  const [playing, setPlaying] = useState<string | null>(null);

  const listen = (key: string, t: string, withRest = false) => {
    if (playing === key) { stopGuide(); setPlaying(null); return; }
    const { cues, length } = setCues({ setNo: 2, reps: 3, tempo: t, ex: SAMPLE, countdown: g.countdown, rhythm: g.reps });
    const all = withRest ? [...restCues(20, 2, g.countdown), ...cues.map((x) => ({ ...x, t: x.t + 20 - (g.countdown ? 4.6 : 0) }))] : cues;
    preview(all, { voice: true, haptic: g.haptic });
    setPlaying(key);
    setTimeout(() => setPlaying((p) => (p === key ? null : p)), ((withRest ? 20 : 0) + length + 1.5) * 1000);
  };

  // exercises to choose from: the ones done recently first, then search the whole library
  const recent = useMemo(() => {
    const n = new Map<string, number>();
    for (const s of live(sessionsT)) for (const e of s.exercises) n.set(e.name, (n.get(e.name) ?? 0) + (e.status === 'done' ? 2 : 1));
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).slice(0, 16);
  }, [sessionsT]);
  const found = q.trim() ? library(draft.customExercises).map((e) => e.n).filter((n) => n.includes(q.trim())).slice(0, 12) : [];
  const picks = [...new Set([...g.only, ...(q.trim() ? found : recent)])];
  const toggleEx = (n: string) => set({ only: g.only.includes(n) ? g.only.filter((x) => x !== n) : [...g.only, n] });

  return (
    <SavePage dirty={dirty} onSave={() => { stopGuide(); save(); }} onReset={reset}>
      <Card>
        <T v="title" style={{ fontSize: 16 }}>세트를 음성으로 안내해요</T>
        <T v="muted">“2세트 준비, 3, 2, 1, 시작” → “내리고… 올려, 하나” → “2세트 끝” → 휴식 “30초 남았어요” → 다음 세트 카운트다운</T>
        <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: '켜기' }]} value={g.on ? 'on' : 'off'} onChange={(v) => v && set({ on: v === 'on' })} />
      </Card>

      <T v="label">기본값 먼저 들어보기</T>
      <Card style={{ gap: Space.sm }}>
        <T>{GOAL_WORD[goal]} 기본 템포 <T style={{ fontWeight: '700' }}>{goalTempo}</T></T>
        <T v="small">{describeTempo(goalTempo)} · 벤치프레스 3회 예시</T>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Button label={playing === 'set' ? '■ 멈추기' : '▶ 한 세트 들어보기'} kind="primary" onPress={() => listen('set', goalTempo)} style={{ flex: 1 }} />
          <Button label={playing === 'rest' ? '■ 멈추기' : '▶ 휴식 → 다음 세트'} onPress={() => listen('rest', goalTempo, true)} style={{ flex: 1 }} />
        </Row>
        <T v="small">휴식 예시는 20초로 줄여서 들려줘요. 아래에서 바꾸면 들어보기에도 바로 반영돼요.</T>
      </Card>

      <T v="label">템포 (내리기-멈춤-올리기-멈춤, 초)</T>
      <Card style={{ gap: 2 }}>
        {[null, ...TEMPO_CHOICES.filter((t) => t !== goalTempo)].map((t) => {
          const v = t ?? goalTempo;
          const sel = g.tempo === t;
          return (
            <Row key={t ?? 'goal'} style={{ flexWrap: 'nowrap', paddingVertical: 4 }}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: sel }} onPress={() => set({ tempo: t })} style={{ flex: 1, flexDirection: 'row', gap: Space.sm, alignItems: 'center' }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: sel ? c.accent : c.line, alignItems: 'center', justifyContent: 'center' }}>
                  {sel ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T>{v}{t === null ? ' · 목적별 기본' : ''}</T>
                  <T v="small">{TEMPO_NOTE[v] ?? describeTempo(v)}</T>
                </View>
              </Pressable>
              <Button label={playing === `t${v}` ? '■' : '▶'} kind="ghost" accessibilityLabel={`${v} 들어보기`} onPress={() => listen(`t${v}`, v)} />
            </Row>
          );
        })}
        <T v="small">클린·스윙 같은 빠른 동작은 템포 없이 횟수만, 플랭크·캐리 같은 버티기는 시작만 알려줘요.</T>
      </Card>

      <T v="label">들을 것</T>
      <Card style={{ gap: 0 }}>
        <Toggle label="시작 카운트다운" sub="“n세트 준비, 3, 2, 1, 시작”" on={g.countdown} onChange={(countdown) => set({ countdown })} />
        <Toggle label="반복 리듬" sub={`템포에 맞춰 “내리고… 올려, 하나” (지금 ${tempo})`} on={g.reps} onChange={(reps) => set({ reps })} />
        <Toggle label="세트 사이 휴식 안내" sub="남은 시간 알림 + 휴식 끝에 다음 세트 자동 시작. 끄면 세트가 끝난 뒤 직접 눌러 시작" on={g.rest} onChange={(rest) => set({ rest })} />
      </Card>

      <T v="label">안내 방법</T>
      <Card style={{ gap: 0 }}>
        <Toggle label="음성" on={g.voice} onChange={(voice) => set({ voice })} />
        <Toggle label="진동" sub="시작·매 반복·끝에 짧게" on={g.haptic} onChange={(haptic) => set({ haptic })} />
        {!g.voice && !g.haptic ? <T v="small" style={{ color: c.warn }}>둘 다 끄면 화면 숫자로만 안내해요</T> : null}
      </Card>

      <T v="label">적용 종목</T>
      <Card style={{ gap: Space.sm }}>
        <Segmented options={[{ v: 'all', n: '모든 종목' }, { v: 'only', n: '고른 종목만' }]} value={pickMode ? 'only' : 'all'}
          onChange={(v) => { if (!v) return; setPickMode(v === 'only'); if (v === 'all') { set({ only: [] }); setQ(''); } }} />
        {pickMode ? (<>
          <Field label="종목 찾기" value={q} onChangeText={setQ} placeholder="예: 스쿼트" />
          {picks.length ? <Pills options={picks.map((n) => ({ k: n, n }))} value={g.only} onToggle={toggleEx} />
            : <T v="small">{q.trim() ? '찾는 종목이 없어요' : '운동을 하면 자주 하는 종목이 여기 먼저 보여요. 위에서 찾아 고르세요.'}</T>}
          <T v="small">{g.only.length ? `${g.only.length}종목만 가이드: ${g.only.join(', ')}` : '하나도 안 고르면 모든 종목에 적용돼요'}</T>
        </>) : <T v="small">운동 화면의 모든 종목에 “▶ 세트 시작 · 가이드” 버튼이 나와요.</T>}
      </Card>

      <T v="small">안내 중엔 화면이 꺼지지 않아요. 화면을 끄거나 다른 앱으로 가면 음성이 멈출 수 있어요(특히 iPhone).</T>
    </SavePage>
  );
}
