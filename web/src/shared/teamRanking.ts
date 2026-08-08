// 경기 일정과 선수 기록을 학교 단위 순위 행으로 집계하는 순수 함수.
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";

export interface TeamRankingRow {
  rank: number;
  team: string;
  region: string;
  games: number;
  w: number;
  l: number;
  d: number;
  pct: number;
  avg: number;
  era: number;
  pts: number;
  gb: number;
}

interface TeamTotals {
  team: string;
  region: string;
  games: number;
  w: number;
  l: number;
  d: number;
  h: number;
  ab: number;
  er: number;
  outs: number;
}

// 클럽팀 뒤에 붙는 연령 구분 접미사. 협회 원본이 같은 시즌에도 (U-18)·(U18) 을 섞어 쓰고
// 대학·중등 기록에는 (U19) 같은 표기도 있어, 끝에 붙은 경우만 폭넓게 걷어낸다.
// 표시용이면서 동시에 집계 키 — 2025 GD챌린저스BC 처럼 한 팀이 두 표기로 갈려
// 두 행으로 집계되던 것을 하나로 합친다. 이름 전체가 접미사면 원본을 유지한다.
const TEAM_SUFFIX = /\s*\(\s*U\s*-?\s*\d+\s*\)\s*$/i;
export const teamDisplayName = (name: string) => name.replace(TEAM_SUFFIX, "").trim() || name;

const ipToOuts = (ip: number) =>
  Math.floor(ip) * 3 + Math.round((ip - Math.floor(ip)) * 10);

const defaultOrder = (a: TeamRankingRow, b: TeamRankingRow) =>
  b.games - a.games || b.w - a.w || a.l - b.l || a.team.localeCompare(b.team, "ko");

const standingsOrder = (a: TeamRankingRow, b: TeamRankingRow) =>
  b.pct - a.pct || b.w - a.w || a.l - b.l || a.team.localeCompare(b.team, "ko");

export function buildTeamRanking(
  games: ScheduleGame[],
  teams: TeamRosterEntry[],
  records: Player[],
  tournamentTitle?: string,
  region?: string
): TeamRankingRow[] {
  const regions = new Map(teams.map((team) => [teamDisplayName(team.team), team.region]));
  const totals = new Map<string, TeamTotals>();

  const getTeam = (team: string) => {
    let row = totals.get(team);
    if (!row) {
      row = {
        team,
        region: regions.get(team) ?? "",
        games: 0,
        w: 0,
        l: 0,
        d: 0,
        h: 0,
        ab: 0,
        er: 0,
        outs: 0,
      };
      totals.set(team, row);
    }
    return row;
  };

  for (const game of games) {
    if (game.status !== "완료" || (tournamentTitle && game.title !== tournamentTitle)) continue;
    for (const side of [game.away, game.home]) {
      const name = teamDisplayName(side.name);
      if (region && regions.get(name) !== region) continue;
      const row = getTeam(name);
      row.games += 1;
      if (side.result === "승") row.w += 1;
      else if (side.result === "패") row.l += 1;
      else row.d += 1;
    }
  }

  for (const player of records) {
    const row = totals.get(teamDisplayName(player.team));
    if (!row) continue;
    if (player.batting) {
      row.h += player.batting.h;
      row.ab += player.batting.ab;
    }
    if (player.pitching) {
      row.er += player.pitching.er;
      row.outs += ipToOuts(player.pitching.ip);
    }
  }

  const rows = [...totals.values()].map<TeamRankingRow>((row) => ({
    rank: 0,
    team: row.team,
    region: row.region,
    games: row.games,
    w: row.w,
    l: row.l,
    d: row.d,
    pct: row.w + row.l ? row.w / (row.w + row.l) : 0,
    avg: row.ab ? row.h / row.ab : 0,
    era: row.outs ? (row.er * 27) / row.outs : 0,
    pts: row.w * 3 + row.d,
    gb: 0,
  }));

  const leader = [...rows].sort(standingsOrder)[0];
  if (leader) {
    for (const row of rows) {
      row.gb = ((leader.w - row.w) + (row.l - leader.l)) / 2;
    }
  }

  rows.sort(defaultOrder);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
}
