// 시즌 중 이적해 두 학교 이상 명단에 남은 선수의 현재 소속을 선수 프로필로 판정하는 순수 함수
import type { PlayerProfile, TeamRosterEntry } from "./types.js";

const norm = (s: string) => s.replace(/\s+/g, "");

// personNo → 그 선수가 올라 있는 팀 이름 목록 (2팀 이상만).
export function multiTeamPlayers(rosters: TeamRosterEntry[]): Map<string, string[]> {
  const teams = new Map<string, string[]>();
  for (const r of rosters) {
    for (const p of r.players) {
      if (!p.person_no) continue;
      const list = teams.get(p.person_no) ?? [];
      if (!list.includes(r.team)) list.push(r.team);
      teams.set(p.person_no, list);
    }
  }
  return new Map([...teams].filter(([, list]) => list.length > 1));
}

// KBSA 는 이적 후에도 옛 학교 명단에 선수를 남긴다(등번호도 그대로인 경우가 많다).
// 선수 상세 출신학교 목록은 최신순이라, 당해 시즌 첫 학교 중 명단에 있는 학교를 현재 소속으로 본다.
// 현재 소속이 아닌 항목에 moved_to(현재 학교)를 붙인다. 판정 불가(프로필 없음·학교 불일치)면 그대로 둔다.
export function markTransfers(
  rosters: TeamRosterEntry[],
  profiles: Map<string, PlayerProfile>,
  season: number
): number {
  let marked = 0;
  for (const [personNo, teams] of multiTeamPlayers(rosters)) {
    const school = profiles.get(personNo)?.schools.find((s) => s.year === season);
    const current = school && teams.find((t) => norm(t) === norm(school.school));
    if (!current) continue;
    marked++;
    for (const r of rosters) {
      for (const p of r.players) {
        if (p.person_no !== personNo) continue;
        if (r.team === current) delete p.moved_to;
        else p.moved_to = current;
      }
    }
  }
  return marked;
}
