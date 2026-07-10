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
│     │   ├─ ScheduleView.tsx  경기일정 화면(월별 달력/학교별/시합별 순위·대진 — D/M 공용, u81-baseball 이식)
│     │   ├─ TeamsView.tsx     선수현황 화면(팀 카드/팀 상세 모달/이름·백넘버 검색 — D/M 공용, u81-baseball 이식)
│     │   ├─ PersonView.tsx    무기록 선수 폴백 상세(/person/:personNo — teams.json+프로필 기반)
│     │   ├─ KbsaLink.tsx, kbsa.ts  KBSA 외부 링크 버튼/URL 헬퍼 (선수 상세·경기 카드)
│     │   ├─ filters.tsx, StatTable.tsx, Footer.tsx
│     ├─ desktop/  DesktopApp.tsx + pages/{Home,Records,Matchup,Search,Player}Page.tsx
│     └─ mobile/   MobileApp.tsx + mobile.css + pages/{MHome,MRecords,MMatchup,MSearch,MPlayer}.tsx
│
├─ scraper/
│  └─ src/
│     ├─ index.ts            ★ 메인 진입(`npm run scrape`): collectNewGames → updateOfficialFor → updateProfilesFor(프로필 증분) → aggregate → writeYear/writeYearsIndex + 시합별 분리 집계 (`by-tournament/{slug}/records.json` + `tournaments.json`) + 리그평균(`averages.json`). 최근 3일치 게임은 무조건 재수집.
│     ├─ backfillTitles.ts   기존 game JSON 에 `title` 없는 항목 재fetch 채우기 (1회용)
│     ├─ koreaBaseball.ts    KBSA HTML 어댑터 (BASE/KIND/fetchGameRefs/fetchRecordDetail/classifyAtBat)
│     ├─ fetchGames.ts       listGameRefs, existingGameIds, isAfterSeasonStart(2026-01-01~), incrementalMonths
│     ├─ parseRecordDetail.ts (얇은 래퍼)
│     ├─ accumulate.ts       ★ 집계 순수함수(aggregate(games,source,roster,official,history)) + readGames/readRoster/readRosterHistory/writeYear/writeYearsIndex/groupBySeason + outsToIp + personNo 중복 슬러그 병합(현행 소속 우선 대표)
│     ├─ officialStats.ts    /record/record/player_record 공식기록 수집 (개별 선수 batting/pitching) — 박스스코어 파생 덮어쓰기
│     ├─ roster.ts           /info/team/team_list + /info/team/team_player → data/roster.json(키: `이름|등번호`, 등번호 미배정은 `이름|`) + roster-history.json 누적 + 선수등록현황(current_list) 총원 대조
│     ├─ teams.ts            선수현황 뷰 모델 수집(팀 목록(감독)+선수/지도자·신장·체중) → data/{year}/teams.json (u81-baseball fetch_u18_rosters.py 이식, `npm run teams`)
│     ├─ schedule.ts         경기 일정/결과 수집(calendar→box_score, 취소 감지, 증분 병합, 주말리그 공식 순위 match_table) → data/{year}/schedule.json (u81-baseball fetch_u18_schedule.py 이식, `npm run schedule`, 전체 재수집 `SCHEDULE_FULL=1`)
│     ├─ playerProfiles.ts   /info/player/player_view 프로필 수집(출신학교 연도별·수상내역·생년월일·키/몸무게) → data/profiles/{personNo}.json + 시즌 내 이적 이력 roster-history 병합. `npm run profiles` = 전체 재수집.
│     ├─ leagueAverages.ts   리그 평균(computeLeagueRates) — 집계 결과 합산으로 AVG~wOBA·ERA~K/BB 산출 (averages.json 용, 갱신 시마다 재계산)
│     ├─ types.ts            ← web/src/shared/types.ts 와 호환 유지 필수
│     ├─ seed.ts, discover.ts(Playwright 탐색용), accumulate.test.ts
│
├─ data/  (커밋됨, 빌드 시 dist로 복사. games/·roster.json·roster-history.json·official.json 은 dist 제외 — vite.config 참고)
│  ├─ games/{gameId}.json          ★ 원천: 경기당 GameBoxScore (멱등 키 = id)
│  ├─ roster.json                  키: `${name}|${number}` → RosterEntry[] (학년/personNo/clubIdx/지역/투타)
│  ├─ roster-history.json          로스터 스냅샷+프로필 출신학교의 누적 union — 이적 선수 personNo 조인용 (dist 제외)
│  ├─ profiles/{personNo}.json     PlayerProfile (출신학교 연도별 이력·수상내역·생년월일 등 — 선수 상세 탭)
│  ├─ years.json                   [2026, …] (내림차순)
│  ├─ meta.json                    최신 시즌 Meta 복사본
│  └─ {year}/
│      ├─ meta.json                Meta
│      ├─ official.json            personNo → {batting, pitching}  (공식기록 오버레이)
│      ├─ averages.json            LeagueAverages (전체+시합별 리그평균 — 갱신 시마다 재계산, 용어 모달/wRC+/WAR 기준)
│      ├─ players/index.json       PlayerIndexEntry[]  (검색·매치업 후보용 슬림)
│      ├─ players/{id}.json        Player (gameLog 포함)
│      ├─ records/players.json     Player[] (gameLog 제외 슬림본 — 리더보드/테이블용)
│      ├─ schedule.json            ScheduleData (경기일정 페이지 — games[]+official_ranks, u18_schedule.json 스키마)
│      ├─ teams.json               TeamRosterEntry[] (선수현황 페이지 — 팀+선수+지도자, u18_data.json 스키마)
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
| 선수 프로필 | GET | `/info/player/player_view?person_no=N&gubun=P` | `summary_team` 표(선수명/백넘버/생년월일/포지션/키·몸무게/투타) + `<h4>출신학교` ul(지역/소속/연도/포지션 — **같은 연도 2개 학교 = 시즌 중 이적**) + `<h4>수상내역` ul(연도/대회명/수상명) |
| 경기 요약(일정용) | GET | `/game/box_score?game_idx=N` | `dl.game_name`(dt=대회명, dd="날짜 시간 / 구장 / 라운드") + `dl.team`×2("팀명 승/패 점수") + `dt.font_red`("취소") — schedule.ts |
| 주말리그 공식 순위 | GET | `/game/match_table?kind_cd=31&season=Y&lig_idx=N` | `<option lig_idx>` 로 권역 목록, `div.match-club > span.team` 행 순서 = 공식 순위 — schedule.ts |
| 선수등록현황 | GET | `/info/current/current_list` | 지역×부별 팀/선수 총계 표. `총계` 행(25칸)의 18세 이하부 팀[12]·계[16] 로 로스터 수집 검증 |

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
- `GameLogEntry.team?`: 그 경기 당시 소속(이적 병합 후 팀별 경기수 정확 계산용).
- `PlayerProfile`: personNo/name/birth/height/weight/투타 + `schools[]`(연도별 초·중·고) + `awards[]` — `data/profiles/{personNo}.json`.
- `LeagueAverages`: `{ season, updatedAt, overall: LeagueRates, tournaments: {slug: {title, rates}} }` — `data/{year}/averages.json`. `LeagueRates` = avg~woba·rPerPa(타자) + era~kbb(투수). wOBA 가중치는 scraper `leagueAverages.WOBA_WEIGHTS` ↔ web `sabermetrics.W` **동일 유지**.
- 선수 `id` 슬러그: `${team}_${name}_${number}` (공백 제거). 안정 ID 후보 = `personNo`.
- `PlayerIndexEntry.personNo`: 선수현황(teams.json person_no) ↔ 기록 상세(/player/:id) 연결 키.
- `ScheduleData/ScheduleGame`: `data/{year}/schedule.json` — u81-baseball u18_schedule.json 스키마 그대로 (status 완료/예정/취소, official_ranks 권역→팀명 순서).
- `TeamRosterEntry/TeamPlayerEntry/TeamStaffEntry`: `data/{year}/teams.json` — u81-baseball u18_data.json 스키마 그대로.

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

