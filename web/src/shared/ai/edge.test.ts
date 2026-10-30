// 기록 기반 예상 우위 — 비율 구간·조정 범위·AI 응답 검사, 그리고 2024~2026 공식경기로 다시 계산한 검증 수치가 상수와 맞는지
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ScheduleGame, TeamStrength } from "../types";
import { teamKey } from "../versus";
import { EDGE_BANDS, checkEdgeLines, edgeBand, edgeLabel, edgePayload, edgeProb, parseEdgeLabel, perspectiveLabel } from "./edge";
import { buildPayload, buildUserPrompt, parseAnswer, systemPrompt } from "./prompt";

const s = (bat: number, pit: number, g = 30): TeamStrength => ({ bat, pit, g });
// 같은 전력이면 5:5, 대칭
assert.equal(edgeProb(s(1, 1), s(1, 1)), 0.5);
assert.ok(Math.abs(edgeProb(s(1.2, 1.1), s(0.9, 0.9)) + edgeProb(s(0.9, 0.9), s(1.2, 1.1)) - 1) < 1e-12);
assert.equal(edgeBand(0.53).label, "5:5");
assert.equal(edgeBand(0.4).label, "6:4", "B 우위도 같은 구간");
assert.equal(edgeBand(0.7).label, "7:3");
assert.equal(edgeBand(0.99).label, "8:2 이상");
assert.equal(edgeLabel(0, "강릉고", "원주고"), "동등 5:5");
assert.equal(edgeLabel(-1, "강릉고", "원주고"), "원주고 우위 6:4");
assert.equal(edgeLabel(3, "강릉고", "원주고"), "강릉고 우위 8:2 이상");
assert.equal(parseEdgeLabel("원주고 우위 6:4", "강릉고"), -1);
assert.equal(parseEdgeLabel("강릉고 우위 8:2 이상", "강릉고"), 3);
assert.equal(parseEdgeLabel("동등 5:5", "강릉고"), 0);

// 프롬프트 자료 — 기준 비율과 한 구간 조정 범위. 강도지수가 없으면 비율을 만들지 않는다.
const teams = { 강릉고: s(1.22, 1.145), 원주고: s(0.908, 0.91, 16), 신생고: s(1.0, 1.0, 4), 비슷고: s(1.21, 1.15) };
const ab = edgePayload(teams, "강릉고", "원주고")!;
assert.equal(ab.결과, "강릉고 우위 8:2 이상");
assert.equal(ab.조정범위, "강릉고 우위 7:3 ~ 강릉고 우위 8:2 이상");
assert.equal(edgePayload(teams, "원주고", "강릉고")!.결과, "강릉고 우위 8:2 이상", "학교 순서와 무관");
const even = edgePayload(teams, "강릉고", "비슷고")!;
assert.equal(even.결과, "동등 5:5");
assert.equal(even.조정범위, "비슷고 우위 6:4 ~ 강릉고 우위 6:4");
assert.equal(edgePayload(teams, "강릉고", "없는고"), null);
assert.ok(edgePayload(teams, "강릉고", "신생고")!.표본주의?.includes("신생고"), "10경기 미만 학교는 표본 주의");

// AI 응답 검사 — 기준(강릉고 7:3 = +2)에서 한 구간 안만 남기고, 점수는 비율로 보지 않는다.
const lines = [
  "기록 기반 예상 우위는 강릉고 우위 7:3이다. AI 판단은 강릉고 6:4로, 원주고의 최근 흐름이 격차를 줄인다.",
  "원주고는 맞대결에서 5:3으로 이긴 적이 있다.",
  "원주고 우위 6:4로 본다.",
  "강릉고 9:1 우위다.",
  "마운드 차이가 결정적이다.",
];
const checked = checkEdgeLines(lines, "강릉고", "원주고", 2);
assert.deepEqual(checked.kept, [lines[0], lines[1], lines[4]]);
assert.deepEqual(checked.dropped, [lines[2], lines[3]], "두 구간 이상 벗어나거나 정해진 표기가 아닌 비율은 버린다");
assert.equal(checked.adjusted, "강릉고 우위 6:4");
assert.equal(checkEdgeLines([lines[0].split(" AI")[0]], "강릉고", "원주고", 2).adjusted, undefined, "기준만 쓰면 조정 없음");
assert.equal(checkEdgeLines(["학교 이름 없이 6:4 우위로 본다."], "강릉고", "원주고", 2).adjusted, "강릉고 우위 6:4", "이름이 없으면 기준과 같은 쪽");

// 프롬프트 — 모든 방향에 예상우위, 규칙 문구. parseAnswer 가 기준·AI 판단 비율을 낸다.
const input = { aName: "강릉고", bName: "원주고", year: 2026, allYears: false, metrics: {} };
const extra = { edge: edgePayload({ 강릉고: s(1.06, 1.03), 원주고: s(1.0, 0.975) }, "강릉고", "원주고") }; // 전력비 1.12 → 70%
for (const f of ["overall", "batting", "pitching", "h2h"] as const) assert.ok(buildPayload(input, extra, f).예상우위, f);
const payload = buildPayload(input, extra, "overall");
assert.equal(payload.예상우위!.결과, "강릉고 우위 7:3");
assert.ok(buildUserPrompt(payload).includes("기록 기반 예상 우위는 강릉고 우위 7:3"));
assert.ok(systemPrompt().includes("조정범위") && systemPrompt().includes("승리 확률(%)"));
assert.ok(!buildUserPrompt(buildPayload(input, {}, "overall")).includes("예상우위 규칙"));
const answer = JSON.stringify({ lines: [
  "기록 기반 예상 우위는 강릉고 우위 7:3이다. AI 판단은 강릉고 8:2로 본다.",
  "강릉고 타선이 앞선다.", "원주고 마운드가 버텨야 한다.", "원주고 우위 7:3이다.", "변수는 수비다.",
] });
const parsed = parseAnswer(answer, payload);
assert.deepEqual(parsed.edge, { base: "강릉고 우위 7:3", adjusted: "강릉고 우위 8:2 이상" });
assert.equal(parsed.lines.length, 4);
assert.ok(parsed.dropped.includes("원주고 우위 7:3이다."));
assert.equal(parseAnswer(answer, buildPayload(input, {}, "overall")).edge, undefined, "예상우위가 없으면 비율 검사·표시 없음");

