// 학교 시즌 성적과 상세 지표의 시즌 전체 학교 대비 백분위 등급을 계산하는 순수 함수.
import { pctGrade, percentileRank } from "./percentile";
import { buildTeamSummaries, MIN_TEAM_GRADE_GAMES, MIN_TEAM_GRADE_POPULATION, type TeamSummaryGrade } from "./teamSummary";
import type { Player, ScheduleGame, StrengthData, TeamRosterEntry } from "./types";
import { teamKey, teamTotals } from "./versus";

export const TEAM_DETAIL_METRICS = ["winPct", "runsFor", "runsAgainst", "avg", "obp", "slg", "ops", "hr", "sb", "batStrength", "era", "whip", "k9", "bb9", "pitStrength"] as const;
export type TeamDetailMetric = typeof TEAM_DETAIL_METRICS[number];
export interface TeamDetailStats {
  name: string;
  games: number;
  values: Record<TeamDetailMetric, number | null>;
  grades: Record<TeamDetailMetric, TeamSummaryGrade | null>;
}

const finite = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value : null;
const lowerIsBetter = new Set<TeamDetailMetric>(["runsAgainst", "era", "whip", "bb9"]);

export function buildTeamDetailGrades(
  year: number,
  teams: readonly TeamRosterEntry[],
  games: readonly ScheduleGame[],
  records: readonly Player[],
  strength?: StrengthData | null
): TeamDetailStats[] {
  const seasonRecords = records.filter((p) => p.season === year);
  const strengths = new Map(Object.entries(strength?.season === year ? strength.teams : {})
    .map(([name, value]) => [teamKey(name), value]));
  const rows = buildTeamSummaries(year, teams, games, records).map<TeamDetailStats>((summary) => {
    const totals = teamTotals(seasonRecords, summary.name);
    const bat = totals?.batting;
    const pit = totals?.pitching;
    const str = strengths.get(summary.name);
    const validBat = !!bat && bat.ab > 0;
    const validPit = !!pit && pit.outs > 0;
    return {
      name: summary.name,
      games: summary.games,
      values: {
        winPct: summary.pct,
        runsFor: summary.games > 0 ? finite(summary.rec.rf) : null,
        runsAgainst: summary.games > 0 ? finite(summary.rec.ra) : null,
        avg: summary.avg,
        obp: validBat ? finite(bat.obp) : null,
        slg: validBat ? finite(bat.slg) : null,
        ops: validBat ? finite(bat.ops) : null,
        hr: validBat ? finite(bat.hr) : null,
        sb: validBat ? finite(bat.sb) : null,
        batStrength: str && str.g >= MIN_TEAM_GRADE_GAMES ? finite(str.bat) : null,
        era: summary.era,
        whip: validPit ? finite(pit.whip) : null,
        k9: validPit ? finite(pit.k9) : null,
        bb9: validPit ? finite(pit.bb9) : null,
        pitStrength: str && str.g >= MIN_TEAM_GRADE_GAMES ? finite(str.pit) : null,
      },
      grades: Object.fromEntries(TEAM_DETAIL_METRICS.map((key) => [key, null])) as TeamDetailStats["grades"],
    };
  });
  const eligible = rows.filter((r) => r.games >= MIN_TEAM_GRADE_GAMES);
  for (const key of TEAM_DETAIL_METRICS) {
    const population = eligible.map((r) => r.values[key]).filter((v): v is number => v != null);
    if (population.length < MIN_TEAM_GRADE_POPULATION) continue;
    for (const row of eligible) {
      const value = row.values[key];
      if (value == null) continue;
      const percentile = percentileRank(population, value, lowerIsBetter.has(key));
      row.grades[key] = percentile == null ? null : { ...pctGrade(percentile), percentile };
    }
  }
  return rows;
}
