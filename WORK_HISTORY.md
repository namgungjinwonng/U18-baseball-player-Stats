# 개발용 작업 이력 및 검증 인계서

> 작성일: 2026-07-13  
> 작업 위치: `dev-repo/`  
> 운영 원본: `base-repo/` 변경 없음  
> 목적: Claude 검증 후 사용자가 운영 반영 여부를 결정

## 1. 유지한 설계 원칙

- 데이터 경로는 기존 `data/{year}/` 구조를 유지했다.
- `data/seasons/` 재배치와 status manifest는 도입하지 않았다.
- 전역 연도 선택에는 `통산`을 넣지 않았다.
- 통산은 선수 상세 화면 안의 `시즌별 | 통산` 토글로만 제공한다.
- 별도 차트 라이브러리나 선수 데이터 샤드는 추가하지 않았다.
- 과거 시즌은 현재 시즌 자동 수집 파이프라인에 포함하지 않았다.
- `matchups/{id}.json`은 별도 파일로 만들지 않고 선수 JSON의 `matchups`에 포함했다.

## 2. 과거 시즌 데이터

- `data/2024/`, `data/2025/`를 2026과 같은 최상위 구성으로 생성했다.
- `data/years.json`: `[2026, 2025, 2024]`
- 각 시즌에 `averages.json`이 존재한다.
- 최종 데이터 검사 결과:

| 연도 | 선수 수 | personNo 커버리지 | matchup 연결 | 일정 |
|---:|---:|---:|---:|---:|
| 2026 | 2,458 | 99.88% | 71,270 | 876 |
| 2025 | 2,606 | 99.81% | 87,500 | 1,043 |
| 2024 | 2,602 | 99.50% | 87,000 | 1,055 |

## 3. KBSA 저부하 수집 및 재실행 안전성

- `YEAR` 환경변수로 과거 시즌을 1회 생성할 수 있게 했다.
- 요청 간격, 타임아웃, 동시 요청 수를 환경변수로 제어한다.
- 공식 기록 수집은 50명마다 체크포인트를 기록하여 중단 후 이어받을 수 있다.
- 과거 시즌 권장값은 단일 동시 요청과 750ms 간격이다.
- 관련 파일: `scraper/src/`, `scraper/package.json`, `README.md`

## 4. 통산 모드

- scraper가 `data/career-index.json`을 생성한다.
- 구조: `personNo -> { 연도: 선수ID }`
- 앱은 연도별 전체 `players/index.json`을 반복 다운로드하지 않고, 작은 역인덱스와 해당 선수 JSON만 읽는다.
- 카운팅 스탯은 합산하고 AVG/OBP/SLG/OPS/ERA/WHIP는 합산 원자료로 재계산한다.
- 서로 다른 시즌의 리그 환경을 임의로 합치지 않기 위해 통산 wRC+·WAR 등 리그 대비 지표는 표시하지 않는다.
- 기존 인라인 SVG 미니 바 차트를 유지했다.
- 통산 요약의 타율, OPS, 경기, 타석, 타수, 안타, 홈런 등 항목을 누르면 해당 항목의 연도별 차트로 변경된다.
- 제목 옆에 `항목 선택 시 연도별 비교` 안내를 작게 표시한다.
- 주요 파일:
  - `web/src/shared/career.ts`
  - `web/src/shared/career.test.ts`
  - `web/src/shared/CareerPanel.tsx`
  - `web/src/shared/data.ts`
  - `web/src/mobile/pages/MPlayer.tsx`
  - `web/src/desktop/pages/PlayerPage.tsx`
  - `web/src/app.css`

## 5. 앱 시작 연도

- 앱을 새로 시작하면 브라우저의 과거 저장값이 아니라 실제 현재 연도를 우선 선택한다.
- 실제 현재 연도가 `data/years.json`에 있으면 그 연도를 기본값으로 사용한다.
- 아직 해당 연도 데이터가 없으면 `years.json` 첫 항목(최신 제공 연도)을 사용한다.
- 예: 2027년에 `years.json`에 2027이 있으면 2027이 기본값이다.
- 수정 파일: `web/src/shared/year.tsx`

