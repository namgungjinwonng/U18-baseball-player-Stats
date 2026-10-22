// 매치업 경기 분석 입력을 원자료(일정·선수 기록·강도지수·리그 평균)에서 만드는 순수 함수 — 화면과 실데이터 측정이 같은 입력을 쓴다.
import type { AnalysisInput, MetricKey } from "./analysis/core";
import type { LeagueRates, Player, ScheduleGame } from "./types";
import { commonOpponents, headToHead, teamExtra, teamGames, teamKey, teamRecord, teamTotals, type Record3 } from "./versus";

export interface AnalysisSource {
  a: string; // 학교 A (원래 표기)
  b: string;
  seasonGames: ScheduleGame[]; // 선택 시즌 일정
  h2hGames: ScheduleGame[]; // 맞대결을 볼 일정 (통산이면 여러 시즌)
  records: Player[] | null; // 선택 시즌 선수 기록
  strength?: Record<string, { bat: number; pit: number }> | null; // 학교별 강도지수
  lg?: Partial<LeagueRates> | null; // 리그 평균
  year: number;
  allYears: boolean;
}

const winPct = (r: Record3) => (r.w + r.l ? r.w / (r.w + r.l) : null);

export function buildAnalysisInput(src: AnalysisSource): AnalysisInput {
  const { a, b, seasonGames } = src;
  const recA = teamRecord(seasonGames, a), recB = teamRecord(seasonGames, b);
  const totA = src.records ? teamTotals(src.records, a) : null;
  const totB = src.records ? teamTotals(src.records, b) : null;
  const strengthOf = new Map(Object.entries(src.strength ?? {}).map(([t, s]) => [teamKey(t), s]));
  const sA = strengthOf.get(teamKey(a)), sB = strengthOf.get(teamKey(b));
  const pair = (x: number | null | undefined, y: number | null | undefined) => ({ a: x, b: y });
  const metrics: Partial<Record<MetricKey, { a?: number | null; b?: number | null }>> = {
    pct: pair(winPct(recA), winPct(recB)),
    avg: pair(totA?.batting.avg, totB?.batting.avg),
    obp: pair(totA?.batting.obp, totB?.batting.obp),
    ops: pair(totA?.batting.ops, totB?.batting.ops),
    hr: pair(totA?.batting.hr, totB?.batting.hr),
    sb: pair(totA?.batting.sb, totB?.batting.sb),
    era: pair(totA?.pitching.era, totB?.pitching.era),
    whip: pair(totA?.pitching.whip, totB?.pitching.whip),
    k9: pair(totA?.pitching.k9, totB?.pitching.k9),
    bb9: pair(totA?.pitching.bb9, totB?.pitching.bb9),
    sbat: pair(sA?.bat, sB?.bat),
    spit: pair(sA?.pit, sB?.pit),
  };
  // 시즌 완료 경기 — 상대 학교·대회명까지 넘겨 한 경기 제외·대회 단계 분석에 쓴다.
  const done = (team: string) =>
    teamGames(seasonGames, team)
      .filter((g) => g.outcome && g.me.score != null && g.opp.score != null)
      .map((g) => ({ date: g.game.date, rf: g.me.score!, ra: g.opp.score!, outcome: g.outcome!, opp: teamKey(g.opp.name), title: g.game.title }));
  const h2h = headToHead(src.h2hGames, a, b);
  return {
    aName: teamKey(a),
    bName: teamKey(b),
    metrics,
    recA,
    recB,
    h2h: {
      ...h2h,
      games: h2h.games.map((g) => ({ date: g.game.date, status: g.game.status, me: g.me.score, opp: g.opp.score, outcome: g.outcome, title: g.game.title })),
    },
    extra: { a: teamExtra(totA), b: teamExtra(totB) },
    year: src.year,
    seasonA: done(a),
    seasonB: done(b),
    allYears: src.allYears,
    lg: src.lg,
    common: commonOpponents(seasonGames, a, b),
  };
}
