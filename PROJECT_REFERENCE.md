> ⚠️ **AI/Claude 작업 우선 참고 문서 (Single Source of Truth)**
>
> - 이 저장소에서 **모든 코드 작업을 시작하기 전, 이 파일을 반드시 먼저 읽고** 구조·계약·관례를 파악할 것. 개별 파일을 광범위하게 탐색하기 전에 이 요약으로 토큰을 절약한다.
> - 코드/스키마/워크플로를 수정하면 **같은 PR/커밋에서 이 문서를 동기화 업데이트**할 것. 어긋난 상태로 남기지 말 것.
> - 본 문서와 실제 코드가 충돌하면 **코드가 정답**이다. 발견 즉시 이 문서를 고친다(섹션 끝 "변경 이력" 추가).
> - 동기화 체크리스트: ① 영향받은 섹션 갱신 ② 데이터 스키마 변경 시 [스키마 호환] 표 갱신 ③ 신규 모듈/파일은 [디렉터리 맵]에 한 줄 추가 ④ 외부 계약(KBSA URL/파라미터) 변경 시 [데이터 소스 계약] 갱신.

# U18 Baseball Player Stats — 프로젝트 참고

대한야구소프트볼협회(KBSA, `korea-baseball.com`)의 U18(고교) 경기 데이터를 수집·집계해, 선수 기록과 타자×투수 상대전적을 보여주는 **정적(JSON DB) 웹앱**.

---

## 1. 한눈에 보기

- **프론트엔드**: `web/` — React 18 + Vite 5 + TS, React Router v6. 데스크탑·모바일 **완전 분리 트리**(`shared/`만 공유).
- **수집기**: `scraper/` — Node 20 + TS + tsx. **fetch 기반**(Playwright는 `discover`만 사용).
- **데이터 "DB"**: 리포 루트 `data/` 의 **커밋되는 정적 JSON**. GitHub Pages가 그대로 서빙. 진실의 원천(Source of Truth)은 `data/games/*.json`(원본 박스스코어). 그 외 파일(`data/{year}/…`)은 **순수 함수로 파생** → 멱등.
- **CI 워크플로 3개** (`.github/workflows/`):
  - `scrape.yml` = **"데이터 수집·집계 (증분)"** — 매일 KST 00:00 cron + 수동. `incrementalMonths()` 동작: 마지막 수집 월부터만 스캔(빠름).
  - `scrape-full.yml` = **"데이터 수집·집계 (전체 월 스캔)"** — 수동 전용. `MONTHS=3,4,5,6,7,8,9,10,11,12` 강제. 누락 경기까지 모두 채움(멱등).
  - `deploy.yml` = **"웹사이트 배포 (GitHub Pages)"** — `web/**`·`data/**` 푸시 + 수동 + **`workflow_run` 트리거(위 두 스크레이프 워크플로 success 시 자동 실행)**. GITHUB_TOKEN 푸시는 push 트리거를 깨우지 못해 workflow_run 이 필수.
- 두 스크레이프는 `concurrency: scrape` 그룹을 공유해 동시 실행 불가(데이터 충돌 방지).
- GitHub가 자동 추가하는 `pages-build-deployment`(파일 없음, 이름 변경 불가)도 함께 표시될 수 있음.
- **GitHub Pages base**: `/U18-baseball-player-Stats/` (배포 워크플로의 `VITE_BASE`, 리포명과 동일). 로컬 dev는 `/`.

---

## 2. 디렉터리 맵 (수정 시 갱신)