## 6. 선수 상세의 연도 전환

### 구현

- 선수 ID는 시즌마다 달라질 수 있으므로 `personNo`를 동일인 식별 키로 사용한다.
- `/player/{id}`에서 연도를 변경하면 `career-index.json`으로 선택 연도의 선수 ID를 찾아 이동한다.
- 선택 연도에 기록이 없으면 `/person/{personNo}`로 이동한다.
- `/person/{personNo}`에서 다시 기록 있는 연도를 선택하면 `/player/{선택연도 선수ID}`로 복귀한다.
- `/player` 화면에서 이전 비동기 데이터가 잠시 남아 잘못 이동하는 것을 막기 위해 현재 URL의 선수 ID와 로드된 선수 ID가 일치할 때만 연도 이동을 수행한다.

### 발견하고 수정한 결함

초기 구현에는 `/person/{personNo}` 화면에서 기록 있는 연도로 복귀시키는 로직이 없었다. 그 결과 `기록 있음 → 기록 없음 → 기록 있음` 순서에서 URL은 계속 `/person`에 남고 “이번 시즌 경기 기록이 없는 선수”가 표시됐다.

`web/src/shared/PersonView.tsx`가 `useCareerPlayers(personNo)`와 현재 연도를 사용하여 선택 연도에 선수 기록이 존재하면 해당 `/player/{id}`로 자동 이동하도록 수정했다. 이 화면은 모바일과 데스크톱이 공유한다.

### 실제 브라우저 검증

동일인 `personNo=201802001388` 김다원 선수로 다음 순서를 확인했다.

1. 2025: `/player/배명고_김다원_52` — 배명고, 2학년, 기록 표시
2. 2024: `/person/201802001388` — 해당 시즌 경기 기록 없음
3. 2026 선택
4. `/player/강릉고_김다원_7`로 자동 이동
5. 강릉고, 3학년, 7번과 2026 경기 기록 정상 표시

관련 파일:

- `web/src/mobile/pages/MPlayer.tsx`
- `web/src/desktop/pages/PlayerPage.tsx`
- `web/src/shared/PersonView.tsx`
- `web/src/shared/year.tsx`

## 7. 모바일 UI

- 375×812 뷰포트에서 통산 토글, 항목 선택, 미니 바 차트와 상단 연도 선택을 확인했다.
- 작은 화면에서 상단 바가 가로로 넘치지 않도록 모바일 CSS를 보완했다.
- 참고 캡처: `ui-career-mobile.png`

## 8. 자동 검증

전체 검증 명령:

```powershell
cd C:\Users\user\Desktop\claude_code\U18-baseball-player-Stats-new\dev-repo
.\verify-dev.ps1
```

개별 웹 검증:

```powershell
cd web
npm exec tsc -- --noEmit
npm run build
```

2026-07-13 최종 결과:

- TypeScript 검사 통과
- Vite production build 통과
- 94 modules transformed
- JS 번들: 310.18 kB, gzip 99.74 kB
- 통산 계산 테스트 통과
- 데이터 구조 및 personNo 커버리지 검사 통과

## 9. Claude 검증 체크리스트

- [ ] `base-repo/`에 변경이 없는지 확인
- [ ] 2024·2025·2026 최상위 데이터 구성과 JSON 스키마 비교
- [ ] 각 연도 `averages.json`과 personNo 99% 이상 확인
- [ ] `career-index.json`의 personNo 및 연도별 선수 ID 연결 확인
- [ ] 통산 AVG/OPS/ERA/WHIP가 시즌 비율 평균이 아닌 원자료 합산 재계산인지 확인
- [ ] 통산 요약 항목 선택 시 연도별 미니 바 차트가 변경되는지 확인
- [ ] 앱 시작 시 현재 연도 우선 선택 및 미제공 연도 fallback 확인
- [ ] 선수 페이지에서 `기록 있음 → 기록 없음 → 기록 있음` 연도 전환 확인
- [ ] 375px 모바일 레이아웃 확인
- [ ] `verify-dev.ps1`, tsc, production build 재실행

