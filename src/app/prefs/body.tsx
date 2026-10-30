import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, NumField, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { fmt, today } from '@/lib/dates';
import { body, proteinTarget } from '@/lib/profile';
import { live, useData } from '@/store/store';

export default function BodyPrefs() {
  const c = usePalette();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const bodyT = useData((x) => x.bodyComps);
  const addBody = useData((x) => x.addBodyComp);
  const removeBody = useData((x) => x.removeBodyComp);
  const [bc, setBc] = useState<{ weight: number | null; smm: number | null; fatPct: number | null }>({ weight: null, smm: null, fatPct: null });
  const comps = useMemo(() => live(bodyT).sort((a, b) => (a.date < b.date ? 1 : -1)), [bodyT]);
  const b = body(s.profile, comps);
  const pt = b ? proteinTarget(s.profile, b) : null;

  return (
    <Page>
      {b ? (
        <Row gap={Space.xl}>
          <View><T v="small">제지방량</T><T v="num">{b.ffm ? `${b.ffm.toFixed(1)}kg` : '–'}</T></View>
          <View><T v="small">BMI</T><T v="num">{b.bmi.toFixed(1)}</T></View>
          {pt ? <View><T v="small">단백질/일</T><T v="num">{pt.lo}~{pt.hi}g</T></View> : null}
        </Row>
      ) : null}

      <Card>
        <Row gap={Space.md}>
          <NumField label="체중 kg" value={bc.weight} onCommit={(weight) => setBc((x) => ({ ...x, weight }))} decimal />
          <NumField label="골격근량 kg" value={bc.smm} onCommit={(smm) => setBc((x) => ({ ...x, smm }))} decimal />
          <NumField label="체지방률 %" value={bc.fatPct} onCommit={(fatPct) => setBc((x) => ({ ...x, fatPct }))} decimal />
        </Row>
        <Button kind="primary" label="오늘 측정값 저장" onPress={() => {
          if (!bc.weight) return toast('체중을 입력하세요');
          if (bc.fatPct != null && (bc.fatPct <= 0 || bc.fatPct >= 70)) return toast('체지방률은 1~69% 사이로 입력하세요');
          addBody({ date: today(), weight: bc.weight, smm: bc.smm, fatPct: bc.fatPct });
          setBc({ weight: null, smm: null, fatPct: null }); toast('저장했어요');
        }} />
      </Card>

      {comps.length ? (
        <View>
          {comps.map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}>
              <T style={{ flex: 1 }}>{fmt(x.date)}</T>
              <T v="muted">{x.weight}kg{x.smm ? ` · 골격근 ${x.smm}` : ''}{x.fatPct ? ` · ${x.fatPct}%` : ''}</T>
              <ConfirmButton label="삭제" onConfirm={() => removeBody(x.id)} />
            </View>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