```
├─ web/
│  ├─ index.html, vite.config.ts (← serveDataPlugin: dev 미들웨어로 ../data 서빙, build 시 dist/data로 복사)
│  ├─ public/         manifest.webmanifest, sw.js, icon-*.png
│  └─ src/
│     ├─ main.tsx            진입점: useDevice → DesktopApp | MobileApp, YearProvider, initPwa
│     ├─ app.css
│     ├─ design/             tokens.css / components.css / theme.ts / ui.tsx  (Nike.md 디자인 토큰)
│     ├─ shared/             ★ 디바이스 공용. 데이터/포맷/도메인 로직은 여기로.
│     │   ├─ types.ts        ← scraper/src/types.ts 와 호환 유지 필수
│     │   ├─ data.ts         정적 JSON 로더 + useAsync 훅 (useMeta, useAllPlayers, usePlayer, usePlayerMatchups, usePlayerIndex, searchPlayers)
│     │   ├─ year.tsx        YearProvider + YearSelect (localStorage "season")
│     │   ├─ useDevice.ts    뷰포트 폭 ≤640px → mobile. `?device=mobile|desktop`으로 강제.
│     │   ├─ pwa.tsx         initPwa / InstallButton / InAppBanner (카카오톡·iOS 처리)
│     │   ├─ refresh.tsx     RefreshButton (캐시 전부 비우고 location.reload)
│     │   ├─ format.ts       rate(.333) / dec2 / inn(6.2) / int / formatDate
│     │   ├─ sabermetrics.ts OPS/ISO/BABIP/BB%·K%·BB/K, K9·BB9·H9·KBB·FIP
│     │   ├─ columns.ts      recordTabs (타자 기본/세부, 투수 기본/세부) + 컬럼 정의. 모든 탭 initialSort="g".
│     │   ├─ leaders.ts      홈 리더보드(규정타석=경기수×3.1, 규정이닝=경기수×1.0)
│     │   ├─ matchup.ts      Role/playerLabel/facedOpponents/facedSchools/sumMatchups + batsThrowsLabel/matchupOpponentMeta
│     │   ├─ Glossary.tsx    TERM_MAP export (약어→설명) — SaberTerm 모달에서 참조
│     │   ├─ SaberTerm.tsx   클릭형 세이버 용어 라벨 + 설명 모달
│     │   ├─ filters.tsx, StatTable.tsx, Footer.tsx
│     ├─ desktop/  DesktopApp.tsx + pages/{Home,Records,Matchup,Search,Player}Page.tsx
│     └─ mobile/   MobileApp.tsx + mobile.css + pages/{MHome,MRecords,MMatchup,MSearch,MPlayer}.tsx
│
├─ scraper/
│  └─ src/
│     ├─ index.ts            ★ 메인 진입(`npm run scrape`): collectNewGames → updateOfficialFor → aggregate → writeYear/writeYearsIndex + 시합별 분리 집계 (`by-tournament/{slug}/records.json` + `tournaments.json`). 최근 3일치 게임은 무조건 재수집.
│     ├─ backfillTitles.ts   기존 game JSON 에 `title` 없는 항목 재fetch 채우기 (1회용)
│     ├─ koreaBaseball.ts    KBSA HTML 어댑터 (BASE/KIND/fetchGameRefs/fetchRecordDetail/classifyAtBat)
│     ├─ fetchGames.ts       listGameRefs, existingGameIds, isAfterSeasonStart(2026-01-01~), incrementalMonths
│     ├─ parseRecordDetail.ts (얇은 래퍼)
│     ├─ accumulate.ts       ★ 집계 순수함수(aggregate) + readGames/readRoster/writeYear/writeYearsIndex/groupBySeason + outsToIp + personNo 중복 슬러그 병합
│     ├─ officialStats.ts    /record/record/player_record 공식기록 수집 (개별 선수 batting/pitching) — 박스스코어 파생 덮어쓰기
│     ├─ roster.ts           /info/team/team_list + /info/team/team_player → data/roster.json(키: `이름|등번호`)
│     ├─ types.ts            ← web/src/shared/types.ts 와 호환 유지 필수
│     ├─ seed.ts, discover.ts(Playwright 탐색용), accumulate.test.ts
│
├─ data/  (커밋됨, 빌드 시 dist로 복사. games/·roster.json·official.json 은 dist 제외 — vite.config 참고)
│  ├─ games/{gameId}.json          ★ 원천: 경기당 GameBoxScore (멱등 키 = id)
│  ├─ roster.json                  키: `${name}|${number}` → RosterEntry (학년/personNo/clubIdx/지역/투타)
│  ├─ years.json                   [2026, …] (내림차순)
│  ├─ meta.json                    최신 시즌 Meta 복사본
│  └─ {year}/
│      ├─ meta.json                Meta
│      ├─ official.json            personNo → {batting, pitching}  (공식기록 오버레이)
│      ├─ players/index.json       PlayerIndexEntry[]  (검색·매치업 후보용 슬림)
│      ├─ players/{id}.json        Player (gameLog 포함)
│      ├─ records/players.json     Player[] (gameLog 제외 슬림본 — 리더보드/테이블용)
│      └─ matchups/{playerId}.json Matchup[] (한 매치업이 양쪽 샤드에 중복 포함)
│
└─ .github/workflows/{scrape,deploy}.yml
```

