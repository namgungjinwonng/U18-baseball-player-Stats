// 시즌 초 참고 분석의 현재 엔트리 대조·졸업 제외·연도·프롬프트·저장 분리를 검증한다.
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPreviousSeasonAnalysis, needsPreviousSeasonReference } from "./previousSeasonAnalysis";
import { buildPayload, buildUserPrompt, SYSTEM_PROMPT } from "./ai/prompt";
import { entryKey, loadEntry, saveEntry, type AiEntry } from "./ai/store";
import type { Player, ScheduleGame, TeamPlayerEntry, TeamRosterEntry } from "./types";

const player = (id: string, team = "A고", grade = "2", season = 2026): Player => ({
  id: `${team}_${id}_1`, personNo: id, name: `선수${id}`, team, grade, season, number: "1", position: "투수",
  batting: { g: 5, pa: 20, ab: 16, r: 3, h: 5, b2: 1, b3: 0, hr: 1, rbi: 3, bb: 4, hbp: 0, so: 2, sb: 1, avg: .312, obp: .45, slg: .562 },
  pitching: { g: 3, w: 1, l: 0, sv: 0, ip: 10.2, h: 8, r: 3, er: 2, bb: 3, so: 12, era: 1.69, whip: 1.03 },
});
const member = (id: string, team = "A고", grade = "3"): TeamPlayerEntry => ({
  type: "player", person_no: id, name: `선수${id}`, team, grade, number: "99", position: "투수",
  team_idx: team, region: "서울", height_weight: "", throw_bat: "",
});
const roster = (team: string, players: TeamPlayerEntry[]): TeamRosterEntry => ({
  team, players, club_idx: team, region: "서울", manager: "", staff: [], player_count: players.length,
});
const rosters = [roster("A고", [member("a"), member("grad"), member("rookie", "A고", "1")]), roster("B고", [member("b", "B고")])];
const previous = [player("a"), player("b", "B고"), player("grad", "A고", "3"), player("absent")];
const build = (rs = rosters, ps = previous, year = 2027) => buildPreviousSeasonAnalysis(year, "A고", "B고", rs, ps);
const original = JSON.stringify({ rosters, previous });
const result = build();
assert.ok(result.input?.reference);
assert.deepEqual(result.extra.players?.a.batters.map((p) => p.personNo), ["a"]);
assert.deepEqual(result.extra.players?.b.pitchers.map((p) => p.personNo), ["b"]);
assert.equal(result.extra.players!.a.batters[0].number, "1", "등번호 변경과 무관하게 고유번호로 연결");
assert.equal(result.extra.players!.a.batters[0].grade, "3", "화면 학년은 현재 엔트리");
assert.equal(result.extra.players!.a.batters[0].season, 2026, "수치의 출처 연도 유지");
assert.ok(build(rosters, previous.map((p) => p.personNo === "a" ? { ...p, grade: "1" } : p)).input, "전년 1학년도 포함");
assert.deepEqual(result.input.reference.teams.map((t) => [t.rosterCount, t.matchedCount]), [[3, 1], [1, 1]]);
assert.equal(JSON.stringify({ rosters, previous }), original, "입력 자료 불변");
assert.deepEqual(result.input.metrics, {});
for (const k of ["recA", "recB", "h2h", "lg", "seasonA", "seasonB", "extra", "common"]) assert.ok(!(k in result.input));

// 이름이 같아도 ID가 다르면 제외하고, 이적은 현재 학교에 배정하되 과거 소속을 남긴다.
const renamed = previous.map((p) => p.personNo === "a" ? { ...p, name: "동명이인", team: "전적고" } : p);
const moved = build(rosters, renamed);
assert.equal(moved.extra.players!.a.batters[0].team, "A고");
assert.equal(moved.extra.players!.a.batters[0].name, "선수a");
assert.deepEqual(moved.input!.reference!.teams[0].transfers, [{ name: "선수a", from: "전적고" }]);
assert.equal(build(rosters, previous.map((p) => p.personNo === "a" ? { ...p, personNo: "different" } : p)).input, null);

