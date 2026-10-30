// 선수 검색 대상에 기록 없는 등록 선수(선수현황)를 합치고 결과 링크를 정하는 순수 함수
import type { PlayerIndexEntry, TeamPlayerEntry, TeamRosterEntry } from "./types";
import { transferMap } from "./transfers";

// recordless = 경기 기록이 없어 players/index.json 에 없는 선수현황 등록 선수.
export type PlayerSearchEntry = PlayerIndexEntry & { recordless?: boolean };

// 기록 보유 선수는 이적 시 최종 학교·그 학교 등번호·학년으로 바꿔 보이고(링크는 기록 그대로),
// personNo 로 겹치지 않는 등록 선수를 덧붙인다.
// 이적 선수는 두 학교 명단에 함께 있다 — 무기록이면 moved_to 없는(현재 학교) 항목을 쓴다.
export function withRecordlessPlayers(
  index: PlayerIndexEntry[],
  teams: TeamRosterEntry[] | null | undefined
): PlayerSearchEntry[] {
  const moved = transferMap(teams);
  const current = new Map<string, TeamPlayerEntry>();
  for (const t of teams ?? []) {
    for (const p of t.players) if (!p.moved_to && moved.has(p.person_no)) current.set(p.person_no, p);
  }
  const records = index.map((p) => {
    const to = p.personNo && moved.get(p.personNo);
    if (!to || to === p.team) return p;
    const cur = current.get(p.personNo!);
    return { ...p, team: to, number: cur?.number || undefined, grade: cur?.grade || p.grade };
  });
  const known = new Set(index.map((p) => p.personNo).filter(Boolean));
  const extra = new Map<string, { entry: PlayerSearchEntry; old: boolean }>();
  for (const t of teams ?? []) {
    for (const p of t.players ?? []) {
      if (!p.name || !p.person_no || known.has(p.person_no)) continue;
      const prev = extra.get(p.person_no);
      if (prev && (!prev.old || p.moved_to)) continue;
      extra.set(p.person_no, {
        old: !!p.moved_to,
        entry: {
          id: `person:${p.person_no}`,
          name: p.name,
          team: p.moved_to || p.team || t.team,
          position: p.position,
          number: p.moved_to ? undefined : p.number || undefined,
          grade: p.grade || undefined,
          region: p.region,
          personNo: p.person_no,
          recordless: true,
        },
      });
    }
  }
  return [...records, ...[...extra.values()].map((e) => e.entry)];
}

export const playerSearchLink = (p: PlayerSearchEntry) =>
  p.recordless ? `/person/${p.personNo}` : `/player/${p.id}`;
