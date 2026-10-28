import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, usePalette } from '@/constants/theme';
import { today } from '@/lib/dates';
import { MUSCLE_NAME } from '@/lib/exercises';
import { repRange } from '@/lib/profile';
import type { MuscleKey } from '@/lib/types';
import { useData } from '@/store/store';

import { Button, Field, NumField, Row, Stepper, T } from './ui';

export interface LogDraft { exercise: string; muscle: MuscleKey; sets: number }

/** Bottom sheet to log one exercise straight from a suggestion. */
export function LogSheet({ draft, onClose, onSaved }: { draft: LogDraft | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const addLog = useData((s) => s.addLog);
  const profile = useData((s) => s.settings.profile);
  const [sets, setSets] = useState(3);
  const [kg, setKg] = useState<number | null>(null);
  const [reps, setReps] = useState('');

  const [prev, setPrev] = useState<LogDraft | null>(null);
  if (draft !== prev) {
    setPrev(draft);
    if (draft) { setSets(Math.max(1, draft.sets)); setKg(null); setReps(''); }
  }

  const save = () => {
    if (!draft) return;
    addLog({ date: today(), exercise: draft.exercise, muscle: draft.muscle, sets, kg, reps: reps.trim(), at: Date.now() });
    onSaved(`${draft.exercise} ${sets}세트 저장됨`);
    onClose();
  };

  return (
    <Modal visible={!!draft} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0007' }} />
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: Radius.md * 1.5, borderTopRightRadius: Radius.md * 1.5, padding: Space.lg, paddingBottom: insets.bottom + Space.lg, gap: Space.md, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
          {draft ? (
            <>
              <View>
                <T v="title">{draft.exercise}</T>
                <T v="muted">{MUSCLE_NAME[draft.muscle]} · 권장 {repRange(draft.exercise, profile)}</T>
              </View>
              <Row gap={Space.md}>
                <Stepper label="세트" value={sets} onChange={setSets} />
              </Row>
              <Row gap={Space.md}>
                <NumField label="중량 kg (선택)" value={kg} onCommit={setKg} decimal />
                <Field label="반복 (선택)" value={reps} onChangeText={setReps} placeholder="예: 10 / 8~10" />
              </Row>
              <Row>
                <Button label="취소" onPress={onClose} style={{ flex: 1 }} />
                <Button label="기록 저장" kind="primary" onPress={save} style={{ flex: 2 }} />
              </Row>
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
