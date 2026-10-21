// 학교 카드의 팀 원자료 합산·최소 경기 수·시즌 전체 백분위·무기록 처리를 검증하는 단위 테스트.
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

console.log("✓ 학교 카드 합산·시즌 분리·최소 5경기·동률·전체 집단·무기록 등급 검증 통과");
