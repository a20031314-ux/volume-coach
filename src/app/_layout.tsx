// Registers the background location task before anything else runs.
import '@/run/tracker';
import { resumeMove } from '@/move/tracker';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseMenuProvider } from '@/components/exercise-menu';
import { ToastProvider } from '@/components/toast';
import { Palettes } from '@/constants/theme';
import { AuthProvider } from '@/store/auth';
import { useMealReminders } from '@/store/meal-reminders';
import { useFixedAuto } from '@/hooks/use-fixed';
import { useData } from '@/store/store';

SplashScreen.preventAutoHideAsync();

function MealReminders() {
  useMealReminders();
  return null;
}

function FixedAuto() {
  useFixedAuto();
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const hydrated = useData((s) => s.hydrated);
  const pal = Palettes[scheme === 'dark' ? 'dark' : 'light'];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);
  useEffect(() => { void resumeMove(); }, []);

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: pal.bg, card: pal.surface, text: pal.ink, primary: pal.accent, border: pal.line } }}>
        <AuthProvider>
          <ToastProvider>
            <ExerciseMenuProvider>
            <StatusBar style="auto" />
            {Platform.OS !== 'web' ? <MealReminders /> : null}
            <FixedAuto />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="session" options={{ gestureEnabled: false }} />
              <Stack.Screen name="session-guide" options={{ headerShown: true, title: '음성 가이드' }} />
              <Stack.Screen name="program" options={{ headerShown: true, title: '중량 목표' }} />
              <Stack.Screen name="routine" options={{ headerShown: true, title: '운동 방식' }} />
              <Stack.Screen name="routine-edit" options={{ headerShown: true, title: '루틴 편집' }} />
              <Stack.Screen name="ability" options={{ headerShown: true, title: '할 수 있는 운동 체크' }} />
              <Stack.Screen name="exercises" options={{ headerShown: true, title: '운동 목록' }} />
              <Stack.Screen name="prefs/profile" options={{ headerShown: true, title: '내 정보' }} />
              <Stack.Screen name="prefs/body" options={{ headerShown: true, title: '신체 정보' }} />
              <Stack.Screen name="prefs/rules" options={{ headerShown: true, title: '운동 규칙' }} />
              <Stack.Screen name="prefs/workout" options={{ headerShown: true, title: '기록 방식' }} />
              <Stack.Screen name="activity/session" options={{ headerShown: true, title: '웨이트' }} />
              <Stack.Screen name="activity/run" options={{ headerShown: true, title: '유산소' }} />
              <Stack.Screen name="activity/lifts" options={{ headerShown: true, title: '웨이트 기록' }} />
              <Stack.Screen name="activity/move" options={{ headerShown: true, title: '걷기' }} />
              <Stack.Screen name="prefs/fixed" options={{ headerShown: true, title: '고정식단' }} />
              <Stack.Screen name="prefs/guide" options={{ headerShown: true, title: '음성 가이드' }} />
              <Stack.Screen name="prefs/life" options={{ headerShown: true, title: '생활 시간' }} />
              <Stack.Screen name="prefs/cheat" options={{ headerShown: true, title: '치팅데이' }} />
              <Stack.Screen name="prefs/meal-plan" options={{ headerShown: true, title: '식단 추천' }} />
              <Stack.Screen name="diet-report" options={{ headerShown: true, title: '내 식습관' }} />
              <Stack.Screen name="guide" options={{ headerShown: true, title: '기능 설명' }} />
              <Stack.Screen name="run-map" options={{ headerShown: true, title: '경로' }} />
              <Stack.Screen name="prefs/health" options={{ headerShown: true, title: '걸음 수' }} />
              <Stack.Screen name="prefs/privacy" options={{ headerShown: true, title: '개인정보처리방침' }} />
              <Stack.Screen name="prefs/app" options={{ headerShown: true, title: '앱 정보' }} />
              <Stack.Screen name="prefs/account" options={{ headerShown: true, title: '계정' }} />
              <Stack.Screen name="account" options={{ presentation: 'modal', headerShown: true, title: '계정' }} />
            </Stack>
            </ExerciseMenuProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
