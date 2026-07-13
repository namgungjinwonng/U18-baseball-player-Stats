# U18 야구 선수 기록 조회 서비스

아마추어(U18/고교 등) 야구 선수의 기록을 **이름으로 조회**하고, **타자 vs 투수 상대전적**까지 확인하는 웹 서비스입니다. 데이터는 대한야구소프트볼협회(KBSA, `korea-baseball.com`)의 경기 상세에서 수집하며 **2026 시즌부터 누적**합니다.

## 구조

```
├─ web/        React + Vite + TS 프론트엔드 (데스크탑/모바일 분리)
├─ scraper/    Node + TS + Playwright 데이터 수집기
├─ data/       커밋되는 정적 JSON "DB" (GitHub Pages가 그대로 서빙)
└─ .github/workflows/   정기 스크레이핑(scrape) + Pages 배포(deploy)
```

데이터(`/data`)는 빌드 시 프론트 산출물에 복사되고, 개발 서버에서는 Vite 미들웨어가 리포 루트 `/data`를 그대로 서빙합니다.

## 개발

### 다년도 개발 브랜치 검증

이 개발 복제본은 기존 `data/{year}/` 구조와 `data/years.json`을 그대로 사용합니다.
종료된 시즌은 `YEAR`를 지정해 백필하며, 지정하지 않으면 KST 기준 현재 연도를 수집합니다.

```powershell
cd scraper
$env:YEAR='2025'; npm run roster
$env:YEAR='2025'; npm run teams
$env:YEAR='2025'; $env:SCHEDULE_FULL='1'; npm run schedule
$env:YEAR='2025'; npm run scrape
npm test
npm run validate-data
```

KBSA 저부하 수집 예시:

```powershell
$env:YEAR='2024'
$env:KBSA_DELAY_MS='750'
$env:KBSA_OFFICIAL_CONCURRENCY='1'
$env:KBSA_PROFILE_CONCURRENCY='1'
$env:KBSA_PROFILE_DELAY_MS='750'
$env:KBSA_TIMEOUT_MS='20000'
npm run scrape
```

공식기록은 50명마다 `official.partial.json` 체크포인트를 기록합니다. 중단되거나
요청 타임아웃이 발생해도 다음 실행에서 완료된 선수는 건너뛰고 이어받습니다.

선수 상세의 상대전적은 별도 `matchups/{id}.json`이 아니라
`data/{year}/players/{id}.json`의 `matchups` 필드에 포함됩니다. 앱의 선수 상세과
상대전적 로더는 같은 URL 요청을 공유합니다.

앱 확인:

```powershell
cd ..\web
npm run dev -- --port 5174
```

브라우저에서 `http://localhost:5174`를 열고 시즌 선택기에서 2025를 선택합니다.

### 선수 통산 모드

- 전역 연도 선택기는 시즌만 유지합니다.
- 모바일/데스크탑 선수 상세의 `시즌별 | 통산` 토글에서 통산 기록을 확인합니다.
- `data/career-index.json`은 `personNo → {연도: 선수 ID}` 역인덱스이며 scraper 재집계 때 생성됩니다.
- 통산 타율·OPS·ERA·WHIP는 시즌 비율 평균이 아니라 합산 원자료로 재계산합니다.
- 연도별 미니바는 각 시즌 선수 JSON의 시즌 집계값을 그대로 사용합니다.
- 연도마다 리그 환경이 다른 wRC+·WAR 같은 리그 대비 지표는 통산 화면에서 표시하지 않습니다.
- 별도 차트 라이브러리는 사용하지 않고 인라인 SVG를 사용합니다.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

데스크탑/모바일은 뷰포트 폭으로 자동 분기됩니다. 모바일 화면은 브라우저 창을 좁히거나 `?device=mobile` 쿼리로 강제할 수 있습니다.

## 디자인

`Design_MD/Nike.md` 디자인 시스템을 `web/src/design/tokens.css` + `theme.ts`로 토큰화해 적용합니다. (알약 CTA, soft-cloud 배경, 그림자 0)

## 데이터 파이프라인

데이터 소스는 KBSA(`korea-baseball.com`)의 서버 렌더 HTML입니다. (게임원 CMS, AJAX 아님)

- **경기 목록**: `GET /game/calendar?kind_cd=31&month=M` → `game_idx` + 날짜 + 팀/스코어
- **경기 박스스코어**: `GET /game/record_detail?game_idx=N` → 스코어보드 + 타자 이닝별 타석 그리드 + 투수기록
- **팀 로스터**: `GET /info/team/team_list` · `/info/team/team_player?club_idx=X` → 학년·person_no·포지션·투타
- **부(division) `kind_cd`**: 41=대학부, **31=18세 이하부(U18)**, 51=일반부

```bash
cd scraper
npm install
npm run roster                       # 팀 로스터 수집(학년/person_no) → data/roster.json (가끔)
npm run scrape                       # 증분 수집(마지막 경기 월부터) → data/{year}/ 누적
MONTHS=6 GAME_LIMIT=20 npm run scrape # 월/건수 제한 수집(초기 적재·테스트)
npm test                             # 집계 멱등성/정확성 테스트
npx playwright install chromium && npm run discover -- "<URL>"  # 구조 재확인(탐색 전용)
```

**연도 누적**: 집계는 시즌별로 `data/{year}/`에 기록되고 `data/years.json`에 연도 목록이 쌓입니다. 프론트 상단의 연도 셀렉터로 해당 시즌 기록을 조회합니다. **증분 수집**: `npm run scrape`는 마지막으로 수집된 경기의 '월'부터만 캘린더를 훑어 갱신 시간을 줄입니다(이미 받은 `game_idx`는 건너뜀).

**로스터 오버레이**: 박스스코어에는 이름·등번호만 있어, `(이름,등번호)` 키로 로스터와 조인해 **학년/person_no/정식 팀명/투타**를 보강합니다(팀명 접두 일치로 동명이인 오조인 방지, 매칭률 ~98%).

### PWA(모바일 설치)
`web/public`의 `manifest.webmanifest` + `sw.js`로 홈 화면 설치를 지원합니다. 안드로이드 Chrome은 설치 버튼이 뜨고(설치 후 숨김), iOS Safari는 "공유 → 홈 화면에 추가" 안내를 노출합니다. 카카오톡 등 인앱 브라우저에서는 외부 브라우저로 여는 배너가 표시됩니다.

`scrape`는 `record_detail`을 파싱해 타자(타수·안타·타점·득점·홈런·볼넷·삼진·도루), 투수(이닝·피안타·자책·삼진·승패), **타자×투수 상대전적**(이닝별 투수 귀속)을 산출합니다. 집계는 `data/games/*.json`을 진실의 원천으로 하는 순수 함수라 재실행해도 동일합니다.

**알려진 한계**: 2·3루타는 타석 그리드에서 신뢰 추출이 어려워 0 처리(장타율 일부 과소). 선수 ID는 `팀_이름_등번호` 슬러그(안정 ID는 `person_no` 매핑이 향후 개선점). 캘린더 `month`는 현재 연도(2026) 기준.

GitHub Actions `scrape.yml`이 시즌 중 정기 실행하여 `data/` 변경분을 커밋하고, `deploy.yml`이 Pages로 배포합니다.

## 배포 (최초 1회)

`gh` CLI 또는 GitHub Desktop으로 원격 리포를 만든 뒤 푸시합니다. 리포 Settings → Pages 소스를 GitHub Actions로 설정하면 `deploy.yml`이 동작합니다.
