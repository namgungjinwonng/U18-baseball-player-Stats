// 대전 모드 집계(맞대결·공통 상대·팀 합계·주요 선수·선수 맞대결표)를 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { seasonConfig, type QualifyContext } from "./leaders";
import {
  cellKey, commonOpponents, headToHead, returningTopPlayers, teamGames, teamRecord, teamTotals, topPlayers, versusMatrix,
} from "./versus";
import type { Matchup, Player, PlayerIndexEntry, ScheduleGame } from "./types";

let seq = 0;
const game = (
  date: string,
  away: string,
  awayScore: number | null,
  home: string,
  homeScore: number | null,
  opts: { status?: string; title?: string } = {}
): ScheduleGame => {
  const status = opts.status ?? "완료";
  const res = (me: number | null, opp: number | null) =>
    status !== "완료" || me == null || opp == null ? "" : me > opp ? "승" : me < opp ? "패" : "무";
  return {
    game_idx: String(++seq),
    title: opts.title ?? "2026 주말리그 전반기(서울권)",
    date,
    time: "10:00",
    venue: "테스트구장",
    round: "리그전",
    status,
    away: { name: away, result: res(awayScore, homeScore), score: awayScore },
    home: { name: home, result: res(homeScore, awayScore), score: homeScore },
  };
};

const games: ScheduleGame[] = [
  game("2026-03-01", "A고", 5, "B BC(U-18)", 3),
  game("2026-04-01", "B BC(U18)", 7, "A고", 2),
  game("2026-05-01", "A고", 4, "B BC(U-18)", 4),
  game("2026-08-01", "A고", 6, "B BC(U-18)", 1, { title: "제1회 전국대회" }),
  game("2026-10-30", "B BC(U-18)", null, "A고", null, { status: "예정" }),
  game("2026-03-08", "A고", 10, "C고", 0),
  game("2026-03-15", "C고", 2, "B BC(U-18)", 1),
  game("2026-03-22", "A고", 3, "D고", 1), // D고는 A만 상대
];

// 맞대결: 클럽 접미사 표기((U-18)/(U18))가 달라도 같은 팀으로 묶고, 예정 경기는 승패에서 뺀다.
const h2h = headToHead(games, "A고", "B BC");
assert.deepEqual({ w: h2h.w, l: h2h.l, d: h2h.d, rf: h2h.rf, ra: h2h.ra }, { w: 2, l: 1, d: 1, rf: 17, ra: 15 });
assert.equal(h2h.games.length, 5);
assert.equal(h2h.games[0].game.date, "2026-10-30", "최신 경기(예정 포함)가 먼저");
assert.equal(h2h.games[0].outcome, null);
assert.equal(h2h.games[1].outcome, "승");

// 대회 필터: 해당 대회 경기만
const cup = headToHead(games, "A고", "B BC", "제1회 전국대회");
assert.deepEqual({ w: cup.w, l: cup.l, n: cup.games.length }, { w: 1, l: 0, n: 1 });

// B 기준으로 뒤집으면 승패·득실도 뒤집힌다
const rev = headToHead(games, "B BC(U-18)", "A고");
assert.deepEqual({ w: rev.w, l: rev.l, rf: rev.rf, ra: rev.ra }, { w: 1, l: 2, rf: 15, ra: 17 });

// 팀 전적·경기 목록
assert.deepEqual(teamRecord(games, "A고"), { w: 4, l: 1, d: 1, rf: 30, ra: 16 });
assert.equal(teamGames(games, "A고").length, 7);

// 공통 상대: 두 팀이 모두 상대한 C고만 (D고는 A만, 서로는 제외)
const common = commonOpponents(games, "A고", "B BC");
assert.equal(common.length, 1);
assert.equal(common[0].opponent, "C고");
assert.deepEqual(common[0].a, { w: 1, l: 0, d: 0, rf: 10, ra: 0 });
assert.deepEqual(common[0].b, { w: 0, l: 1, d: 0, rf: 1, ra: 2 });

const bat = (h: number, ab: number, extra: Partial<NonNullable<Player["batting"]>> = {}): Player["batting"] => ({
  g: 10, pa: ab + (extra.bb ?? 0), ab, r: 0, h, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0,
  avg: ab ? h / ab : 0, obp: 0, slg: ab ? h / ab : 0, ...extra,
});
const pit = (ip: number, er: number, h: number, bb: number, so: number): Player["pitching"] => {
  const outs = Math.floor(ip) * 3 + Math.round((ip % 1) * 10);
  return { g: 5, w: 0, l: 0, sv: 0, ip, h, r: er, er, bb, so, era: (er * 27) / outs, whip: ((h + bb) * 3) / outs };
};
const player = (id: string, team: string, batting?: Player["batting"], pitching?: Player["pitching"]): Player => ({
  id, name: id, team, position: pitching && !batting ? "투수" : "내야수", season: 2026, batting, pitching,
});

const records: Player[] = [
  player("a1", "A고", bat(1, 1)), // 1.000 (1타수)
  player("a2", "A고", bat(10, 50, { obp: 0.3, slg: 0.25 })), // .200
  player("a3", "A고", undefined, pit(6.2, 3, 5, 2, 8)), // 20아웃
  player("a4", "A고", undefined, pit(3.1, 0, 2, 1, 4)), // 10아웃
  player("b1", "B BC(U-18)", bat(20, 50, { obp: 0.45, slg: 0.5 })),
];

