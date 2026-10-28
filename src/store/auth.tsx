import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

import { useData } from './store';
import { startAutoSync, syncNow, type SyncResult } from './sync';

interface AuthCtx {
  configured: boolean;
  session: Session | null;
  email: string | null;
  lastSync: SyncResult | null;
  syncing: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  sync: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const KO: Record<string, string> = {
  'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요.',
  'User already registered': '이미 가입된 이메일이에요. 로그인해 주세요.',
  'Email not confirmed': '메일함에서 가입 확인 링크를 먼저 눌러 주세요.',
};
const ko = (m: string) => KO[m] ?? m;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try { setLastSync(await syncNow()); } finally { setSyncing(false); }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const first = setTimeout(() => void sync(), 0);
    const unsub = startAutoSync();
    const app = AppState.addEventListener('change', (st) => { if (st === 'active') void sync(); });
    return () => { clearTimeout(first); unsub(); app.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const value: AuthCtx = {
    configured: !!supabase,
    session,
    email: session?.user.email ?? null,
    lastSync,
    syncing,
    sync,
    signIn: async (email, password) => {
      if (!supabase) return '서버가 설정되지 않았어요';
      // records made before login belong to this device; upload them to the account
      useData.getState().markAllDirty();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? ko(error.message) : null;
    },
    signUp: async (email, password) => {
      if (!supabase) return { error: '서버가 설정되지 않았어요', needsConfirm: false };
      useData.getState().markAllDirty();
      const { data, error } = await supabase.auth.signUp({ email, password });
      return { error: error ? ko(error.message) : null, needsConfirm: !error && !data.session };
    },
    signOut: async () => {
      if (!supabase) return;
      await syncNow();
      await supabase.auth.signOut();
      useData.getState().resetAll();
      setLastSync(null);
    },
    deleteAccount: async () => {
      if (!supabase) return '서버가 설정되지 않았어요';
      const { error } = await supabase.rpc('delete_my_account');
      if (error) return error.message;
      await supabase.auth.signOut();
      useData.getState().resetAll();
      return null;
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
