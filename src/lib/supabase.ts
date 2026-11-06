import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// The publishable key is meant to ship inside the app (access is enforced by row-level security),
// so the project's values are kept here as defaults. Env vars still override them, e.g. for a staging project.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://eiohgdcxtugbufuvwkzt.supabase.co';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4uNY4LvApdMMR8T25cu24Q_ynew12It';

/** null when the server isn't configured yet — the app then runs fully offline on this device. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Refresh the session only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
