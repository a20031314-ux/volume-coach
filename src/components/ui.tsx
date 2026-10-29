import { useEffect, useState, type ReactNode } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, usePalette, type Palette } from '@/constants/theme';
import type { StatusTone } from '@/lib/coach';

/* ---------- layout ---------- */
export function Screen({ children, title, sub, right }: { children: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        // on web the tab bar sits at the top of the page
        paddingTop: insets.top + Space.md + (Platform.OS === 'web' ? 72 : 0),
        paddingBottom: insets.bottom + (Platform.OS === 'web' ? Space.xl : 96),
        paddingLeft: Math.max(Space.lg, insets.left), paddingRight: Math.max(Space.lg, insets.right),
        gap: Space.md, maxWidth: 680, width: '100%', alignSelf: 'center',
      }}
      keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Space.md, marginBottom: Space.xs }}>
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: c.ink, letterSpacing: -0.5 }}>{title}</Text>
          {sub ? <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return (
    <View style={[{ backgroundColor: c.surface, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: Radius.md, padding: Space.lg, gap: Space.md }, style]}>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = Space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

/* ---------- text ---------- */
type TV = 'body' | 'muted' | 'small' | 'title' | 'label' | 'num' | 'big';
export function T({ v = 'body', children, style, numberOfLines }: { v?: TV; children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const c = usePalette();
  const base: Record<TV, TextStyle> = {
    body: { fontSize: 15, color: c.ink, lineHeight: 21 },
    muted: { fontSize: 13, color: c.muted, lineHeight: 19 },
    small: { fontSize: 12, color: c.muted },
    title: { fontSize: 17, fontWeight: '700', color: c.ink },
    label: { fontSize: 12, fontWeight: '700', color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: Space.sm },
    num: { fontSize: 20, fontWeight: '700', color: c.ink, fontVariant: ['tabular-nums'] },
    big: { fontSize: 36, fontWeight: '800', color: c.ink, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  };
  return <Text numberOfLines={numberOfLines} style={[base[v], style]}>{children}</Text>;
}

/* ---------- controls ---------- */
type BtnKind = 'primary' | 'default' | 'ghost' | 'danger';
export function Button({ label, onPress, kind = 'default', disabled, style, accessibilityLabel }: {
  label: string; onPress: () => void; kind?: BtnKind; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const c = usePalette();
  const bg = kind === 'primary' ? c.accent : kind === 'ghost' ? 'transparent' : c.surface;
  const fg = kind === 'primary' ? c.accentInk : kind === 'danger' ? c.bad : c.ink;
  const border = kind === 'primary' ? c.accent : kind === 'danger' ? c.bad : c.line;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: Radius.sm,
        paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      }, style]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Tap twice to confirm (no modal dialogs). */
export function ConfirmButton({ label, confirmLabel = '확인', onConfirm, style }: { label: string; confirmLabel?: string; onConfirm: () => void; style?: StyleProp<ViewStyle> }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      label={armed ? confirmLabel : label}
      kind={armed ? 'danger' : 'ghost'}
      style={style}
      onPress={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    />
  );
}

export function Chip({ label, tone = 'accent' }: { label: string; tone?: StatusTone }) {
  const c = usePalette();
  const map: Record<StatusTone, [string, string]> = {
    ok: [c.okSoft, c.ok], warn: [c.warnSoft, c.warn], bad: [c.badSoft, c.bad], rest: [c.restSoft, c.rest], accent: [c.accentSoft, c.accent],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Pills<K extends string>({ options, value, onToggle, danger }: {
  options: { k: K; n: string }[]; value: K[] | K | null; onToggle: (k: K) => void; danger?: boolean;
}) {
  const c = usePalette();
  const on = (k: K) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <Row gap={6}>
      {options.map((o) => {
        const sel = on(o.k);
        const bg = sel ? (danger ? c.bad : c.accent) : c.bg;
        return (
          <Pressable
            key={o.k}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onToggle(o.k)}
            style={{ backgroundColor: bg, borderColor: sel ? bg : c.line, borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 11, paddingVertical: 7 }}>
            <Text style={{ color: sel ? (danger ? c.surface : c.accentInk) : c.ink, fontSize: 13, fontWeight: '600' }}>{o.n}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange }: {
  options: { v: V; n: string }[]; value: V | null | undefined; onChange: (v: V | null) => void;
}) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexGrow: 1, flexShrink: 1 }}>
      {options.map((o) => {
        const sel = value === o.v;
        return (
          <Pressable
            key={String(o.v)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(sel ? null : o.v)}
            style={{ flex: 1, backgroundColor: sel ? c.ink : c.bg, borderColor: sel ? c.ink : c.line, borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: sel ? c.bg : c.ink, fontSize: 13, fontWeight: '600' }}>{o.n}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return (
    <View style={[{ gap: 5, flexGrow: 1, minWidth: 120 }, style]}>
      <Text style={{ fontSize: 13, color: c.muted, fontWeight: '500' }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={{ color: c.ink, backgroundColor: c.bg, borderColor: c.line, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 10, fontSize: 15 }}
        {...rest}
      />
    </View>
  );
}

/** Numeric text field that commits on blur so typing "1" on the way to "12" doesn't trigger updates. */
export function NumField({ label, value, onCommit, decimal, placeholder, style }: {
  label: string; value: number | null | undefined; onCommit: (v: number | null) => void; decimal?: boolean; placeholder?: string; style?: StyleProp<ViewStyle>;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setText(value == null ? '' : String(value)); }
  const commit = () => {
    const t = text.trim();
    if (!t) return onCommit(null);
    const n = Number(t.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) onCommit(n);
    else setText(value == null ? '' : String(value));
  };
  return (
    <Field label={label} value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'} placeholder={placeholder} returnKeyType="done" style={style} />
  );
}

export function Stepper({ value, onChange, step = 1, min = 1, max = 30, label, format }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; label: string; format?: (v: number) => string;
}) {
  const c = usePalette();
  const fix = (v: number) => Math.round(v * 10) / 10;
  return (
    <View style={{ gap: 5, flexGrow: 1, minWidth: 120 }}>
      <Text style={{ fontSize: 13, color: c.muted, fontWeight: '500' }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Button label="−" accessibilityLabel={`${label} 줄이기`} onPress={() => onChange(fix(Math.max(min, value - step)))} style={{ width: 44 }} />
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: c.ink, fontVariant: ['tabular-nums'] }}>{format ? format(value) : value}</Text>
        <Button label="+" accessibilityLabel={`${label} 늘리기`} onPress={() => onChange(fix(Math.min(max, value + step)))} style={{ width: 44 }} />
      </View>
    </View>
  );
}

export function Meter({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  const c = usePalette();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: c.restSoft, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Banner({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'accent' }) {
  const c = usePalette();
  return (
    <View style={{ backgroundColor: tone === 'warn' ? c.warnSoft : c.accentSoft, borderRadius: Radius.sm, padding: Space.md }}>
      <Text style={{ color: tone === 'warn' ? c.warn : c.accent, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export function DayNav({ date, label, onPrev, onNext }: { date: string; label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }} key={date}>
      <Button label="‹" accessibilityLabel="이전 날" onPress={onPrev} style={{ width: 44 }} />
      <T v="title" style={{ flex: 1, textAlign: 'center' }}>{label}</T>
      <Button label="›" accessibilityLabel="다음 날" onPress={onNext} style={{ width: 44 }} />
    </View>
  );
}

export const toneColor = (c: Palette, pct: number, ready: number) => (pct >= ready ? c.ok : pct >= ready - 20 ? c.warn : c.bad);
export const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
