// 학교 정보 카드용 시즌 팀 합계와 개별 지표·동일 비중 종합 백분위 등급을 계산하는 순수 함수.
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
  overallGrade: TeamSummaryGrade | null;
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
      overallGrade: null,
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

  // 종합은 세 지표가 모두 있는 동일 집단으로 계산한다. 개별 지표 집단과 섞으면
  // 자료가 일부만 있는 학교 때문에 승률·타율·ERA의 실질적인 비중이 달라질 수 있다.
  const complete = eligible.filter((row): row is TeamSummary & { pct: number; avg: number; era: number } =>
    row.pct != null && row.avg != null && row.era != null);
  if (complete.length >= MIN_TEAM_GRADE_POPULATION) {
    const winPcts = complete.map((row) => row.pct);
    const avgs = complete.map((row) => row.avg);
    const earnedRuns = complete.map((row) => row.era);
    const scored = complete.map((row) => ({
      row,
      score: (percentileRank(winPcts, row.pct)! + percentileRank(avgs, row.avg)!
        + percentileRank(earnedRuns, row.era, true)!) / 3,
    }));
    // 평균 점수 자체에 등급을 붙이지 않고 재순위화해 기존 상위 20% = A 기준을 유지한다.
    const scores = scored.map(({ score }) => score);
    for (const { row, score } of scored) row.overallGrade = grade(scores, score);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