---

## 3. 데이터 흐름 (상세)

1. **수집(증분, 멱등)**: `scrape` 진입점이
   - `incrementalMonths(data/)`: `data/games/` 최신 경기의 월부터 12월까지만 캘린더 스캔.
   - `listGameRefs(2026, months)`: `/game/calendar?kind_cd=31&month=M` 파싱 → `GameRef[]`.
   - `existingGameIds` 와 `isAfterSeasonStart('2026-01-01')` 필터 → 신규만.
   - 각 신규 ref에 대해 `parseRecordDetail`(= `fetchRecordDetail`) → `data/games/{id}.json` 저장.
   - 실패 시 지수 백오프 5회 재시도, `410 Gone`은 영구 실패로 분류.
   - 환경변수: `GAME_LIMIT`(상한), `MONTHS=6` 또는 `MONTHS=5,6`.
2. **공식기록 증분**: 신규 게임에 등장한 선수만 `collectOfficial(dataDir, year, [신규 파일들])` → `data/{year}/official.json` 에 머지.
3. **로스터 보강(가끔)**: `npm run roster` → `data/roster.json` 갱신. CI는 매 실행에서 갱신.
4. **집계(파생, 순수함수)**: `aggregate(games, source, roster, official)` →
   - 박스스코어 합산 → batting/pitching 파생값 산출(`outsToIp`, AVG/OBP/SLG, ERA/WHIP).
   - 로스터 조인 키: `${name}|${number}`. 팀명은 **접두 일치**로 동명이인 오조인 방지.
   - `personNo`가 같은 다중 슬러그는 **대표(투타정보 보유→경기수 많은 순)로 병합**, 게임로그/매치업 id 재매핑.
   - `official[personNo].batting/pitching` 가 존재하면 **공식값으로 교체** (`g>0` 조건).
   - 매치업은 **이닝→투수 매핑**으로 귀속(`pitcherForInning`). 출력은 `pa = ab + bb + hbp`.
5. **출력**: `writeYear(dataDir, year, agg)` 가
   - `players/index.json`, `meta.json`, `records/players.json`(slim) + 선수별 `players/{id}.json` + 매치업 선수별 샤드 `matchups/{id}.json` 기록 (모두 compact JSON).
   - `writeYearsIndex` → `data/years.json` + `data/meta.json` 갱신.

---

## 4. 데이터 소스 계약 (KBSA, 변경되면 즉시 갱신)

| 목적 | 메서드 | 경로 | 비고 |
|---|---|---|---|
| 경기 목록 | GET | `/game/calendar?kind_cd=31&month=M` | `<li date="Y:M:D:H:I">…game_idx=N…class="name"…class="score|num"…</li>` 정규식 파싱 |
| 박스스코어 | GET | `/game/record_detail?game_idx=N` | 서버 렌더 HTML. 표0 스코어보드 / 표1·3 타자 그리드 / 표2·4 투수기록 |
| 팀 목록 | GET | `/info/team/team_list?kind_cd=31&page=N` | `team_player?club_idx=` 기준 분할 |
| 팀 로스터 | GET | `/info/team/team_player?club_idx=X&kind_cd=31` | `<dt>학년</dt>` 있는 항목만 = 선수 |
| 선수 공식기록 | GET | `/record/record/player_record?kind_cd=31&club_idx=&person_no=&record_type=1|2&begin_year=Y&end_year=Y` | `record_type` 1=타격 2=투구 |

