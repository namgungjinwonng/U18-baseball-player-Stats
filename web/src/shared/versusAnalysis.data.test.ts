// 실제 시즌 데이터(전 학교쌍)로 경기 분석의 조건 충족률·노출률·분야 쏠림·중복·속도를 측정하고 기준을 검증하는 테스트.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAnalysisInput } from "./analysisInput";
import { ANALYSIS_RULES, analyzeVersus, probeRules } from "./versusAnalysis";
import { teamKey, teamRecord } from "./versus";
import type { Player, ScheduleGame } from "./types";

const D = new URL("../../../data/", import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, D), "utf8"));
const YEAR = 2026;
const years: number[] = read("years.json");
const allGames: ScheduleGame[] = years.flatMap((y) => read(`${y}/schedule.json`).games);
const season: ScheduleGame[] = read(`${YEAR}/schedule.json`).games;
const records: Player[] = (read(`${YEAR}/records/players.json`) as Player[]).filter((p) => p.name && p.name !== "()" && (p as { number?: string }).number);
const strength = read(`${YEAR}/strength.json`).teams;
const lg = read(`${YEAR}/averages.json`).overall;

// 5경기 이상 치른 학교의 모든 대진 중 3쌍마다 1쌍 (실행 시간 절약)
const teams = [...new Set(season.flatMap((g) => [teamKey(g.away.name), teamKey(g.home.name)]))]
  .filter((t) => { const r = teamRecord(season, t); return r.w + r.l + r.d >= 5; }).sort();
const pairs: [string, string][] = [];
for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) if ((i + j) % 3 === 0) pairs.push([teams[i], teams[j]]);

const fired = new Map<string, number>(), shown = new Map<string, number>(), famShown = new Map<string, number>();
let lines = 0, tEngine = 0, aOnly = 0, bOnly = 0;
for (const [a, b] of pairs) {
  const input = buildAnalysisInput({ a, b, seasonGames: season, h2hGames: allGames, records, strength, lg, year: YEAR, allYears: true });
  for (const p of probeRules(input)) if (p.fired) fired.set(p.id, (fired.get(p.id) ?? 0) + 1);
  const t0 = performance.now();
  const out = analyzeVersus(input);
  tEngine += performance.now() - t0;
  const body = out.filter((l) => l.cat !== "sample");
  const keys = body.flatMap((l) => l.claims ?? []);
  assert.equal(new Set(keys).size, keys.length, `${a} vs ${b}: 같은 주장 중복`);
  assert.ok(body.length >= 4 && body.length <= 6, `${a} vs ${b}: ${body.length}줄`);
  lines += body.length;
  const sides = new Set(body.filter((l) => l.cat !== "overall").map((l) => l.side));
  if (sides.has("a") && !sides.has("b")) aOnly++;
  if (sides.has("b") && !sides.has("a")) bOnly++;
  for (const l of body) {
    shown.set(l.id, (shown.get(l.id) ?? 0) + 1);
    famShown.set(l.cat, (famShown.get(l.cat) ?? 0) + 1);
  }
}
const N = pairs.length;
const ids = ANALYSIS_RULES.map((r) => r.id);
const firedOften = ids.filter((id) => (fired.get(id) ?? 0) / N >= 0.05);
const hidden = firedOften.filter((id) => !shown.get(id));
const topCat = [...famShown].filter(([c]) => c !== "overall").sort((x, y) => y[1] - x[1])[0];

// 기준: 자주 맞는 규칙은 대부분 실제로 보이고(같은 주장이 이미 나와 빠지는 규칙만 예외), 한 분류로 쏠리지 않으며, 빠르다.
assert.ok(hidden.length <= 12, `충족 5% 이상인데 미노출: ${hidden.join(",")}`);
assert.ok(topCat[1] / N <= 0.7, `분류 쏠림 ${topCat[0]} ${(topCat[1] / N * 100).toFixed(0)}%`);
assert.ok(shown.size >= 150, `노출된 규칙 ${shown.size}개`);
assert.ok(tEngine / N < 2, `엔진 평균 ${(tEngine / N).toFixed(2)}ms`);
assert.ok((aOnly + bOnly) / N <= 0.35, `한쪽 학교 이야기만 나온 대진 ${aOnly + bOnly}/${N}`);

console.log(
  `versusAnalysis data tests passed (${YEAR} 대진 ${N}개 · 조건 충족 규칙 ${fired.size}/${ids.length} · 노출 규칙 ${shown.size} · ` +
  `대진당 ${(lines / N).toFixed(2)}줄 · 최다 분류 ${topCat[0]} ${(topCat[1] / N * 100).toFixed(0)}% · 엔진 ${(tEngine / N).toFixed(2)}ms · ` +
  `충족 5%+ 미노출 ${hidden.length}개${hidden.length ? `(${hidden.join(",")})` : ""})`
);
