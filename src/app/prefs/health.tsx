import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Page } from '@/components/layout';
import { useToast } from '@/components/toast';
import { Button, Card, Row, Segmented, T } from '@/components/ui';
import { HEALTH_NAME, healthStatus, openHealthSettings, type HealthStatus } from '@/health/steps';
import { refreshSteps, setHealthEnabled, useDaySteps, useHealth } from '@/health/use-steps';
import { today } from '@/lib/dates';

export default function HealthPrefs() {
  const toast = useToast();
  const enabled = useHealth((s) => s.enabled);
  const steps = useDaySteps(today());
  const [status, setStatus] = useState<HealthStatus | null>(null);
  useEffect(() => { healthStatus().then(setStatus); }, []);

  if (Platform.OS === 'web' || status === 'unavailable') {
    return <Page><Card><T v="muted">이 기기에서는 걸음 수를 읽을 수 없어요.</T></Card></Page>;
  }

  const toggle = async (on: boolean) => {
    const ok = await setHealthEnabled(on);
    if (on && !ok) toast(`${HEALTH_NAME} 권한을 받지 못했어요`);
    if (ok) refreshSteps(today(), true);
  };

  return (
    <Page>
      <Card>
        <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: `${HEALTH_NAME} 연결` }]} value={enabled ? 'on' : 'off'}
          onChange={(v) => v && toggle(v === 'on')} />
        {enabled ? (
          <T v="small">{steps ? `오늘 ${Math.round(steps.steps).toLocaleString('ko-KR')}보 · ${(steps.meters / 1000).toFixed(1)}km`
            : steps === null ? '읽을 수 없어요. 권한을 확인하세요.' : '…'}</T>
        ) : null}
      </Card>
      {status === 'needsInstall' && Platform.OS === 'android' ? (
        <Card>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <T v="muted" style={{ flexShrink: 1 }}>헬스 커넥트 설치·업데이트 필요</T>
            <Button label="설치" onPress={() => Linking.openURL('market://details?id=com.google.android.apps.healthdata')} />
          </Row>
        </Card>
      ) : null}
      {enabled ? <Button label="권한 관리" onPress={openHealthSettings} /> : null}
    </Page>
  );
}
