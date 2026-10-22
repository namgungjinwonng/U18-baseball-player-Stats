// 매치업 경기 분석 엔진의 규칙·표현 수, 표현 문구 품질(빈 값·조사·금지 표현), 선택(중복 주장·분류·지표), 대칭성·기준 표기를 검증하는 단위 테스트.
import assert from "node:assert/strict";
import { FAMILY, type Cat } from "./analysis/core";
import { ANALYSIS_RULES, analyzeVersus, probeRules, type AnalysisGame, type AnalysisInput, type AnalysisLine, type SeasonGame } from "./versusAnalysis";

// ── 규칙 수와 id ─────────────────────────────────────────────
assert.ok(ANALYSIS_RULES.length >= 230, `규칙 ${ANALYSIS_RULES.length}개`);
assert.equal(new Set(ANALYSIS_RULES.map((r) => r.id)).size, ANALYSIS_RULES.length, "규칙 id 중복");

const lg = { avg: 0.265, obp: 0.379, ops: 0.743, era: 4.95, whip: 1.71, k9: 8.31, bb9: 6.48, iso: 0.1, babip: 0.338, kPct: 0.198, bbPct: 0.112, h9: 8.91 };
const game = (date: string, me: number, opp: number, title?: string): AnalysisGame => ({
  date, status: "완료", me, opp, outcome: me > opp ? "승" : me < opp ? "패" : "무", title,
});
const sg = (date: string, rf: number, ra: number, opp = "상대고", title = "2026 고교야구 주말리그 전반기(서울권)"): SeasonGame =>
  ({ date, rf, ra, outcome: rf > ra ? "승" : rf < ra ? "패" : "무", opp, title });

// ── 1) 무작위 입력 + 표적 입력으로 모든 규칙의 조건을 한 번 이상 맞추고, 표현 변형 전체를 모은다 ─────────
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
// 받침 없는 학교명 / 받침 있는 학교명 — 조사 검사에 쓴다
const NO_FINAL = ["강릉고", "덕수고"];
const FINAL = ["서울HK야구단", "용인시야구단"];
const NAMES = [...NO_FINAL, ...FINAL];
const titles = ["2026 고교야구 주말리그 전반기(서울권)", "제81회 청룡기 전국고교야구선수권대회 겸 주말리그 왕중왕전", "제54회 봉황대기 전국고교야구대회"];
const randomSeason = (n: number, bias: number): SeasonGame[] =>
  Array.from({ length: n }, (_, k) => {
    const rf = Math.max(0, Math.round(between(0, 12) + bias)), ra = Math.max(0, Math.round(between(0, 12) - bias));
    return sg(`2026-${String(3 + Math.floor(k / 4)).padStart(2, "0")}-${String(1 + (k % 4) * 7).padStart(2, "0")}`, rf, ra, `상대${k % 9}고`, titles[k % 3]);
  });