## 선수 중복 병합 & 수집 누락 (accumulate / 스크레이퍼)

- **roster.json 구조**: `이름|번호 → RosterEntry[]`(배열). 다른 학교 동명·동번호 충돌 보존(이전 단일 객체는 덮어써져 personNo 유실). 등번호 미배정 선수는 키 `이름|`(빈 번호)로 포함 — KBSA 선수등록현황 총원과 일치. `lookupRoster(roster,name,number,team)` 가 팀 일치로 정확 항목 선택. officialStats 도 동일 사용.
- **roster-history.json**: 로스터 스냅샷 + 프로필 출신학교(시즌 연도 행)의 누적 union. `aggregate` 5번째 인자(history)로 전달되어 ① (이름,번호,팀) 정확 매칭 폴백 ② nameTeamFallback 빈 자리 채움에 사용 → **이적 선수의 옛 소속 라인도 personNo 를 얻어 병합**.
- **중복 병합 4단계** (`accumulate.aggregate`):
  1. **정규팀 재슬러그**: `p.id` 를 정규팀 기반 `${team}_${name}_${number}` 로 재생성 → `광남고B`/`광남고BC` 처럼 축약 팀명으로 갈라진 동일 선수 병합(personNo 없어도). ⚠ 충돌 없는 단순 교체도 반드시 `reslugRemap` 에 기록(누락 시 매치업 id 가 옛 슬러그로 남아 상대 메타·링크·샤드 깨짐 — 2026-07-02 수정).
  2. **personNo 병합**: 같은 personNo 슬러그를 대표로 합산(raw stats `addBatting`/`addPitching` → derive 재계산). 대표 선정: **현행 로스터 소속팀 일치**(이적 시 현재 학교 기준 표시) → 투타정보 보유 → 경기수 순.
  3. **(이름,정규팀) 유일 폴백**: `nameTeamFallback`(현행 로스터 + history) — 번호변경/임시번호로 (이름,번호)가 안 맞아도 같은 학교 동명 1명뿐이면 personNo 부여.
  4. **번호 미상(`0`/빈) 병합**: 같은 이름·팀에 실번호 형제가 유일하면 거기로 병합.
  - 매치업 id 는 `canon()` = reslug → personNo 순으로 재매핑. **잔여 중복은 KBSA personNo 가 다른 실제 동명이인뿐**.
