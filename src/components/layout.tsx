import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, usePalette } from '@/constants/theme';

import { T } from './ui';

/** Bottom sheet for options that shouldn't sit on the main screen. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: '#0007' }]} />
        <View style={{ maxHeight: '85%', backgroundColor: c.surface, borderTopLeftRadius: Radius.md * 1.5, borderTopRightRadius: Radius.md * 1.5, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, paddingTop: Space.lg, paddingBottom: Space.sm }}>
            <T v="title">{title}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} hitSlop={12}>
              <Text style={{ color: c.muted, fontSize: 15, fontWeight: '600' }}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: Space.lg, paddingTop: Space.sm, paddingBottom: insets.bottom + Space.lg, gap: Space.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A heading that folds its content away until tapped. */
export function Disclosure({ title, meta, children, initiallyOpen = false }: { title: string; meta?: string; children: ReactNode; initiallyOpen?: boolean }) {
  const c = usePalette();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: Space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.sm }}>
        <T v="muted" style={{ fontWeight: '600' }}>{title}</T>
        <Text style={{ color: c.muted, fontSize: 13 }}>{meta ? `${meta}  ` : ''}{open ? '접기' : '보기'}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** Grouped list for settings: rows separated by hairlines inside one surface. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      {title ? <T v="label">{title}</T> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.line, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

/** One settings row: label, current value, chevron. */
export function ListRow({ label, value, onPress, last, danger }: { label: string; value?: string; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const c = usePalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingHorizontal: Space.lg, paddingVertical: 14,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, borderColor: c.line, backgroundColor: pressed ? c.bg : 'transparent',
      })}>
      <Text style={{ flex: 1, fontSize: 15, color: danger ? c.bad : c.ink }}>{label}</Text>
      {value ? <Text numberOfLines={1} style={{ maxWidth: '55%', fontSize: 14, color: c.muted }}>{value}</Text> : null}
      {onPress ? <Text style={{ color: c.muted, fontSize: 18 }}>›</Text> : null}
    </Pressable>
  );
}

/** Plain scrolling page for pushed screens (no big title, the header has it). */
export function Page({ children }: { children: ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: Space.lg, paddingBottom: insets.bottom + Space.xl, gap: Space.lg, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
      {children}
    </ScrollView>
  );
}