**`kind_cd`**: 41=대학부, **31=U18(고교)**, 51=일반부.

**타석 결과 분류 규칙** (`classifyAtBat` in `koreaBaseball.ts`):
- `사구`→HBP, `4구|고4|고의4구`→BB(앞 글자 ^/, 경계 주의), `^희`→희생타(`ab=0`), `삼진`→K, `홈런|월홈|장외`→HR.
- 2·3루타: HR 아니고 `[좌중우]` 방향이 있으며 끝자리 `2|3`(예: `좌중2`). 수비위치 숫자(`3땅`, `3내안`)와 구분.
- 도루는 cell에 `도루` 포함 시 +1.
- 알려진 한계: 2·3루타 추출은 보수적이라 일부 누락 가능(장타율 일부 과소).

---

## 5. 스키마 호환 (web ↔ scraper)

**파일 한 쌍을 항상 동기화**: `web/src/shared/types.ts` ↔ `scraper/src/types.ts`. 한쪽만 바꾸면 빌드는 통과해도 런타임에서 깨진다.

핵심 타입:

- `Player`: `{ id, name, team, position, number?, grade?, personNo?, region?, bats?, throws?, season, batting?, pitching?, gameLog }`
  - 슬림본(`records/players.json`)은 `gameLog` 제외 (web 타입은 `gameLog?` 옵션).
- `BattingStats`: g, pa, ab, r, h, b2, b3, hr, rbi, bb, hbp, so, sb, avg, obp, slg / 공식기록 전용 sh, sf, ibb, e.
- `PitchingStats`: g, w, l, sv, **ip(소수: `6.2`=6과 2/3)**, h, r, er, bb, so, era, whip / 공식 hr, bf, np.
- `Matchup`: batterId/Name, pitcherId/Name, pa, ab, h, b2, b3, hr, bb, hbp, so, avg.
- `Meta`: season, lastUpdated(ISO), gameCount, source, teamGames?(팀→경기수).
- 선수 `id` 슬러그: `${team}_${name}_${number}` (공백 제거). 안정 ID 후보 = `personNo`.

---

## 6. 프론트엔드 관례

- **디바이스 분기**: `useDevice()` (`MOBILE_MAX = 640`). 절대 라우터 자체를 분기하지 말고 `Root`에서 분기. 디바이스 종속 UI는 `desktop/` 또는 `mobile/` 안에만.
- **모든 데이터 로딩은 `shared/data.ts` 훅 사용**: `useMeta`/`useAllPlayers`/`usePlayer`/`usePlayerMatchups`/`usePlayerIndex`. 신규 데이터셋 추가 시 같은 패턴으로 훅 만들 것.
- **연도(시즌)는 컨텍스트**: `useYear()`. 로더 deps에 `year`를 반드시 포함. `data/{year}/…` 경로 규약 유지.
- **포맷**: `format.ts` 의 `rate/dec2/inn/int/formatDate` 사용. 자체 `toFixed`로 임의 포맷 금지(소수점 표기·앞 0 처리 일관성).
- **테이블 컬럼**: `columns.ts` 의 `recordTabs`/`battingBasicColumns` 등에 추가. 정렬 기본 방향은 `defaultDesc`로 명시. ERA·WHIP는 오름차순(낮을수록 좋음).
- **상대전적 도메인**: `matchup.ts` 의 `Role`/`opposite`/`inRole`/`facedOpponents`/`facedSchools`/`sumMatchups` 사용. `isPitcher = position === "투수"`.
- **PWA**: `initPwa`는 `manifest.webmanifest` 링크 주입 + `sw.js` 등록. `BASE_URL` 경로 변경 시 깨지므로 `import.meta.env.BASE_URL` 사용 일관 유지.
- **인앱/설치**: `InstallButton`(beforeinstallprompt), iOS는 가이드 토글. `InAppBanner`는 카카오톡/Instagram/FB/Line/NAVER 감지.
- **새로고침**: `RefreshButton`은 `caches.delete + sw.update + cache:'reload'` 후 `location.reload`. 변경 시 캐시 무효화 보장 필수.

