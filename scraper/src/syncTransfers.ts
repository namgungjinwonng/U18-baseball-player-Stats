// 이미 수집된 시즌의 teams.json 에 이적 표시(moved_to)를 다시 판정해 반영하는 스크립트(지난 시즌 보정용)
// 실행: YEARS=2024,2025 npm run transfers
// 현재 시즌은 npm run teams(선수현황 수집)가 매번 판정하므로 따로 돌릴 필요가 없다.
// 지난 시즌 아카이브 원칙에 따라 teams.json 의 moved_to 만 바꾸고 roster-history 는 건드리지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markRosterTransfers } from "./teams.js";
import type { TeamRosterEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function main() {
  const years = (process.env.YEARS ?? "").split(",").map((y) => parseInt(y, 10)).filter(Boolean);
  if (!years.length) throw new Error("YEARS=2024,2025 처럼 시즌을 지정하세요.");
  for (const year of years) {
    const fp = path.join(DATA_DIR, String(year), "teams.json");
    const rosters = JSON.parse(fs.readFileSync(fp, "utf8")) as TeamRosterEntry[];
    console.log(`[${year}] 이적 판정…`);
    const r = await markRosterTransfers(DATA_DIR, rosters, year, []);
    fs.writeFileSync(fp, JSON.stringify(rosters));
    console.log(`✓ ${year}: 두 학교 이상 ${r.multi}명 · 판정 ${r.marked}명 · 미판정 ${r.multi - r.marked}명 · 프로필 갱신 ${r.refreshed}명`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
