// 학교 카드 합산·개별 등급·동일 비중 종합등급·표본과 시즌/필터 처리를 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { pctGrade } from "./percentile";
import { buildTeamSummaries, MIN_TEAM_GRADE_GAMES, MIN_TEAM_GRADE_POPULATION } from "./teamSummary";
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";

const team = (name: string, region = "서울"): TeamRosterEntry => ({
  team: name, region, club_idx: name, manager: "", staff: [], players: [], player_count: 0,
});
let seq = 0;
const game = (name: string, outcome: "승" | "패" | "무" = "승", status = "완료", year = 2026): ScheduleGame => ({
  game_idx: String(++seq), title: "테스트 대회", date: `${year}-04-01`,
  time: "10:00", venue: "", round: "", status,
  away: { name, score: outcome === "승" ? 3 : outcome === "무" ? 1 : 0, result: outcome },
  home: { name: "상대고", score: 1, result: outcome === "승" ? "패" : outcome === "무" ? "무" : "승" },
});
const player = (name: string, hits: number, er: number): Player => ({
  id: name, name, team: name, position: "내야수", season: 2026,
  batting: { g: 5, pa: 100, ab: 100, h: hits, r: 0, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, avg: 0.999, obp: 0, slg: 0 },
  pitching: { g: 5, w: 0, l: 0, sv: 0, ip: 10, h: 0, r: er, er, bb: 0, so: 0, era: 99, whip: 0 },
});
const names = ["A고", "B고", "C고", "D고", "E고"];
const teams = [...names.map((n) => team(n)), team("표본부족고"), team("무기록고"), team("등록만고")];
const games = [
  ...names.flatMap((n) => Array.from({ length: 5 }, () => game(n))),
  ...Array.from({ length: 4 }, () => game("표본부족고")),
  ...Array.from({ length: 5 }, () => game("무기록고")),
];
const records = [...names.map((n, i) => player(n, 10 * (i + 1), 10 - 2 * i)), player("표본부족고", 100, 0)];
const before = JSON.stringify({ teams, games, records });
const rows = buildTeamSummaries(2026, teams, games, records);
const row = (name: string) => rows.find((r) => r.name === name)!;

assert.equal(MIN_TEAM_GRADE_GAMES, 5);
assert.equal(MIN_TEAM_GRADE_POPULATION, 5);
assert.deepEqual(names.map((n) => row(n).avgGrade?.percentile), [10, 30, 50, 70, 90]);
assert.deepEqual(names.map((n) => row(n).avgGrade?.grade), [10, 30, 50, 70, 90].map((p) => pctGrade(p).grade));
assert.deepEqual(names.map((n) => row(n).eraGrade?.percentile), [10, 30, 50, 70, 90], "ERA는 낮을수록 높은 백분위");
assert.equal(row("표본부족고").avg, 1, "기록값은 보여도 경기 수 부족 시 등급은 보류");
assert.equal(row("표본부족고").avgGrade, null);
assert.equal(row("표본부족고").eraGrade, null);
assert.equal(row("무기록고").avg, null);
assert.equal(row("무기록고").era, null);
assert.equal(row("무기록고").avgGrade, null);
assert.equal(row("무기록고").eraGrade, null, "투구 기록 없음은 ERA 0.00이 아님");
assert.equal(row("등록만고").games, 0);
assert.equal(row("등록만고").pct, null);
assert.equal(JSON.stringify({ teams, games, records }), before, "입력 배열·객체를 변경하지 않는다");
assert.ok(!buildTeamSummaries(2026, teams, games, [...records, player("기록에만있는고", 100, 0)])
  .some((r) => r.name === "기록에만있는고"), "기존 로스터·일정 카드 목록을 기록 파일로 확장하지 않는다");

