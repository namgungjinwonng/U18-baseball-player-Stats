// 학교별 규정타석·규정이닝의 하한·상한·학교명 폴백과 안내 문구를 검증한다.
import assert from "node:assert/strict";
import { baseGames, describeQualify, isQualifiedBat, isQualifiedPit, regOuts, regPA, seasonConfig, type QualifyContext } from "./leaders";
import type { Player } from "./types";

const context = (teamGames: Record<string, number>, scope: QualifyContext["scope"] = "season"): QualifyContext => ({
  scope, teamGames, config: seasonConfig(2026),
});
const player = (team: string, pa: number, ip: number, g = 3): Player => ({
  id: "test", name: "테스트", team, position: "투수", season: 2026,
  batting: { g, pa, ab: pa, r: 0, h: 0, b2: 0, b3: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, avg: 0, obp: 0, slg: 0 },
  pitching: { g, ip, w: 0, l: 0, sv: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, era: 0, whip: 0 },
});
const season = context({ 강릉고: 6, 많은고: 35, 적은고: 1, 영경기고: 0 });

// 학교 경기 수를 쓰며 최다 경기 학교의 진행 정도가 다른 학교에 강제되지 않는다.
assert.equal(baseGames(season, "강릉고"), 6);
assert.equal(regPA(season, "강릉고"), 18);
assert.equal(regOuts(season, "강릉고"), 18);
assert.equal(isQualifiedBat(player("강릉고", 18, 6), season), true);
assert.equal(isQualifiedBat(player("강릉고", 17, 6), season), false);
assert.equal(isQualifiedPit(player("강릉고", 18, 6), season), true);
assert.equal(isQualifiedPit(player("강릉고", 18, 5.2), season), false);
assert.equal(baseGames(season, "많은고"), 12);
assert.equal(regPA(season, "많은고"), 37);
assert.equal(regOuts(season, "많은고"), 36);

const lower = context({ 적은고: 1, 많은고: 10 });
assert.equal(baseGames(lower, "적은고"), 3);
assert.equal(regPA(lower, "적은고"), 9);
assert.equal(regOuts(lower, "적은고"), 9);
assert.equal(baseGames(season, "영경기고"), 3, "명시된 0경기는 누락이 아니라 하한 적용");
for (const games of [1, 2]) {
  const opening = context({ 적은고: 0, 많은고: games });
  assert.equal(baseGames(opening, "적은고"), games);
  assert.equal(regPA(opening, "적은고"), Math.floor(games * 3.1));
  assert.equal(regOuts(opening, "적은고"), games * 3);
}

// 누락 학교는 기존 전체 최다 기준으로 계산하며 1~2타석은 통과하지 않는다.
assert.equal(baseGames(season, "없는고"), 12);
assert.equal(regPA(season, "없는고"), 37);
assert.equal(regOuts(season, "없는고"), 36);
assert.equal(regPA(lower, "없는고"), 31);
for (const pa of [1, 2]) assert.equal(isQualifiedBat(player("없는고", pa, 1), season), false);

// 정확한 이름이 우선이며 기존 teamKey와 동일하게 U-18 표기를 정규화한다.
for (const [stored, requested] of [["명지BC(U-18)", "명지BC"], ["명지BC", "명지BC(U-18)"], ["명지BC(U18)", " 명지BC (U-18) "]]) {
  const normalized = context({ [stored]: 6, 많은고: 35 });
  assert.equal(regPA(normalized, requested), 18);
  assert.equal(regOuts(normalized, requested), 18);
}
assert.equal(regPA(context({ 명지BC: 6, "명지BC(U-18)": 10 }), "명지BC"), 18);
assert.equal(regPA(context({ 명지BC: 0, "명지BC(U-18)": 10 }), "명지BC"), 9);

const weekend = context({ 강릉고: 4, 많은고: 10, 적은고: 1 }, "weekend");
assert.equal(baseGames(weekend, "많은고"), 6);
assert.equal(regPA(weekend, "많은고"), 18);
assert.equal(regOuts(weekend, "많은고"), 18);
assert.equal(regPA(weekend, "강릉고"), 12);
assert.equal(regPA(weekend, "적은고"), 9);
assert.equal(regPA(weekend, "없는고"), 18);

// 전국대회는 학교별 대회 경기 수, 최소 3경기·12타석 및 정확한 학교명 조회를 그대로 유지한다.
const national = context({ 강릉고: 2, 많은고: 5, "명지BC(U-18)": 4 }, "national");
assert.equal(baseGames(national, "강릉고"), 2);
assert.equal(regPA(national, "많은고"), 15);
assert.equal(regOuts(national, "많은고"), 15);
assert.equal(baseGames(national, "명지BC"), 0);
assert.equal(baseGames(national, "없는고"), 0);
assert.equal(isQualifiedBat(player("강릉고", 11, 2), national), false);
assert.equal(isQualifiedBat(player("강릉고", 12, 2, 2), national), false);
assert.equal(isQualifiedBat(player("강릉고", 12, 2), national), true);
assert.equal(isQualifiedBat(player("많은고", 14, 5), national), false);
assert.equal(isQualifiedPit(player("많은고", 15, 4.2), national), false);
assert.equal(isQualifiedPit(player("많은고", 15, 5, 2), national), false);
assert.equal(isQualifiedPit(player("많은고", 15, 5), national), true);

