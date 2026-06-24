// 상대전적 공용 로직 — 역할/라벨/상대 목록 (데스크탑·모바일 공용).
import type { Matchup, PlayerIndexEntry } from "./types";

export type Role = "batter" | "pitcher";
export const opposite = (r: Role): Role => (r === "batter" ? "pitcher" : "batter");
export const isPitcher = (p: PlayerIndexEntry) => p.position === "투수";

export function inRole(p: PlayerIndexEntry, role: Role): boolean {
  return role === "pitcher" ? isPitcher(p) : !isPitcher(p);
}

// 동명이인 구분 라벨: "이름 (3학년·강원고)" (학년 없으면 "이름 (강원고·7번)")
export function playerLabel(p: PlayerIndexEntry): string {
  if (p.grade) return `${p.name} (${p.grade}학년·${p.team})`;
  const num = p.number ? `·${p.number}번` : "";
  return `${p.name} (${p.team}${num})`;
}

// 이름/팀 부분 일치로 역할 내 후보 검색.
export function searchByRole(
  index: PlayerIndexEntry[],
  role: Role,
  query: string,
  limit = 30
): PlayerIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index
    .filter((p) => inRole(p, role) && (p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)))
    .slice(0, limit);
}

// A(선택 선수)가 상대한 선수 목록 + 각 대결 기록.
export function facedOpponents(
  matchups: Matchup[],
  byId: Map<string, PlayerIndexEntry>,
  aRole: Role,
  aId: string
): { opponent: PlayerIndexEntry; matchup: Matchup }[] {
  const out: { opponent: PlayerIndexEntry; matchup: Matchup }[] = [];
  for (const m of matchups) {
    const oppId = aRole === "batter" ? (m.batterId === aId ? m.pitcherId : null)
                                     : (m.pitcherId === aId ? m.batterId : null);
    if (!oppId) continue;
    const opponent = byId.get(oppId);
    if (opponent) out.push({ opponent, matchup: m });
  }
  // 상대 이름 가나다순
  return out.sort((a, b) => a.opponent.name.localeCompare(b.opponent.name, "ko"));
}

export const indexById = (index: PlayerIndexEntry[]) =>
  new Map(index.map((p) => [p.id, p]));