// AWAY·HOME 기준 — 우리팀 쪽에서 읽은 비율을 붙이고, 「우리팀」「상대팀」으로 쓴 비율도 어느 쪽 우위인지 정확히 본다.
assert.ok(!("우리팀기준" in ab), "양팀 비교용 예상우위는 중립");
assert.equal(buildPayload(input, extra, "overall", "away").예상우위!.우리팀기준, "우리팀 우위 7:3");
assert.equal(buildPayload(input, extra, "overall", "home").예상우위!.우리팀기준, "상대팀 우위 7:3", "HOME 원주고가 우리팀이면 상대팀 우위");
assert.equal(buildPayload(input, extra, "overall").예상우위!.우리팀기준, undefined);
const alias = checkEdgeLines(["AI 판단은 우리팀 6:4로 본다.", "상대팀 우위 6:4로 본다."], "강릉고", "원주고", 2, "a");
assert.deepEqual(alias.kept, ["AI 판단은 우리팀 6:4로 본다."]);
assert.equal(alias.adjusted, "강릉고 우위 6:4");
assert.deepEqual(alias.dropped, ["상대팀 우위 6:4로 본다."], "기준(우리팀 7:3)에서 두 구간 넘게 벗어남");
const homeAlias = checkEdgeLines(["상대팀 우위 6:4로 본다.", "우리팀 우위 6:4로 본다."], "강릉고", "원주고", 2, "b");
assert.deepEqual(homeAlias.kept, ["상대팀 우위 6:4로 본다."], "HOME 기준에서 상대팀 = AWAY 강릉고");
assert.equal(homeAlias.adjusted, "강릉고 우위 6:4");
const homeParsed = parseAnswer(JSON.stringify({ lines: ["기록 기반 예상 우위는 강릉고 우위 7:3이다. AI 판단은 상대팀 6:4로 본다.", "원주고 마운드가 버텨야 한다.", "변수는 수비다."] }), buildPayload(input, extra, "overall", "home"));
assert.deepEqual(homeParsed.edge, { base: "강릉고 우위 7:3", adjusted: "강릉고 우위 6:4" });
assert.equal(perspectiveLabel("강릉고 우위 7:3", "강릉고", "원주고"), "우리팀 강릉고 우위 7:3");
assert.equal(perspectiveLabel("원주고 우위 6:4", "강릉고", "원주고"), "상대팀 원주고 우위 6:4");
assert.equal(perspectiveLabel("동등 5:5", "강릉고", "원주고"), "동등 5:5");
const view = buildPayload(input, extra, "batting", "away");
assert.deepEqual(view.관점, { 우리팀: "강릉고", 상대팀: "원주고" }, "모든 방향에 관점");
assert.ok(systemPrompt("away").includes("우리팀") && buildUserPrompt(view, undefined, "batting", "away").includes("경계할 상대 타자"));

// 검증 수치 — 현재 자료(2024~2026 공식경기)로 다시 계산해 상수와 크게 다르면 실패한다(시즌 중 자료가 늘어도 견디도록 허용 폭을 둔다).
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(dataDir, p), "utf8"));
const tally = EDGE_BANDS.map(() => ({ n: 0, fav: 0 }));
let awayWins = 0, total = 0;
for (const y of [2024, 2025, 2026]) {
  const st = new Map(Object.entries(read<{ teams: Record<string, TeamStrength> }>(`${y}/strength.json`).teams).map(([k, v]) => [teamKey(k), v]));
  for (const g of read<{ games: ScheduleGame[] }>(`${y}/schedule.json`).games) {
    const a = st.get(teamKey(g.away.name)), b = st.get(teamKey(g.home.name));
    if (g.status !== "완료" || !a || !b || g.away.score == null || g.home.score == null || g.away.score === g.home.score) continue;
    const p = edgeProb(a, b), win = g.away.score > g.home.score;
    const t = tally[EDGE_BANDS.indexOf(edgeBand(p))];
    t.n++;
    if ((p >= 0.5) === win) t.fav++;
    total++;
    if (win) awayWins++;
  }
}
EDGE_BANDS.forEach((band, i) => {
  const rate = tally[i].fav / tally[i].n;
  assert.ok(Math.abs(rate - band.favWin) < 0.04, `${band.label} 우위 쪽 실제 승률 ${rate.toFixed(3)} (상수 ${band.favWin})`);
});
assert.ok(Math.abs(awayWins / total - 0.497) < 0.02, "선공/후공 승률 차이 없음 — 비율에 반영하지 않는 근거");
console.log(`예상 우위 비율·조정 범위·응답 검사·검증 수치 테스트 통과 (${total}경기: ${EDGE_BANDS.map((b, i) => `${b.label} ${(tally[i].fav / tally[i].n * 100).toFixed(1)}%`).join(" · ")})`);