- **빈 박스스코어 재수집**: `fetchGames.emptyGameIds/emptyGameMonths` — 타자 0명 게임(수집 당시 record_detail 이 일시적으로 비어있던 경기)을 game_idx 가 있어도 매 증분마다 재fetch. `index.collectNewGames` 가 빈 게임 월을 스캔 월에 포함. **단, record_detail 자체에 선수 행이 없는 게임(KBSA 미게시·몰수 등 "합계 0.000")은 원본 부재라 복구 불가** — 게시되면 자동 채워짐.
- **취소·미래 경기 처리**: 캘린더에 `<strike>팀명</strike>` + "(취소)" 로 표시되는 우천취소 경기는 `GameRef.canceled` 로 감지 → record_detail fetch 없이 `canceled: true` 마커 파일 저장(재수집 루프 종료, `readEmptyGames` 제외). 캘린더 선등록된 미래 경기(`date > today`)는 수집 스킵 — 경기일이 지나면 자동 수집. `accumulate.readGames` 는 취소·빈 경기를 집계에서 제외(gameCount 정확화).

## 변경 이력 (이 문서에 한함 — 코드 변경 시 한 줄씩 추가)

- 2026-07-10: **알리는 글 페이지 추가**: `shared/Notice.tsx` → `/notice`, 데스크탑 nav-links·nav-drawer + 모바일 Drawer 에 "알리는 글"(8번째) 등록. 4개 섹션(서비스 성격 / 데이터 출처+KBSA 링크 / 기록은 참고용 / 저작권과 문의) — 비상업·출처 귀속·무단 수집 금지·정확성 무보증·권리자 요청 시 중단 고지. 갱신 주기는 최소치 보장 표현("하루 1회 이상")으로 표기(실제는 선수현황 2회·일정 5회). 스타일 `.notice*`(app.css, max-width 680px). 내비 링크 8개로 늘며 1440px 컨테이너에서 26px 오버플로 → `.search-pill--link` 에 `min-width: 0`(flex 기본 min-width:auto 해제)로 해소, 햄버거 전환 1360px 유지.

