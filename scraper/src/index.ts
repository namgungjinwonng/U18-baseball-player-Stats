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

// 시합/대회명 → 파일시스템/URL 호환 슬러그(한글 유지).
function tournamentSlug(title: string): string {
  let s = title.trim().replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "-");
  if (s.length > 80) s = s.slice(0, 80);
  return s || "untitled";
}

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
    // 증분: env 미지정 시 마지막 수집 경기의 월부터만 스캔(시간 절약).
    // 단, 최근 3일치(오늘·어제·그제) 캘린더 월은 항상 포함해 진행 중 경기를 따라잡는다.
    // (참고: U-18 Baseball/fetch_u18_schedule.py main_incremental — 최근 N일 무조건 재수집)
    const baseMonths = MONTHS ?? incrementalMonths(DATA_DIR);
    // MONTHS=0 = 재집계 전용(캘린더/박스 호출 스킵).
    if (MONTHS && MONTHS.length === 1 && MONTHS[0] === 0) {
      console.log("MONTHS=0 → 캘린더 스캔 스킵 (재집계 전용 모드)");
      return [];
    }
    const todayISO = new Date().toISOString().slice(0, 10);
    const recentMonth = parseInt(todayISO.slice(5, 7), 10);
    const months = [...new Set([...baseMonths, recentMonth])].sort((a, b) => a - b);
    const refs = await listGameRefs(2026, months);
    const have = existingGameIds(DATA_DIR);
    // 최근 3일치 game_idx 는 이미 수집되어 있어도 강제 재수집(점수 0-0 오인·실시간 업데이트 교정).
    const recentDays = new Set<string>();
    for (let k = 0; k < 3; k++) {
      const d = new Date();
      d.setDate(d.getDate() - k);
      recentDays.add(d.toISOString().slice(0, 10));
    }
    const recentRefs = refs.filter((r) => recentDays.has(r.date) && have.has(r.id));
    const eligible = refs.filter(
      (r) => (!have.has(r.id) || recentDays.has(r.date)) && isAfterSeasonStart(r.date)
    );
    if (recentRefs.length) console.log(`  ↻ 최근 3일치 ${recentRefs.length}경기 재수집 대상`);
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
    const yearGames = bySeason.get(year)!;
    const agg = aggregate(yearGames, SOURCE, roster, official as never);
    writeYear(DATA_DIR, year, agg);
    if (latest === undefined) latest = agg.meta;

    // --- 시합/대회별 집계 → 시합 선택 필터 ---
    const byTitle = new Map<string, typeof yearGames>();
    for (const g of yearGames) {
      const t = g.title?.trim();
      if (!t) continue;
      const arr = byTitle.get(t) ?? [];
      arr.push(g);
      byTitle.set(t, arr);
    }
    const tournamentList: { slug: string; title: string; gameCount: number }[] = [];
    for (const [title, games] of byTitle) {
      const slug = tournamentSlug(title);
      // ⚠ official 오버레이 제외: official 은 시즌 누적 공식기록이라
      //    시합별 aggregate 에 넘기면 박스스코어 합산이 시즌 공식 stats 로
      //    덮어써져 모든 시합 결과가 시즌과 동일해진다.
      const tAgg = aggregate(games, SOURCE, roster, {});
      // 시합별 슬림 records + 시합별 매치업 단일 파일(상대전적 시합 필터용).
      const tDir = path.join(DATA_DIR, String(year), "by-tournament", slug);
      fs.mkdirSync(tDir, { recursive: true });
      fs.writeFileSync(
        path.join(tDir, "records.json"),
        JSON.stringify(tAgg.players.map(({ gameLog: _gl, ...rest }) => rest))
      );
      fs.writeFileSync(path.join(tDir, "matchups.json"), JSON.stringify(tAgg.matchups));
      fs.writeFileSync(path.join(tDir, "meta.json"), JSON.stringify(tAgg.meta));
      tournamentList.push({ slug, title, gameCount: games.length });
    }
    tournamentList.sort((a, b) => b.gameCount - a.gameCount);
    fs.writeFileSync(
      path.join(DATA_DIR, String(year), "tournaments.json"),
      JSON.stringify(tournamentList)
    );
    console.log(`  · 시합 ${tournamentList.length}개 분리 집계`);
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
