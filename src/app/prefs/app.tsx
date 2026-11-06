import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Platform } from 'react-native';

import { router } from 'expo-router';

import { Group, ListRow, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { ConfirmButton } from '@/components/ui';
import { useHealth } from '@/health/use-steps';
import { useMove } from '@/move/tracker';
import { useData } from '@/store/store';

const stamp = (d: Date | null) =>
  d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '설치 버전';

/** App version and over-the-air update status. */
export default function AppInfo() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const enabled = Platform.OS !== 'web' && Updates.isEnabled;

  const check = async () => {
    if (!enabled) return toast('개발 모드에서는 업데이트를 확인할 수 없어요');
    setBusy(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) { toast('최신 버전이에요'); return; }
      await Updates.fetchUpdateAsync();
      toast('새 버전을 받았어요. 다시 시작해요');
      await Updates.reloadAsync();
    } catch (e) {
      toast(`확인 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <Group>
        <ListRow label="앱 버전" value={Constants.expoConfig?.version ?? '–'} />
        <ListRow label="코드 업데이트" value={enabled ? (Updates.isEmbeddedLaunch ? '설치 버전' : stamp(Updates.createdAt)) : '개발 모드'} />
        <ListRow label="채널" value={enabled ? Updates.channel ?? '–' : '–'} last />
      </Group>
      <Group>
        <ListRow label={busy ? '확인 중…' : '업데이트 확인'} onPress={busy ? undefined : () => void check()} last />
      </Group>
      <Group>
        <ListRow label="개인정보처리방침" onPress={() => router.push('/prefs/privacy')} last />
      </Group>
      <ConfirmButton label="이 기기의 기록 모두 지우기" confirmLabel="정말 지우기 (되돌릴 수 없어요)" style={{ alignSelf: 'center' }}
        onConfirm={() => {
          // device only: the server copy (if signed in) stays until the account is deleted
          useData.getState().resetAll();
          useMove.setState({ days: {} });
          useHealth.setState({ days: {}, readAt: {}, buckets: {}, bucketsAt: {} });
          toast('이 기기의 기록을 지웠어요');
        }} />
    </Page>
  );
}