const emptyTeamGames: Record<string, number>[] = [{}, { 영경기고: 0 }];
for (const scope of ["season", "weekend"] as const) {
  for (const teamGames of emptyTeamGames) {
    const empty = context(teamGames, scope);
    for (const team of ["영경기고", "없는고"]) {
      assert.equal(baseGames(empty, team), 0);
      assert.equal(regPA(empty, team), 0);
      assert.equal(regOuts(empty, team), 0);
      assert.equal(isQualifiedBat(player(team, 0, 0), empty), true);
      assert.equal(isQualifiedPit(player(team, 0, 0), empty), true);
    }
  }
}

assert.equal(describeQualify(season, "batting"), "규정타석 = 학교 경기 수×3.1 (최대 37타석)");
assert.equal(describeQualify(season, "pitching"), "규정이닝 = 학교 경기 수×1.0 (최대 12이닝)");
assert.equal(describeQualify(weekend, "batting"), "규정타석 = 학교 경기 수×3.1 (최대 18타석)");
assert.equal(describeQualify(weekend, "pitching"), "규정이닝 = 학교 경기 수×1.0 (최대 6이닝)");
assert.equal(describeQualify(season, "batting", "강릉고"), "규정타석 18 이상 (강릉고 6경기 기준)");
assert.equal(describeQualify(season, "pitching", "강릉고"), "규정이닝 6 이상 (강릉고 6경기 기준)");
assert.equal(describeQualify(season, "batting", "많은고"), "규정타석 37 이상 (많은고 35경기 · 최대 12경기 기준)");
assert.equal(describeQualify(lower, "batting", "적은고"), "규정타석 9 이상 (적은고 1경기 · 하한 3경기 기준)");
assert.equal(describeQualify(season, "batting", "없는고"), "규정타석 37 이상 (없는고 경기 수 미확인 · 전체 최다 35경기 · 12경기 기준)");
assert.equal(describeQualify(context({}), "pitching", "없는고"), "규정이닝 0 이상 (없는고 경기 수 미확인 · 전체 최다 0경기 · 0경기 기준)");
assert.equal(describeQualify(national, "batting"), "규정타석 = 팀 경기수×3.1 (최소 3경기·12타석)");
// 전국대회 선수 기준 문구: 학교 대회 경기 수로 계산한 규정(최소 12타석)과 최소 출전
assert.equal(describeQualify(national, "batting", "강릉고"), "규정타석 12 이상 · 3경기 이상 출전 (강릉고 대회 2경기 기준)");
assert.equal(describeQualify(national, "batting", "많은고"), "규정타석 15 이상 · 3경기 이상 출전 (많은고 대회 5경기 기준)");
assert.equal(describeQualify(national, "pitching", "많은고"), "규정이닝 5 이상 · 3경기 이상 등판 (많은고 대회 5경기 기준)");
assert.equal(describeQualify(national, "batting", "명지BC(U-18)"), "규정타석 12 이상 · 3경기 이상 출전 (명지BC 대회 4경기 기준)");
assert.equal(describeQualify(national, "pitching"), "규정이닝 = 팀 경기수×1 (최소 3경기)");
assert.equal(describeQualify(season, "batting").replace(/\s*\(.*\)\s*$/, ""), "규정타석 = 학교 경기 수×3.1");

// 시즌 중 전학: 본인 출전 경기 수가 마지막 학교 경기 수보다 많으면 본인 출전 경기 수 기준 (상한 12는 유지)
const transfer = context({ 적은고: 1, 많은고: 35 });
assert.equal(baseGames(transfer, "적은고", 4), 4);
assert.equal(regPA(transfer, "적은고", 4), 12);
assert.equal(isQualifiedBat({ ...player("적은고", 11, 1, 4) }, transfer), false, "4경기 11타석 — 하한 9타석으로 통과하면 안 된다");
assert.equal(isQualifiedBat({ ...player("적은고", 12, 1, 4) }, transfer), true);
assert.equal(regPA(transfer, "적은고", 13), 37);
assert.equal(isQualifiedBat({ ...player("적은고", 17, 1, 13) }, transfer), false, "13경기 17타석");
assert.equal(regOuts(transfer, "적은고", 5), 15);
assert.equal(isQualifiedPit({ ...player("적은고", 0, 4.2, 5) }, transfer), false);
assert.equal(isQualifiedPit({ ...player("적은고", 0, 5, 5) }, transfer), true);
// 전학이 아닌 선수(출전 ≤ 학교 경기 수)는 결과가 바뀌지 않는다
assert.equal(regPA(season, "강릉고", 5), regPA(season, "강릉고"));
assert.equal(describeQualify(transfer, "batting", "적은고", 4), "규정타석 12 이상 (적은고 1경기 · 본인 출전 4경기 기준)");
assert.equal(describeQualify(transfer, "batting", "적은고", 13), "규정타석 37 이상 (적은고 1경기 · 본인 출전 13경기 · 최대 12경기 기준)");
assert.equal(describeQualify(season, "batting", "강릉고", 5), "규정타석 18 이상 (강릉고 6경기 기준)");

// 안내 문구의 학교명에는 (U-18) 표기를 붙이지 않는다
const u18 = context({ "명지BC(U-18)": 2, 많은고: 35 });
assert.equal(describeQualify(u18, "batting", "명지BC(U-18)"), "규정타석 9 이상 (명지BC 2경기 · 하한 3경기 기준)");
assert.equal(describeQualify(u18, "batting", "없는BC(U-18)"), "규정타석 37 이상 (없는BC 경기 수 미확인 · 전체 최다 35경기 · 12경기 기준)");

console.log("leaders tests passed");
