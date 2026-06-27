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
- **CI**: `.github/workflows/scrape.yml`("데이터 수집·집계", 매일 KST 00:00 → 커밋) + `deploy.yml`("웹사이트 배포 (GitHub Pages)", `web/**`·`data/**` 푸시 시 Pages 배포). GitHub가 자동 추가하는 `pages-build-deployment`(파일 없음, 이름 변경 불가)도 함께 표시될 수 있음.
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
│     │   ├─ columns.ts      recordTabs (타자 기본/세부, 투수 기본/세부) + 컬럼 정의
│     │   ├─ leaders.ts      홈 리더보드(규정타석=경기수×3.1, 규정이닝=경기수×1.0)
│     │   ├─ matchup.ts      Role/playerLabel/facedOpponents/facedSchools/sumMatchups
│     │   ├─ filters.tsx, StatTable.tsx, Glossary.tsx, Footer.tsx
│     ├─ desktop/  DesktopApp.tsx + pages/{Home,Records,Matchup,Search,Player}Page.tsx
│     └─ mobile/   MobileApp.tsx + mobile.css + pages/{MHome,MRecords,MMatchup,MSearch,MPlayer}.tsx
│
├─ scraper/
│  └─ src/
│     ├─ index.ts            ★ 메인 진입(`npm run scrape`): collectNewGames → updateOfficialFor → aggregate → writeYear/writeYearsIndex
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

## 변경 이력 (이 문서에 한함 — 코드 변경 시 한 줄씩 추가)

- 2026-06-27: 초판 작성 (구조 분석 기준 커밋 `f0948e6`).
- 2026-06-27: `VITE_BASE` 를 실제 리포명(`U18-baseball-player-Stats`)에 맞춰 정정. (이전 값 `U18-baseball-player-records` 는 리포명과 불일치하여 배포 시 자산 경로 404 유발.)
- 2026-06-27: 워크플로 이름 한글화 — `Deploy to GitHub Pages` → `웹사이트 배포 (GitHub Pages)`, `Scrape & Accumulate Data` → `데이터 수집·집계`. (GitHub 자동 생성 `pages-build-deployment` 은 이름 변경 불가.)
