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
- **부(division) `kind_cd`**: 41=대학부, **31=18세 이하부(U18)**, 51=일반부
- (대안) 선수 시즌기록: `GET /record/record/player_record?kind_cd=31&club_idx=&person_no=&record_type=1|2&begin_year=&end_year=`

```bash
cd scraper
npm install
npx playwright install chromium     # discover 전용(탐색 시에만 필요)
npm run discover -- "<URL>"          # 데이터 구조 재확인용
MONTHS=6 GAME_LIMIT=20 npm run scrape # 신규 경기 수집 → data/ 누적(게임ID 멱등)
npm test                             # 집계 멱등성/정확성 테스트
```

`scrape`는 `record_detail`을 파싱해 타자(타수·안타·타점·득점·홈런·볼넷·삼진·도루), 투수(이닝·피안타·자책·삼진·승패), **타자×투수 상대전적**(이닝별 투수 귀속)을 산출합니다. 집계는 `data/games/*.json`을 진실의 원천으로 하는 순수 함수라 재실행해도 동일합니다.

**알려진 한계**: 2·3루타는 타석 그리드에서 신뢰 추출이 어려워 0 처리(장타율 일부 과소). 선수 ID는 `팀_이름_등번호` 슬러그(안정 ID는 `person_no` 매핑이 향후 개선점). 캘린더 `month`는 현재 연도(2026) 기준.

GitHub Actions `scrape.yml`이 시즌 중 정기 실행하여 `data/` 변경분을 커밋하고, `deploy.yml`이 Pages로 배포합니다.

## 배포 (최초 1회)

`gh` CLI 또는 GitHub Desktop으로 원격 리포를 만든 뒤 푸시합니다. 리포 Settings → Pages 소스를 GitHub Actions로 설정하면 `deploy.yml`이 동작합니다.