---

## 7. 빌드/배포 관례

- `web/vite.config.ts` 의 `serveDataPlugin`:
  - **dev**: `/data/*` 요청을 리포 루트 `../data` 에서 즉시 서빙(외부 의존성 없음).
  - **build closeBundle**: `data/` 전체를 `dist/data` 로 복사하되 `games/`, `roster.json`, 모든 `official.json` **제외**(용량 절감).
- 새 파생 산출물을 프론트가 직접 읽게 만들면, **vite.config의 제외 목록과 충돌하지 않는지** 반드시 확인.
- `VITE_BASE` 는 `deploy.yml` 의 `/U18-baseball-player-Stats/` 로 주입(리포명과 동일해야 함). **로컬 dev는 `/`**.
- SPA fallback: `cp web/dist/index.html web/dist/404.html`.

---

## 8. 자주 쓰는 명령

```bash
# 프론트
cd web && npm install && npm run dev          # http://localhost:5173

# 수집
cd scraper && npm install
npm run roster                                 # 로스터 갱신 → data/roster.json
npm run scrape                                 # 증분 수집 + 재집계
MONTHS=6 GAME_LIMIT=20 npm run scrape          # 초기 적재/테스트
YEAR=2026 npm run official                     # 공식기록만 전체 재수집
npm test                                       # 집계 멱등/정확성 테스트
npx playwright install chromium && npm run discover -- "<URL>"
```

---

## 9. 변경할 때 자주 빼먹는 것들

- [ ] `web/src/shared/types.ts` 와 `scraper/src/types.ts` **양쪽** 갱신.
- [ ] 새로운 데이터 파일은 `accumulate.ts:writeAgg` 에서 기록 + `vite.config.ts` 제외 목록 검토.
- [ ] 새 페이지·라우트는 `DesktopApp.tsx` **와** `MobileApp.tsx` 양쪽에 등록.
- [ ] 컬럼 추가 시 `columns.ts` 의 `recordTabs` `initialSort` 검토(defaultDesc 방향 포함).
- [ ] KBSA HTML 구조 변경 의심 시 먼저 `npm run discover -- <URL>` 로 재확인.
- [ ] 데이터 스키마 변경 후에는 한 번 `npm run scrape` 로 전체 재집계가 깨끗하게 도는지 확인.
- [ ] 시즌 변경(2027~) 시 `SEASON_START`(`fetchGames.ts`)·`YEAR` 기본값·`incrementalMonths` 동작 검토.

---

## 10. 알려진 한계 / 비고

- 2·3루타: 보수적 추출(장타율 일부 과소). 공식기록 오버레이로 보강.
- 선수 안정 ID: 현재 슬러그 `team_name_number`. `personNo` 보강 매핑이 향후 개선 포인트.
- 캘린더 month 기준 연도는 현재 코드상 **2026 하드코딩**(`listGameRefs` 기본값).
- FIP 상수는 MLB 관례값(3.1) 근사.

---

## 규정타석/규정이닝 (스코프별 차등 — leaders.ts)

`leaders.ts` 의 `SeasonConfig`(연도별, `SEASON_CONFIG[2026]`) + `QualifyContext{scope,config,teamGames}` 로 계산. `filters.useQualifyContext(filter)` 가 필터에 맞는 스코프/팀경기수를 조립.

