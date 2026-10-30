// 이적 선수 현재 소속 판정(markTransfers)이 프로필 출신학교 최신순을 따르는지 검증한다.
import assert from "node:assert/strict";
import { markTransfers, multiTeamPlayers } from "./transfers.js";
import type { PlayerProfile, TeamPlayerEntry, TeamRosterEntry } from "./types.js";

const player = (team: string, name: string, number: string, person_no: string): TeamPlayerEntry => ({
  type: "player", number, name, position: "외야수", grade: "1", height_weight: "", throw_bat: "",
  person_no, team, team_idx: "", region: "",
});
const roster = (team: string, players: TeamPlayerEntry[]): TeamRosterEntry => ({
  team, club_idx: "", region: "", manager: "", staff: [], players, player_count: players.length,
});
const profile = (personNo: string, schools: [number, string][]): PlayerProfile => ({
  personNo, schools: schools.map(([year, school]) => ({ year, school })), awards: [], updatedAt: "",
});

const rosters = [
  // 남궁승준: 옛 학교(경기상업고)에 등번호가 남아 있고 새 학교(백송고)는 등번호 미배정.
  roster("경기상업고", [player("경기상업고", "남궁승준", "22", "A"), player("경기상업고", "잔류", "7", "C")]),
  roster("백송고", [player("백송고", "남궁승준", "", "A")]),
  // 최혜성: 새 학교(제주고)에 등번호, 옛 학교(대구고)는 빈 값.
  roster("대구고", [player("대구고", "최혜성", "", "B")]),
  roster("제주고", [player("제주고", "최혜성", "22", "B")]),
  // 프로필 없는 이적 선수는 판정하지 않는다.
  roster("강릉고", [player("강릉고", "미확인", "", "D")]),
  roster("청주고", [player("청주고", "미확인", "18", "D")]),
];
assert.deepEqual([...multiTeamPlayers(rosters).keys()], ["A", "B", "D"]);

const profiles = new Map([
  ["A", profile("A", [[2026, "백송고"], [2026, "경기상업고"], [2025, "서울 신월중"]])],
  ["B", profile("B", [[2026, "제주고"], [2026, "대구고"]])],
]);
assert.equal(markTransfers(rosters, profiles, 2026), 2);
const find = (team: string, pn: string) => rosters.find((r) => r.team === team)!.players.find((p) => p.person_no === pn)!;
assert.equal(find("경기상업고", "A").moved_to, "백송고");
assert.equal(find("백송고", "A").moved_to, undefined);
assert.equal(find("대구고", "B").moved_to, "제주고");
assert.equal(find("제주고", "B").moved_to, undefined);
assert.equal(find("경기상업고", "C").moved_to, undefined, "한 학교만 있는 선수는 그대로");
assert.equal(find("강릉고", "D").moved_to, undefined, "프로필 없으면 판정 안 함");

// 다시 판정해도 같은 결과(멱등)이고, 다시 옛 학교로 돌아가면 표시가 옮겨진다.
assert.equal(markTransfers(rosters, profiles, 2026), 2);
profiles.set("A", profile("A", [[2026, "경기상업고"], [2026, "백송고"]]));
markTransfers(rosters, profiles, 2026);
assert.equal(find("경기상업고", "A").moved_to, undefined);
assert.equal(find("백송고", "A").moved_to, "경기상업고");
console.log("transfers tests passed");
