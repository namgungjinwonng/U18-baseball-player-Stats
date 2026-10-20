// 학교 대전 경기 분석 문구 규칙(152개)의 선택·중복 방지·조사·안전성을 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { ANALYSIS_RULES, analyzeVersus, type AnalysisGame, type AnalysisInput } from "./versusAnalysis";

// 규칙 수와 id 중복
assert.ok(ANALYSIS_RULES.length >= 150, `규칙 ${ANALYSIS_RULES.length}개`);
assert.equal(new Set(ANALYSIS_RULES.map((r) => r.id)).size, ANALYSIS_RULES.length, "규칙 id 중복");

const lg = { avg: 0.265, obp: 0.379, ops: 0.743, era: 4.95, whip: 1.71, k9: 8.31, bb9: 6.48, iso: 0.1, babip: 0.338, kPct: 0.198, bbPct: 0.112, h9: 8.91 };
const game = (date: string, me: number, opp: number): AnalysisGame => ({
  date, status: "완료", me, opp, outcome: me > opp ? "승" : me < opp ? "패" : "무",
});

// 1) A가 거의 모든 지표에서 앞서는 경우 — 전체 구도 문구가 맨 앞
const dominant: AnalysisInput = {
  aName: "충암고",
  bName: "광주제일고",
  metrics: {
    pct: { a: 0.882, b: 0.4 }, avg: { a: 0.32, b: 0.24 }, obp: { a: 0.43, b: 0.33 }, ops: { a: 0.9, b: 0.62 },
    hr: { a: 9, b: 2 }, sb: { a: 60, b: 30 }, era: { a: 1.9, b: 4.8 }, whip: { a: 1.02, b: 1.6 },
    k9: { a: 10.5, b: 7 }, bb9: { a: 3.1, b: 5.6 }, sbat: { a: 1.2, b: 0.9 }, spit: { a: 1.25, b: 0.92 },
  },
  recA: { w: 15, l: 2, d: 0, rf: 140, ra: 40 },
  recB: { w: 6, l: 9, d: 0, rf: 70, ra: 90 },
  h2h: { w: 2, l: 0, d: 0, rf: 15, ra: 4, games: [game("2026-04-01", 7, 2), game("2026-06-01", 8, 2)] },
  lg,
};
const d = analyzeVersus(dominant);
assert.equal(d[0].id, "O1", "전 항목 우위");
assert.match(d[0].text, /^충암고가 /, "받침 없는 '고' 뒤에는 '가'");
assert.ok(d.some((l) => l.id === "H3"), "맞대결 전승");
assert.ok(d.length <= 6);
assert.equal(new Set(d.map((l) => l.cat)).size, d.length, "분류당 한 줄");

// 2) 대비 구도: A는 ERA가 좋지만 WHIP는 나쁨 → 위기관리 문구, 맞대결은 B 우세인데 지표는 A 우위
const contrast: AnalysisInput = {
  aName: "서울HK야구단",
  bName: "명지BC",
  metrics: {
    pct: { a: 0.6, b: 0.62 }, avg: { a: 0.28, b: 0.27 }, obp: { a: 0.38, b: 0.37 }, ops: { a: 0.8, b: 0.7 },
    hr: { a: 5, b: 4 }, sb: { a: 20, b: 19 }, era: { a: 3.0, b: 4.2 }, whip: { a: 1.5, b: 1.3 },
    k9: { a: 8, b: 8.1 }, bb9: { a: 5, b: 5.05 },
  },
  recA: { w: 6, l: 4, d: 0, rf: 60, ra: 50 },
  recB: { w: 6, l: 4, d: 0, rf: 55, ra: 52 },
  h2h: { w: 0, l: 1, d: 0, rf: 3, ra: 4, games: [game("2026-05-02", 3, 4)] },
  lg,
};
const c = analyzeVersus(contrast);
const ids = c.map((l) => l.id);
assert.ok(ids.includes("P4"), `위기관리(P4) 기대 — ${ids.join(",")}`);
assert.ok(ids.includes("H8"), "맞대결과 지표 우세 팀이 다름");
assert.match(c.find((l) => l.id === "P4")!.text, /^서울HK야구단은 /, "받침 있는 '단' 뒤에는 '은'");
// 같은 지표를 두 줄에서 반복하지 않는다 — ERA 언급은 한 줄만
assert.ok(c.filter((l) => /ERA/.test(l.text)).length <= 1, "ERA 중복");

