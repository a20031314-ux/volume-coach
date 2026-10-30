import { router } from 'expo-router';

import { Group, ListRow, Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { ConfirmButton, T } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/store';

export default function AccountPrefs() {
  const auth = useAuth();
  const toast = useToast();
  const dirty = useData((x) => x.dirty.length);
  const status = auth.syncing ? '동기화 중…' : auth.lastSync?.ok === false ? `실패: ${auth.lastSync.error}` : dirty ? `보낼 변경 ${dirty}개` : '동기화됨';

  return (
    <Page>
      <Group>
        <ListRow label={auth.email ?? '계정'} value={status} />
        <ListRow label="지금 동기화" onPress={() => void auth.sync()} />
        <ListRow label="로그아웃" onPress={async () => { await auth.signOut(); router.back(); }} last />
      </Group>
      <ConfirmButton label="계정 삭제" confirmLabel="정말 삭제 (모든 기록이 지워져요)" style={{ alignSelf: 'center' }} onConfirm={async () => {
        const err = await auth.deleteAccount();
        toast(err ? `삭제 실패: ${err}` : '계정과 모든 기록을 삭제했어요');
        if (!err) router.back();
      }} />
      {!auth.session ? <T v="muted">로그인되어 있지 않아요.</T> : null}
    </Page>
  );
}
