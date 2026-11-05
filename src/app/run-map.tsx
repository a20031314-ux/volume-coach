import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { T } from '@/components/ui';
import { usePalette } from '@/constants/theme';
import { useData } from '@/store/store';

/** Full-screen route map you can pan and zoom. */
export default function RunMap() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useData((s) => (id ? s.runs[id] : undefined));
  if (!run || run.deleted) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24 }}><T v="muted">기록을 찾을 수 없어요.</T></View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <RouteMap route={run.route} grades={run.elev?.pointGrade} height="fill" interactive />
    </View>
  );
}
