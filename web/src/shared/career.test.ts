import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateCareerBatting, aggregateCareerBattingAdvanced,
  aggregateCareerPitching, aggregateCareerPitchingAdvanced,
  type CareerAverages, type CareerSeason,
} from "./career";
import { battingAdvanced, pitchingAdvanced } from "./sabermetrics";
import type { LeagueAverages, LeagueRates, Player } from "./types";

const player = (year: number, batting?: Partial<Player["batting"]>, pitching?: Partial<Player["pitching"]>): CareerSeason => ({
  year,
  player: {
    id: String(year), name: "테스트", team: "테스트고", position: "투수", season: year, gameLog: [],
    batting: batting as Player["batting"], pitching: pitching as Player["pitching"],
  },
});

const seasons = [
  player(2024, { g: 1, pa: 2, ab: 2, h: 1, b2: 0, b3: 0, hr: 0, r: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, sh: 0, sf: 0, ibb: 0, e: 0 }, { g: 1, w: 0, l: 0, sv: 0, ip: 1.2, h: 2, hr: 0, r: 1, er: 1, bb: 1, so: 2, bf: 7, np: 20 }),
  player(2025, { g: 1, pa: 8, ab: 8, h: 1, b2: 0, b3: 0, hr: 0, r: 0, rbi: 0, bb: 0, hbp: 0, so: 0, sb: 0, sh: 0, sf: 0, ibb: 0, e: 0 }, { g: 1, w: 1, l: 0, sv: 0, ip: 2.1, h: 1, hr: 0, r: 2, er: 2, bb: 0, so: 3, bf: 8, np: 25 }),
];

const batting = aggregateCareerBatting(seasons)!;
assert.equal(batting.h, 2);
assert.equal(batting.ab, 10);
assert.equal(batting.avg, 0.2, "통산 타율은 2/10으로 재계산해야 함");

const pitching = aggregateCareerPitching(seasons)!;
assert.equal(pitching.ip, 4.0, "1.2이닝 + 2.1이닝은 4.0이닝");
assert.equal(pitching.era, 6.75, "3자책 × 9 / 4이닝");
assert.equal(pitching.whip, 1, "(3피안타 + 1볼넷) / 4이닝");

console.log("✓ 통산 원자료 합산·비율 재계산 통과");

const rates = (overrides: Partial<LeagueRates>): LeagueRates => ({
  avg: 0.25, obp: 0.35, slg: 0.38, ops: 0.73, iso: 0.13, babip: 0.3,
  bbPct: 0.1, kPct: 0.2, bbK: 0.5, woba: 0.33, rPerPa: 0.14,
  era: 4.5, whip: 1.6, fip: 4.2, k9: 7, bb9: 4, h9: 9, kbb: 1.75,
  pa: 1000, outs: 1500,
  ...overrides,
});
const league = (year: number, overrides: Partial<LeagueRates>): LeagueAverages => ({
  season: year,
  updatedAt: `${year}-12-31T00:00:00.000Z`,
  overall: rates(overrides),
  tournaments: {},
});
const averages: CareerAverages = {
  2024: league(2024, { woba: 0.28, rPerPa: 0.1, era: 3.8 }),
  2025: league(2025, { woba: 0.38, rPerPa: 0.2, era: 5.2 }),
};

const careerBatAdvanced = aggregateCareerBattingAdvanced(seasons, averages)!;
assert.ok(Math.abs(careerBatAdvanced.woba - 0.178) < 1e-12, "통산 wOBA는 고정 가중치로 2×0.89/10 재계산");

const seasonBatAdvanced = seasons.map((season) =>
  battingAdvanced(season.player.batting!, averages[season.year]!.overall)
);
const expectedWar = Number(seasonBatAdvanced.reduce((sum, row) => sum + row.war!, 0).toFixed(1));
assert.equal(careerBatAdvanced.war, expectedWar, "통산 타자 WAR는 시즌 WAR 합");
const expectedWrc = Math.round(
  (seasonBatAdvanced[0].wrcPlus! * 2 + seasonBatAdvanced[1].wrcPlus! * 8) / 10
);
const simpleWrcAverage = Math.round((seasonBatAdvanced[0].wrcPlus! + seasonBatAdvanced[1].wrcPlus!) / 2);
assert.equal(careerBatAdvanced.wrcPlus, expectedWrc, "통산 wRC+는 시즌 PA 가중평균");
assert.notEqual(expectedWrc, simpleWrcAverage, "테스트 표본은 시즌 단순 평균과 달라야 함");

const only2024: CareerAverages = { 2024: averages[2024], 2025: null };
const fallbackBat = aggregateCareerBattingAdvanced(seasons, only2024)!;
assert.equal(fallbackBat.wrcPlus, seasonBatAdvanced[0].wrcPlus, "평균 결손 연도는 wRC+에서 제외");
assert.equal(fallbackBat.war, seasonBatAdvanced[0].war, "평균 결손 연도는 WAR 합산에서 제외");
const noLeagueBat = aggregateCareerBattingAdvanced(seasons, {})!;
assert.equal(noLeagueBat.wrcPlus, undefined, "전 연도 평균 결손 시 wRC+ 숨김");
assert.equal(noLeagueBat.war, undefined, "전 연도 평균 결손 시 WAR 숨김");

const careerPitAdvanced = aggregateCareerPitchingAdvanced(seasons, averages)!;
const expectedPitchingWar = Number(seasons.reduce((sum, season) =>
  sum + pitchingAdvanced(season.player.pitching!, averages[season.year]!.overall).war!, 0
).toFixed(1));
assert.equal(careerPitAdvanced.war, expectedPitchingWar, "통산 투수 WAR는 시즌 WAR 합");
assert.equal(careerPitAdvanced.fip, undefined, "통산 FIP는 기준 상수 문제로 제외");
console.log("✓ 통산 wOBA·시즌 WAR 합·PA 가중 wRC+·averages 결손 폴백 통과");

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data");
const careerIndex = JSON.parse(fs.readFileSync(path.join(dataDir, "career-index.json"), "utf8")) as Record<string, Record<string, string>>;
const ids = careerIndex["202001000181"];
const realSeasons = Object.entries(ids).map(([year, id]) => ({
  year: Number(year),
  player: JSON.parse(fs.readFileSync(path.join(dataDir, year, "players", `${id}.json`), "utf8")) as Player,
}));
const realBatting = aggregateCareerBatting(realSeasons)!;
assert.equal(realBatting.h, 59);
assert.equal(realBatting.ab, 197);
assert.equal(realBatting.avg, 0.299, "권민수 통산 타율은 59/197=.299");
console.log("✓ 실제 3시즌 선수 통산 검증: 권민수 59/197 = .299");