function randomInput(): AnalysisInput {
  const maybe = (v: number) => (rnd() < 0.08 ? undefined : v);
  const pair = (lo: number, hi: number, round = 3) => ({ a: maybe(Number(between(lo, hi).toFixed(round))), b: rnd() < 0.12 ? undefined : Number(between(lo, hi).toFixed(round)) });
  const gA = int(1, 36), gB = int(1, 36);
  const seasonA = randomSeason(gA, between(-4, 4)), seasonB = randomSeason(gB, between(-4, 4));
  const rec = (s: SeasonGame[]) => ({
    w: s.filter((g) => g.outcome === "승").length, l: s.filter((g) => g.outcome === "패").length, d: s.filter((g) => g.outcome === "무").length,
    rf: s.reduce((t, g) => t + g.rf, 0), ra: s.reduce((t, g) => t + g.ra, 0),
  });
  const n = int(0, 7);
  const games: AnalysisGame[] = Array.from({ length: n }, (_, k) => game(`${2024 + (k % 3)}-0${(k % 6) + 3}-1${k}`, int(0, 14), int(0, 14), rnd() < 0.6 ? titles[0] : titles[2]));
  if (rnd() < 0.2) games.push({ date: "2026-11-01", status: "예정", me: null, opp: null, outcome: null });
  const done = games.filter((g) => g.outcome);
  const r3 = () => { const w = int(0, 4), l = int(0, 4); return { w, l, d: rnd() < 0.1 ? 1 : 0, rf: int(w, 30), ra: int(l, 30) }; };
  const nameA = NAMES[int(0, 3)];
  let nameB = NAMES[int(0, 3)];
  if (nameB === nameA) nameB = NAMES[(NAMES.indexOf(nameA) + 1) % 4];
  const ex = () => (rnd() < 0.9 ? {
    kPct: between(0.1, 0.32), bbPct: between(0.06, 0.2), iso: between(0.03, 0.2), babip: between(0.25, 0.43), bbK: between(0.3, 1.5),
    h9: between(5, 12), unearned: rnd() < 0.85 ? between(0, 0.55) : undefined, kbbP: between(0.7, 4),
  } : null);
  return {
    aName: nameA, bName: nameB,
    metrics: {
      pct: pair(0, 1), avg: pair(0.16, 0.36), obp: pair(0.26, 0.5), ops: pair(0.45, 1.05),
      hr: { a: int(0, 40), b: int(0, 40) }, sb: { a: int(0, 90), b: int(0, 90) },
      era: pair(0.8, 12, 2), whip: pair(0.85, 2.6, 2), k9: pair(4, 13, 1), bb9: pair(2, 9.5, 1),
      sbat: pair(0.8, 1.3, 2), spit: pair(0.8, 1.3, 2),
    },
    recA: rec(seasonA), recB: rec(seasonB),
    h2h: {
      w: done.filter((g) => g.outcome === "승").length, l: done.filter((g) => g.outcome === "패").length, d: done.filter((g) => g.outcome === "무").length,
      rf: done.reduce((s, g) => s + g.me!, 0), ra: done.reduce((s, g) => s + g.opp!, 0), games,
    },
    allYears: rnd() < 0.7,
    lg: rnd() < 0.92 ? lg : null,
    year: 2026,
    extra: { a: ex(), b: ex() },
    seasonA, seasonB,
    common: Array.from({ length: int(0, 10) }, (_, k) => ({ opponent: `공통${k}고`, a: r3(), b: r3() })),
  };
}
// 무작위로 잘 안 맞는 조건을 위한 표적 입력
const fixed: AnalysisInput[] = [];
const base = (over: Partial<AnalysisInput>): AnalysisInput => ({
  aName: "강릉고", bName: "서울HK야구단", metrics: {}, recA: { w: 5, l: 5, d: 0, rf: 50, ra: 50 }, recB: { w: 5, l: 5, d: 0, rf: 50, ra: 50 },
  h2h: { w: 0, l: 0, d: 0, rf: 0, ra: 0, games: [] }, lg, year: 2026, ...over,
});
const same = (v: number) => ({ a: v, b: v * 1.01 });
// 전 지표 3% 이내(O7) / 대부분 같고 일부만 차이(O8)
fixed.push(base({ metrics: { pct: same(0.5), avg: same(0.27), obp: same(0.38), ops: same(0.75), hr: { a: 5, b: 5 }, sb: { a: 20, b: 20 }, era: same(4.5), whip: same(1.6), k9: same(8), bb9: same(6) } }));
fixed.push(base({ metrics: { pct: same(0.5), avg: same(0.27), obp: same(0.38), ops: same(0.75), hr: { a: 5, b: 9 }, sb: { a: 20, b: 20 }, era: same(4.5), whip: same(1.6), k9: same(8), bb9: { a: 4, b: 6 } } }));
// 올 시즌 맞대결 없음(H1) · 무승부 1경기(H5) · 예정 경기(D6)
fixed.push(base({ allYears: false }));
fixed.push(base({ allYears: true, h2h: { w: 0, l: 0, d: 1, rf: 3, ra: 3, games: [game("2026-05-01", 3, 3), { date: "2026-11-03", status: "예정", me: null, opp: null, outcome: null }] } }));
// 무패(R10)·무승부 잦음(G1)·경기당 홈런 1개(T13)·삼진/볼넷 3 이상(Q5)
fixed.push(base({ recA: { w: 6, l: 0, d: 2, rf: 70, ra: 20 }, metrics: { hr: { a: 10, b: 2 } }, extra: { a: { kbbP: 3.5 }, b: { kbbP: 1 } } }));
// 연승(F6)·직전 대승(F10)·최근 10경기 반등(W1)·최근 3경기 큰 승리(W6)·전국대회 무패(ST9)·전국대회 경기 수 차이(ST6)
{
  const nat = titles[2];
  const s: SeasonGame[] = [
    ...Array.from({ length: 10 }, (_, k) => sg(`2026-03-${String(k + 1).padStart(2, "0")}`, 2, 6, "약팀고")),
    ...Array.from({ length: 5 }, (_, k) => sg(`2026-04-${String(k + 1).padStart(2, "0")}`, 4 + k, 3, "중간고", nat)),
    ...Array.from({ length: 3 }, (_, k) => sg(`2026-05-${String(k + 1).padStart(2, "0")}`, 6 + k, 3, "상대고")),
    ...Array.from({ length: 4 }, (_, k) => sg(`2026-06-${String(k + 1).padStart(2, "0")}`, 12, 2, "또다른고")),
  ];
  const b: SeasonGame[] = Array.from({ length: 12 }, (_, k) => sg(`2026-03-${String(k + 1).padStart(2, "0")}`, 5, 5 + (k % 2), "상대고"));
  fixed.push(base({ seasonA: s, seasonB: b }));
  const s2 = [...s.slice(0, -4), ...Array.from({ length: 3 }, (_, k) => sg(`2026-06-1${k}`, 6, 4, "또다른고"))];
  fixed.push(base({ seasonA: s2, seasonB: b }));
}
// 전 지표 우위(O1) · 올해 맞대결 3경기 이상(HS6) · 두 팀 모두 홈런 없음(T6)
fixed.push(base({
  metrics: { pct: { a: 0.8, b: 0.4 }, avg: { a: 0.32, b: 0.24 }, obp: { a: 0.43, b: 0.33 }, ops: { a: 0.9, b: 0.62 }, sb: { a: 60, b: 30 }, era: { a: 1.9, b: 4.8 }, whip: { a: 1.0, b: 1.6 } },
  h2h: { w: 2, l: 1, d: 0, rf: 20, ra: 12, games: [game("2026-04-01", 7, 2), game("2026-06-01", 8, 2), game("2026-07-01", 5, 8)] },
  allYears: true,
}));
fixed.push(base({ metrics: { hr: { a: 0, b: 0 } } }));
// 시즌 초반 강세 → 최근 부진(W9) · 대량 득점 몇 경기로 평균이 부푼 경우(RB4)
{
  const s: SeasonGame[] = [
    ...Array.from({ length: 10 }, (_, k) => sg(`2026-03-${String(k + 1).padStart(2, "0")}`, 7, 2)),
    ...Array.from({ length: 10 }, (_, k) => sg(`2026-05-${String(k + 1).padStart(2, "0")}`, 2, 6)),
  ];
  const big: SeasonGame[] = Array.from({ length: 12 }, (_, k) => sg(`2026-04-${String(k + 1).padStart(2, "0")}`, k < 2 ? 30 : 3, 4));
  fixed.push(base({ seasonA: s, seasonB: big }));
}
// 두 팀 모두 공통 상대에게 무패(CO9)
fixed.push(base({ common: [0, 1, 2].map((k) => ({ opponent: `공통${k}고`, a: { w: 1, l: 0, d: 0, rf: 5, ra: 2 }, b: { w: 1, l: 0, d: 0, rf: 6, ra: 3 } })) }));
// 표본 경고: 한쪽(X1) / 양쪽(X2)
fixed.push(base({ recA: { w: 1, l: 2, d: 0, rf: 10, ra: 12 }, recB: { w: 8, l: 4, d: 0, rf: 80, ra: 50 } }));
fixed.push(base({ recA: { w: 1, l: 2, d: 0, rf: 10, ra: 12 }, recB: { w: 2, l: 1, d: 0, rf: 13, ra: 9 } }));

