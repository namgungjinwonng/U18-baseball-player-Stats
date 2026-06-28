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

// 박스스코어가 비어있는(타자 0명) 경기 정보 → 수집 당시 record_detail 이 일시적으로
// 비어있던 경기. game_idx 가 있어 증분이 건너뛰므로 재수집 대상으로 별도 표시한다.
function readEmptyGames(dataDir: string): { id: string; date: string }[] {
  const dir = path.join(dataDir, "games");
  if (!fs.existsSync(dir)) return [];
  const out: { id: string; date: string }[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const g = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
        id?: string; date?: string; batters?: unknown[];
      };
      if (g.id && (!g.batters || g.batters.length === 0)) out.push({ id: g.id, date: g.date ?? "" });
    } catch {
      /* 무시 */
    }
  }
  return out;
}
export function emptyGameIds(dataDir: string): Set<string> {
  return new Set(readEmptyGames(dataDir).map((g) => g.id));
}
// 빈 경기들이 속한 '월' 집합 → 증분 스캔 시 해당 월을 포함해야 재수집된다.
export function emptyGameMonths(dataDir: string): number[] {
  const ms = new Set<number>();
  for (const g of readEmptyGames(dataDir)) {
    const m = parseInt(g.date.slice(5, 7), 10);
    if (m) ms.add(m);
  }
  return [...ms];
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