- 2026-07-10: **증분 수집 분리(ci)**: scrape.yml = 일정·기록 증분 전용(schedule+scrape, 하루 5회 — 12/15/18/21/24시 KST), 신규 teams.yml = 선수현황 전용(roster+teams+`MONTHS=0` 재집계, 하루 2회 — 10/18시 KST). 둘 다 `concurrency: scrape` 그룹으로 순차 실행, deploy.yml workflow_run 이름 3종으로 갱신. u81 동기화도 소스별 분리 — 일정 워크플로는 `--generate-schedule`(u18_schedule_data.js/u18_schedule.html 만), 선수현황 워크플로는 `--generate-players`(u18_app_data.js/u18_players.html/index.html 만) — u81 build_all.py 신규 모드, 실데이터 해시 비교로 상호 불간섭 검증. 유의: 기록 증분이 로스터보다 자주 돌므로 당일 새로 등장한 선수의 personNo 조인은 다음 선수현황 실행 때 채워짐.

- 2026-07-10: **UI 피드백 반영(경기일정·선수현황·선수 상세·검색)**: ① 팀/학교 카드 = 소프트 클라우드 헤더(#f5f5f5)+볼드 학교명+지역 회색 텍스트(`.sch-team-card__reg`) — 컬러 지역 배지 제거(badgeColors 는 POS/GRADE 만 유지), 승 초록·패 빨강 유지. ② 달력 년월 라인 블랙 채움(`.sch-monthnav`), 화살표는 데이터 유무로 활성/30% 흐림 구분(`.sch-monthnav__btn`). ③ 선수 상세 접이식 기본 모두 접힘 + 펼침 시 블랙 헤더·테두리 박스(`.fold[open]`). ④ 카드 내 시합명 볼드+한 줄 말줄임(`.sch-game__comp`). ⑤ 시합 탭 세그먼트 균등 폭(`.sch-seg`). ⑥ 리그 순위표 = `tv-table sch-stand` 고정 레이아웃(가로 스크롤 없음). ⑦ 팀 모달 필터 칩 테두리 1.5px. ⑧ 브랜드 로고 = 홈 링크 인지(호버 밑줄/눌림/title). ⑨ 검색 통일 — 상단바 검색(데스크탑 pill `.search-pill--link`·모바일 ⌕)은 /search 로 바로 이동(모바일 SearchOverlay 삭제), placeholder "선수 검색 (이름 또는 팀+등번호 가능)", 실존 선수 예시 문구 금지.
- 2026-07-10: **백그라운드 복귀 자동 동기화**: `shared/autoSync.ts` `useAutoSync()`(main.tsx Root) — visibilitychange/focus/online 시 `data/meta.json` lastUpdated 서명 비교(30초 스로틀), 변경 시 `bumpDataVersion()`(data.ts) → useAsync 전 훅 재조회. scrape 가 실행마다 meta.json 을 다시 쓰므로 모든 데이터 변경을 이 서명 하나로 감지. 콜드 스타트 최신화는 기존 network-first 서비스워커가 담당.
- 2026-07-10: **u81-baseball docs 동기화(ci)**: scrape/scrape-full 에 `sync-merge` 잡 — 데이터 커밋 발생 시(`changed` output) u81-baseball 체크아웃, `teams.json→u18_data.json`·`schedule.json→u18_schedule.json` 복사(스키마 동일), u81 의 `python build_all.py --generate-only`(신규 모드: 수집 없이 HTML/JS 재생성+docs 반영) 실행 후 커밋·푸시. `secrets.MERGE_REPO_TOKEN`(u81 contents RW PAT) 필요 — 미설정 시 경고 후 스킵. u81 쪽 cron 자동 수집은 제거(수동 전용).
- 2026-07-09: **u81-baseball(경기일정·선수현황) 병합**: ① 수집기 TS 이식 — `teams.ts`(팀 목록(감독)+선수/지도자/신장·체중 → `data/{year}/teams.json`), `schedule.ts`(calendar→box_score 일정/결과+취소, 증분 병합(완료·취소 보존, 예정+신규+최근3일 재수집), match_table 주말리그 공식 순위 → `data/{year}/schedule.json`) — 원본 Python(fetch_u18_rosters/schedule.py)과 산출물 동일함을 전수 비교로 검증. scrape.yml 에 `npm run teams`/`npm run schedule` 스텝, scrape-full.yml 은 `SCHEDULE_FULL=1` 전체 재수집. ② 프론트 — 공용 `ScheduleView`(/schedule: 월별 달력·학교별 전적·시합별 순위표/대진, 모달)·`TeamsView`(/players: 통계 밴드·팀 카드·팀 상세 모달·이름/백넘버 검색)·`PersonView`(/person/:personNo: 무기록 선수 폴백 상세) — 구성은 u81-baseball 페이지 동일, 스타일은 Nike.md 토큰. 선수 행 클릭 → 기록 보유 시 `/player/:id`(PlayerIndexEntry 에 `personNo` 추가로 조인), 무기록 시 폴백. 선수 상세(D/M/폴백)에 `KbsaLink`(player_view 새 탭) 버튼. 메인 히어로 버튼 = 경기일정→선수현황→선수기록→상대전적, 내비/드로어 7항목(경기일정·선수현황·선수 기록 상세·항목별 랭킹·상대전적·선수 검색·지표 설명).
- 2026-07-09: **수집 누락 원인 해소 — 취소·미래 경기**: 빈 박스스코어 51건의 정체 = ① 우천취소 경기 33건(캘린더 `<strike>`+"(취소)" — 팀명 파싱 실패로 빈 파일 저장 후 매 실행 재수집 루프) ② 캘린더 선등록 미래 경기 ③ 몰수경기(38759, 9:0 — 선수 기록 원본 부재). `koreaBaseball.fetchGameRefs` 가 취소 감지(`GameRef.canceled`) + strike 안 팀명 파싱, `index.collectNewGames` 가 취소 마커 저장·미래 경기 스킵·요청 간 250ms 지연, `readEmptyGames` 취소 제외, `readGames` 빈/취소 경기 집계 제외(경기 854→823 정확화). 부수 효과: 3·4월 캘린더 상시 재스캔 소멸, 실행당 낭비 요청 ~50건 제거.
- 2026-07-09: **선수 검색 백넘버 지원**: `searchPlayers` 가 공백 토큰 AND 매칭 — 숫자 토큰은 등번호 정확 일치(예: "충암 45"), 그 외 이름/팀 부분 일치. 검색 결과에 `N번` 표기 추가 (SearchPage/MSearch).
- 2026-07-09: **선수 상세 접이식 그룹**: 경기 로그를 시합(title)별, 상대전적을 상대 학교별 `<details>` 접이식(`shared/Fold.tsx`, `.fold` CSS)으로 — 경기 로그는 최근 경기가 속한 그룹만 기본 펼침, 그룹 1개면 자동 펼침. `groupLogByTitle`(playerStats)·`groupMatchupsByTeam`(matchup, 가나다순) 헬퍼. 학교 그룹 내 행은 학년·투타만 표기(학교 중복 제거). PlayerPage/MPlayer 공통.

- 2026-07-06: **랭킹 행 표기 개편**: `LeadersView` 행을 "이름(학교/학년/투타) 기록" 축약형(예: `박지율(유신고/3/우우)` — 학년 숫자만, 투타는 투·타 첫 글자)으로 — 별도 팀 컬럼(`rank-team`, 이름과 간격 멀던 문제) 제거, `LeaderItem` 에 grade/bats/throws 추가, `rankMeta()` 가 없는 항목 생략 조합. `.rank-meta` 폰트 = `calc(var(--type-caption) - 1pt)`, grid `36px 1fr auto 90px` → `36px 1fr 90px`(column-gap 8px). `.rank-name` 은 flex+nowrap — ▲▼ 는 `margin-left:auto` 로 기록값 옆 정렬, 모바일 가중치 모드에서 줄바꿈 없이 공간 부족 시 메타만 말줄임(ellipsis).
- 2026-07-06: **팀 강도 소프트 클램프**: `strength.ts` 하드 클램프(0.85~1.15 — 경계값에 30팀이 눌려 상·하위권 내부 서열 소실)를 소프트 클램프로 교체 — 1±0.15 구간은 원값, 초과분은 tanh 압축으로 0.7~1.3 점근(CORE=TAIL=0.15, 순단조라 동률 없음). `params.clamp` = [0.7, 1.3]. 가중치 설명 모달(weights.tsx) 문구 동기화.
- 2026-07-05: **용어 모달 학년별 리그평균**: `LeagueAverages.grades`("1"/"2"/"3" → LeagueRates) 추가 — index.ts 가 시즌 집계에서 학년별 `computeLeagueRates` 를 매 수집마다 재계산. `SaberTerm` 리그평균 섹션에 "학년별 (3개)" 접이식 그룹(전체 시즌 아래, 리그별 위).
- 2026-07-05: **상대 가중치 랭킹**: `scraper/src/strength.ts`(`buildStrength` — 수집 파이프라인 `index.ts` 가 집계 후 매번 자동 호출, 단독 재계산은 `npm run strength`)가 경기 원본에서 팀 강도(타격 wOBA/피wOBA 리그 대비 지수, 상대 강도 1회 재조정 + 지역 shrinkage K=6 + 클램프 0.85~1.15)와 선수별 상대 난이도(ob=타자 상대투수진, op=투수 상대타선 — gameLog 노출량 가중, 시즌+시합별)를 계산해 `data/{year}/strength.json` 생성. 프론트: `useStrength`/`weights.tsx`(WeightToggle+설명 모달 — "하루 동안 보지 않기" localStorage `weightInfoHideDate`), `leaders.ts` 에 `WeightKind`(bat-rate=×ob, pit-rate=÷op, bat-adv/pit-adv=리그평균 치환 재계산)·`weightedPick`·rankByCategory weights 인자(origValue/delta = as-is 대비 원값·순위변동). 적용: 홈 리더보드(D/M)+랭킹(LeadersView). 누적 지표는 미보정(토글 비활성). accumulate `buildTeamNormalizer` export.

- 2026-07-04: **선수 기록 페이지 규정 미달 토글**: RecordsPage/MRecords 가 `useQualifyContext` + `isQualifiedBat/Pit` 로 규정 미달 선수를 기본 제외, 랭킹 페이지와 동일한 `qual-toggle` 체크박스("규정 미달 포함 — 규정타석/이닝 설명")로 포함 가능. 탭 kind(타자/투수)에 따라 규정타석/규정이닝 기준 자동 전환.
- 2026-07-04: **학년 필터 추가**: `RecordFilter` 에 `grade`("1"/"2"/"3") — `FilterBar` 하단 줄이 지역+학교+학년 3칸(`filter-bar__row--2col` → `--3col`, 모바일은 학년 칸만 좁게). `applyFilter` 가 학년도 클라이언트 필터링, URL query `g` 로 홈↔랭킹 전파(`filterToQuery`/`filterFromQuery`). 학년 옵션은 지역/학교 캐스케이드로 rows 에서 유도. 적용 위치: 홈 시즌리더(Desktop/Mobile)·선수 기록(Desktop/Mobile)·랭킹(`LeadersView`) — 규정 충족자 수·순위 모두 학년 필터 반영. wRC+/WAR 리그평균 기준값은 기존 지역/학교 필터와 동일하게 리그 전체(시즌/시합) 기준 유지.
- 2026-07-02: 상대전적 메타 누락/로스터 총원/이적 병합/WAR·wRC+/선수 상세 탭 일괄 개선:
  - **매치업 id 재매핑 버그 수정 (#1·#5)**: reslug 비충돌 브랜치에서 `reslugRemap` 미기록 → 매치업 886건이 옛 축약팀 슬러그(`GD챌린_…`)로 남아 상대 (학교·학년·투타) 메타·링크·상대전적 샤드가 깨지던 문제. 한 줄 수정 + 재집계.
  - **로스터 총원 일치 (#2)**: `roster.ts` 가 등번호 미배정 선수도 수집(키 `이름|`), 이름은 `<a>` 없을 때 span 폴백. 수집 후 `/info/current/current_list` 의 18세 이하부 총계와 자동 대조(±1% 초과 시 경고). 3,667 → 3,859명(공식 3,860).
  - **이적 선수 기록 합산 (#3)**: `data/roster-history.json`(스냅샷 누적) + `playerProfiles.ts`(player_view 출신학교 연도별 이력 — 같은 연도 2개 학교 = 시즌 중 이적) → `aggregate(…, history)` 조인으로 옛 소속 라인 병합. 대표는 현행 로스터 소속팀 우선 → 고교·학년·투타는 현재 기준, 기록은 합산. `GameLogEntry.team` 추가로 팀별 경기수 왜곡 방지.
  - **선수 상세 탭 (#3)**: 타자기록/투수기록/출신학교/수상내역 탭(Desktop `PlayerPage`·Mobile `MPlayer`). 기록 탭은 해당 기록 보유 시에만 노출, 출신학교=profiles 연도별(초·중·고), 수상내역=대회/수상명. 프로필의 생년월일·키/몸무게 헤더 표시.
  - **WAR·wRC+ (#4)**: `sabermetrics.ts` 에 wOBA/wRC+/WAR(타자·투수 구분, 간이 계산 — 상수: wOBA스케일 1.15, 10런=1승, 대체수준 타자 −20런/600PA·투수 +0.6런/9IP). 리그평균은 스크레이퍼 `leagueAverages.ts` 가 갱신 시마다 재계산해 `data/{year}/averages.json`(전체+시합별) 기록. 용어 모달(`SaberTerm`)에 전체/리그별(주말리그)/시합별(전국대회) 리그평균 표시. Glossary 에 wOBA/wRC+/WAR(타자·투수) 계산식 추가(TERM_MAP 키: `WAR_BAT`/`WAR_PIT`).
  - **상대전적 표에 투타 컬럼** (MatchupPage/MMatchup).
  - **랭킹·기록 세부에도 확장**: `leaders.ts` 카테고리에 wOBA/wRC+/WAR(타자)·WAR(투수) 추가(id: `woba`/`wrc`/`war-bat`/`war-pit`, wRC+·wOBA 는 규정타석, WAR 는 누적). `columns.ts` 세부 탭이 lg(LeagueRates)를 받는 팩토리로 변경 — `recordTabs(lg)` 호출로 바뀜(RecordsPage/MRecords/LeadersView 가 averages.json 의 스코프별 rates 주입).
  - **wRAA 지표 추가 + 모달 라벨 정리**: battingAdvanced 에 wraa(부호 표기 `signed1`), 타자 세부 컬럼·선수 상세 세이버·Glossary·랭킹(id `wraa`, 누적) 에 wRAA 추가. 타율(AVG)·평균자책(ERA)도 선수 상세에서 클릭형 모달로. wRC+/WAR/wRAA 모달은 "리그 평균" 대신 `avgLabel`("계산 기준값 — 리그 wOBA/ERA") + avgNote(정의상 평균=100/0, WAR 는 평균 없음)로 오해 방지.
  - scrape-full.yml 에 `npm run profiles`(전체 프로필 재수집) 스텝 추가. 증분 scrape 는 신규 경기 출전자만 프로필 갱신(`updateProfilesFor`).
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