// 4경기→5경기 경계. 미달 학교는 비교 집단에서도 빠지고, 기준 충족 후에만 합류한다.
const fifth = buildTeamSummaries(2026, teams, [...games, game("표본부족고")], records);
assert.ok(fifth.find((r) => r.name === "표본부족고")!.avgGrade);
assert.equal(fifth.find((r) => r.name === "표본부족고")!.eraGrade?.letter, "A");
assert.ok(fifth.find((r) => r.name === "E고")!.avgGrade!.percentile < row("E고").avgGrade!.percentile);

// 취소·예정·다른 시즌 경기는 표본을 늘리지 않으며, 다른 시즌 선수 기록도 섞지 않는다.
const oldPlayer = { ...player("A고", 100, 0), season: 2025 };
const scoped = buildTeamSummaries(2026, teams, [
  ...games, game("표본부족고", "승", "취소"), game("표본부족고", "승", "예정"),
  game("표본부족고", "승", "완료", 2025),
], [...records, oldPlayer]);
assert.equal(scoped.find((r) => r.name === "표본부족고")!.games, 4);
assert.deepEqual(scoped.find((r) => r.name === "A고"), row("A고"));

// 평균 비율의 평균이 아니라 안타/타수 합산. 1.2 + 2.1이닝은 12아웃.
const one = player("클럽BC(U18)", 1, 1);
one.batting = { ...one.batting!, ab: 1, h: 1 };
one.pitching = { ...one.pitching!, ip: 1.2, er: 1 };
const two = player("클럽BC(U-18)", 10, 2);
two.batting = { ...two.batting!, ab: 50, h: 10 };
two.pitching = { ...two.pitching!, ip: 2.1, er: 2 };
const clubRows = buildTeamSummaries(2026, [team("클럽BC(U-18)", "경기")],
  [game("클럽BC(U18)", "승"), game("클럽BC(U-18)", "패"), game("클럽BC(U18)", "무")], [one, two]);
const club = clubRows.find((r) => r.name === "클럽BC")!;
assert.equal(clubRows.filter((r) => r.name === "클럽BC").length, 1);
assert.equal(club.region, "경기");
assert.deepEqual([club.rec.w, club.rec.l, club.rec.d, club.games, club.pct], [1, 1, 1, 3, 0.5]);
assert.equal(club.avg, 0.216);
assert.equal(club.era, 6.75);

// 동률은 중간 순위. 지역 필터는 계산 완료 행에서 적용하므로 백분위를 다시 매기지 않는다.
const tiedRecords = records.map((p) => names.slice(0, 3).includes(p.team)
  ? { ...p, batting: { ...p.batting!, h: 30 } } : p);
const tied = buildTeamSummaries(2026, teams, games, tiedRecords);
assert.deepEqual(tied.filter((r) => names.slice(0, 3).includes(r.name)).map((r) => r.avgGrade?.percentile), [30, 30, 30]);
const regional = buildTeamSummaries(2026, teams.map((t, i) => ({ ...t, region: i % 2 ? "경기" : "서울" })), games, records);
assert.deepEqual(regional.filter((r) => r.region === "서울").map((r) => [r.name, r.avgGrade]),
  rows.filter((r) => regional.find((x) => x.name === r.name)?.region === "서울").map((r) => [r.name, r.avgGrade]));

// 타율·ERA는 유효 자료별 집단을 따로 구성하며, 비교 학교가 5곳 미만이면 보류한다.
const tooFew = buildTeamSummaries(2026, teams, games, records.filter((p) => p.team !== "A고"));
assert.ok(tooFew.every((r) => r.avgGrade === null && r.eraGrade === null));
const noPitch = records.map((p) => p.team === "A고" ? { ...p, pitching: undefined } : p);
const partial = buildTeamSummaries(2026, teams, games, noPitch);
assert.ok(partial.find((r) => r.name === "A고")!.avgGrade);
assert.ok(partial.every((r) => r.eraGrade === null));
const zeroRecords = records.map((p) => p.team === "A고"
  ? { ...p, batting: { ...p.batting!, ab: 0, h: 0 }, pitching: { ...p.pitching!, ip: 0, er: 0 } } : p);