- **전체 시즌(season)**: 규정타석 = `min(seasonGames=12, 리그최대경기) × 3.1`, 규정이닝 = `… × 1.0`. (12 = 전반기6+후반기6, 진행 중엔 최대경기로 동적)
- **주말리그(weekend)**: `min(weekendLeagueGames=6, 리그최대경기) × 3.1`.
- **전국대회(national)**: **팀별** `teamGames[team] × 3.1` + **최소 3경기·12타석**(투수는 최소 3경기). 토너먼트는 팀마다 경기수가 달라 per-team.
- 스코프 판정: `filter.tournament` 없으면 season, 있으면 `tournamentTree.categorize().kind` 가 주말리그면 weekend, 아니면 national.
- teamGames 출처: 시즌은 `data/{year}/meta.json`, 시합은 `data/{year}/by-tournament/{slug}/meta.json` (둘 다 aggregate 가 기록).
- **연도별 변경**: `SEASON_CONFIG` 에 연도 키 추가하면 됨(미정의 연도는 최신 연도 폴백).
- 랭킹 페이지(`LeadersView`)에 "규정 미달 포함" 토글 — 켜면 미달자도 보이되 `규정 미달` 뱃지 + 순번 `–`.

## 변경 이력 (이 문서에 한함 — 코드 변경 시 한 줄씩 추가)

