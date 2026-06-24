// 신규 경기 목록 수집 — korea-baseball.com 캘린더(/game/calendar?kind_cd=31)에서
// 2026 시즌 U18 경기 game_idx 를 모은다.
import fs from "node:fs";
import path from "node:path";
import { fetchGameRefs, KIND, type GameRef } from "./koreaBaseball.js";

export type { GameRef };

const SEASON_START = "2026-01-01";

// 기본: 3~12월 (빈 달은 자동으로 0건). 환경에 따라 조정 가능.
const DEFAULT_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export async function listGameRefs(
  _season = 2026,
  months: number[] = DEFAULT_MONTHS
): Promise<GameRef[]> {
  const refs = await fetchGameRefs(months, KIND.U18);
  return refs.filter((r) => isAfterSeasonStart(r.date));
}

// 이미 수집(커밋)된 경기 ID 집합 → 신규만 추리는 데 사용(멱등 수집).
export function existingGameIds(dataDir: string): Set<string> {
  const dir = path.join(dataDir, "games");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
  );
}

export function isAfterSeasonStart(date: string): boolean {
  return date >= SEASON_START;
}

// 증분 수집: 이미 수집된 경기 중 가장 최근 날짜의 '월'부터 12월까지만 스캔.
// (기존 갱신 시점 이전 달은 다시 훑지 않아 캘린더 요청/시간을 절약)
export function incrementalMonths(dataDir: string): number[] {
  const dir = path.join(dataDir, "games");
  if (!fs.existsSync(dir)) return DEFAULT_MONTHS;
  let latest = "";
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { date?: string };
      if (g.date && g.date > latest) latest = g.date;
    } catch {
      /* 무시 */
    }
  }
  if (!latest) return DEFAULT_MONTHS;
  const startMonth = parseInt(latest.slice(5, 7), 10) || DEFAULT_MONTHS[0];
  return DEFAULT_MONTHS.filter((m) => m >= startMonth);
}