// 2028은 반드시 2027 개인 기록만 사용하고, 2026으로 건너뛰지 않는다.
assert.equal(build(rosters, previous, 2028).input, null);
const next = build(rosters, previous.map((p) => ({ ...p, season: 2027 })), 2028);
assert.equal(next.input!.reference!.year, 2027);
assert.equal(next.extra.players!.b.batters[0].season, 2027);
for (const grade of [undefined, "", "3"]) {
  assert.equal(build(rosters, previous.map((p) => p.personNo === "a" ? { ...p, grade } : p)).input, null, "전년 학년 불명·졸업 대상 제외");
}
for (const grade of ["", "4"]) {
  assert.equal(build([roster("A고", [member("a", "A고", grade)]), rosters[1]]).input, null);
}
for (const ps of [
  previous.map((p) => p.personNo === "a" ? { ...p, personNo: undefined } : p),
  [...previous, player("a", "다른고")],
  previous.map((p) => p.personNo === "a" ? { ...p, batting: undefined, pitching: undefined } : p),
]) assert.equal(build(rosters, ps).input, null, "불명 ID·중복 기록·무기록 제외");
assert.equal(build([roster("A고", [member("")]), rosters[1]]).input, null);
assert.equal(build([roster("A고", [member("a"), member("a")]), rosters[1]]).input, null, "명단 내 중복 ID도 추정하지 않음");
assert.equal(build([rosters[0], roster("B고", [member("b", "B고"), member("a", "B고")])]).input, null, "양교에 중복된 ID 제외");
assert.ok(build([rosters[0], roster("B고", [member("b", "B고"), { ...member("a", "B고"), moved_to: "A고" }])]).input, "이적해 나간 옛 학교 항목(moved_to)은 현재 엔트리가 아니라 중복으로 보지 않음");
assert.equal(build([roster("A고", [{ ...member("a"), name: "" }]), rosters[1]]).input, null);
for (const rs of [
  [rosters[0]], [roster("A고", []), rosters[1]], [{ ...rosters[0], error: "failed" }, rosters[1]],
  [...rosters, rosters[0]],
]) assert.equal(build(rs).input, null, "현재 명단이 없거나 수집 실패·중복 학교면 참고 분석 금지");
assert.equal(buildPreviousSeasonAnalysis(2027, "A고", "A고", rosters, previous).input, null);
assert.equal(buildPreviousSeasonAnalysis(2027, "", "B고", rosters, previous).input, null);

// 클럽 접미사 정규화는 학교 식별에만 사용한다. 선수는 항상 고유번호로 식별한다.
assert.ok(buildPreviousSeasonAnalysis(2027, "A BC", "B고", [roster("A BC(U-18)", [member("a", "A BC")]), rosters[1]], previous).input);

// 양교 올해 기록이 모두 없을 때만 진입하며 한 경기·한 타석·한 아웃도 올해 기록을 우선한다.
const game = (date: string, status = "완료"): ScheduleGame => ({
  game_idx: "1", date, status, title: "테스트", time: "10:00", venue: "", round: "",
  away: { name: "A고", score: status === "완료" ? 1 : null, result: status === "완료" ? "승" : "" },
  home: { name: "다른고", score: status === "완료" ? 0 : null, result: status === "완료" ? "패" : "" },
});
assert.ok(needsPreviousSeasonReference("A고", "B고", 2027, [], []));
assert.ok(needsPreviousSeasonReference("A고", "B고", 2027, [game("2026-04-01"), game("2027-04-01", "예정")], previous));
assert.ok(!needsPreviousSeasonReference("A고", "B고", 2027, [game("2027-04-01")], []));
assert.ok(!needsPreviousSeasonReference("A고", "B고", 2027, [], [player("x", "B고", "1", 2027)]));
const onePa = { ...player("x", "A고", "1", 2027), pitching: undefined };
onePa.batting = { ...onePa.batting!, pa: 1, ab: 0 };
assert.ok(!needsPreviousSeasonReference("A고", "B고", 2027, [], [onePa]));
assert.ok(!needsPreviousSeasonReference("A고", "B고", 2027, [], [{ ...player("x", "A고", "1", 2027), batting: undefined, pitching: { ...player("x").pitching!, ip: .1 } }]));
assert.ok(needsPreviousSeasonReference("A고", "B고", 2027, [], [{ ...onePa, batting: { ...onePa.batting!, pa: 0 } }]));
assert.ok(!needsPreviousSeasonReference("A고", "A고", 2027, [], []));