const fired = new Map<string, number>();
const variants = new Map<string, Set<string>>();
const varCount = new Map<string, number>();
const outputs: { input: AnalysisInput; lines: AnalysisLine[] }[] = [];
const inputs = [...Array.from({ length: 4000 }, randomInput), ...fixed];
for (const input of inputs) {
  for (const p of probeRules(input)) {
    if (!p.fired) continue;
    fired.set(p.id, (fired.get(p.id) ?? 0) + 1);
    const set = variants.get(p.id) ?? new Set<string>();
    p.variants?.forEach((v) => set.add(v));
    variants.set(p.id, set);
    varCount.set(p.id, Math.max(varCount.get(p.id) ?? 0, p.variants?.length ?? 0));
  }
  outputs.push({ input, lines: analyzeVersus(input) });
}
const notFired = ANALYSIS_RULES.map((r) => r.id).filter((id) => !fired.get(id));
assert.deepEqual(notFired, [], `조건을 한 번도 맞추지 못한 규칙: ${notFired.join(",")}`);
const few = [...varCount].filter(([, n]) => n < 4).map(([id, n]) => `${id}(${n})`);
assert.deepEqual(few, [], `표현 4개 미만 규칙: ${few.join(",")}`);
const expressions = [...varCount.values()].reduce((a, b) => a + b, 0);
assert.ok(expressions >= 1000, `표현 ${expressions}개`);

