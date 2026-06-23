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

```bash
cd scraper
npm install
npm run discover   # SPA가 호출하는 실제 API/DOM 구조 탐지(구현 1순위)
npm run scrape     # 신규 경기 수집 → data/ 누적 머지(게임ID 멱등)
```

GitHub Actions `scrape.yml`이 시즌 중 정기 실행하여 `data/` 변경분을 커밋하고, `deploy.yml`이 Pages로 배포합니다.

## 배포 (최초 1회)

`gh` CLI 또는 GitHub Desktop으로 원격 리포를 만든 뒤 푸시합니다. 리포 Settings → Pages 소스를 GitHub Actions로 설정하면 `deploy.yml`이 동작합니다.
