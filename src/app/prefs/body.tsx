import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Disclosure, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, ConfirmButton, NumField, Row, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { fmt, today } from '@/lib/dates';
import { body, bodySource, proteinTarget } from '@/lib/profile';
import type { Profile } from '@/lib/types';
import { live, useData } from '@/store/store';

type Draft = { weight: number | null; smm: number | null; fatPct: number | null; ffm: number | null; bmr: number | null; visceral: number | null };
const EMPTY: Draft = { weight: null, smm: null, fatPct: null, ffm: null, bmr: null, visceral: null };

/** Body numbers: from InBody measurements or entered by hand. */
export default function BodyPrefs() {
  const c = usePalette();
  const toast = useToast();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const bodyT = useData((x) => x.bodyComps);
  const addBody = useData((x) => x.addBodyComp);
  const removeBody = useData((x) => x.removeBodyComp);
  const [d, setD] = useState<Draft>(EMPTY);
  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const comps = useMemo(() => live(bodyT).sort((a, b) => (a.date < b.date ? 1 : -1)), [bodyT]);
  const src = bodySource(p, comps);
  const b = body(p, comps);
  const pt = b ? proteinTarget(p, b) : null;

  return (
    <Page>
      <Segmented options={[{ v: 'inbody', n: '인바디' }, { v: 'manual', n: '직접 입력' }]} value={src}
        onChange={(v) => v && setP({ bodySource: v })} />

      {b ? (
        <Row gap={Space.xl}>
          <View><T v="small">체중</T><T v="num">{b.weight}kg</T></View>
          <View><T v="small">제지방량</T><T v="num">{b.ffm ? `${b.ffm.toFixed(1)}kg` : '–'}</T></View>
          {pt ? <View><T v="small">단백질/일</T><T v="num">{pt.lo}~{pt.hi}g</T></View> : null}
        </Row>
      ) : null}

      <Card>
        <Row gap={Space.md}>
          <NumField label="키 cm" value={p.height} onCommit={(height) => setP({ height })} decimal />
          {src === 'manual' ? <NumField label="체중 kg" value={p.weight} onCommit={(weight) => setP({ weight })} decimal /> : null}
        </Row>
        {src === 'manual' ? (
          <Row gap={Space.md}>
            <NumField label="체지방률 % (선택)" value={p.fatPct} onCommit={(fatPct) => setP({ fatPct: fatPct && fatPct > 0 && fatPct < 70 ? fatPct : null })} decimal />
          </Row>
        ) : null}
      </Card>

      {src === 'inbody' ? (
        <>
          <Card>
            <T v="title" style={{ fontSize: 15 }}>측정 결과 · {fmt(today())}</T>
            <Row gap={Space.md}>
              <NumField label="체중 kg" value={d.weight} onCommit={(weight) => setD((x) => ({ ...x, weight }))} decimal />
              <NumField label="골격근량 kg" value={d.smm} onCommit={(smm) => setD((x) => ({ ...x, smm }))} decimal />
              <NumField label="체지방률 %" value={d.fatPct} onCommit={(fatPct) => setD((x) => ({ ...x, fatPct }))} decimal />
            </Row>
            <Disclosure title="더 입력">
              <Row gap={Space.md}>
                <NumField label="제지방량 kg" value={d.ffm} onCommit={(ffm) => setD((x) => ({ ...x, ffm }))} decimal />
                <NumField label="기초대사량 kcal" value={d.bmr} onCommit={(bmr) => setD((x) => ({ ...x, bmr }))} />
                <NumField label="내장지방 레벨" value={d.visceral} onCommit={(visceral) => setD((x) => ({ ...x, visceral }))} />
              </Row>
            </Disclosure>
            <Button kind="primary" label="저장" onPress={() => {
              if (!d.weight) return toast('체중을 입력하세요');
              if (d.fatPct != null && (d.fatPct <= 0 || d.fatPct >= 70)) return toast('체지방률은 1~69% 사이로 입력하세요');
              if (d.ffm != null && d.ffm >= d.weight) return toast('제지방량은 체중보다 작아야 해요');
              addBody({ date: today(), weight: d.weight, smm: d.smm, fatPct: d.fatPct, ffm: d.ffm, bmr: d.bmr, visceral: d.visceral });
              if (!p.bodySource) setP({ bodySource: 'inbody' });
              setD(EMPTY); toast('저장했어요');
            }} />
          </Card>

          {comps.length ? (
            <View>
              {comps.map((x) => (
                <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}>
                  <T style={{ width: 84 }}>{fmt(x.date)}</T>
                  <T v="muted" style={{ flex: 1 }} numberOfLines={1}>
                    {x.weight}kg{x.smm ? ` · 골격근 ${x.smm}` : ''}{x.fatPct ? ` · ${x.fatPct}%` : ''}{x.bmr ? ` · ${x.bmr}kcal` : ''}
                  </T>
                  <ConfirmButton label="삭제" onConfirm={() => removeBody(x.id)} />
                </View>
              ))}
            </View>
          ) : <T v="muted" style={{ textAlign: 'center' }}>아직 측정 기록이 없어요.</T>}
        </>
      ) : null}
    </Page>
  );
}
