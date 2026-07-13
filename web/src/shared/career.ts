import { battingAdvanced, pitchingAdvanced, type BattingAdvanced, type PitchingAdvanced } from "./sabermetrics";
import type { BattingStats, LeagueAverages, PitchingStats, Player } from "./types";

export interface CareerSeason {
  year: number;
  player: Player;
}

export type CareerAverages = Record<number, LeagueAverages | null | undefined>;

export interface CareerBattingAdvanced extends BattingAdvanced {
  // wRC+는 시즌 PA 가중평균, WAR는 해당 시즌 환경에서 계산한 시즌 WAR 합계.
  wrcPlus?: number;
  war?: number;
}

export interface CareerPitchingAdvanced extends PitchingAdvanced {
  // WAR는 해당 시즌 환경에서 계산한 시즌 WAR 합계.
  war?: number;
}

const r3 = (value: number) => Number(value.toFixed(3));
const r2 = (value: number) => Number(value.toFixed(2));
const ipToOuts = (ip: number) => Math.floor(ip) * 3 + Math.round((ip - Math.floor(ip)) * 10);
const outsToIp = (outs: number) => Number((Math.floor(outs / 3) + (outs % 3) / 10).toFixed(1));

export function aggregateCareerBatting(seasons: CareerSeason[]): BattingStats | undefined {
  const rows = seasons.map(({ player }) => player.batting).filter(Boolean) as BattingStats[];
  if (!rows.length) return undefined;
  const keys = ["g", "pa", "ab", "r", "h", "b2", "b3", "hr", "rbi", "bb", "hbp", "so", "sb", "sh", "sf", "ibb", "e"] as const;
  const out = Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)])) as unknown as BattingStats;
  const b1 = out.h - out.b2 - out.b3 - out.hr;
  out.avg = out.ab ? r3(out.h / out.ab) : 0;
  const sf = out.sf ?? 0;
  out.obp = out.ab + out.bb + out.hbp + sf
    ? r3((out.h + out.bb + out.hbp) / (out.ab + out.bb + out.hbp + sf))
    : 0;
  out.slg = out.ab ? r3((b1 + 2 * out.b2 + 3 * out.b3 + 4 * out.hr) / out.ab) : 0;
  return out;
}

export function aggregateCareerPitching(seasons: CareerSeason[]): PitchingStats | undefined {
  const rows = seasons.map(({ player }) => player.pitching).filter(Boolean) as PitchingStats[];
  if (!rows.length) return undefined;
  const keys = ["g", "w", "l", "sv", "h", "hr", "r", "er", "bb", "so", "bf", "np"] as const;
  const out = Object.fromEntries(keys.map((key) => [key, rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)])) as unknown as PitchingStats;
  const outs = rows.reduce((sum, row) => sum + ipToOuts(row.ip), 0);
  out.ip = outsToIp(outs);
  out.era = outs ? r2((out.er * 27) / outs) : 0;
  out.whip = outs ? r2(((out.h + out.bb) * 3) / outs) : 0;
  return out;
}

export function aggregateCareerBattingAdvanced(
  seasons: CareerSeason[],
  averages: CareerAverages
): CareerBattingAdvanced | undefined {
  const batting = aggregateCareerBatting(seasons);
  if (!batting) return undefined;
  const raw = battingAdvanced(batting, null);
  let weightedWrc = 0;
  let weightedPa = 0;
  let war = 0;
  let leagueSeasonCount = 0;
  for (const season of seasons) {
    const stats = season.player.batting;
    const league = averages[season.year]?.overall;
    if (!stats || !league) continue;
    const advanced = battingAdvanced(stats, league);
    const pa = stats.pa || stats.ab + stats.bb + stats.hbp;
    if (advanced.wrcPlus != null && pa > 0) {
      weightedWrc += advanced.wrcPlus * pa;
      weightedPa += pa;
    }
    if (advanced.war != null) war += advanced.war;
    leagueSeasonCount++;
  }
  return {
    ...raw,
    wrcPlus: weightedPa > 0 ? Math.round(weightedWrc / weightedPa) : undefined,
    war: leagueSeasonCount > 0 ? Number(war.toFixed(1)) : undefined,
  };
}

export function aggregateCareerPitchingAdvanced(
  seasons: CareerSeason[],
  averages: CareerAverages
): CareerPitchingAdvanced | undefined {
  const pitching = aggregateCareerPitching(seasons);
  if (!pitching) return undefined;
  // K/9·BB/9·H/9·K/BB는 통산 합산 원자료와 총 아웃으로 재계산된다.
  const raw = pitchingAdvanced(pitching, null);
  let war = 0;
  let leagueSeasonCount = 0;
  for (const season of seasons) {
    const stats = season.player.pitching;
    const league = averages[season.year]?.overall;
    if (!stats || !league) continue;
    const seasonWar = pitchingAdvanced(stats, league).war;
    if (seasonWar != null) war += seasonWar;
    leagueSeasonCount++;
  }
  // 통산 FIP는 연도별 상수 결합 기준이 없어 노출하지 않는다.
  return {
    ...raw,
    fip: undefined,
    war: leagueSeasonCount > 0 ? Number(war.toFixed(1)) : undefined,
  };
}

export function careerYearsLabel(seasons: CareerSeason[]): string {
  const years = seasons.map((season) => season.year).sort((a, b) => a - b);
  return years.length > 1 ? `${years[0]}–${years.at(-1)}` : String(years[0] ?? "");
}