// 팀 타율은 선수 타율 평균((1.000+.200)/2=.600)이 아니라 합산 11/51=.216
const totals = teamTotals(records, "A고")!;
assert.equal(totals.batting.ab, 51);
assert.equal(totals.batting.avg, 0.216);
// 6.2이닝(20아웃) + 3.1이닝(10아웃) = 30아웃 = 10이닝, 자책 3 → ERA 2.70
assert.equal(totals.pitching.outs, 30);
assert.equal(totals.pitching.era, 2.7);
assert.equal(totals.pitching.whip, 1); // (7+3)/10
assert.equal(totals.pitching.k9, 10.8); // 12×9/10
assert.equal(teamTotals(records, "B BC")!.team, "B BC");
assert.equal(teamTotals(records, "없는고"), null);

// 주요 선수: 규정(시즌 3경기 × 3.1 = 9타석, 3이닝) 충족자만, OPS·ERA 순
const ctx: QualifyContext = { scope: "season", config: seasonConfig(2026), teamGames: { A고: 3, "B BC(U-18)": 3 } };
const top = topPlayers(records, "A고", ctx);
assert.deepEqual(top.batters.map((p) => p.id), ["a2"], "1타수 선수는 규정 미달로 제외");
assert.deepEqual(top.pitchers.map((p) => p.id), ["a4", "a3"], "ERA 0.00 → 4.05 순");

// 전년도 기준 주요 선수: 올해 로스터에 남은 선수만 (졸업생 제외, 유급생 유지), 학년은 올해 기준
const prevCtx: QualifyContext = { scope: "season", config: seasonConfig(2025), teamGames: { A고: 3, B고: 3 } };
const withPn = (p: Player, personNo: string, grade: string): Player => ({ ...p, personNo, grade });
const prevRecords: Player[] = [
  withPn(player("p3", "A고", bat(15, 40)), "pn3", "3"), // 졸업 → 올해 로스터에 없음
  withPn(player("p2", "A고", bat(12, 40)), "pn2", "2"), // 올해 3학년
  withPn(player("pR", "A고", bat(14, 40)), "pnR", "3"), // 유급 → 올해도 3학년으로 로스터에 있음
  withPn(player("pT", "B고", bat(16, 40)), "pnT", "1"), // 전학 → 올해 A고 로스터
  withPn(player("q1", "B고", bat(18, 40)), "pnQ", "2"), // 다른 학교 그대로
];
const roster = new Map([["pn2", "3"], ["pnR", "3"], ["pnT", "2"]]);
const ret = returningTopPlayers(prevRecords, "A고", roster, prevCtx);
assert.deepEqual(ret.batters.map((p) => p.id), ["pT", "pR", "p2"], "졸업생 p3·타교 q1 제외, OPS 순");
assert.deepEqual(ret.batters.map((p) => p.grade), ["2", "3", "3"], "학년은 올해 로스터 기준");
// 로스터가 없으면 전년도 같은 학교 3학년만 뺀다
const noRoster = returningTopPlayers(prevRecords, "A고", null, prevCtx);
assert.deepEqual(noRoster.batters.map((p) => [p.id, p.grade]), [["p2", "3"]]);

// 선수 맞대결표: A 파일만으로 양방향, 타자·투수 파일에 중복된 같은 대결은 한 번만
const idx = (id: string, team: string): PlayerIndexEntry => ({ id, name: id, team, position: "내야수" });
const byId = new Map([idx("a2", "A고"), idx("a3", "A고"), idx("b1", "B BC(U-18)"), idx("b9", "B BC(U-18)"), idx("c1", "C고")].map((p) => [p.id, p]));
const mu = (batterId: string, pitcherId: string, pa: number, h: number): Matchup => ({
  batterId, batterName: batterId, pitcherId, pitcherName: pitcherId,
  pa, ab: pa, h, b2: 0, b3: 0, hr: 0, bb: 0, hbp: 0, so: 0, avg: pa ? h / pa : 0,
});
const files: Player[] = [
  { ...player("a2", "A고"), matchups: [mu("a2", "b9", 4, 2), mu("a2", "c1", 3, 1)] },
  { ...player("a3", "A고"), matchups: [mu("b1", "a3", 5, 1), mu("b1", "a3", 5, 1)] },
];
const fileMatchups = files.flatMap((f) => f.matchups ?? []);
const aBat = versusMatrix(fileMatchups, byId, "A고", "B BC", "aBat");
assert.deepEqual(aBat.batters.map((p) => p.id), ["a2"]);
assert.deepEqual(aBat.pitchers.map((p) => p.id), ["b9"]);
assert.equal(aBat.cells.get(cellKey("a2", "b9"))!.h, 2);
assert.equal(aBat.cells.size, 1, "C고 투수와의 대결은 제외");
const bBat = versusMatrix(fileMatchups, byId, "A고", "B BC", "bBat");
assert.deepEqual(bBat.batters.map((p) => p.id), ["b1"]);
assert.equal(bBat.cells.size, 1, "중복 대결은 한 번만");

console.log("versus tests passed");
