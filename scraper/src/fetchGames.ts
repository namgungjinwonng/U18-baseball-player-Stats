// 신규 경기 목록 수집. discover.ts 로 내부 API 를 확정한 뒤 구현한다.
//
// 전략:
//  1순위) SPA 가 호출하는 JSON API 를 직접 호출(가볍고 빠름).
//  폴백)  Playwright 로 일정 페이지를 렌더해 경기 링크/ID 를 DOM 에서 추출.
//
// 반환: 아직 data/games/ 에 없는 경기 ID 목록(2026 시즌 이후만).
import fs from "node:fs";
import path from "node:path";

export interface GameRef {
  id: string;
  date: string; // YYYY-MM-DD
}

const SEASON_START = "2026-01-01";

export async function listGameRefs(_season = 2026): Promise<GameRef[]> {
  // TODO(discover): 확정된 API 엔드포인트로 교체.
  // 예) const res = await fetch(`${API}/games?season=${season}`); ...
  throw new Error(
    "listGameRefs 미구현 — `npm run discover` 로 내부 API/필드를 먼저 확정하세요."
  );
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
