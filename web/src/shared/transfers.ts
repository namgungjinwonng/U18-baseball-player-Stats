// 선수현황(teams.json)의 이적 표시(moved_to)로 선수의 현재 소속을 찾는 함수
import type { TeamPlayerEntry, TeamRosterEntry } from "./types";

// 이적 선수는 옛 학교 명단에도 남아 있다 — moved_to 없는 항목이 현재 소속.
export function currentRosterEntry(
  teams: TeamRosterEntry[] | null | undefined,
  personNo: string | undefined
): TeamPlayerEntry | null {
  let first: TeamPlayerEntry | null = null;
  if (!personNo) return null;
  for (const t of teams ?? []) {
    for (const p of t.players) {
      if (p.person_no !== personNo) continue;
      if (!p.moved_to) return p;
      first ??= p;
    }
  }
  return first;
}

// personNo → 현재 학교 (이적 선수만).
export function transferMap(teams: TeamRosterEntry[] | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of teams ?? []) for (const p of t.players) if (p.moved_to && p.person_no) m.set(p.person_no, p.moved_to);
  return m;
}

// personNo → 옮겨 오기 전 학교들 (새 학교 명단에 「(옛 학교에서 이적)」 표시용).
export function transferFromMap(teams: TeamRosterEntry[] | null | undefined): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of teams ?? []) {
    for (const p of t.players) {
      if (!p.moved_to || !p.person_no) continue;
      const prev = m.get(p.person_no);
      m.set(p.person_no, prev ? `${prev}·${t.team}` : t.team);
    }
  }
  return m;
}

// 기록상 소속(team)에서 다른 학교로 옮겼으면 현재 학교명.
export function transferredTo(
  teams: TeamRosterEntry[] | null | undefined,
  personNo: string | undefined,
  team: string
): string | undefined {
  const to = personNo ? transferMap(teams).get(personNo) : undefined;
  return to && to !== team ? to : undefined;
}