const zero = buildTeamSummaries(2026, teams, games, zeroRecords).find((r) => r.name === "A고")!;
assert.deepEqual([zero.avg, zero.era, zero.avgGrade, zero.eraGrade], [null, null, null, null]);
const zeroEra = buildTeamSummaries(2026, teams, games, records.map((p) =>
  p.team === "E고" ? { ...p, pitching: { ...p.pitching!, er: 0 } } : p));
assert.equal(zeroEra.find((r) => r.name === "E고")!.era, 0);
assert.equal(zeroEra.find((r) => r.name === "E고")!.eraGrade?.letter, "A", "투구 아웃이 있는 ERA 0.00은 유효");
assert.deepEqual(buildTeamSummaries(2026, [], [], []), []);

// 종합점수도 재순위화한다. 평균 점수의 범위가 좁아져도 최고 학교는 상위 등급을 받는다.
assert.deepEqual(names.map((n) => row(n).overallGrade?.percentile), [10, 30, 50, 70, 90]);
assert.deepEqual(names.map((n) => row(n).overallGrade?.grade), [10, 30, 50, 70, 90].map((p) => pctGrade(p).grade));
assert.equal(row("표본부족고").overallGrade, null);
assert.equal(row("무기록고").overallGrade, null);
assert.equal(row("등록만고").overallGrade, null);
assert.ok(tooFew.every((r) => r.overallGrade === null), "비교 학교 4곳이면 종합등급을 보류한다");
assert.ok(partial.every((r) => r.overallGrade === null), "타율 학교 5곳이어도 세 지표 완비 학교가 4곳이면 보류한다");
assert.equal(zero.overallGrade, null, "타수·투구 아웃이 0이면 종합 자료가 없는 것으로 본다");
assert.ok(zeroEra.find((r) => r.name === "E고")!.overallGrade, "실제 투구한 ERA 0.00은 종합에서도 유효하다");

// 승률과 타율의 순위를 반대로 놓고 ERA를 같게 하면 동일 비중에서 모든 종합점수가 같아야 한다.
const balancedTeams = names.map((n, i) => team(n, i % 2 ? "경기" : "서울"));
const balancedGames = names.flatMap((n, i) => Array.from({ length: 10 }, (_, g) => game(n, g < 1 + i * 2 ? "승" : "패")));
const balancedRecords = names.map((n, i) => player(n, 50 - i * 10, 4));
const balanced = buildTeamSummaries(2026, balancedTeams, balancedGames, balancedRecords);
assert.deepEqual(balanced.filter((r) => names.includes(r.name)).map((r) => r.pct), [0.1, 0.3, 0.5, 0.7, 0.9]);
assert.ok(balanced.filter((r) => names.includes(r.name)).every((r) => r.overallGrade?.percentile === 50 && r.overallGrade.grade === "C"),
  "승률 50% 같은 가중치를 임의로 적용하지 않고 세 지표를 정확히 1/3씩 반영한다");

// 부분 기록 학교가 개별 지표 집단에 들어오더라도 종합의 공통 비교 집단은 바뀌지 않는다.
const batOnly = { ...player("타격만고", 35, 4), pitching: undefined };
const withPartial = buildTeamSummaries(2026, [...balancedTeams, team("타격만고")], [
  ...balancedGames, ...Array.from({ length: 10 }, (_, g) => game("타격만고", g < 4 ? "승" : "패")),
], [...balancedRecords, batOnly]);
assert.equal(withPartial.find((r) => r.name === "타격만고")!.overallGrade, null);
for (const n of names) assert.deepEqual(withPartial.find((r) => r.name === n)!.overallGrade, balanced.find((r) => r.name === n)!.overallGrade);

