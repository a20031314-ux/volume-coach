# 내 폰에 설치해서 써보기 (Android · iPhone)

스토어에 올리지 않고 내 폰에만 설치하는 방법입니다. 처음 한 번만 터미널에서 설정하면, 그 뒤로는 코드가 GitHub `main`에 올라갈 때마다 앱이 자동으로 업데이트됩니다.

## 0. 준비

- [ ] 컴퓨터에 Node.js 22 이상, git
- [ ] Expo 계정: https://expo.dev/signup (무료)
- [ ] iPhone에 설치하려면 Apple Developer Program 가입: https://developer.apple.com/programs/ (연 $99, 승인까지 하루 정도 걸릴 수 있음)

## 1. 프로젝트 연결 (한 번만)

```bash
git clone https://github.com/a20031314-ux/volume-coach
cd volume-coach
npm install
npm run eas:login          # Expo 계정으로 로그인
npm run eas:init           # Expo에 프로젝트를 만들고 app.json에 연결 정보를 넣어요
git add app.json
git commit -m "Link EAS project"
git push
```

`eas:init` 중에 프로젝트를 새로 만들지 물으면 **Yes**를 고르세요.

## 2. Android 설치

```bash
npm run build:android
```

- "Generate a new Android Keystore?"라고 물으면 **Yes**를 고르세요. 앱 서명 키가 Expo 서버에 안전하게 저장돼요.
- 빌드는 클라우드에서 10~20분 걸려요. 끝나면 터미널과 https://expo.dev 에 설치 링크와 QR 코드가 나와요.
- 폰에서 링크를 열어 APK를 받고 설치하세요. "출처를 알 수 없는 앱" 허용을 물으면 허용하면 돼요.

## 3. iPhone 설치 (TestFlight)

Apple Developer 가입이 끝난 뒤에 진행하세요.

```bash
npm run build:ios
```

- Apple ID 로그인을 물으면 개발자 계정으로 로그인하세요.
- 인증서와 프로비저닝 프로필을 만들지 물으면 모두 **Yes**를 고르세요.
- 빌드가 끝나면 App Store Connect에 자동으로 올라가요. 처음에는 App Store Connect에 앱을 새로 만들지 물어요. **Yes**를 고르세요.
- Apple 처리에 10~30분 더 걸려요. 그 뒤 iPhone에 **TestFlight** 앱을 설치하고, App Store Connect → 내 앱 → TestFlight → 내부 테스터에 본인을 추가하면 설치할 수 있어요.

## 4. 자동 업데이트 켜기

1. https://expo.dev → 오른쪽 위 프로필 → **Account settings → Access tokens → Create token**. 이름은 `github`로 하고 토큰을 복사하세요.
2. GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `EXPO_TOKEN`
   - Secret: 복사한 토큰
3. 토큰은 채팅이나 코드에 붙여넣지 마세요. 이 Secret에만 넣으면 돼요.

이제 `main`에 코드가 올라가면 GitHub Actions의 **Publish update**가 자동으로 돌아요. 폰에서 앱을 완전히 닫았다가 다시 열면 새 버전을 받아요. 바로 받고 싶으면 **설정 → 앱 정보 → 업데이트 확인**을 누르세요.

## 5. 다시 설치가 필요한 경우

새 네이티브 기능(예: 새 권한, 아이콘 변경, 새 네이티브 패키지)이 들어가면 기존 앱에는 업데이트가 적용되지 않아요. 앱이 망가지지 않게 자동으로 막아주는 장치예요. 이때는 새로 빌드해서 설치해야 해요.

- GitHub 저장소 → **Actions → Build test app → Run workflow** → 플랫폼 선택 → 실행
- 끝나면 Android는 expo.dev의 링크로 다시 설치하고, iPhone은 TestFlight에서 업데이트하면 돼요.

## 6. (권장) 서버 연결

앱을 지웠다 다시 설치해도 기록이 남게 하려면 Supabase를 연결하세요. README의 "서버(Supabase) 연결"대로 프로젝트를 만든 뒤, 값을 `.env`가 아니라 **expo.dev → 프로젝트 → Environment variables → preview 환경**에 넣으세요.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

다음 업데이트나 빌드부터 로그인 메뉴가 나타나요.