// AI에는 확인된 개인 기록만 보낸다. 졸업생·전체 학교 지표·최근 흐름·참고 문구는 섞지 않는다.
for (const focus of ["overall", "batting", "pitching"] as const) {
  const payload = buildPayload(result.input, { ...result.extra, notes: [{ cat: "overall", text: "졸업스타가 팀을 이끈다" }] }, focus);
  assert.deepEqual(Object.keys(payload).sort(), ["시즌", "학교", "관점", "참고기준", "주요선수"].sort());
  assert.equal(payload.참고기준!.개인기록연도, 2026);
  assert.equal(payload.참고기준!.분석대상연도, 2027);
  const raw = JSON.stringify(payload);
  for (const name of ["선수grad", "선수absent", "선수rookie", "졸업스타"]) assert.ok(!raw.includes(name));
  const prompt = buildUserPrompt(payload, undefined, focus);
  assert.match(prompt, /첫 항목에 개인기록연도를 명시/);
  assert.match(prompt, /올해 승률·올해 연승·선발 예고는 쓰지 않는다/);
  assert.match(prompt, /확인된 선수가 적으면/);
  assert.ok(!prompt.includes("5항목 이상에"), "소수 인원으로 이름 수를 강제하지 않음");
}
assert.match(SYSTEM_PROMPT, /참고기준/);

// 현재 시즌 정상 분석, 참고 분석, 다른 연도 및 갱신된 명단·기록은 서로 다른 저장 키를 쓴다.
const ref = result.input.reference;
const key = entryKey("A고", "B고", 2027, true, `${ref.year}:${ref.signature}`);
assert.notEqual(key, entryKey("A고", "B고", 2027, true));
assert.notEqual(key, entryKey("A고", "B고", 2028, true, `${ref.year}:${ref.signature}`));
assert.equal(ref.signature, buildPreviousSeasonAnalysis(2027, "B고", "A고", rosters, previous).input!.reference!.signature);
assert.notEqual(ref.signature, build([roster("A고", [...rosters[0].players, member("new")]), rosters[1]]).input!.reference!.signature);
assert.notEqual(ref.signature, build(rosters, previous.map((p) => p.personNo === "a" ? { ...p, batting: { ...p.batting!, hr: 2 } } : p)).input!.reference!.signature);
assert.equal(ref.signature, build([...rosters].reverse(), [...previous].reverse()).input!.reference!.signature);
const currentKey = entryKey("A고", "B고", 2027, true);
const saved: AiEntry = { lines: ["전년도 개인 기록 참고"], provider: "gemini-free", model: "fixture", at: new Date().toISOString(), focus: "overall" };
await saveEntry(key, saved);
assert.equal(await loadEntry(currentKey), null, "올해 정상 분석에서 전년도 참고 결과를 읽지 않음");
await saveEntry(currentKey, { ...saved, lines: ["올해 정상 기록 분석"] });
await saveEntry(key, { ...saved, focus: "batting", lines: ["전년도 타격 참고"] });
assert.deepEqual((await loadEntry(key))?.lines, ["전년도 개인 기록 참고"]);
assert.deepEqual((await loadEntry(key, "batting"))?.lines, ["전년도 타격 참고"]);
assert.deepEqual((await loadEntry(currentKey))?.lines, ["올해 정상 기록 분석"]);

// 실제 과거 자료도 같은 보수적 교집합을 사용한다. 2027 실제 명단인 것처럼 취급하지 않는다.
const D = new URL("../../../data/", import.meta.url);
const realRoster: TeamRosterEntry[] = JSON.parse(readFileSync(new URL("2026/teams.json", D), "utf8"));
const realPrevious: Player[] = JSON.parse(readFileSync(new URL("2025/records/players.json", D), "utf8"));
const historical = buildPreviousSeasonAnalysis(2026, "강릉고", "원주고", realRoster, realPrevious);
assert.ok(historical.input);
for (const [side, team] of [["a", "강릉고"], ["b", "원주고"]] as const) {
  const ids = new Set(realRoster.find((r) => r.team === team)!.players.map((p) => p.person_no));
  for (const p of [...historical.extra.players![side].batters, ...historical.extra.players![side].pitchers]) {
    assert.ok(ids.has(p.personNo!));
    assert.ok(realPrevious.some((old) => old.personNo === p.personNo && ["1", "2"].includes(old.grade ?? "")));
    assert.equal(p.season, 2025);
  }
}
console.log("실자료 교집합", historical.input.reference!.teams.map((t) => `${t.team} ${t.rosterCount}명 중 ${t.matchedCount}명`).join(" · "));
console.log("시즌 초 전년도 참고 분석 테스트 통과 — 2027/2028·졸업 제외·고유번호·이적·자료 부족·현재 기록 우선·저장 분리");