## 10. 운영 반영 전 주의사항

- 이 디렉터리는 검증용 복제본이며 Git 저장소가 아니다.
- 운영 반영은 Claude 검증과 사용자 승인 후 변경 파일 및 생성 데이터를 선별하여 `base-repo/`에 적용해야 한다.
- 운영 반영 전 서비스워커 캐시 버전과 배포 데이터 포함 범위를 별도로 확인한다.

## 11. 2026-07-13 후속 개선 반영

Claude 검토 의견을 반영하여 다음을 추가 수정했다.

### 새로고침 시 선택 연도 유지

- `year.tsx`가 선택 연도를 `sessionStorage`의 `u18-selected-year`에 저장한다.
- 같은 탭의 `location.reload()`에서는 선택 연도를 유지한다.
- 새 탭/새 앱 세션에서는 실제 현재 연도를 우선한다.
- 저장된 연도가 `years.json`에 없으면 실제 현재 연도, 그것도 없으면 최신 제공 연도로 폴백한다.
- 저장소 접근이 차단된 브라우저에서도 앱이 중단되지 않도록 예외를 처리했다.

### career-index 런타임 다운로드 제거

- `data/career-index.json` 원본 349,263바이트(gzip 예상 약 76,512바이트)를 앱 런타임에서 더 이상 fetch하지 않는다.
- scraper의 `writeYearsIndex`가 각 `profiles/{personNo}.json`에 `careerYears: {연도: 선수ID}`를 기록한다.
- profile이 없던 기록 선수 23명은 이름, personNo, 빈 학교/수상 배열을 가진 최소 profile로 생성했다.
- 총 4,980명의 profile에 매핑을 생성했다.
- 이후 `npm run profiles`를 단독 재실행해도 기존 `careerYears`를 보존한다.
- `career-index.json`은 scraper 생성 및 검증용으로 유지한다.
- 로컬 재생성 명령: `cd scraper; npm run career-index`
- 데이터 검증기는 선수 index, career-index, profile careerYears가 모두 같은 ID인지 대조한다.

### 연도 전환 쿼리 정리

- 선수 상세에서 연도를 바꿀 때 연도 종속 대회 필터 `t`를 URL에서 제거한다.
- 지역·학교·학년 등 다른 쿼리는 유지한다.
- 화면 내부의 `tournamentSlug` 상태도 함께 초기화한다.
- 모바일, 데스크톱, 무기록 `/person`에서 기록 화면으로 복귀하는 경로에 모두 적용했다.

### 통산 미니 바 차트 개선

- 비율 지표도 해당 선수의 시즌 최댓값을 100%로 사용하여 연도별 대비가 선명하게 보인다.
- 값이 0인 항목은 최소 3% 막대를 그리지 않고 0%로 표시한다.
- ERA 또는 WHIP 선택 시 제목 옆에 `낮을수록 좋음`을 표시한다.

### 후속 검증 결과

- scraper TypeScript 통과
- web TypeScript 통과
- scraper 회귀 테스트 4종 통과
- 2024·2025·2026 데이터 무결성 및 profile careerYears 대조 통과
- 통산 계산 테스트 통과(권민수 59/197 = .299)
- Vite production build 통과(94 modules, JS gzip 99.99 kB)
- 브라우저 자동 제어는 로컬 주소에 대한 도구 정책 차단으로 실행하지 못했으므로 아래 수동 확인이 필요하다.

### 추가 수동 확인 (2026-07-13 Claude 브라우저 실측 완료)

