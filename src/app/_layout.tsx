// Registers the background location task before anything else runs.
import '@/run/tracker';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseMenuProvider } from '@/components/exercise-menu';
import { ToastProvider } from '@/components/toast';
import { Palettes } from '@/constants/theme';
import { AuthProvider } from '@/store/auth';
import { useData } from '@/store/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const hydrated = useData((s) => s.hydrated);
  const pal = Palettes[scheme === 'dark' ? 'dark' : 'light'];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: pal.bg, card: pal.surface, text: pal.ink, primary: pal.accent, border: pal.line } }}>
        <AuthProvider>
          <ToastProvider>
            <ExerciseMenuProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="session" options={{ gestureEnabled: false }} />
              <Stack.Screen name="routine" options={{ headerShown: true, title: '루틴 설정' }} />
              <Stack.Screen name="routine-edit" options={{ headerShown: true, title: '루틴 편집' }} />
              <Stack.Screen name="ability" options={{ headerShown: true, title: '할 수 있는 운동 체크' }} />
              <Stack.Screen name="exercises" options={{ headerShown: true, title: '운동 목록' }} />
              <Stack.Screen name="account" options={{ presentation: 'modal', headerShown: true, title: '계정' }} />
            </Stack>
            </ExerciseMenuProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
