/** "What else adds up to the same?" — swaps for one food, with the main food optionally chosen. */
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/layout';
import { Button, Card, Pills, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { foodLabel, type FoodDef, type Macros } from '@/lib/foods';
import { mainOptions, swapNote, swaps, type Swap, type SwapPart } from '@/lib/swap';

export interface SwapTarget {
  /** shown in the title, e.g. "연어 200g" */
  label: string;
  macros: Macros;
  /** the built-in food it is, when known */
  def?: FoodDef;
}

const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '±');

export function MacroLine({ m, small }: { m: Macros; small?: boolean }) {
  return (
    <T v={small ? 'small' : 'muted'}>
      {Math.round(m.k)}kcal · 단백질 {Math.round(m.p)}g · 탄수화물 {Math.round(m.c)}g · 지방 {Math.round(m.f)}g
    </T>
  );
}

export function SwapOption({ s, target, def, action, onPick }: { s: Swap; target?: Macros; def?: FoodDef; action: string; onPick: () => void }) {
  const c = usePalette();
  const note = swapNote(def, s);
  const dk = Math.round(s.total.k - (target?.k ?? s.total.k));
  const dp = Math.round(s.total.p - (target?.p ?? s.total.p));
  return (
    <Card style={{ gap: Space.sm }}>
      <View style={{ gap: 2 }}>
        {s.parts.map((p, i) => (
          <T key={p.food.n} style={{ fontSize: 17, fontWeight: i ? '400' : '600' }}>{i ? '+ ' : ''}{foodLabel(p.food, p.amt)}</T>
        ))}
      </View>
      <MacroLine m={s.total} small />
      {target ? (
        <T v="small" style={{ color: c.muted }}>원래보다 {sign(dk)}{Math.abs(dk)}kcal · 단백질 {sign(dp)}{Math.abs(dp)}g</T>
      ) : null}
      {note ? <T v="small" style={{ color: c.warn }}>{note}</T> : null}
      <Button label={action} kind="primary" onPress={onPick} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

export function SwapSheet({ target, action, onClose, onApply }: {
  target: SwapTarget | null;
  /** button label: "이걸로 바꾸기" or "이걸로 추가" */
  action: string;
  onClose: () => void;
  onApply: (parts: SwapPart[]) => void;
}) {
  const [main, setMain] = useState<string | null>(null);
  const [prev, setPrev] = useState<SwapTarget | null>(null);
  if (target !== prev) { setPrev(target); setMain(null); }

  const opts = useMemo(() => {
    if (!target) return null;
    const base = { group: target.def?.g, exclude: target.def ? [target.def.n] : [], primary: target.def?.g === 'meal' ? 'p' as const : undefined };
    return {
      mains: mainOptions(target.macros, base).slice(0, 16),
      list: swaps(target.macros, { ...base, main: main ?? undefined, loose: main != null }),
    };
  }, [target, main]);

  return (
    <Sheet open={target != null} title={target ? `${target.label} 대신` : ''} onClose={onClose}>
      {target && opts ? (<>
        <MacroLine m={target.macros} />
        <Pills options={[{ k: '__auto', n: '추천' }, ...opts.mains.map((d) => ({ k: d.n, n: d.n }))]} value={main ?? '__auto'}
          onToggle={(k) => setMain(k === '__auto' ? null : k)} />
        {opts.list.length ? opts.list.map((s) => (
          <SwapOption key={s.parts.map((p) => p.food.n + p.amt).join('|')} s={s} target={target.macros} def={target.def} action={action} onPick={() => onApply(s.parts)} />
        )) : (
          <T v="muted" style={{ textAlign: 'center', paddingVertical: Space.lg }}>비슷하게 맞는 조합이 없어요.</T>
        )}
        <Row><T v="small">양은 생 무게 기준이에요. 외식·가공식품은 실제와 20~30% 다를 수 있어요.</T></Row>
      </>) : null}
    </Sheet>
  );
}
