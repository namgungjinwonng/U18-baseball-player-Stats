// 참고 소스(C:\Users\user\claude\U-18 Baseball/u18_schedule.json)의 game_idx→title 매핑으로
// 우리 data/games/*.json 의 title 누락분을 채운다. KBSA 410 Gone 경기까지 보존.
//
// 실행: npx tsx scraper/src/fillFromReference.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GameBoxScore } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const REF_SCHEDULE = "C:/Users/user/claude/U-18 Baseball/u18_schedule.json";

interface RefGame { game_idx: string; title?: string }
interface RefSchedule { games: RefGame[] }

function main() {
  if (!fs.existsSync(REF_SCHEDULE)) {
    console.error(`참고 스케줄 파일 없음: ${REF_SCHEDULE}`);
    process.exit(1);
  }
  const ref = JSON.parse(fs.readFileSync(REF_SCHEDULE, "utf8")) as RefSchedule;
  const titleByIdx = new Map<string, string>();
  for (const g of ref.games) {
    if (g.game_idx && g.title) titleByIdx.set(String(g.game_idx), g.title);
  }
  console.log(`참고 데이터: ${titleByIdx.size}개 game_idx→title 매핑`);

  const gamesDir = path.join(DATA_DIR, "games");
  if (!fs.existsSync(gamesDir)) {
    console.error(`games 디렉터리 없음: ${gamesDir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(gamesDir).filter((f) => f.endsWith(".json"));
  let filled = 0, alreadyOk = 0, noMatch = 0;
  for (const f of files) {
    const fp = path.join(gamesDir, f);
    const g = JSON.parse(fs.readFileSync(fp, "utf8")) as GameBoxScore;
    if (g.title && g.title.trim().length > 0) { alreadyOk++; continue; }
    const t = titleByIdx.get(String(g.id));
    if (!t) { noMatch++; continue; }
    const merged: GameBoxScore = { ...g, title: t };
    fs.writeFileSync(fp, JSON.stringify(merged, null, 2) + "\n");
    filled++;
  }
  console.log(`처리: 총 ${files.length} / 이미 OK ${alreadyOk} / 채움 ${filled} / 매칭 없음 ${noMatch}`);
}

main();