- [x] 연도 선택 후 `location.reload()` → 선택 연도 유지 (sessionStorage `u18-selected-year` 확인)
- [x] `?t=nonexist&g=2`가 있는 선수에서 연도 변경 → `t`만 제거되고 `g=2` 유지
- [x] 통산 진입·연도 변경 시 `career-index.json` 네트워크 요청 없음 (profiles/{personNo}.json + 연도별 선수 JSON만 로드)
- [x] `/person/{personNo}` 직접 진입 시 기록 있는 연도면 `/player/{id}` 자동 복귀 (김다원 2025)
- [x] 타율 차트의 시즌 최고값이 트랙 100% 사용 (fill width 100 확인)
- [x] ERA 선택 시 `낮을수록 좋음` 표시, 0.00 시즌은 0% 막대 (김민찬 3시즌)
- [ ] 실기기: 탭을 닫고 새로 앱 시작 → 현재 연도 선택 (코드 검토로는 확인, 실기기 미확인)

## 12. 2026-07-13 워딩 정리 (Claude 작업)

사용자 지시로 dev-repo 에 다음 UI 워딩을 변경했다. 데이터·로직 변경 없음.

- 대회 필터 첫 옵션: `전체 시즌` → `대회 전체` (`shared/filters.tsx`, aria-label `시합구분` → `대회구분`)
- 홈 규정 안내의 스코프 표기: `전체 시즌` → `대회 전체` (`desktop/pages/HomePage.tsx`, `mobile/pages/MHome.tsx`)
- 용어사전 리그평균 섹션: `전체 시즌` → `대회 전체`, `시합별` → `대회별` (`shared/SaberTerm.tsx`)
- 경기일정 탭: `시합` → `대회`, 안내 문구 `위에서 시합을…` → `위에서 대회를…` (`shared/ScheduleView.tsx`)
- 가중치 설명 모달: `시합 필터`/`그 시합에서` → `대회 필터`/`그 대회에서` (`shared/weights.tsx`)
- 선수 상세 기록 범위 토글: `시즌별` → `{선택연도} 시즌` (예: `2026 시즌 | 통산`) — 상단 연도 선택기 워딩과 통일 (`mobile/pages/MPlayer.tsx`, `desktop/pages/PlayerPage.tsx`)
- 코드 주석의 "시합" 표기는 변경하지 않음 (UI 노출 문자열만 대상)

검증: web tsc 통과, production build 통과(gzip 100.00 kB), 브라우저 실측(토글 `2025 시즌`→연도 전환 시 `2026 시즌` 동기화, 필터 `대회 전체`, 일정 탭 `대회`, 홈 문구 `※ 대회 전체 —`), UI 잔존 문자열 grep 0건.

## 13. 2026-07-13 통산 사버메트릭스 및 리그 평균 오버레이 A안

### 변경 파일

- `web/src/shared/career.ts`
- `web/src/shared/CareerPanel.tsx`
- `web/src/shared/data.ts`
- `web/src/shared/career.test.ts`
- `web/src/app.css`

수집 파이프라인과 `data/{year}/` 구조는 변경하지 않았다. 기존 `averages.json`만 사용한다.

### 계산 규칙

- 타자 ISO·BABIP·BB%·K%·BB/K·wOBA는 통산 합산 원자료로 재계산한다.
- wOBA는 기존 `sabermetrics.ts`의 고정 가중치를 재사용한다.
- 투수 K/9·BB/9·H/9·K/BB는 야구식 이닝을 총 아웃으로 환산한 합산 원자료에서 재계산한다.
- 통산 타자·투수 WAR는 해당 연도 리그 평균으로 계산한 시즌 WAR의 합이다.
- 통산 wRC+는 해당 연도 평균으로 계산한 시즌 wRC+의 PA 가중평균이다.
- 특정 연도 평균이 없으면 그 연도는 리그 대비 계산에서 제외하고, 전 연도 평균이 없으면 wRC+·WAR 타일을 숨긴다.
- 통산 FIP는 연도별 상수 결합 기준 문제로 제외했다.

### 데이터 로딩과 UI

