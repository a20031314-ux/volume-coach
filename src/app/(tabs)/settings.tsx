import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useToast } from '@/components/toast';
import { Banner, Button, Card, Chip, ConfirmButton, NumField, Pills, Row, Screen, Segmented, T } from '@/components/ui';
import { Space, usePalette } from '@/constants/theme';
import { fmt, today } from '@/lib/dates';
import { MUSCLES } from '@/lib/exercises';
import { body, latestBodyComp, proteinTarget, recommendedVolume, recoveryMultiplier, type VolumeRec } from '@/lib/profile';
import type { Goal, Profile, Settings } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { live, useData } from '@/store/store';

export default function SettingsScreen() {
  const c = usePalette();
  const toast = useToast();
  const auth = useAuth();
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const bodyT = useData((x) => x.bodyComps);
  const addBody = useData((x) => x.addBodyComp);
  const removeBody = useData((x) => x.removeBodyComp);
  const dirty = useData((x) => x.dirty.length);
  const [undo, setUndo] = useState<VolumeRec | null>(null);
  const [bc, setBc] = useState<{ weight: number | null; smm: number | null; fatPct: number | null }>({ weight: null, smm: null, fatPct: null });

  const p = s.profile;
  const setP = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } });
  const comps = useMemo(() => live(bodyT).sort((a, b) => (a.date < b.date ? 1 : -1)), [bodyT]);
  const { rec, why } = recommendedVolume(p);
  const same = rec.min === s.min && rec.max === s.max && rec.cap === s.cap && rec.mcap === s.mcap;
  const b = body(p, comps);
  const pt = b ? proteinTarget(p, b) : null;
  const m = recoveryMultiplier(p);
  const latest = latestBodyComp(comps);

  const num = (k: keyof Settings, label: string) => (
    <NumField label={label} value={s[k] as number}
      onCommit={(v) => {
        if (v == null) return;
        const patch: Partial<Settings> = { [k]: k === 'ready' ? Math.min(100, v) : v };
        if (k === 'min' && v > s.max) patch.max = v;
        if (k === 'max' && v < s.min) patch.min = v;
        update(patch);
      }} />
  );

  return (
    <Screen title="설정">
      <T v="label" style={{ marginTop: 0 }}>계정</T>
      <Card>
        {!auth.configured ? (
          <T v="muted">서버가 아직 연결되지 않아 이 기기에만 저장돼요. 개발자가 Supabase 주소를 설정하면 로그인과 동기화가 켜져요.</T>
        ) : auth.session ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flexShrink: 1 }}>
                <T>{auth.email}</T>
                <T v="small">
                  {auth.syncing ? '동기화 중…' : auth.lastSync?.ok === false ? `동기화 실패: ${auth.lastSync.error}` : dirty ? `보낼 변경 ${dirty}개` : '모든 기기와 동기화됨'}
                </T>
              </View>
              <Button label="지금 동기화" onPress={() => void auth.sync()} disabled={auth.syncing} />
            </Row>
            <Row>
              <Button label="로그아웃" onPress={() => void auth.signOut()} />
              <ConfirmButton label="계정 삭제" confirmLabel="정말 삭제" onConfirm={async () => {
                const err = await auth.deleteAccount();
                toast(err ? `삭제 실패: ${err}` : '계정과 모든 기록을 삭제했어요');
              }} />
            </Row>
          </>
        ) : (
          <>
            <T v="muted">로그인하면 기록이 계정에 저장되고 폰을 바꿔도 이어서 쓸 수 있어요. 지금까지 이 기기에 쌓은 기록도 함께 올라가요.</T>
            <Button label="로그인 / 회원가입" kind="primary" onPress={() => router.push('/account')} style={{ alignSelf: 'flex-start' }} />
          </>
        )}
      </Card>

      <T v="label">내 정보</T>
      <Card>
        <Row gap={Space.md}>
          <NumField label="나이" value={p.age} onCommit={(age) => setP({ age })} placeholder="예: 32" />
          <NumField label="키 cm" value={p.height} onCommit={(height) => setP({ height })} decimal placeholder="예: 175" />
          <NumField label="체중 kg" value={p.weight} onCommit={(weight) => setP({ weight })} decimal placeholder="예: 75" />
        </Row>
        {latest ? <T v="small">계산에는 인바디 최근 체중 {latest.weight}kg({fmt(latest.date)})을 써요.</T> : null}
        <View style={{ gap: 6 }}><T v="muted">성별</T>
          <Segmented options={[{ v: 'm', n: '남성' }, { v: 'f', n: '여성' }]} value={p.sex || null} onChange={(v) => setP({ sex: (v ?? '') as Profile['sex'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">웨이트 경력</T>
          <Segmented options={[{ v: '0', n: '1년 미만' }, { v: '1', n: '1~3년' }, { v: '3', n: '3년 이상' }]} value={p.years || null} onChange={(v) => setP({ years: (v ?? '') as Profile['years'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">운동 외 활동량</T>
          <Segmented options={[{ v: '0', n: '앉아서' }, { v: '1', n: '자주 걸음' }, { v: '2', n: '서서 일함' }]} value={p.act ?? '1'} onChange={(v) => setP({ act: (v ?? '1') as Profile['act'] })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">우선 목표</T>
          <Pills options={[{ k: 'hyp', n: '근비대' }, { k: 'str', n: '근력' }, { k: 'cut', n: '체지방 감량' }, { k: 'fit', n: '건강·체력' }] as { k: Goal; n: string }[]}
            value={p.goal} onToggle={(goal) => setP({ goal })} />
        </View>

        <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: Space.md, gap: Space.sm }}>
          <Row gap={Space.xl}>
            <View><T v="small">추천 범위</T><T v="num">{rec.min}~{rec.max}<T v="small"> 세트/주</T></T></View>
            <View><T v="small">하루 최대</T><T v="num">{rec.cap}<T v="small"> 세트</T></T></View>
            <View><T v="small">회복 속도</T><T v="num">{m === 1 ? '기본' : m < 1 ? '빠름' : `×${m.toFixed(2)}`}</T></View>
          </Row>
          {b ? <T v="muted">BMI {b.bmi.toFixed(1)}{pt ? ` · 권장 단백질 하루 ${pt.lo}~${pt.hi}g (${pt.basis})` : ''}</T> : null}
          {why.length ? <T v="small">{why.join(' · ')}</T> : null}
          <T v="small">현재 규칙 {s.min}~{s.max}세트 · 하루 {s.cap}세트. 회복 속도와 반복 범위는 바로 반영되고, 세트 범위는 버튼을 눌러야 바뀌어요.</T>
          <Row>
            {same ? <Chip tone="ok" label="규칙이 추천값과 같아요" /> : (
              <Button kind="primary" label="추천값으로 규칙 바꾸기" onPress={() => {
                setUndo({ min: s.min, max: s.max, cap: s.cap, mcap: s.mcap, minEx: s.minEx });
                update(rec); toast('추천값으로 규칙을 바꿨어요');
              }} />
            )}
            {undo ? <Button label="되돌리기" onPress={() => { update(undo); setUndo(null); toast('이전 규칙으로 되돌렸어요'); }} /> : null}
          </Row>
        </View>
      </Card>

      <T v="label">인바디</T>
      <Card>
        <Row gap={Space.md}>
          <NumField label="체중 kg" value={bc.weight} onCommit={(weight) => setBc((x) => ({ ...x, weight }))} decimal />
          <NumField label="골격근량 kg" value={bc.smm} onCommit={(smm) => setBc((x) => ({ ...x, smm }))} decimal />
          <NumField label="체지방률 %" value={bc.fatPct} onCommit={(fatPct) => setBc((x) => ({ ...x, fatPct }))} decimal />
        </Row>
        <Button kind="primary" label="오늘 측정값 저장" onPress={() => {
          if (!bc.weight) return toast('체중을 입력하세요');
          if (bc.fatPct != null && (bc.fatPct <= 0 || bc.fatPct >= 70)) return toast('체지방률은 1~69% 사이로 입력하세요');
          addBody({ date: today(), weight: bc.weight, smm: bc.smm, fatPct: bc.fatPct });
          setBc({ weight: null, smm: null, fatPct: null }); toast('인바디 기록을 저장했어요');
        }} />
        {b?.ffm ? (
          <Banner tone="accent" text={`제지방량 ${b.ffm.toFixed(1)}kg(${b.ffmSource === 'fat' ? '체지방률로 계산' : '골격근량 ÷ 0.56으로 추정'}) 기준으로 단백질과 기초대사량을 계산해요.`} />
        ) : <T v="small">체지방률이나 골격근량을 넣으면 체중 대신 제지방량으로 더 정확하게 계산해요.</T>}
        {comps.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 6, borderTopWidth: 1, borderColor: c.line }}>
            <T style={{ flex: 1 }}>{fmt(x.date)}</T>
            <T v="muted">{x.weight}kg{x.smm ? ` · 골격근 ${x.smm}` : ''}{x.fatPct ? ` · 체지방 ${x.fatPct}%` : ''}</T>
            <ConfirmButton label="삭제" onConfirm={() => removeBody(x.id)} />
          </View>
        ))}
      </Card>

      <T v="label">운동 규칙</T>
      <Card>
        <Row gap={Space.md}>{num('min', '부위당 주간 최소 세트')}{num('max', '부위당 주간 최대 세트')}</Row>
        <Row gap={Space.md}>{num('minEx', '부위당 최소 운동 종류')}{num('gap', '같은 부위 사이 휴식일')}</Row>
        <Row gap={Space.md}>{num('cap', '하루 최대 세트')}{num('mcap', '한 부위 하루 최대 세트')}</Row>
        <Row gap={Space.md}>{num('ready', '운동 가능 회복도 %')}</Row>
        <View style={{ gap: 6 }}><T v="muted">디로드 주간 (범위 절반)</T>
          <Segmented options={[{ v: 'off', n: '끔' }, { v: 'on', n: '켬' }]} value={s.deload ? 'on' : 'off'} onChange={(v) => update({ deload: v === 'on' })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">주 시작 요일</T>
          <Segmented options={[{ v: 1, n: '월요일' }, { v: 0, n: '일요일' }]} value={s.weekStart} onChange={(v) => v != null && update({ weekStart: v as 0 | 1 })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">보조 부위 반영</T>
          <Segmented options={[{ v: 0.5, n: '0.5세트로' }, { v: 0, n: '안 함' }]} value={s.sec} onChange={(v) => v != null && update({ sec: v as number })} />
        </View>
        <View style={{ gap: 6 }}><T v="muted">관리할 부위</T>
          <Pills options={MUSCLES} value={MUSCLES.filter((x) => !s.off.includes(x.k)).map((x) => x.k)}
            onToggle={(k) => update({ off: s.off.includes(k) ? s.off.filter((x) => x !== k) : [...s.off, k] })} />
        </View>
        <T v="small">회복도는 부위별 회복 속도와 최근 세트 수로 계산해요. 고중량 복합 운동은 피로를 더 크게 남겨요. 회복도가 기준보다 20% 이내로 낮으면, 이번 주 목표가 급한 부위만 세트를 줄여 추천해요.</T>
      </Card>
      <T v="small">이 앱의 추천은 일반적인 운동·영양 가이드에 기반한 참고용이에요. 부상이나 질환이 있다면 전문가와 먼저 상의하세요.</T>
    </Screen>
  );
}
