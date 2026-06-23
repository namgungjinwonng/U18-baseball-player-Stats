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

  page.on("response", async (res) => {
    const url = res.url();
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) return;
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
  await page.goto(target, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(3000);

  console.log(`\n=== 발견된 JSON 엔드포인트 ${apiHits.length}건 ===`);
  for (const h of apiHits) console.log(`- ${h.url}`);

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
