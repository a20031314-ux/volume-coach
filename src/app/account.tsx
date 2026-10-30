import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { useToast } from '@/components/toast';
import { Banner, Button, Field, Segmented } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function Account() {
  const c = usePalette();
  const auth = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMsg('이메일 형식을 확인해 주세요.');
    if (pw.length < 8) return setMsg('비밀번호는 8자 이상이어야 해요.');
    setBusy(true);
    try {
      if (mode === 'in') {
        const err = await auth.signIn(email.trim(), pw);
        if (err) return setMsg(err);
        toast('로그인했어요');
        router.back();
      } else {
        const { error, needsConfirm } = await auth.signUp(email.trim(), pw);
        if (error) return setMsg(error);
        if (needsConfirm) { setMode('in'); setMsg('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.'); return; }
        toast('가입했어요');
        router.back();
      }
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: Space.lg, gap: Space.md, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Segmented options={[{ v: 'in', n: '로그인' }, { v: 'up', n: '회원가입' }]} value={mode} onChange={(v) => v && setMode(v)} />
      <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="비밀번호 (8자 이상)" value={pw} onChangeText={setPw} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} textContentType={mode === 'in' ? 'password' : 'newPassword'} onSubmitEditing={submit} />
      {msg ? <Banner text={msg} /> : null}
      <Button kind="primary" label={busy ? '잠시만요…' : mode === 'in' ? '로그인' : '가입하기'} onPress={submit} disabled={busy} style={{ paddingVertical: 13 }} />
    </ScrollView>
  );
}