// 각 지표를 단독으로 개선했을 때 종합 순위 방향이 맞는지 확인한다.
const flatGames = names.flatMap((n) => Array.from({ length: 10 }, (_, g) => game(n, g < 5 ? "승" : "패")));
const flatRecords = names.map((n) => player(n, 30, 4));
const allTied = buildTeamSummaries(2026, balancedTeams, flatGames, flatRecords);
assert.ok(allTied.filter((r) => names.includes(r.name)).every((r) => r.overallGrade?.percentile === 50));
const winOnly = buildTeamSummaries(2026, balancedTeams, balancedGames, flatRecords);
const avgOnly = buildTeamSummaries(2026, balancedTeams, flatGames, names.map((n, i) => player(n, 10 * (i + 1), 4)));
const eraOnly = buildTeamSummaries(2026, balancedTeams, flatGames, names.map((n, i) => player(n, 30, 10 - i * 2)));
for (const cases of [winOnly, avgOnly, eraOnly]) {
  assert.deepEqual(names.map((n) => cases.find((r) => r.name === n)!.overallGrade?.percentile), [10, 30, 50, 70, 90]);
}

// 0승과 타율 .000도 실제 기록이면 유효하다. 전 경기 무승부는 승률이 없어 종합 보류다.
const zeroWinGames = balancedGames.map((g) => g.away.name === "A고" ? {
  ...g, away: { ...g.away, score: 0, result: "패" }, home: { ...g.home, score: 1, result: "승" },
} : g);
const zeroValid = buildTeamSummaries(2026, balancedTeams, zeroWinGames, balancedRecords.map((p) => p.team === "A고"
  ? { ...p, batting: { ...p.batting!, h: 0 } } : p));
assert.equal(zeroValid.find((r) => r.name === "A고")!.pct, 0);
assert.equal(zeroValid.find((r) => r.name === "A고")!.avg, 0);
assert.ok(zeroValid.find((r) => r.name === "A고")!.overallGrade);
const drawGames = balancedGames.map((g) => g.away.name === "A고" ? {
  ...g, away: { ...g.away, score: 1, result: "무" }, home: { ...g.home, score: 1, result: "무" },
} : g);
const drawOnly = buildTeamSummaries(2026, balancedTeams, drawGames, balancedRecords);
assert.equal(drawOnly.find((r) => r.name === "A고")!.pct, null);
assert.ok(drawOnly.every((r) => r.overallGrade === null));

// 지역·검색은 계산 완료 행에 적용하므로 같은 학교의 종합등급이 바뀌지 않는다.
const local = balanced.filter((r) => r.region === "서울" && r.name.includes("A"));
assert.deepEqual(local[0].overallGrade, balanced.find((r) => r.name === "A고")!.overallGrade);
const withOld = buildTeamSummaries(2026, balancedTeams,
  [...balancedGames, ...Array.from({ length: 10 }, () => game("A고", "승", "완료", 2025))],
  [...balancedRecords, { ...player("A고", 100, 0), season: 2025 }]);
for (const n of names) assert.deepEqual(withOld.find((r) => r.name === n)!.overallGrade, balanced.find((r) => r.name === n)!.overallGrade);

// 별칭 학교를 같은 팀으로 합치고 모든 유효 지표를 같은 비교 학교 수로 계산한다.
const aliasNames = ["클럽BC", ...names.slice(1)];
const aliases = buildTeamSummaries(2026, aliasNames.map((n) => team(n)), [
  ...Array.from({ length: 5 }, () => game("클럽BC(U18)")),
  ...names.slice(1).flatMap((n) => Array.from({ length: 5 }, () => game(n))),
], [one, two, ...names.slice(1).map((n) => player(n, 30, 4))]);
assert.equal(aliases.filter((r) => r.name === "클럽BC").length, 1);
assert.ok(aliases.find((r) => r.name === "클럽BC")!.overallGrade);
assert.equal(JSON.stringify({ teams, games, records }), before, "종합등급 계산도 원자료를 변경하지 않는다");

console.log("✓ 학교 카드 합산·종합 동일 비중·공통 집단·재백분위·동률·결측·시즌/필터 검증 통과");
