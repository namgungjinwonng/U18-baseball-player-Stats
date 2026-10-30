// 선수 검색 대상에 기록 없는 등록 선수가 중복 없이 합쳐지고 무기록 상세로 연결되는지 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playerSearchLink, withRecordlessPlayers } from "./playerSearch";
import { currentRosterEntry, transferredTo } from "./transfers";
import type { PlayerIndexEntry, TeamRosterEntry } from "./types";

const player = (name: string, number: string, person_no: string) => ({
  type: "player" as const, number, name, position: "투수", grade: "2", height_weight: "",
  throw_bat: "우투우타", person_no, team: "장안고", team_idx: "547", region: "경기",
});
const index: PlayerIndexEntry[] = [
  { id: "장안고_권민상_37", name: "권민상", team: "장안고", position: "투수", number: "37", personNo: "A" },
];
const teams: TeamRosterEntry[] = [{
  team: "장안고", club_idx: "547", region: "경기", manager: "", staff: [], player_count: 3,
  players: [player("권민상", "37", "A"), player("배선우", "19", "B"), player("신입생", "", "C")],
}];

const merged = withRecordlessPlayers(index, teams);
assert.equal(merged.length, 3, "기록 선수는 personNo로 중복 제외");
assert.equal(merged[0], index[0], "기록 선수는 그대로 앞에 둔다");
const bae = merged.find((p) => p.name === "배선우")!;
assert.equal(bae.recordless, true);
assert.equal(bae.number, "19");
assert.equal(playerSearchLink(bae), "/person/B");
assert.equal(playerSearchLink(merged[0]), "/player/장안고_권민상_37");
assert.equal(merged.find((p) => p.name === "신입생")!.number, undefined, "등번호 미배정은 빈 값으로 두지 않는다");
assert.deepEqual(withRecordlessPlayers(index, null), index, "선수현황이 없으면 기록 선수만");

// 이적 선수: 옛 학교 항목(moved_to, 등번호 남아 있음)이 먼저 나와도 현재 학교 항목으로 한 번만 넣는다.
const transferTeams: TeamRosterEntry[] = [
  { ...teams[0], team: "경기상업고", players: [
    { ...player("이적생", "22", "D"), team: "경기상업고", moved_to: "백송고" },
    { ...player("기록이적", "32", "A"), team: "경기상업고", moved_to: "백송고" },
  ] },
  { ...teams[0], team: "백송고", players: [
    { ...player("이적생", "", "D"), team: "백송고" },
    { ...player("기록이적", "", "A"), team: "백송고" },
  ] },
];
const moved = withRecordlessPlayers(index, transferTeams);
const movedRecordless = moved.filter((p) => p.name === "이적생");
assert.equal(movedRecordless.length, 1);
assert.equal(movedRecordless[0].team, "백송고");
assert.equal(movedRecordless[0].number, undefined);
assert.equal(moved[0].team, "백송고", "기록 선수도 최종 학교만 보인다");
assert.equal(moved[0].number, undefined, "옛 학교 등번호(37)는 보이지 않는다(최종 학교 미배정)");
assert.equal(playerSearchLink(moved[0]), "/player/장안고_권민상_37", "링크는 기록 그대로");
assert.equal(index[0].team, "장안고", "원본 index 는 바꾸지 않는다");
// 옛 학교 항목만 있으면 현재 학교 이름으로 보여 준다.
const onlyOld = withRecordlessPlayers([], [transferTeams[0]]).find((p) => p.name === "이적생")!;
assert.equal(onlyOld.team, "백송고");
assert.equal(currentRosterEntry(transferTeams, "D")!.team, "백송고");
assert.equal(transferredTo(transferTeams, "A", "경기상업고"), "백송고");
assert.equal(transferredTo(transferTeams, "A", "백송고"), undefined);

// 실제 데이터: 시즌마다 선수현황 등록 선수 전원이 검색 대상에 한 번씩 들어간다.
const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../data");
const read = <T>(y: number, f: string): T => JSON.parse(fs.readFileSync(path.join(dataRoot, String(y), f), "utf8"));
const counts: string[] = [];
for (const y of [2024, 2025, 2026]) {
  const real = withRecordlessPlayers(read<PlayerIndexEntry[]>(y, "players/index.json"), read<TeamRosterEntry[]>(y, "teams.json"));
  const personNos = real.map((p) => p.personNo).filter(Boolean);
  assert.equal(new Set(personNos).size, personNos.length, `${y} personNo 중복 없음`);
  const found = new Set(personNos);
  const roster = read<TeamRosterEntry[]>(y, "teams.json").flatMap((t) => t.players);
  assert.ok(roster.every((p) => found.has(p.person_no)), `${y} 등록 선수 전원 검색 대상`);
  counts.push(`${y}: ${real.length}명`);
  if (y === 2026) {
    const bae = real.filter((p) => p.name === "배선우");
    assert.equal(bae.length, 1);
    assert.equal(playerSearchLink(bae[0]), "/person/202302011665");
    // 시즌 중 경기상업고 → 백송고 이적(KBSA 선수 상세 출신학교 최신순 기준).
    const nam = real.filter((p) => p.personNo === "202201001131");
    assert.equal(nam.length, 1);
    assert.equal(nam[0].team, "백송고");
    assert.equal(nam[0].number, undefined, "경기상업고 22번은 보이지 않는다");
    assert.equal(real.find((p) => p.personNo === "202103003752")!.team, "백송고", "박성훈(32번)");
  }
}
console.log(`선수 검색 무기록 등록 선수 병합 검증 통과 (${counts.join(", ")})`);
