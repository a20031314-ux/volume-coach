# 볼륨 코치

부위별 주간 세트 범위·운동 종류·휴식일 규칙과 회복도, 그날 컨디션, 나이·신체정보를 함께 계산해
**오늘 할 운동**을 추천하고, 기록할 때마다 다시 계산하는 운동·영양 기록 앱입니다.

- **오늘**: 컨디션 체크(수면·컨디션·근육통) → 오늘 권장 볼륨, 부위별 추천 운동·세트·반복, 교체, 바로 기록
- **기록**: 날짜·부위·운동·세트·중량·반복, 직접 만든 운동 추가
- **영양**: 목표 칼로리와 단백질·탄수화물·지방, 음식 기록(기본 20종 + 직접 입력)
- **주간**: 부위별 주간 세트와 목표 범위
- **설정**: 계정·동기화, 내 정보, 인바디(체중·골격근량·체지방률), 운동 규칙

기술 스택: Expo SDK 58 · Expo Router · TypeScript · zustand(로컬 우선 저장) · Supabase(로그인·동기화)

---

## 1. 내 폰에서 바로 실행해 보기 (서버 없이)

```bash
npm install
npx expo start
```

폰에 **Expo Go** 앱(SDK 58 지원 버전)을 설치하고, 터미널에 뜬 QR 코드를 찍으면 바로 열립니다.
서버를 연결하지 않으면 기록은 그 폰에만 저장됩니다.

## 2. 서버(Supabase) 연결 — 로그인·기기 간 동기화

1. https://supabase.com 에서 새 프로젝트를 만듭니다. 리전은 **Northeast Asia (Seoul)** 을 추천합니다.
2. 왼쪽 **SQL Editor**에서 `supabase/migrations/20261028000000_init.sql` 내용을 그대로 붙여넣고 **Run** 합니다.
   - `records` 테이블, 사용자별 접근 제한(RLS), 동기화 충돌 처리, 계정 삭제 함수가 만들어집니다.
3. **Project Settings → API**에서 Project URL과 Publishable key를 복사해, 프로젝트 폴더에 `.env` 파일을 만듭니다.
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
   ```
4. `npx expo start`를 다시 실행하면 설정 탭에 **로그인 / 회원가입**이 나타납니다.
5. (선택) 테스트 중 가입 확인 메일이 번거로우면 **Authentication → Providers → Email**에서 *Confirm email*을 끌 수 있습니다. 출시 전에는 다시 켜세요.

### 동기화 방식

- 모든 기록은 먼저 폰에 저장되고(헬스장에서 인터넷이 끊겨도 동작), 로그인 상태면 2.5초 뒤 서버로 올라갑니다.
- 앱을 다시 열 때마다 서버의 변경분을 받아옵니다. 같은 기록을 두 기기에서 고치면 **나중에 고친 쪽**이 남습니다.
- 서버에는 테이블 하나(`records`)에 종류(`log`·`checkin`·`meal`·`body`·`settings`)별 JSON으로 저장합니다. 필드를 추가해도 마이그레이션이 필요 없어서 초기에 빠르게 바꾸기 좋습니다.

## 3. 스토어 출시 (EAS)

준비물: Apple Developer Program(연 $99), Google Play Console(1회 $25), https://expo.dev 계정

```bash
npx eas-cli@latest login
npx eas-cli@latest init            # app.json에 프로젝트 ID 연결
npx eas-cli@latest build --profile preview --platform android   # 테스트용 APK
npx eas-cli@latest build --profile production --platform all    # 스토어용
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

- `.env` 값은 빌드 서버에 올라가지 않으니, EAS 대시보드 **Environment variables**에 같은 두 값을 등록하세요.
- `app.json`의 `ios.bundleIdentifier` / `android.package`(현재 `com.volumecoach.app`)는 **한 번 출시하면 바꿀 수 없습니다.** 본인 도메인 기반 이름으로 먼저 바꾸세요.
- 아이콘·스플래시(`assets/images`)는 아직 Expo 기본 이미지입니다.

### 출시 전 체크리스트

- [ ] 번들 ID 확정, 앱 아이콘·스플래시 교체
- [ ] 개인정보처리방침 URL (건강·신체 정보를 다루므로 두 스토어 모두 필수)
- [ ] 스토어 데이터 안전 설문(Google) / 앱 개인정보 라벨(Apple): 이메일, 건강·피트니스 데이터 수집 명시
- [ ] 앱 안 계정 삭제 — 구현됨 (설정 → 계정 삭제)
- [ ] Supabase *Confirm email* 다시 켜기, 이메일 발송을 자체 SMTP로 전환(기본 발송량 제한이 낮음)
- [ ] 소셜 로그인(구글·애플)을 추가하면 iOS는 애플 로그인도 함께 제공해야 함

## 개발

```bash
npm test          # 추천·회복·영양 계산 테스트
npm run typecheck
npm run lint
```

구조

```
src/
  app/                 화면 (Expo Router)
    (tabs)/            오늘 · 기록 · 영양 · 주간 · 설정
    account.tsx        로그인/회원가입
  lib/                 순수 계산 로직 (UI와 무관, 테스트 대상)
    coach.ts           회복도, 주간 볼륨, 오늘 추천
    profile.ts         나이·경력·목표별 추천, 제지방량, 단백질
    nutrition.ts       칼로리·영양소 목표, 기본 음식
    exercises.ts       부위·운동 목록
  store/
    store.ts           로컬 저장(zustand + AsyncStorage)
    sync.ts            Supabase 동기화
    auth.tsx           로그인 상태
supabase/migrations/   DB 스키마
```

## 계산 기준 요약

| 항목 | 기준 |
| --- | --- |
| 회복도 | 세트마다 피로 1(보조 부위 0.5, 고중량 복합 ×1.3)을 쌓고 부위별 반감기(팔·종아리·복근 16~20h, 가슴·등 30h, 하체 42h)로 감소. 30대 ×1.05 · 40대 ×1.15 · 50대 ×1.3 · 60대+ ×1.45, 여성 ×0.9 |
| 오늘 권장 볼륨 | 하루 최대 세트 × (수면 부족 −15%, 컨디션 처짐 −15%, 최근 전신 피로) |
| 기초대사량 | 체지방률·골격근량이 있으면 Katch-McArdle(제지방량), 없으면 Mifflin-St Jeor |
| 제지방량 | 체지방률이 있으면 체중 × (1 − 체지방률), 골격근량만 있으면 골격근량 ÷ 0.56 |
| 단백질 | 제지방량 × 2.0~2.5g(감량 2.3~2.8g), 없으면 체중 × 1.6~2.2g(감량 2.0~2.2g) |

추천은 일반적인 운동·영양 가이드에 기반한 참고용입니다.
