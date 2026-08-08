// 학교별 랭킹의 승률·승차·이닝 변환 집계를 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { buildTeamRanking } from "./teamRanking";
import type { Player, ScheduleGame, TeamRosterEntry } from "./types";

const game = (
  id: number,
  away: string,
  awayResult: string,
  home: string,
  homeResult: string
): ScheduleGame => ({
  game_idx: String(id),
  title: "테스트 주말리그",
  date: "2026-03-01",
  time: "10:00",
  venue: "테스트구장",
  round: "리그전",
  status: "완료",
  away: { name: away, result: awayResult, score: 1 },
  home: { name: home, result: homeResult, score: 0 },
});

const names = ["A고", "B고", ...Array.from({ length: 14 }, (_, index) => `상대${index + 1}고`)];
const teams = names.map((team): TeamRosterEntry => ({
  team,
  club_idx: team,
  region: "서울",
  manager: "",
  staff: [],
  players: [],
  player_count: 0,
}));

const games: ScheduleGame[] = [
  ...Array.from({ length: 7 }, (_, index) => game(index, "A고", "승", `상대${index + 1}고`, "패")),
  ...Array.from({ length: 5 }, (_, index) => game(index + 10, "B고", "승", `상대${index + 8}고`, "패")),
  game(20, "B고", "패", "상대13고", "승"),
  game(21, "A고", "", "상대14고", ""),
  { ...game(22, "A고", "승", "B고", "패"), status: "취소" },
  { ...game(23, "A고", "승", "B고", "패"), title: "다른 대회" },
];

const records: Player[] = [
  {
    id: "a1", name: "A타자", team: "A고", position: "내야수", season: 2026,
    batting: { g: 1, pa: 2, ab: 2, r: 0, h: 1, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, avg: 0.5, obp: 0.5, slg: 0.5 },
  },
  {
    id: "a2", name: "A투수1", team: "A고", position: "투수", season: 2026,
    pitching: { g: 1, w: 0, l: 0, sv: 0, ip: 1.2, h: 0, r: 1, er: 1, bb: 0, so: 0, era: 5.4, whip: 0 },
  },
  {
    id: "a3", name: "A투수2", team: "A고", position: "투수", season: 2026,
    batting: { g: 1, pa: 8, ab: 8, r: 0, h: 1, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, avg: 0.125, obp: 0.125, slg: 0.125 },
    pitching: { g: 1, w: 0, l: 0, sv: 0, ip: 2.1, h: 0, r: 2, er: 2, bb: 0, so: 0, era: 8.1, whip: 0 },
  },
];

const rows = buildTeamRanking(games, teams, records, "테스트 주말리그");
const a = rows.find((row) => row.team === "A고")!;
const b = rows.find((row) => row.team === "B고")!;

assert.equal(a.games, 8, "완료된 7승과 무승부 1경기만 집계해야 함");
assert.equal(a.w, 7);
assert.equal(a.d, 1);
assert.equal(a.pct, 1, "승률 분모에서 무승부를 제외해야 함");
assert.equal(a.pts, 22, "승점은 승×3 + 무여야 함");
assert.equal(b.gb, 1.5, "7승 0패와 5승 1패의 승차는 1.5여야 함");
assert.equal(a.avg, 0.2, "팀타율은 전체 안타 2개를 전체 타수 10으로 나눠야 함");
assert.equal(a.era, 6.75, "1.2이닝과 2.1이닝은 12아웃으로 변환해 평균자책점을 계산해야 함");

// 협회 원본은 같은 시즌에도 한 클럽팀을 (U-18)·(U18) 로 섞어 표기한다.
// 접미사를 걷어낸 이름으로 합쳐 한 행이 되어야 한다 (2025 GD챌린저스BC 실제 사례).
const clubTeams: TeamRosterEntry[] = ["클럽BC(U-18)", "상대A고", "상대B고"].map((team) => ({
  team, club_idx: team, region: "서울", manager: "", staff: [], players: [], player_count: 0,
}));
const clubGames: ScheduleGame[] = [
  game(30, "클럽BC(U-18)", "승", "상대A고", "패"),
  game(31, "클럽BC(U18)", "패", "상대B고", "승"),
];
const clubRecords: Player[] = [
  {
    id: "c1", name: "클럽타자", team: "클럽BC(U18)", position: "내야수", season: 2026,
    batting: { g: 1, pa: 4, ab: 4, r: 0, h: 2, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, avg: 0.5, obp: 0.5, slg: 0.5 },
  },
];
const clubRows = buildTeamRanking(clubGames, clubTeams, clubRecords, "테스트 주말리그");
const club = clubRows.filter((row) => row.team === "클럽BC");

assert.equal(club.length, 1, "(U-18)과 (U18) 표기는 한 행으로 합쳐야 함");
assert.equal(club[0].games, 2, "두 표기의 경기를 합산해야 함");
assert.equal(club[0].w, 1);
assert.equal(club[0].l, 1);
assert.equal(club[0].region, "서울", "지역은 접미사를 걷어낸 이름으로 조회해야 함");
assert.equal(club[0].avg, 0.5, "선수 기록도 접미사 무관하게 팀에 합산해야 함");
assert.ok(!clubRows.some((row) => /\(U-?\d+\)/.test(row.team)), "표시 이름에 연령 접미사가 남지 않아야 함");

console.log("✓ 학교별 랭킹 승률·승점·승차·팀타율·이닝 변환·팀명 정규화 검증 통과");
