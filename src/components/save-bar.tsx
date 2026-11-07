/**
 * A settings page with a fixed 저장 bar at the bottom. Leaving with unsaved changes asks first:
 * 저장하고 나가기 / 저장 안 하고 나가기 / 계속 고치기.
 */
import { usePreventRemove } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Row, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';

export function SavePage({ children, dirty, onSave, onReset, label = '저장' }: {
  children: ReactNode; dirty: boolean; onSave: () => void | Promise<void>; onReset: () => void; label?: string;
}) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const leave = useRef<(() => void) | null>(null);

  usePreventRemove(dirty, ({ repeat }) => { leave.current = repeat; setAsk(true); });

  const save = async () => { await onSave(); toast('저장했어요'); };
  const go = () => { setAsk(false); const r = leave.current; leave.current = null; setTimeout(() => r?.(), 50); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Space.lg, paddingBottom: Space.xl, gap: Space.lg, maxWidth: 680, width: '100%', alignSelf: 'center' }}>
        {children}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: Space.lg, paddingTop: Space.sm, paddingBottom: insets.bottom + Space.sm }}>
        <Row gap={Space.md} style={{ flexWrap: 'nowrap', maxWidth: 680, width: '100%', alignSelf: 'center' }}>
          {dirty ? <Button label="되돌리기" onPress={onReset} style={{ flex: 1, paddingVertical: 14 }} /> : null}
          <Button label={dirty ? label : '저장됨'} kind="primary" disabled={!dirty} onPress={() => { void save(); }} style={{ flex: 2, paddingVertical: 14 }} />
        </Row>
      </View>
      <Sheet open={ask} title="저장하지 않은 변경이 있어요" onClose={() => setAsk(false)}>
        <T v="muted">바꾼 내용을 저장할까요?</T>
        <Button label="저장하고 나가기" kind="primary" onPress={async () => { await onSave(); toast('저장했어요'); go(); }} style={{ paddingVertical: 14 }} />
        <Button label="저장 안 하고 나가기" onPress={() => { onReset(); go(); }} />
        <Button label="계속 고치기" kind="ghost" onPress={() => { leave.current = null; setAsk(false); }} />
      </Sheet>
    </View>
  );
}
