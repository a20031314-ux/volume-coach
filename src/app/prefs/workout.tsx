import { View } from 'react-native';

import { Page } from '@/components/layout';
import { Card, Pills, Segmented, T } from '@/components/ui';
import { useData } from '@/store/store';

export default function WorkoutPrefs() {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const set = (patch: Partial<typeof s.session>) => update({ session: { ...s.session, ...patch } });

  return (
    <Page>
      <Card>
        <Segmented options={[{ v: 'exercise', n: '운동별' }, { v: 'set', n: '세트별' }]} value={s.session.detail}
          onChange={(v) => v && set({ detail: v })} />
        <T v="small">{s.session.detail === 'set' ? '세트마다 완료를 눌러요.' : '운동마다 세트 수만 확인해요.'}</T>
      </Card>

      {s.session.detail === 'set' ? (
        <Card>
          <View style={{ gap: 6 }}><T v="muted">세트마다 남길 것</T>
            <Pills
              options={[{ k: 'setInputs', n: '중량·반복' }, { k: 'setRpe', n: 'RPE' }, { k: 'restTimer', n: '휴식 타이머' }] as { k: 'setInputs' | 'setRpe' | 'restTimer'; n: string }[]}
              value={(['setInputs', 'setRpe', 'restTimer'] as const).filter((k) => s.session[k])}
              onToggle={(k) => set({ [k]: !s.session[k] })} />
          </View>
        </Card>
      ) : null}

      <Card>
        <T v="muted">자동 종료</T>
        <Segmented options={[{ v: '0', n: '끔' }, { v: '60', n: '60분' }, { v: '90', n: '90분' }, { v: '120', n: '120분' }]}
          value={String(s.session.autoEndMin)} onChange={(v) => v != null && set({ autoEndMin: Number(v), autoEndChosen: true })} />
        {s.session.autoEndMin ? <T v="small">마지막 체크 후 {s.session.autoEndMin}분 동안 입력이 없으면 그 시각으로 운동을 끝내요.</T> : null}
      </Card>
    </Page>
  );
}
