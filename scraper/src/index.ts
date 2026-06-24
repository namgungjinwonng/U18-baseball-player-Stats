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
import { collectOfficial } from "./officialStats.js";
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

async function collectNewGames(): Promise<string[]> {
  const newFiles: string[] = [];
  const fetchOne = async (ref: { id: string; date: string }): Promise<"ok" | "gone" | "fail"> => {
    try {
      const box = await parseRecordDetail(ref as never);
      const fp = path.join(DATA_DIR, "games", `${box.id}.json`);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, JSON.stringify(box, null, 2) + "\n");
      newFiles.push(`${box.id}.json`);
      console.log(`+ 경기 추가: ${box.id} (${box.date})`);
      return "ok";
    } catch (e) {
      // 410 Gone = 영구 실패(재시도 제외). 그 외는 일시 실패로 재시도 대상.
      return /410/.test((e as Error).message) ? "gone" : "fail";
    }
  };
  try {
    // 증분: env 미지정 시 마지막 수집 경기의 월부터만 스캔(시간 절약)
    const months = MONTHS ?? incrementalMonths(DATA_DIR);
    const refs = await listGameRefs(2026, months);
    const have = existingGameIds(DATA_DIR);
    const eligible = refs.filter((r) => !have.has(r.id) && isAfterSeasonStart(r.date));
    const todo = GAME_LIMIT === Infinity ? eligible : eligible.slice(0, GAME_LIMIT);
    let failed: typeof todo = [];
    for (const ref of todo) if ((await fetchOne(ref)) === "fail") failed.push(ref);
    // 누락(일시 실패) 재시도: 지수 백오프 최대 5회
    for (let attempt = 1; attempt <= 5 && failed.length; attempt++) {
      const retry = failed;
      failed = [];
      const wait = Math.min(5000 * 2 ** (attempt - 1), 40000);
      console.log(`  [경기 재시도 ${attempt}] 누락 ${retry.length}건, ${wait / 1000}s 대기`);
      await new Promise((r) => setTimeout(r, wait));
      for (const ref of retry) if ((await fetchOne(ref)) === "fail") failed.push(ref);
    }
    if (failed.length) console.warn(`  ⚠ 최종 누락 ${failed.length}경기(일시실패)`);
  } catch (e) {
    console.warn(`⚠ 경기 목록 수집 실패: ${(e as Error).message}`);
  }
  return newFiles;
}

// 신규 경기에 등장한 선수만 공식기록 증분 수집 → 기존 official.json 에 병합.
async function updateOfficialFor(year: number, newGameFiles: string[]) {
  if (newGameFiles.length === 0) return;
  const offFp = path.join(DATA_DIR, String(year), "official.json");
  const existing = fs.existsSync(offFp) ? JSON.parse(fs.readFileSync(offFp, "utf8")) : {};
  const fresh = await collectOfficial(DATA_DIR, year, newGameFiles);
  const merged = { ...existing, ...fresh };
  fs.mkdirSync(path.dirname(offFp), { recursive: true });
  fs.writeFileSync(offFp, JSON.stringify(merged));
  console.log(`✓ 공식기록 병합: 신규 ${Object.keys(fresh).length}명 (총 ${Object.keys(merged).length})`);
}

async function main() {
  const newGameFiles = await collectNewGames();
  const games = readGames(DATA_DIR);
  if (games.length === 0) {
    console.log("경기 데이터가 없어 집계를 건너뜁니다.");
    return;
  }
  const roster = readRoster(DATA_DIR);
  // 시즌별 누적 집계 → data/{year}/ 에 기록 (연도 선택용).
  const bySeason = groupBySeason(games);
  const years = [...bySeason.keys()].sort((a, b) => b - a);
  // 신규 경기 선수 공식기록 증분 수집(있을 때만, 시즌별)
  for (const year of years) {
    const yearGameIds = new Set(bySeason.get(year)!.map((g) => `${g.id}.json`));
    const yearNew = newGameFiles.filter((f) => yearGameIds.has(f));
    await updateOfficialFor(year, yearNew);
  }
  let latest: Meta | undefined;
  for (const year of years) {
    // 공식기록 오버레이(있으면): data/{year}/official.json
    const offFp = path.join(DATA_DIR, String(year), "official.json");
    const official = fs.existsSync(offFp)
      ? (JSON.parse(fs.readFileSync(offFp, "utf8")) as Record<string, { batting?: unknown; pitching?: unknown }>)
      : {};
    const agg = aggregate(bySeason.get(year)!, SOURCE, roster, official as never);
    writeYear(DATA_DIR, year, agg);
    if (latest === undefined) latest = agg.meta;
    console.log(
      `✓ ${year} · 경기 ${agg.meta.gameCount} · 선수 ${agg.players.length} · 상대전적 ${agg.matchups.length}`
    );
  }
  if (latest) writeYearsIndex(DATA_DIR, years, latest);
  console.log(`✓ 연도 ${years.join(", ")} · 신규 ${newGameFiles.length}경기`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