// 3) 맞대결 없음, 표본 적음
const thin: AnalysisInput = {
  aName: "A고", bName: "B고",
  metrics: { pct: { a: 0.5, b: 0.5 }, avg: { a: 0.25, b: 0.25 } },
  recA: { w: 1, l: 1, d: 0, rf: 8, ra: 9 }, recB: { w: 3, l: 3, d: 0, rf: 30, ra: 30 },
  h2h: { w: 0, l: 0, d: 0, rf: 0, ra: 0, games: [] },
  lg,
};
const t = analyzeVersus(thin);
assert.ok(t.some((l) => l.id === "H1"), "맞대결 없음");
assert.equal(t[t.length - 1].id, "X1", "표본 경고는 맨 뒤");

const sg = (date: string, rf: number, ra: number) => ({ date, rf, ra, outcome: (rf > ra ? "승" : rf < ra ? "패" : "무") as "승" | "패" | "무" });

// 4) 무작위 입력 2,000건 — 빈 값이 문구에 새지 않고, 분류당 한 줄, 다양한 규칙이 실제로 쓰인다
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const fired = new Set<string>();
for (let i = 0; i < 2000; i++) {
  const maybe = (v: number) => (rnd() < 0.08 ? undefined : v);
  const pair = (lo: number, hi: number, round = 3) => ({
    a: maybe(Number(between(lo, hi).toFixed(round))),
    b: rnd() < 0.15 ? undefined : Number(between(lo, hi).toFixed(round)),
  });
  const gA = Math.floor(between(1, 30)), gB = Math.floor(between(1, 30));
  const wA = Math.floor(between(0, gA + 1)), wB = Math.floor(between(0, gB + 1));
  const n = Math.floor(between(0, 5));
  const games: AnalysisGame[] = Array.from({ length: n }, (_, k) =>
    ({ ...game(`${2024 + (k % 3)}-0${k + 3}-1${k}`, Math.floor(between(0, 15)), Math.floor(between(0, 15))), title: rnd() < 0.6 ? "고교야구 주말리그 전반기" : "청룡기 전국고교야구선수권대회" })
  );
  if (rnd() < 0.2) games.push({ date: "2026-11-01", status: "예정", me: null, opp: null, outcome: null });
  const done = games.filter((g) => g.outcome);
  const input: AnalysisInput = {
    aName: rnd() < 0.5 ? "강릉고" : "순천효천고BC",
    bName: rnd() < 0.5 ? "상동고" : "서울컨벤션고",
    metrics: {
      pct: pair(0, 1), avg: pair(0.18, 0.34), obp: pair(0.28, 0.48), ops: pair(0.5, 1.0),
      hr: { a: Math.floor(between(0, 12)), b: Math.floor(between(0, 12)) },
      sb: { a: Math.floor(between(0, 80)), b: Math.floor(between(0, 80)) },
      era: pair(1, 9, 2), whip: pair(0.9, 2.4, 2), k9: pair(4, 13, 1), bb9: pair(2, 9, 1),
      sbat: pair(0.8, 1.25, 2), spit: pair(0.8, 1.25, 2),
    },
    recA: { w: wA, l: gA - wA, d: 0, rf: Math.floor(between(gA, gA * 10)), ra: Math.floor(between(gA, gA * 10)) },
    recB: { w: wB, l: gB - wB, d: 0, rf: Math.floor(between(gB, gB * 10)), ra: Math.floor(between(gB, gB * 10)) },
    h2h: {
      w: done.filter((g) => g.outcome === "승").length,
      l: done.filter((g) => g.outcome === "패").length,
      d: done.filter((g) => g.outcome === "무").length,
      rf: done.reduce((s, g) => s + g.me!, 0),
      ra: done.reduce((s, g) => s + g.opp!, 0),
      games,
    },
    allYears: rnd() < 0.2,
    lg: rnd() < 0.9 ? lg : null,
    year: 2026,
    extra: {
      a: rnd() < 0.9 ? { kPct: between(0.1, 0.3), bbPct: between(0.06, 0.18), iso: between(0.04, 0.2), babip: between(0.26, 0.42), bbK: between(0.3, 1.4), h9: between(5, 12), unearned: between(0, 0.5), kbbP: between(0.8, 4) } : null,
      b: rnd() < 0.9 ? { kPct: between(0.1, 0.3), bbPct: between(0.06, 0.18), iso: between(0.04, 0.2), babip: between(0.26, 0.42), bbK: between(0.3, 1.4), h9: between(5, 12), unearned: between(0, 0.5), kbbP: between(0.8, 4) } : null,
    },
    seasonA: Array.from({ length: gA }, (_, k) => sg(`2026-${String(3 + Math.floor(k / 4)).padStart(2, "0")}-${String(1 + (k % 4) * 7).padStart(2, "0")}`, Math.floor(between(0, 14)), Math.floor(between(0, 14)))),
    seasonB: Array.from({ length: gB }, (_, k) => sg(`2026-${String(3 + Math.floor(k / 4)).padStart(2, "0")}-${String(1 + (k % 4) * 7).padStart(2, "0")}`, Math.floor(between(0, 14)), Math.floor(between(0, 14)))),
  };
  const lines = analyzeVersus(input);
  for (const l of lines) {
    assert.ok(!/undefined|NaN|null|Infinity/.test(l.text), `${l.id}: ${l.text}`);
    fired.add(l.id);
  }
  assert.equal(new Set(lines.map((l) => l.cat)).size, lines.length, "분류당 한 줄");
  assert.ok(lines.length <= 7);
}
// 5) 확장 규칙: 최근 흐름·맞대결 시즌 흐름·팀 색깔
const formCase: AnalysisInput = {
  aName: "덕수고", bName: "배재고",
  metrics: { pct: { a: 0.7, b: 0.69 }, ops: { a: 0.75, b: 0.74 } },
  recA: { w: 7, l: 3, d: 0, rf: 60, ra: 40 }, recB: { w: 7, l: 3, d: 0, rf: 58, ra: 41 },
  seasonA: [sg("2026-03-01", 2, 5), sg("2026-03-08", 1, 4), sg("2026-03-15", 3, 6), sg("2026-04-01", 5, 2), sg("2026-04-08", 6, 1), sg("2026-04-15", 7, 2), sg("2026-04-22", 4, 3), sg("2026-04-29", 9, 1)],
  seasonB: [sg("2026-03-01", 5, 2), sg("2026-03-08", 4, 1), sg("2026-03-15", 6, 3), sg("2026-04-01", 2, 5), sg("2026-04-08", 1, 6), sg("2026-04-15", 2, 7), sg("2026-04-22", 3, 4), sg("2026-04-29", 1, 9)],
  h2h: { w: 1, l: 2, d: 0, rf: 10, ra: 12, games: [
    { ...game("2024-05-01", 1, 4), title: "2024 고교야구 주말리그 전반기(서울권)" },
    { ...game("2025-05-01", 2, 5), title: "2025 고교야구 주말리그 전반기(서울권)" },
    { ...game("2026-05-01", 7, 3), title: "제81회 청룡기 전국고교야구선수권대회" },
  ] },
  year: 2026, lg,
};
const f = analyzeVersus(formCase);
const fids = f.map((l) => l.id);
assert.ok(fids.includes("Y4"), `지난 시즌과 올해 맞대결 승자가 바뀜 — ${fids.join(",")}`);
assert.ok(f.some((l) => l.cat === "form"), "최근 흐름 문구");
// 표현은 변형 중 하나지만 이번에 앞선 쪽(덕수고)과 연도는 반드시 들어간다
assert.match(f.find((l) => l.id === "Y4")!.text, /덕수고/);
assert.match(f.find((l) => l.id === "Y4")!.text, /2026년/);
assert.ok(!fids.includes("D3"), "같은 '최근 결과 뒤집힘'은 Y4 한 줄만");

// 같은 대진은 항상 같은 문장 (표현 변형은 학교 이름으로 고정 선택)
assert.deepEqual(analyzeVersus(formCase).map((l) => l.text), f.map((l) => l.text));

console.log(`versusAnalysis tests passed (규칙 ${ANALYSIS_RULES.length}개, 무작위 2,000건에서 ${fired.size}개 규칙 사용)`);
