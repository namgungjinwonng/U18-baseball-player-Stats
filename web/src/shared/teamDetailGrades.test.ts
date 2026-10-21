// 학교 상세 등급의 산정 방향·목록과 일치·최소 표본·시즌 분리·미집계 처리를 검증한다.
import assert from "node:assert/strict";
import { buildTeamDetailGrades, TEAM_DETAIL_METRICS } from "./teamDetailGrades";
import { buildTeamSummaries } from "./teamSummary";
import type { Player, ScheduleGame, StrengthData, TeamRosterEntry } from "./types";

const names = ["A고", "B고", "C고", "D고", "E고"];
const teams: TeamRosterEntry[] = names.map((team) => ({ team, region: "서울", club_idx: team, manager: "", staff: [], players: [], player_count: 1 }));
const records: Player[] = names.map((team, i) => ({
  id: team, name: team, team, position: "투수", season: 2026,
  batting: { g: 5, pa: 100 + i * 4, ab: 100, h: 10 + i * 10, b2: 0, b3: 0, hr: i, bb: i * 4, hbp: 0, so: i * 5, sb: i * 2, r: 0, rbi: 0, avg: 0, obp: 0, slg: 0 },
  pitching: { g: 5, w: 0, l: 0, sv: 0, ip: 10, h: 10 - i, bb: 10 - i * 2, so: 10 + i * 5, r: 10 - i * 2, er: 10 - i * 2, era: 0, whip: 0 },
}));
const games: ScheduleGame[] = names.flatMap((team, i) => Array.from({ length: 5 }, (_, j) => ({
  game_idx: `${team}-${j}`, title: "대회", date: "2026-04-01", time: "10:00", venue: "", round: "", status: "완료",
  away: { name: team, score: j <= i ? 3 : 1, result: j <= i ? "승" : "패" },
  home: { name: "상대고", score: j <= i ? 1 : 3, result: j <= i ? "패" : "승" },
})));
const strength: StrengthData = {
  season: 2026, updatedAt: "", params: { shrinkK: 0, clamp: [0, 2] },
  teams: Object.fromEntries(names.map((name, i) => [name, { bat: 0.8 + i * 0.1, pit: 0.8 + i * 0.1, g: 5 }])), players: {}, tournaments: {},
};
const before = JSON.stringify({ teams, records, games, strength });
const rows = buildTeamDetailGrades(2026, teams, games, records, strength);
const row = (name: string) => rows.find((r) => r.name === name)!;
const summaries = buildTeamSummaries(2026, teams, games, records);
for (const summary of summaries) {
  assert.deepEqual(row(summary.name).grades.avg, summary.avgGrade, "목록·상세 타율 등급 일치");
  assert.deepEqual(row(summary.name).grades.era, summary.eraGrade, "목록·상세 ERA 등급 일치");
}
for (const key of TEAM_DETAIL_METRICS) {
  const percentiles = names.map((name) => row(name).grades[key]?.percentile);
  assert.ok(percentiles.every((p) => p != null), `${key} 등급이 존재한다`);
  assert.ok(percentiles.every((p, i) => i === 0 || p! > percentiles[i - 1]!), `${key}: 좋은 쪽으로 백분위 증가`);
}
assert.equal(row("A고").values.hr, 0, "유효 타격 기록의 0홈런도 등급 대상");
assert.equal(row("E고").values.era, 1.8, "선수 비율 대신 원자료로 ERA 재계산");
assert.equal(row("E고").values.k9, 27, "K/9 원자료 합산");
assert.equal(JSON.stringify({ teams, records, games, strength }), before, "입력 변경 없음");

const lowGames = games.filter((g) => g.game_idx !== "E고-4");
const lowRows = buildTeamDetailGrades(2026, teams, lowGames, records, strength);
assert.ok(Object.values(lowRows.find((r) => r.name === "E고")!.grades).every((g) => g == null), "5경기 미만은 모든 등급 보류");
assert.ok(lowRows.every((r) => r.grades.avg == null), "유효 타격 학교가 4곳이면 전체 타율 등급 보류");

const noPit = records.map((p, i) => i === 0 ? { ...p, pitching: { ...p.pitching!, ip: 0 } } : p);
const invalidRows = buildTeamDetailGrades(2026, teams, games, noPit, strength);
assert.equal(invalidRows.find((r) => r.name === "A고")!.values.era, null, "0이닝은 ERA 0으로 오인하지 않는다");
assert.ok(invalidRows.every((r) => r.grades.era == null), "유효 투구 학교 4곳은 ERA 등급 보류");
assert.ok(invalidRows.find((r) => r.name === "A고")!.grades.avg, "투구 부족은 타격 등급에 영향 없음");

const scoped = buildTeamDetailGrades(2026, teams, [...games, { ...games[0], date: "2025-04-01" }],
  [...records, { ...records[0], season: 2025 }], strength);
assert.deepEqual(scoped, rows, "다른 시즌 일정·선수 기록 제외");
const oldStrength = buildTeamDetailGrades(2026, teams, games, records, { ...strength, season: 2025 });
assert.ok(oldStrength.every((r) => r.values.batStrength == null && r.grades.pitStrength == null), "다른 시즌 강도 지수 제외");
const badStrength = buildTeamDetailGrades(2026, teams, games, records, {
  ...strength, teams: { ...strength.teams, A고: { bat: NaN, pit: Infinity, g: 5 } },
});
assert.ok(badStrength.every((r) => r.grades.batStrength == null && r.grades.pitStrength == null), "비유한 값과 유효 표본 부족은 미산정");
const tied = buildTeamDetailGrades(2026, teams, games, records.map((p) => ({ ...p, batting: { ...p.batting!, h: 30 } })), strength);
assert.ok(tied.filter((r) => names.includes(r.name)).every((r) => r.grades.avg?.percentile === 50), "동률은 중간 백분위");

console.log("학교 상세 15개 지표 등급·방향·목록 일치·시즌·표본 검증 통과");
