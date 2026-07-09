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

// 투타 표기: throws='우', bats='좌' → "우투좌타". 한쪽만 있으면 그 부분만.
export function batsThrowsLabel(p: { bats?: string; throws?: string }): string {
  const t = p.throws ? `${p.throws}투` : "";
  const b = p.bats ? `${p.bats}타` : "";
  return `${t}${b}`;
}

// 상대전적 행 보조 라벨: "(학교·N학년·우투좌타)" — 없는 항목은 자연스럽게 생략.
export function matchupOpponentMeta(p?: {
  team?: string;
  grade?: string;
  bats?: string;
  throws?: string;
}): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.team) parts.push(p.team);
  if (p.grade) parts.push(`${p.grade}학년`);
  const bt = batsThrowsLabel(p);
  if (bt) parts.push(bt);
  return parts.length ? `(${parts.join("·")})` : "";
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

// 상대한 학교 목록(+상대 인원수). 학교명 가나다순.
export function facedSchools(
  faced: { opponent: PlayerIndexEntry; matchup: Matchup }[]
): { team: string; count: number }[] {
  const m = new Map<string, number>();
  for (const f of faced) m.set(f.opponent.team, (m.get(f.opponent.team) ?? 0) + 1);
  return [...m.entries()]
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => a.team.localeCompare(b.team, "ko"));
}

// 상대전적 행을 상대 학교별로 그룹화 — 학교명 가나다순, 학교 미상("기타")은 맨 뒤.
// 선수 상세의 접이식(학교별) 표시용.
export function groupMatchupsByTeam(
  rows: Matchup[],
  oppIdOf: (m: Matchup) => string,
  byId: Map<string, PlayerIndexEntry> | null
): { team: string; rows: Matchup[] }[] {
  const byTeam = new Map<string, Matchup[]>();
  for (const m of rows) {
    const team = byId?.get(oppIdOf(m))?.team ?? "기타";
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team)!.push(m);
  }
  return [...byTeam.entries()]
    .map(([team, rows]) => ({ team, rows }))
    .sort((a, b) =>
      a.team === "기타" ? 1 : b.team === "기타" ? -1 : a.team.localeCompare(b.team, "ko")
    );
}

// 상대전적 합계(특정 학교 또는 전체)
export function sumMatchups(items: { matchup: Matchup }[]): Matchup | null {
  if (items.length === 0) return null;
  const acc = { pa: 0, ab: 0, h: 0, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0 };
  for (const { matchup: m } of items) {
    acc.pa += m.pa; acc.ab += m.ab; acc.h += m.h; acc.b2 += m.b2; acc.b3 += m.b3;
    acc.hr += m.hr; acc.bb += m.bb; acc.hbp += m.hbp; acc.so += m.so;
  }
  return {
    batterId: "", batterName: "", pitcherId: "", pitcherName: "",
    ...acc, avg: acc.ab ? Number((acc.h / acc.ab).toFixed(3)) : 0,
  };
}
