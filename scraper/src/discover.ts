// korea-baseball.com 은 JS 렌더링 SPA 이므로, 페이지가 호출하는 내부 JSON API 를
// 찾아내는 것이 수집의 1순위다. Playwright 로 record_detail 류 페이지를 열고
// 모든 XHR/fetch 응답(JSON)을 로그로 덤프해 엔드포인트/필드 구조를 파악한다.
//
// 실행: npm run discover -- "<record_detail URL>"
// 예:   npm run discover -- "https://www.korea-baseball.com/game/record_detail?..."
import { chromium } from "playwright";

const target =
  process.argv[2] ??
  "https://www.korea-baseball.com/game/schedule"; // 기본: 일정 → 경기 링크 관찰

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiHits: { url: string; status: number; sample: unknown }[] = [];
  const xhrUrls = new Set<string>();

  page.on("request", (req) => {
    const t = req.resourceType();
    if (t === "xhr" || t === "fetch") xhrUrls.add(`${req.method()} ${req.url()}`);
  });

  page.on("response", async (res) => {
    const url = res.url();
    // korea-baseball.com 데이터 계층(/exec/, record_detail 등) 응답 본문을 덤프
    if (/korea-baseball\.com\/(exec|game|record)\//.test(url) || /record_detail/.test(url)) {
      try {
        const body = await res.text();
        const ct = res.headers()["content-type"] ?? "";
        console.log(`\n[DATA] ${res.status()} ${ct.split(";")[0]} ${url}`);
        console.log(body.replace(/\s+/g, " ").trim().slice(0, 700) + (body.length > 700 ? " …" : ""));
      } catch { /* 무시 */ }
      return;
    }
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const body = await res.json();
      apiHits.push({ url, status: res.status(), sample: trim(body) });
      console.log(`\n[API] ${res.status()} ${url}`);
      console.log(preview(body));
    } catch {
      /* JSON 파싱 실패는 무시 */
    }
  });

  console.log(`▶ 탐색 대상: ${target}`);
  const resp = await page.goto(target, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(3000);
  console.log(`\nHTTP ${resp?.status()} · 최종 URL: ${page.url()}`);

  // 1) XHR/fetch 호출 목록
  console.log(`\n=== XHR/fetch 호출 ${xhrUrls.size}건 ===`);
  for (const u of xhrUrls) console.log(`- ${u}`);
  console.log(`\n=== JSON 응답 ${apiHits.length}건 ===`);
  for (const h of apiHits) console.log(`- ${h.url}`);

  // 2) 서버 렌더 임베디드 상태 탐지
  const embedded = await page.evaluate(() => {
    const out: Record<string, string> = {};
    const w = window as unknown as Record<string, unknown>;
    for (const key of ["__NUXT__", "__NEXT_DATA__", "__INITIAL_STATE__", "__APP_DATA__"]) {
      if (w[key] !== undefined) {
        try { out[key] = JSON.stringify(w[key]).slice(0, 600); } catch { out[key] = "(직렬화 실패)"; }
      }
    }
    const scripts = [...document.querySelectorAll("script[id], script[type='application/json']")]
      .map((s) => s.id || s.getAttribute("type") || "")
      .filter(Boolean);
    return { keys: Object.keys(out), out, scripts };
  });
  console.log(`\n=== 임베디드 상태 키: ${embedded.keys.join(", ") || "(없음)"} ===`);
  for (const k of embedded.keys) console.log(`[${k}] ${embedded.out[k]}…`);
  if (embedded.scripts.length) console.log(`스크립트 데이터 후보: ${embedded.scripts.join(", ")}`);

  // 3) 경기 상세(record_detail) 링크 추출
  const links = await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll("a[href]")]
      .map((a) => (a as HTMLAnchorElement).getAttribute("href") || "");
    return [...new Set(hrefs.filter((h) => /record_detail|record|game/i.test(h)))].slice(0, 20);
  });
  console.log(`\n=== record/game 관련 링크 ${links.length}건 ===`);
  for (const l of links) console.log(`- ${l}`);

  // 4) 페이지 텍스트 일부(렌더 여부 확인)
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
  console.log(`\n=== 본문 텍스트(앞 400자) ===\n${text}`);

  await browser.close();
}

// 콘솔 가독성을 위해 큰 배열/객체를 잘라서 보여준다.
function trim(v: unknown): unknown {
  if (Array.isArray(v)) return v.slice(0, 2);
  return v;
}
function preview(v: unknown): string {
  const s = JSON.stringify(trim(v), null, 2);
  return s.length > 1200 ? s.slice(0, 1200) + "\n… (생략)" : s;
}

main().catch((e) => {
  console.error("탐색 실패:", e);
  process.exit(1);
});
