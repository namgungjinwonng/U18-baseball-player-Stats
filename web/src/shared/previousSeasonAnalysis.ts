// 시즌 초 현재 엔트리와 직전 연도 개인 기록을 고유번호로 대조해 졸업생을 제외한 참고 분석을 만든다.
import { hashOf, type AnalysisInput, type AnalysisLine } from "./analysis/core";
import type { AiExtra } from "./ai/prompt";
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";
import { sameTeam, teamKey, teamRecord, type TopPlayers } from "./versus";

const hasStats = (p: Player) => (p.batting?.pa ?? p.batting?.ab ?? 0) > 0 || (p.pitching?.ip ?? 0) > 0;
const personId = (id?: string) => id?.trim() ?? "";

export function needsPreviousSeasonReference(a: string, b: string, year: number, games: ScheduleGame[], records: Player[]): boolean {
  if (!a || !b || sameTeam(a, b)) return false;
  const thisYear = games.filter((g) => Number(g.date.slice(0, 4)) === year);
  return [a, b].every((team) => {
    const r = teamRecord(thisYear, team);
    return r.w + r.l + r.d === 0 && !records.some((p) => p.season === year && sameTeam(p.team, team) && hasStats(p));
  });
}

const tops = (players: Player[]): TopPlayers => ({
  batters: players.filter((p) => (p.batting?.pa ?? p.batting?.ab ?? 0) > 0)
    .sort((a, b) => (b.batting!.obp + b.batting!.slg) - (a.batting!.obp + a.batting!.slg)).slice(0, 5),
  pitchers: players.filter((p) => (p.pitching?.ip ?? 0) > 0)
    .sort((a, b) => a.pitching!.era - b.pitching!.era || b.pitching!.ip - a.pitching!.ip).slice(0, 5),
});

export interface PreviousSeasonAnalysis {
  input: AnalysisInput | null;
  extra: AiExtra;
  lines: AnalysisLine[];
  reason: string | null;
}

export function buildPreviousSeasonAnalysis(year: number, a: string, b: string, rosters: TeamRosterEntry[], previous: Player[]): PreviousSeasonAnalysis {
  const empty = (reason: string): PreviousSeasonAnalysis => ({ input: null, extra: {}, lines: [], reason });
  const names = [teamKey(a), teamKey(b)];
  if (!names[0] || !names[1] || sameTeam(a, b)) return empty("서로 다른 두 학교를 선택해 주세요.");
  const entries = names.map((team) => rosters.filter((r) => sameTeam(r.team, team)));
  if (entries.some((rows) => rows.length !== 1 || rows[0].error || !rows[0].players?.length)) {
    return empty(`${year} 현재 엔트리가 없거나 수집되지 않은 학교가 있어 전년도 참고 분석을 제공할 수 없습니다.`);
  }
  const selectedRosters = entries.map(([r]) => r.players.filter((p) => p.type === "player"));
  const memberships = new Map<string, Set<number>>();
  selectedRosters.forEach((rows, i) => rows.forEach((p) => {
    const id = personId(p.person_no);
    if (id) memberships.set(id, new Set([...(memberships.get(id) ?? []), i]));
  }));
  const byPerson = new Map<string, Player[]>();
  for (const p of previous) {
    const id = personId(p.personNo);
    if (p.season === year - 1 && id) byPerson.set(id, [...(byPerson.get(id) ?? []), p]);
  }
  const sides = selectedRosters.map((rows, i) => {
    const seen = new Set<string>();
    const transfers: { name: string; from: string }[] = [];
    const matched: Player[] = [];
    for (const current of rows) {
      const id = personId(current.person_no), candidates = byPerson.get(id) ?? [];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (!current.name.trim() || memberships.get(id)?.size !== 1 || candidates.length !== 1
        || rows.filter((row) => personId(row.person_no) === id).length !== 1) continue;
      const p = candidates[0];
      // 현재 명단에 잘못 남은 전년 3학년과 학년·개인 식별이 불명확한 자료도 보수적으로 제외한다.
      if (!["1", "2"].includes(p.grade ?? "") || !["1", "2", "3"].includes(current.grade) || !hasStats(p)) continue;
      if (!sameTeam(p.team, names[i])) transfers.push({ name: current.name, from: teamKey(p.team) });
      matched.push({ ...p, name: current.name, grade: current.grade, team: names[i], personNo: id });
    }
    matched.sort((x, y) => x.personNo!.localeCompare(y.personNo!));
    return { matched, coverage: { team: names[i], rosterCount: rows.length, matchedCount: matched.length, transfers } };
  });
  if (sides.some((s) => !s.matched.length)) {
    return empty("한쪽 학교의 현재 엔트리에서 졸업생을 제외하고 고유번호로 확인할 수 있는 전년도 개인 기록이 없습니다. 이름이나 등번호로 추정하지 않습니다.");
  }
  const signatureSource = JSON.stringify(sides.map((s, i) => ({
    team: names[i], roster: selectedRosters[i].map((p) => [p.person_no, p.name, p.grade]).sort(),
    players: s.matched,
  })).sort((x, y) => x.team.localeCompare(y.team)));
  const reference: NonNullable<AnalysisInput["reference"]> = {
    year: year - 1, signature: `${hashOf(signatureSource)}-${signatureSource.length}`, teams: sides.map((s) => s.coverage),
  };
  const players = { a: tops(sides[0].matched), b: tops(sides[1].matched) };
  const lines: AnalysisLine[] = [
    { id: "reference-basis", cat: "overall", text: `${year} 시즌 경기·선수 기록이 없어 현재 엔트리에 남은 선수들의 ${year - 1} 개인 기록을 참고한다. 올해 팀 성적이나 등급은 아니다.` },
    ...sides.map((s, i): AnalysisLine => ({ id: `reference-${i}`, cat: "sample", text: `${names[i]}는 현재 엔트리 ${s.coverage.rosterCount}명 중 ${s.coverage.matchedCount}명의 전년도 기록을 확인했다. 졸업 대상자와 확인되지 않는 선수는 제외한다.` })),
    { id: "reference-limit", cat: "sample", text: "신입생·전년도 무기록 선수의 기여와 올해 성장·컨디션은 알 수 없다. 선발 투수나 승패를 단정할 수 없다." },
  ];
  return {
    input: { aName: names[0], bName: names[1], year, allYears: true, metrics: {}, reference },
    extra: { players }, lines, reason: null,
  };
}
