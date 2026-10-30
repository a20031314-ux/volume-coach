import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Pills, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { knownExercises, verdict } from '@/lib/ability';
import { MUSCLES, available, library } from '@/lib/exercises';
import type { ExercisePref, MuscleKey } from '@/lib/types';
import { live, useData } from '@/store/store';

const LEVEL = { 1: '쉬움', 2: '보통', 3: '어려움' } as const;

/** Every exercise with the user's marks and why it is or isn't recommended. */
export default function ExerciseList() {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const logsT = useData((x) => x.logs);
  const [m, setM] = useState<MuscleKey>('chest');
  const known = useMemo(() => knownExercises(live(logsT)), [logsT]);
  const ctx = { ...s, known };
  const eq = s.profile.equipment ?? 'gym';
  const list = library(s.customExercises).filter((e) => e.m === m);

  const mark = (name: string, pref: ExercisePref) => {
    const next = { ...s.exercisePrefs };
    if (next[name] === pref) delete next[name];
    else next[name] = pref;
    update({ exercisePrefs: next });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + Space.xl, gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
      <Pills options={MUSCLES} value={m} onToggle={setM} />
      {list.map((e) => {
        const v = verdict(e, ctx);
        const pref = s.exercisePrefs[e.n];
        const noEq = !available(e, eq);
        return (
          <View key={e.n} style={{ backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 10, padding: Space.md, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flexShrink: 1 }}>
                <T style={{ fontWeight: '600' }}>{e.n}</T>
                <T v="small">{LEVEL[e.lv]}{known.has(e.n) ? ' · 해봤어요' : ''}</T>
              </View>
              {v.ok && !noEq ? <Chip label="추천에 포함" tone="ok" /> : <Chip label={noEq ? '장비 없음' : v.kind === 'hard' ? '추천 안 함' : '나중에 추천'} tone={v.kind === 'hard' || noEq ? 'rest' : 'warn'} />}
            </Row>
            {!v.ok && v.reason ? <T v="small">{v.reason}</T> : null}
            <Row>
              <Button label={pref === 'fav' ? '★ 즐겨찾기' : '☆ 즐겨찾기'} kind={pref === 'fav' ? 'primary' : 'ghost'} onPress={() => mark(e.n, 'fav')} />
              <Button label="안 함" kind={pref === 'dislike' ? 'primary' : 'ghost'} onPress={() => mark(e.n, 'dislike')} />
              <Button label="못 함" kind={pref === 'cant' ? 'primary' : 'ghost'} onPress={() => mark(e.n, 'cant')} />
            </Row>
          </View>
        );
      })}
    </ScrollView>
  );
}