// ── 2) 표현 문구 품질 — 모든 변형(선택되지 않은 것 포함)을 검사 ────────────────
const FORBIDDEN = /운이 따|타구 운|접전 운|컨디션|운용이 승부처|이기는 법을 안다|난타전에 강하다|수비의 도움이 필요|제구만 잡히면|잘 맞은 타구가 잡힌/;
for (const [id, set] of variants) {
  for (const t of set) {
    assert.ok(!/undefined|NaN|null|Infinity|\$\{|\[object/.test(t), `${id}: 빈 값 — ${t}`);
    assert.ok(!FORBIDDEN.test(t), `${id}: 근거 없는 단정 — ${t}`);
    assert.ok(/[.)]$/.test(t), `${id}: 문장 끝 — ${t}`);
    assert.ok(!/ {2}/.test(t), `${id}: 공백 두 칸 — ${t}`);
    for (const n of NO_FINAL) assert.ok(!new RegExp(`${n}(은|이 |을|과|으로|이다|이었다)`).test(t), `${id}: 받침 없는 '${n}' 조사 — ${t}`);
    for (const n of FINAL) assert.ok(!new RegExp(`${n}(는|가 |를|와|로 |다[.( ]|였다)`).test(t), `${id}: 받침 있는 '${n}' 조사 — ${t}`);
  }
}

// ── 3) 선택 — 줄 수, 분류·주장 중복, '압도' 포함 관계, 기준 표기 ─────────────────
const IMPLIED = ["batEdge", "pitEdge", "recordEdge", "runsEdge", "strengthEdge", "power", "speedEdge", "bothEdge"];
for (const { input, lines } of outputs) {
  const body = lines.filter((l) => l.cat !== "sample");
  assert.ok(body.length <= 6 && lines.length <= 7, "최대 6줄 + 표본 경고");
  assert.equal(new Set(body.map((l) => l.cat)).size, body.length, "분류당 한 줄");
  // 같은 지표 이름은 한 줄에서만 (문장에 쓴 지표는 규칙의 uses에 있어야 한다)
  for (const m of ["ERA", "OPS", "WHIP", "K/9", "BB/9", "ISO", "BABIP"]) {
    const n = body.filter((l) => new RegExp(m.replace("/", "\\/") + "(?![A-Za-z])").test(l.text)).length;
    assert.ok(n <= 1, `${m} 언급 ${n}줄 — ${body.filter((l) => l.text.includes(m)).map((l) => l.id).join(",")}`);
  }
  const keys = body.flatMap((l) => l.claims ?? []);
  assert.equal(new Set(keys).size, keys.length, `같은 주장 중복 — ${keys.join(",")}`);
  for (const l of body) {
    for (const k of l.claims ?? []) {
      const [tag, side] = k.split(":");
      if (tag === "dominance") {
        for (const imp of IMPLIED) assert.ok(!keys.includes(`${imp}:${side}`), `압도 + ${imp} 중복 (${body.map((x) => x.id).join(",")})`);
        for (const ev of ["batEven", "pitEven", "recordEven", "balanceEven", "strengthEven"]) assert.ok(!keys.includes(`${ev}:-`), `압도 + ${ev} 모순 (${body.map((x) => x.id).join(",")})`);
      }
    }
    const fam = FAMILY[l.cat as Cat];
    // 맞대결 전적을 말하면 기준(통산/시즌/연도)을 적는다
    if ((fam === "h2h" || fam === "h2hMore") && /\d+승 \d+패|전승/.test(l.text)) {
      assert.ok(/통산|시즌|\d{4}/.test(l.text), `${l.id}: 맞대결 기준 없음 — ${l.text}`);
    }
    // 맞대결과 시즌 평균을 함께 말하면 두 기준을 모두 적는다
    if (l.cat === "h2hScore" && /평균/.test(l.text) && /시즌/.test(l.text)) {
      assert.ok(input.allYears ? /통산/.test(l.text) : true, `${l.id}: 맞대결 기준 없음 — ${l.text}`);
    }
  }
  if (lines.some((l) => l.cat === "sample")) assert.equal(lines[lines.length - 1].cat, "sample", "표본 경고는 맨 뒤");
}

// ── 4) 재현성·A/B 교환 대칭 ─────────────────────────────────
const swap = (x: AnalysisInput): AnalysisInput => ({
  ...x, aName: x.bName, bName: x.aName,
  metrics: Object.fromEntries(Object.entries(x.metrics).map(([k, v]) => [k, { a: v?.b, b: v?.a }])),
  recA: x.recB, recB: x.recA, seasonA: x.seasonB, seasonB: x.seasonA,
  extra: { a: x.extra?.b, b: x.extra?.a },
  h2h: x.h2h && { ...x.h2h, w: x.h2h.l, l: x.h2h.w, rf: x.h2h.ra, ra: x.h2h.rf, games: x.h2h.games.map((g) => ({ ...g, me: g.opp, opp: g.me, outcome: g.outcome === "승" ? "패" : g.outcome === "패" ? "승" : g.outcome })) },
  common: x.common?.map((o) => ({ ...o, a: o.b, b: o.a })),
});
for (const { input, lines } of outputs.slice(0, 800)) {
  assert.deepEqual(analyzeVersus(input).map((l) => l.text), lines.map((l) => l.text), "같은 입력은 같은 결과");
  assert.deepEqual(new Set(analyzeVersus(swap(input)).map((l) => l.id)), new Set(lines.map((l) => l.id)), "A/B 교환 시 같은 규칙");
}

// ── 5) 대표 상황 ─────────────────────────────────────────────
// A가 거의 모든 지표에서 앞서는 경우 — 전체 구도(O1)가 맨 앞, '압도'와 같은 주장(타격·마운드 우위)은 반복하지 않는다
const dominant: AnalysisInput = {
  aName: "충암고", bName: "광주제일고",
  metrics: {
    pct: { a: 0.882, b: 0.4 }, avg: { a: 0.32, b: 0.24 }, obp: { a: 0.43, b: 0.33 }, ops: { a: 0.9, b: 0.62 },
    hr: { a: 9, b: 2 }, sb: { a: 60, b: 30 }, era: { a: 1.9, b: 4.8 }, whip: { a: 1.02, b: 1.6 },
    k9: { a: 10.5, b: 7 }, bb9: { a: 3.1, b: 5.6 }, sbat: { a: 1.2, b: 0.9 }, spit: { a: 1.25, b: 0.92 },
  },
  recA: { w: 15, l: 2, d: 0, rf: 140, ra: 40 }, recB: { w: 6, l: 9, d: 0, rf: 70, ra: 90 },
  h2h: { w: 2, l: 0, d: 0, rf: 15, ra: 4, games: [game("2026-04-01", 7, 2), game("2026-06-01", 8, 2)] },
  allYears: true, lg, year: 2026,
};
const d = analyzeVersus(dominant);
assert.equal(d[0].id, "O1", "전 항목 우위");
assert.match(d[0].text, /충암고/);
assert.ok(d.some((l) => l.id === "H3"), "맞대결 전승");
assert.match(d.find((l) => l.id === "H3")!.text, /통산/, "맞대결 기준 표기");
assert.ok(!d.some((l) => ["B1", "B2", "T1", "P1", "R1", "S1"].includes(l.id)), `압도와 같은 주장 반복 — ${d.map((l) => l.id).join(",")}`);

// 맞대결은 B 우세인데 지표는 A 우위 → 엇갈림(H8)이 맞대결 줄로 나온다
const contrast: AnalysisInput = {
  aName: "서울HK야구단", bName: "명지BC",
  metrics: {
    pct: { a: 0.6, b: 0.62 }, avg: { a: 0.28, b: 0.27 }, obp: { a: 0.38, b: 0.37 }, ops: { a: 0.8, b: 0.7 },
    hr: { a: 5, b: 4 }, sb: { a: 20, b: 19 }, era: { a: 3.0, b: 4.2 }, whip: { a: 1.5, b: 1.3 }, k9: { a: 8, b: 8.1 }, bb9: { a: 5, b: 5.05 },
  },
  recA: { w: 6, l: 4, d: 0, rf: 60, ra: 50 }, recB: { w: 6, l: 4, d: 0, rf: 55, ra: 52 },
  h2h: { w: 0, l: 1, d: 0, rf: 3, ra: 4, games: [game("2026-05-02", 3, 4)] },
  allYears: true, lg, year: 2026,
};
const ct = analyzeVersus(contrast);
assert.ok(ct.some((l) => l.id === "H8"), `맞대결과 지표 우세 팀이 다름 — ${ct.map((l) => l.id).join(",")}`);
assert.ok(ct.filter((l) => /ERA/.test(l.text)).length <= 1, "ERA 언급은 한 줄만");

// 맞대결 없음(올 시즌 기준)·표본 적음
const thin: AnalysisInput = {
  aName: "A고", bName: "B고",
  metrics: { pct: { a: 0.5, b: 0.5 }, avg: { a: 0.25, b: 0.25 } },
  recA: { w: 1, l: 1, d: 0, rf: 8, ra: 9 }, recB: { w: 3, l: 3, d: 0, rf: 30, ra: 30 },
  h2h: { w: 0, l: 0, d: 0, rf: 0, ra: 0, games: [] }, lg, year: 2026,
};
const t = analyzeVersus(thin);
assert.ok(t.some((l) => l.id === "H1"), "맞대결 없음");
assert.match(t.find((l) => l.id === "H1")!.text, /2026 시즌/);
assert.equal(t[t.length - 1].id, "X1", "표본 경고는 맨 뒤");

// 시즌별 맞대결 승자가 바뀜 → '흐름 바뀜'(Y4 또는 D3) 한 줄만
const flip: AnalysisInput = {
  aName: "덕수고", bName: "배재고", metrics: { pct: { a: 0.7, b: 0.69 }, ops: { a: 0.75, b: 0.74 } },
  recA: { w: 7, l: 3, d: 0, rf: 60, ra: 40 }, recB: { w: 7, l: 3, d: 0, rf: 58, ra: 41 },
  h2h: { w: 1, l: 2, d: 0, rf: 10, ra: 12, games: [
    game("2024-05-01", 1, 4, "2024 고교야구 주말리그 전반기(서울권)"),
    game("2025-05-01", 2, 5, "2025 고교야구 주말리그 전반기(서울권)"),
    game("2026-05-01", 7, 3, "제81회 청룡기 전국고교야구선수권대회"),
  ] },
  allYears: true, year: 2026, lg,
};
const fl = analyzeVersus(flip);
assert.ok(fl.filter((l) => l.id === "Y4" || l.id === "D3").length <= 1, "같은 '흐름 바뀜'은 한 줄만");

console.log(`versusAnalysis tests passed (규칙 ${ANALYSIS_RULES.length}개 · 표현 ${expressions}개 · 입력 ${inputs.length}건에서 ${outputs.reduce((s, o) => s + o.lines.length, 0)}줄 검사)`);
