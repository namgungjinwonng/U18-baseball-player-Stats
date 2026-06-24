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
import {
  aggregate, groupBySeason, readGames, readRoster, writeYear, writeYearsIndex,
} from "./accumulate.js";
import {
  existingGameIds, incrementalMonths, isAfterSeasonStart, listGameRefs,
} from "./fetchGames.js";
import { parseRecordDetail } from "./parseRecord.js";
import type { Meta } from "./types.js";

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
    // 증분: env 미지정 시 마지막 수집 경기의 월부터만 스캔(시간 절약)
    const months = MONTHS ?? incrementalMonths(DATA_DIR);
    const refs = await listGameRefs(2026, months);
    const have = existingGameIds(DATA_DIR);
    for (const ref of refs) {
      if (added >= GAME_LIMIT) break;
      if (have.has(ref.id) || !isAfterSeasonStart(ref.date)) continue;
      // 개별 경기 실패(예: 410 Gone)는 그 경기만 건너뛰고 계속 진행.
      try {
        const box = await parseRecordDetail(ref);
        const fp = path.join(DATA_DIR, "games", `${box.id}.json`);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, JSON.stringify(box, null, 2) + "\n");
        added++;
        console.log(`+ 경기 추가: ${box.id} (${box.date})`);
      } catch (e) {
        console.warn(`  ⚠ 경기 ${ref.id} 건너뜀: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    console.warn(`⚠ 경기 목록 수집 실패: ${(e as Error).message}`);
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
  const roster = readRoster(DATA_DIR);
  // 시즌별 누적 집계 → data/{year}/ 에 기록 (연도 선택용).
  const bySeason = groupBySeason(games);
  const years = [...bySeason.keys()].sort((a, b) => b - a);
  let latest: Meta | undefined;
  for (const year of years) {
    const agg = aggregate(bySeason.get(year)!, SOURCE, roster);
    writeYear(DATA_DIR, year, agg);
    if (latest === undefined) latest = agg.meta;
    console.log(
      `✓ ${year} · 경기 ${agg.meta.gameCount} · 선수 ${agg.players.length} · 상대전적 ${agg.matchups.length}`
    );
  }
  if (latest) writeYearsIndex(DATA_DIR, years, latest);
  console.log(`✓ 연도 ${years.join(", ")} · 신규 ${added}경기`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