- `useCareerAverages(years)`가 각 연도 `data/{year}/averages.json`을 기존 `getJSON`·`jsonCache`로 로드한다.
- 연도별 파일 로드 실패는 해당 연도만 `null`로 처리한다.
- 타자 통산 타일에 wOBA·wRC+·WAR, 투수 통산 타일에 K/9·K/BB·WAR를 추가했다.
- 타율·OPS·wOBA·ERA·WHIP와 wRC+에 연도별 리그 평균 세로 마커와 평균값 텍스트를 표시한다.
- SVG 스케일은 선수값과 연도별 평균값 전체의 최댓값을 사용한다.
- 평균이 없거나 0이면 마커와 평균 텍스트를 표시하지 않으며 카운팅 지표에도 표시하지 않는다.
- ERA·WHIP의 `낮을수록 좋음` 안내를 유지한다.
- 다크 선호 모드 평균색은 `#ff6b6f`이며 `#111` 배경 대비율은 6.82:1이다.

### 자동 검증

- `verify-dev.ps1` 전체 통과.
- scraper TypeScript·회귀 테스트 및 2024·2025·2026 데이터 무결성 통과.
- web TypeScript와 production build 통과: 94 modules, JS 313.44 kB / gzip 100.79 kB.
- 통산 wOBA 손계산 `2 × 0.89 / 10 = .178`, 시즌 WAR 합, PA 가중 wRC+, 일부·전체 averages 결손 폴백, 투수 WAR 합과 FIP 제외 테스트 통과.

### 375px 실제 브라우저 검증

- 박성현: 통산 타율 `.191`, wOBA `.252`, wRC+ `54`, WAR `-0.4` 표시.
- 2025 타율 `.171` / 평균 `.259`, 2026 타율 `.204` / 평균 `.264` 표시.
- 평균이 선수 최댓값보다 큰 사례에서 평균 마커가 트랙 100%, 선수 막대가 77.27%로 표시되어 트랙 밖으로 나가지 않음.
- 안타 선택 시 평균 마커와 평균 텍스트가 모두 0개이고 aria-label에도 평균이 없음.
- wRC+ 선택 시 2025 `65`, 2026 `44`, 각 연도 평균 `100`과 마커 표시.
- 김민찬: 통산 ERA `1.87`, WHIP `1.08`, K/9 `8.5`, K/BB `4.17`, WAR `+2.1` 표시.
- ERA 차트에 연도별 평균과 `낮을수록 좋음`이 표시되며 375px 문서 가로 오버플로 없음.
- 실행 브라우저가 light 선호 모드여서 실제 dark 렌더 전환은 불가했으며, dark CSS 색과 명암비를 정적으로 검증했다.

## 14. 2026-07-13 Claude 검증 및 보완 2건

§13 구현을 손계산 대조(하지운: wRC+ 68 = PA 가중, WAR −0.1 = 시즌 합, wOBA = 합산 원자료 재계산 일치),
verify-dev.ps1, 브라우저 실측(마커 위치 62.1% = .259/.417 정확)으로 검증했고, 다음 2건을 보완했다.

- **음수 값 막대**: 시즌 WAR가 음수일 때 `Math.max(3, …)`가 3% 양수 막대를 그려 −0.2와 −2.0이
  같은 길이로 보였다. `row.value <= 0`이면 막대를 그리지 않도록 수정(부호는 값 라벨이 표시).
  (`CareerPanel.tsx`)
