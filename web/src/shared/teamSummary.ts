// 학교 정보 카드용 시즌 팀 합계와 전체 학교 대비 타율·ERA 백분위 등급을 계산하는 순수 함수.
import { pctGrade, percentileRank } from "./percentile";
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";
import { teamKey, teamRecord, teamTotals, type Record3 } from "./versus";

// 1~2경기 성적으로 극단 등급이 붙는 것을 막는 최소 표본 기준(통계적 신뢰도 보장은 아님).
export const MIN_TEAM_GRADE_GAMES = 5;
// 선수 리그 등급과 마찬가지로 유효 비교 대상이 5개 미만이면 등급을 보류한다.
export const MIN_TEAM_GRADE_POPULATION = 5;

export type TeamSummaryGrade = ReturnType<typeof pctGrade> & { percentile: number };

export interface TeamSummary {
  name: string;
  region: string;
  rec: Record3;
  games: number;
  pct: number | null;
  avg: number | null;
  era: number | null;
  avgGrade: TeamSummaryGrade | null;
  eraGrade: TeamSummaryGrade | null;
}

// 지역·검색 필터 이전에 한 번 계산해야 같은 학교의 등급이 필터에 따라 바뀌지 않는다.
export function buildTeamSummaries(
  year: number,
  teams: readonly TeamRosterEntry[],
  games: readonly ScheduleGame[],
  records: readonly Player[]
): TeamSummary[] {
  // useAsync가 연도 전환 중 이전 자료를 유지하더라도 다른 시즌의 기록을 섞지 않는다.
  const seasonGames = games.filter((g) => g.date.startsWith(`${year}-`));
  const seasonRecords = records.filter((p) => p.season === year);
  const regionOf = new Map<string, string>();
  const register = (name: string, region = "") => {
    const key = teamKey(name);
    if (!key) return;
    if (!regionOf.has(key) || (!regionOf.get(key) && region)) regionOf.set(key, region);
  };
  for (const t of teams) register(t.team, t.region);
  for (const g of seasonGames) {
    register(g.away.name);
    register(g.home.name);
  }
  // 카드 목록은 기존과 같이 로스터·일정의 학교만 유지하고, 기록은 누락된 지역만 보완한다.
  for (const p of seasonRecords) {
    if (regionOf.has(teamKey(p.team))) register(p.team, p.region);
  }

  const rows = [...regionOf].map<TeamSummary>(([name, region]) => {
    const rec = teamRecord(seasonGames, name);
    const totals = teamTotals(seasonRecords, name);
    return {
      name,
      region,
      rec,
      games: rec.w + rec.l + rec.d,
      pct: rec.w + rec.l ? rec.w / (rec.w + rec.l) : null,
      // 무기록을 타율 .000·ERA 0.00으로 간주하면 특히 ERA에 부당한 상위 등급이 붙는다.
      avg: totals && totals.batting.ab > 0 && Number.isFinite(totals.batting.avg) ? totals.batting.avg : null,
      era: totals && totals.pitching.outs > 0 && Number.isFinite(totals.pitching.era) ? totals.pitching.era : null,
      avgGrade: null,
      eraGrade: null,
    };
  });
  const eligible = rows.filter((r) => r.games >= MIN_TEAM_GRADE_GAMES);
  const averages = eligible.map((r) => r.avg).filter((v): v is number => v != null);
  const eras = eligible.map((r) => r.era).filter((v): v is number => v != null);
  const grade = (population: number[], value: number | null, lowerIsBetter = false): TeamSummaryGrade | null => {
    if (value == null || population.length < MIN_TEAM_GRADE_POPULATION) return null;
    const percentile = percentileRank(population, value, lowerIsBetter);
    return percentile == null ? null : { ...pctGrade(percentile), percentile };
  };
  for (const row of eligible) {
    row.avgGrade = grade(averages, row.avg);
    row.eraGrade = grade(eras, row.era, true);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
