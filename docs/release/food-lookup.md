# AI 음식 검색 켜기 (서버 설정)

앱 코드는 이미 들어가 있어요. 아래를 한 번 해야 "AI로 영양정보 찾기"와 공유 캐시가 동작해요.
설정 전에는 버튼을 눌러도 "검색 중 문제가 생겼어요"가 나오고, 나머지 기능은 그대로 동작해요.

## 1. Anthropic API 키 만들기
1. https://console.anthropic.com 에서 가입·결제 수단 등록
2. API Keys → Create Key → 복사 (`sk-ant-...`). **채팅·코드·GitHub에 붙여넣지 않기**
3. (권장) Limits에서 월 사용 한도를 $10 정도로 설정

## 2. 서버에 테이블·함수 올리기 (PowerShell, 저장소 폴더에서)
```powershell
git pull
npx supabase@latest login
npx supabase@latest link --project-ref eiohgdcxtugbufuvwkzt
npx supabase@latest db push                      # food_cache 등 테이블 생성
npx supabase@latest secrets set ANTHROPIC_API_KEY=sk-ant-여기에키
npx supabase@latest functions deploy food-lookup
```
- 선택 설정: `FOOD_DAILY_PER_USER`(기본 30), `FOOD_MONTHLY_CAP`(기본 2000건 ≈ $50), `FOOD_MODEL`(기본 claude-haiku-5-5)
- 앱 쪽은 코드만 바뀌어서 `npm run update`로 반영

## 3. 동작 방식
- 검색창에 입력하면 먼저 **공유 캐시**(다른 사용자가 이미 찾은 메뉴)를 보여줌 → 비용 없음, 로그인 불필요
- 없으면 "AI로 영양정보 찾기" → 로그인한 사용자만, 하루 30건
- 출처가 업체 공식 사이트·공공 자료(.go.kr)이고 AI가 실제로 검색한 페이지일 때만 **모두에게 공유**. 블로그·칼로리 앱 값이나 출처 없는 값은 찾은 사람 폰에만 저장되고 "웹 자료(검증 전)" / "AI 추정"으로 표시
- 탄수화물·지방이 표에 없으면(국내 프랜차이즈 대부분) 열량−단백질에서 추정하고 "추정" 표시
- "값이 이상해요" 신고 2건이면 공유 중단

## 4. 비용 확인
Supabase SQL Editor:
```sql
select date_trunc('day', at) d, count(*) filter (where not hit) ai, count(*) filter (where hit) cache, sum(searches) searches
from food_lookup_log group by 1 order by 1 desc limit 14;
```
웹 검색 1회 $0.01 + 토큰 소량 → 새 메뉴 1개 약 $0.02~0.03.

## 5. 정책·문서
- 개인정보처리방침 4항에 Anthropic(음식 이름 전송) 추가함 → `npm run privacy` 완료, 공개 주소에 다시 올리기
- Play 데이터 보안: 음식 이름 검색어는 개인 식별 정보가 아니어서 추가 항목 없음(앱 활동 → 기타 사용자 생성 콘텐츠로 볼 여지가 있으면 "수집·공유: 예, 선택, 앱 기능"으로 보수적으로 표시)