- **다크 모드 마커 색 제거**: 이 앱은 라이트 전용(캔버스 항상 #ffffff, 다른 다크 스타일 전무)인데
  `prefers-color-scheme: dark`에서 마커·평균 텍스트만 #ff6b6f로 바뀌어 흰 배경 대비가
  5.9:1 → 2.9:1로 악화됐다. 해당 @media 블록을 제거해 항상 #d30005 유지. (`app.css`)
  §13의 "#111 배경 대비 6.82:1" 계산은 존재하지 않는 다크 배경을 전제한 것이었다.

보완 후 verify-dev.ps1 전체 재통과(gzip 100.79 kB), 다크 선호 상태 브라우저 실측으로
마커 #d30005 유지 확인.

## 15. 2026-07-13 운영 수집 실행 연도 제한

- 증분·전체 수집은 실행 시점 KST 연도만 수집·재집계한다.
- 과거 `YEAR` 지정은 `collectionYear.ts`에서 즉시 차단한다.
- 공식기록, profile, roster-history, averages, 대회별 집계와 strength도 현재 연도만 갱신한다.
- 현재 연도 경기 데이터가 없으면 과거 시즌을 대신 재집계하지 않는다.
- `scrape.yml`, `scrape-full.yml`, `teams.yml`이 KST 연도를 `$GITHUB_ENV`의 `YEAR`로 명시하여 scraper 보호 로직과 이중 검증한다.
- dev에서 `MONTHS=0`, `SKIP_PROFILES=1` 실제 재집계 전후 2024·2025 전체 트리 SHA-256 불변을 확인했다.
- base 반영 후 `verify-dev.ps1` 전체 통과: TypeScript, scraper 회귀 테스트, 데이터 무결성, 통산 계산, production build.

## 16. 2026-07-14 선수현황·상대전적 4개 이슈 수정

### 변경 파일

- `web/src/shared/data.ts`, `web/src/shared/matchup.ts`
- `web/src/mobile/pages/MMatchup.tsx`, `web/src/desktop/pages/MatchupPage.tsx`
- `web/src/shared/TeamsView.tsx`, `web/src/shared/PagedCardGrid.tsx`
- `web/src/app.css`

### 핵심 로직

- 비동기 데이터 결과에 연도·선수 스코프를 태그하여 선수 인덱스와 상대전적이 같은 연도로 확정됐을 때만 상대 학교를 계산한다.
- 상대전적에서 선택한 선수를 `personNo`로 현재 연도 엔트리에 다시 연결하고, 해당 연도에 없으면 전용 안내를 표시한다. 연도 종속 학교·상대·대회 선택도 초기화한다.
- 선수현황에 지역/학년/검색유형 3열 균등 필터를 추가하고, 지역·학년 범위에 맞춰 팀·선수·지도자·포지션 통계를 다시 계산한다.
- 지도자·미지정·투수·포수·내야수·외야수 통계 셀을 토글 버튼으로 만들고, 해당 범위 목록을 5행 단위 가로 스와이프 페이지로 표시한다.
- 이름·백넘버 검색 결과에도 같은 가로 스와이프 페이지를 적용했다.
- 팀 모달의 포지션·학년 필터를 `mpos`·`mgrade` URL 쿼리로 이전했다. 필터 변경은 replace, 모달 최초 열기는 기존 push를 유지하여 선수 상세에서 뒤로가기 시 모달과 필터가 함께 복원된다.

### 검증

- `web` TypeScript `--noEmit` 통과, production build 통과(94 modules, JS gzip 101.95 kB).
- `verify-dev.ps1` 전체 통과: scraper TypeScript·회귀 테스트, 2024·2025·2026 데이터 무결성, 통산 계산, web production build.
- 375×812 모바일에서 서울·2학년 선택 시 필터 3칸이 각각 104px이며 통계가 27팀·381선수·106지도자 등으로 즉시 갱신되는 것을 확인했다.
- 투수·지도자 목록은 페이지당 5행, 수평 스크롤 시 `1/N → 2/N` 활성 페이지가 변경됨을 확인했다. 백넘버 `1` 검색 98명도 20페이지로 분할됐다.
- 강릉고 모달에서 `투수 + 2학년` 적용 후 URL이 `team + mpos + mgrade`를 보존하고, 선수 상세→뒤로가기에서 모달·필터·7명 결과가 그대로 복원되며 한 번 더 뒤로가기 시 모달이 닫혔다.
- 상대전적 박성현은 2026 17개 학교, 2025 16개 학교로 즉시 전환됐고 2024 없음 안내 후 2026으로 복귀했을 때 17개 학교가 정상 복원됐다. 새 연도에 없는 학교 선택값도 빈 값으로 초기화됐다.