- 2026-06-27: 초판 작성 (구조 분석 기준 커밋 `f0948e6`).
- 2026-06-27: `VITE_BASE` 를 실제 리포명(`U18-baseball-player-Stats`)에 맞춰 정정. (이전 값 `U18-baseball-player-records` 는 리포명과 불일치하여 배포 시 자산 경로 404 유발.)
- 2026-06-27: 워크플로 이름 한글화 — `Deploy to GitHub Pages` → `웹사이트 배포 (GitHub Pages)`, `Scrape & Accumulate Data` → `데이터 수집·집계`. (GitHub 자동 생성 `pages-build-deployment` 은 이름 변경 불가.)
- 2026-06-27: 워크플로 분리·자동 체이닝. `scrape.yml` 을 "데이터 수집·집계 (증분)" 으로 명확화, 신규 `scrape-full.yml` "데이터 수집·집계 (전체 월 스캔)" 추가(수동 전용·`MONTHS=3-12`). `deploy.yml` 에 `workflow_run` 트리거를 추가해 두 스크레이프 success 시 자동 배포되도록 함(`GITHUB_TOKEN` 푸시가 push 트리거를 깨우지 못하는 이슈 해결).
- 2026-06-27: UX 일괄 개선 — (1) 필터 라벨 "전체 X" → "X 선택", (2) 유령 선수(이름 `()`·등번호 누락) 스크레이퍼/프론트 양쪽 필터, (3) 모바일 탭 wrap 으로 한 화면에 표시, (4) 기록 테이블 기본 정렬 경기수(g) 내림차순(detail 탭에 G 컬럼 추가), (5) 선수 상세 헤더 한 줄화 + 투타 표기 + "시즌" 텍스트 제거, (6) 세이버메트릭스 라벨 클릭 → 설명 모달(`SaberTerm` + `Glossary.TERM_MAP`), (7) 매치업 행 라벨 `vs 상대(학교·학년·투타)`, (9) 선수 상세 섹션 분리(타자·투수·세이버·경기로그·상대 타자·상대 투수). `PlayerIndexEntry` 에 `bats/throws` 추가(상대 메타용).
- 2026-06-28: 필터바 2줄 고정 + 태블릿/폴드 모바일 UI 확장 + 선수별 시합 필터 + 상대전적 시합 필터:
  - **필터바 2줄 고정 (#1)**: `.filter-bar` → `filter-bar__row` 컨테이너로 2단 (위 = 시합 cascade, 아래 = 지역+학교). 시합 cascade 가 1→3개로 늘어나도 하단 region/team 줄은 그대로 유지.
  - **태블릿/폴드 (#2)**: `useDevice.MOBILE_MAX` 640→1024 로 확장 → 폴드 전개·태블릿(720-1024)이 모바일 트리(가운데 정렬) 사용. `.m-page max-width:720px`, `.m-topbar__inner`/`.m-hero__inner` wrapper 로 안쪽 콘텐츠도 가운데 정렬.
  - **선수별 시합 필터 (#3)**: `TournamentPicker` 에 `availableSlugs` prop → 선수 상세에선 출전한 시합만 노출.
  - **상대전적 시합 필터 (#4)**: 스크레이퍼가 `data/{year}/by-tournament/{slug}/matchups.json` 도 함께 생성. `useTournamentMatchups(slug)` 훅. PlayerPage/MPlayer/MatchupPage/MMatchup 의 매치업 데이터가 시합 선택에 맞춰 전환됨.
- 2026-06-27: 시합/대회 구분 + 학교 정규화 + 실시간 증분 + PWA 자산 (참고 소스 `C:\Users\user\claude\U-18 Baseball` 패턴 차용):
  - **시합 (#1·#8)**: `koreaBaseball.fetchRecordDetail` 가 `<dl class="game_name"><dt>` 에서 시합명을 추출해 `GameBoxScore.title` 에 저장. `accumulate` 가 시합별로 슬림 records 를 `data/{year}/by-tournament/{slug}/records.json` 로 분리 집계하고 `tournaments.json` 인덱스 생성. 프론트 `useTournaments` / `useTournamentRecords(slug)` 훅 + `FilterBar` 시합 셀렉터(기본 "시즌 전체"). 선수 상세는 `playerStats.filterPlayerStats` 로 gameLog 의 `bStat`/`pStat` 에서 재집계 → 시합별 통계 표기. 1회성 백필: `npm run backfill-titles` 가 기존 게임 JSON 에 title 채움(503/826 완료, 나머지 410 Gone).
  - **학교 정규화 (#2)**: `accumulate.buildTeamNormalizer` — 참고 소스의 `_core()` 패턴 미러. 접미사(`(U-18)`, `야구단`, `BC`, `고등학교`) 제거 + 접두 일치 + `ALIAS_EXPLICIT` 으로 박스스코어 축약명("한국마사")을 KBSA 정식명("한국마사고BC")으로 통합. 팀 113개로 중복 해소.
  - **실시간 증분 (#6)**: `index.collectNewGames` 가 "최근 3일치 게임은 이미 수집되어 있어도 무조건 재fetch" (참고 소스 `main_incremental`). 추가로 오늘 월을 base 월 셋에 무조건 포함. PWA 는 network-first SW 이므로 CI 가 데이터를 푸시하면 앱 새로고침으로 즉시 반영.
  - **PWA (#3)**: `manifest.webmanifest` name="U-18 Player Stats". 아이콘 192/512 교체 (`web/public/icon-*.png`). 512 에 `purpose:"maskable"` 추가해 안드로이드 런처에서 512 사용. `index.html` 에 `apple-touch-icon` 192/512 + `apple-mobile-web-app-title` 추가. `sw.js` 캐시 v1→v2 (새 자산 강제 갱신).
  - **큰 모바일 정렬 (#4)**: `.m-page` 에 `max-width: 560px; margin: 0 auto` + ≥480px·≥720px 미디어쿼리로 양옆 패딩 확장. `.m-hero` 도 동일.
  - **탭 구성 (#5)**: 기본 탭 = 카운팅 스탯(G/타석/타수/안타/2·3루타/홈런/타점/득점/도루/볼넷/사구/삼진 또는 G/승/패/세이브/이닝/피안타/실점/자책/볼넷/탈삼진), 세부 탭 = 비율+세이버(타율/OBP/SLG/OPS/ISO/BABIP/BB%/K%/BB/K 또는 ERA/WHIP/FIP/K9/BB9/H9/KBB).
