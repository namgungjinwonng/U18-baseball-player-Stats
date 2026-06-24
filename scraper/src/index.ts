// 스크레이프 진입점 (GitHub Actions / 로컬 수동 실행).
//
// 1) 신규 경기를 수집해 data/games/{id}.json 으로 저장(멱등: 신규만).
// 2) data/games/*.json 전체에서 선수 집계/상대전적/색인/메타를 파생.
//
// 수집(1)은 내부 API 확정 전까지 미구현일 수 있으나, 파생(2)은 항상 수행되어
// 기존 경기로부터 결정적으로 데이터를 재생성한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, readGames, readRoster, writeAggregated } from "./accumulate.js";
import { existingGameIds, isAfterSeasonStart, listGameRefs } from "./fetchGames.js";
import { parseRecordDetail } from "./parseRecord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const SOURCE = "korea-baseball.com (KBSA)";

// 한 번에 수집할 신규 경기 상한(미설정 시 무제한). 초기 적재/테스트용.
const GAME_LIMIT = process.env.GAME_LIMIT ? parseInt(process.env.GAME_LIMIT, 10) : Infinity;
// 수집 대상 월(쉼표구분, 예: "6" 또는 "5,6"). 미설정 시 fetchGames 기본(3~12월).
const MONTHS = process.env.MONTHS
  ? process.env.MONTHS.split(",").map((s) => parseInt(s, 10))
  : undefined;

async function collectNewGames(): Promise<number> {
  let added = 0;
  try {
    const refs = await listGameRefs(2026, MONTHS);
    const have = existingGameIds(DATA_DIR);
    for (const ref of refs) {
      if (added >= GAME_LIMIT) break;
      if (have.has(ref.id) || !isAfterSeasonStart(ref.date)) continue;
      const box = await parseRecordDetail(ref);
      const fp = path.join(DATA_DIR, "games", `${box.id}.json`);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(box, null, 2) + "\n");
      added++;
      console.log(`+ 경기 추가: ${box.id} (${box.date})`);
    }
  } catch (e) {
    console.warn(`⚠ 신규 경기 수집 건너뜀: ${(e as Error).message}`);
  }
  return added;
}

async function main() {
  const added = await collectNewGames();
  const games = readGames(DATA_DIR);
  if (games.length === 0) {
    console.log("경기 데이터가 없어 집계를 건너뜁니다.");
    return;
  }
  const agg = aggregate(games, SOURCE, readRoster(DATA_DIR));
  writeAggregated(DATA_DIR, agg);
  console.log(
    `✓ 집계 완료 · 경기 ${games.length} · 선수 ${agg.players.length} · 상대전적 ${agg.matchups.length} (신규 ${added})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
