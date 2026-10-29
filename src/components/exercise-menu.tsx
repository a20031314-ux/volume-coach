import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, View, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Space, usePalette } from '@/constants/theme';
import type { ExercisePref } from '@/lib/types';
import { useData } from '@/store/store';

import { useToast } from './toast';
import { Button, T } from './ui';

const Ctx = createContext<(name: string) => void>(() => {});

/** Long-press any exercise name to mark it: favourite, rather not, can't do. */
export function ExerciseMenuProvider({ children }: { children: ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const prefs = useData((s) => s.settings.exercisePrefs);
  const update = useData((s) => s.updateSettings);
  const [name, setName] = useState<string | null>(null);
  const open = useCallback((n: string) => setName(n), []);

  const choose = (pref: ExercisePref | null) => {
    if (!name) return;
    const next = { ...prefs };
    if (pref) next[name] = pref; else delete next[name];
    update({ exercisePrefs: next });
    toast(pref === 'fav' ? `${name} 즐겨찾기` : pref === 'dislike' ? `${name}은 추천에서 뺄게요` : pref === 'cant' ? `${name}은 추천·목록에서 뺄게요` : `${name} 표시를 지웠어요`);
    setName(null);
  };
  const cur = name ? prefs[name] : undefined;

  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal visible={!!name} transparent animationType="fade" onRequestClose={() => setName(null)}>
        <Pressable accessibilityLabel="닫기" onPress={() => setName(null)} style={{ flex: 1, backgroundColor: '#0007', justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.surface, borderTopLeftRadius: Radius.md * 1.5, borderTopRightRadius: Radius.md * 1.5, padding: Space.lg, paddingBottom: insets.bottom + Space.lg, gap: Space.sm, width: '100%', maxWidth: 680, alignSelf: 'center' }}>
            <T v="title">{name}</T>
            <Button label={cur === 'fav' ? '★ 즐겨찾기 (선택됨)' : '★ 즐겨찾기 — 먼저 추천'} kind={cur === 'fav' ? 'primary' : 'default'} onPress={() => choose('fav')} />
            <Button label={cur === 'dislike' ? '안 하고 싶음 (선택됨)' : '안 하고 싶음 — 추천에서 빼기'} kind={cur === 'dislike' ? 'primary' : 'default'} onPress={() => choose('dislike')} />
            <Button label={cur === 'cant' ? '못 함 (선택됨)' : '못 함 — 추천·목록에서 빼기'} kind={cur === 'cant' ? 'primary' : 'default'} onPress={() => choose('cant')} />
            {cur ? <Button label="표시 지우기" kind="ghost" onPress={() => choose(null)} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Ctx.Provider>
  );
}

export const useExerciseMenu = () => useContext(Ctx);

/** An exercise name that opens the mark menu on long press. Shows ★ for favourites. */
export function ExName({ name, style, v = 'body' }: { name: string; style?: StyleProp<TextStyle>; v?: 'body' | 'title' }) {
  const open = useExerciseMenu();
  const fav = useData((s) => s.settings.exercisePrefs[name] === 'fav');
  return (
    <Pressable onLongPress={() => open(name)} delayLongPress={350} accessibilityHint="길게 눌러 즐겨찾기·안 함·못 함 표시">
      <View>
        <T v={v} style={style}>{fav ? '★ ' : ''}{name}</T>
      </View>
    </Pressable>
  );
}
