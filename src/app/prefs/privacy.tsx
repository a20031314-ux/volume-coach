import { Linking } from 'react-native';

import { Page } from '@/components/layout';
import { Button, Card, T } from '@/components/ui';
import policy from '@/content/privacy.json';
import { PRIVACY_URL } from '@/lib/links';

/** The privacy policy, same text as the web page (docs/privacy). */
export default function Privacy() {
  return (
    <Page>
      <T v="small">시행일 {policy.effective} · 문의 {policy.contact}</T>
      {policy.sections.map((s) => (
        <Card key={s.h} style={{ gap: 6 }}>
          <T v="title" style={{ fontSize: 15 }}>{s.h}</T>
          {s.p.map((x, i) => <T key={i}>{x}</T>)}
        </Card>
      ))}
      {PRIVACY_URL ? <Button label="웹에서 보기" kind="ghost" onPress={() => Linking.openURL(PRIVACY_URL)} style={{ alignSelf: 'center' }} /> : null}
    </Page>
  );
}
