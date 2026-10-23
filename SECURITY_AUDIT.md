# 보안 점검 리포트 (2026-10-23)

> 점검만 수행했고 코드는 수정하지 않았다. 아래 **보완 작업**은 다음 작업 때 우선 처리한다.

## 보완 작업 (우선순위 순)

- [ ] **P1. vite 업그레이드 (npm audit 높음)** — `web` 의 `vite` 5.4.21 → 6.4.4 이상(audit 제안은 8.x). `@vitejs/plugin-react` 도 호환 버전으로 함께 올리고, 의존하는 `esbuild` 0.21.5(중간) 취약점도 같이 해소되는지 `npm audit` 로 확인. `npm run build`·`npm test` 통과 확인 필수.
- [ ] **P2. CSP 추가** — `web/index.html` 에 Content-Security-Policy 메타 태그 추가(`script-src 'self'`, `connect-src` 를 AI 공급자 도메인으로 제한). 브라우저에 저장된 AI API 키가 XSS·공급망 공격으로 유출되는 위험을 줄인다. PWA·Pages 배포에서 깨지는 리소스 없는지 실측.
- [ ] **P3. KBSA 링크 파라미터 인코딩** — `web/src/shared/kbsa.ts` 의 `person_no`, `game_idx` 에 `encodeURIComponent` 적용.
- [ ] **P4. GitHub Actions SHA 고정** — `.github/workflows/*.yml` 의 `actions/checkout@v4` 등 태그 참조를 커밋 SHA 로 고정(수집 워크플로가 `contents: write` 권한이라 공급망 영향 축소).
- [ ] **P5. react-router-dom v7 이전 검토** — 6.30.6(중간, 오픈 리다이렉트·SSR) 취약점. 현재 코드에선 공격 경로가 없어 급하지 않으나, v6→v7 마이그레이션 시 함께 해소.

## 1. 점검 범위

- PHP 보안 점검을 요청받았으나 저장소에 **PHP 파일이 없음**(`.php`/`.phtml`/`.inc`/`composer.json` 없음, git 전체 이력에도 없음). SQL 인젝션·LFI/RFI·명령 실행 등 PHP 고유 취약점은 해당 없음.
- 실제 구성: `scraper/`(Node+TS 수집기), `web/`(Vite+React 정적 SPA, GitHub Pages), `.github/workflows/` 4개, `data/` JSON.
- 데이터 출처 korea-baseball.com 은 외부 서비스라 범위 밖.

## 2. 소스 코드 점검 결과

| # | 심각도 | 위치 | 내용 |
|---|---|---|---|
| 1 | 중간 | `web/src/shared/ai/providers.ts:109`, `vault.ts` | 사용자 AI API 키를 브라우저에서 직접 사용(`dangerouslyAllowBrowser: true`). 키는 AES-GCM + non-extractable 키로 IndexedDB 에 암호화 저장되어 저장 방식은 적절하나, 같은 출처 스크립트(XSS·의존성 공급망)는 막지 못함(코드 주석·화면 안내에 명시됨). 구조상 불가피 → 완화책은 P2(CSP). |
| 2 | 낮음 | `web/index.html` | CSP 미설정 → P2. |
| 3 | 낮음 | `web/src/shared/kbsa.ts:5-10` | URL 파라미터를 인코딩 없이 연결. 앞부분이 `https://www.korea-baseball.com` 고정이라 `javascript:` XSS 불가, 파라미터 오염 수준 → P3. |
| 4 | 낮음 | `.github/workflows/*.yml` | 액션을 태그로만 참조(SHA 미고정) → P4. 공식 `actions/*` 만 사용·`npm ci` 고정이라 실위험 낮음. |

### 이상 없음

- XSS 위험 API(`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`) 사용 없음. AI 분석 결과는 React 텍스트로 출력(`AiAnalysisPanel.tsx:136-139`).
- 외부 링크 `target="_blank"` 에 모두 `rel="noreferrer"`.
- 워크플로에 `pull_request_target` 없음, `run:` 에 `${{ github.event.* }}` 직접 삽입 없음, 배포는 `contents: read`.
- 하드코딩된 비밀값 없음, 워크플로 `secrets.*` 미사용.
- 수집기는 고정 KBSA 주소로 GET 만 수행, `child_process`/`exec` 없음.

## 3. npm audit 결과

| 폴더 | 결과 |
|---|---|
| `scraper` | 0건 |
| `web` | 4건 (높음 1, 중간 3) |

| 패키지 (설치 버전) | 심각도 | 직접 | 내용 | 이 프로젝트 영향 |
|---|---|---|---|---|
| `vite` 5.4.21 | 높음 | O | Windows `server.fs.deny`·`fs.existsSync()` 우회(높음), `.map` 경로 탐색, launch-editor 인자 처리, 커스텀 미들웨어 교차 출처 스크립트 실행(낮음) 등 | 개발 서버(`npm run dev`) 한정. 배포본(정적 파일)엔 무관. 단 `verify-dev.ps1` 로 Windows 개발 서버를 쓰므로 `--host` 노출 시 주의 → P1 |
| `esbuild` 0.21.5 | 중간 | - (vite 경유) | 다른 웹사이트가 개발 서버에 요청 후 응답 읽기 가능 (GHSA-67mh-4wv8-2f99) | 개발 서버 한정 → P1 로 함께 해소 |
| `react-router` 6.30.6 | 중간 | - | ① `<Link>`/`useNavigate` 역슬래시 오픈 리다이렉트 (GHSA-wrjc-x8rr-h8h6) ② SSR `deserializeErrors()` 생성자 주입 (GHSA-337j-9hxr-rhxg) | ① 모든 `nav()`/`<Link to>` 가 `/` 로 시작하는 고정 내부 경로라 현재 악용 경로 없음 ② SSR 미사용 → 해당 없음 → P5 |
| `react-router-dom` 6.30.6 | 중간 | O | 위 react-router 취약점 상속 | 동일 |

`npm audit fix --force` 는 메이저 업그레이드(vite 8, react-router-dom 7)를 일으키므로 그대로 실행하지 말 것.
