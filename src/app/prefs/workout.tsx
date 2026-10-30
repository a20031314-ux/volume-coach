import { View } from 'react-native';

import { Page } from '@/components/layout';
import { Card, NumField, Pills, Row, Segmented, T } from '@/components/ui';
import { Space } from '@/constants/theme';
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
        <Row gap={Space.md}>
          <NumField label="자동 종료 (분, 0 = 끔)" value={s.session.autoEndMin} onCommit={(v) => v != null && set({ autoEndMin: v })} />
        </Row>
      </Card>
    </Page>
  );
}
