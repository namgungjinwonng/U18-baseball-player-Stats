// 매치업 "경기 분석" 엔진 — 기록 조건에 맞는 규칙을 모아 분야별로 고르게 최대 6줄을 고른다 (외부 호출 없는 순수 함수).
// 규칙은 analysis/rules*.ts, 공통 타입·도우미는 analysis/core.ts. 같은 대진은 항상 같은 결과, A/B 순서와도 무관하다.
import {
  Ctx, FAMILY, RULES, hashOf,
  type AnalysisInput, type AnalysisLine, type Cat, type Family, type Rule, type Side,
} from "./analysis/core";
import "./analysis/rulesH2h";
import "./analysis/rulesTeam";
import "./analysis/rulesResults";
import "./analysis/rulesExtra";

export type { AnalysisGame, AnalysisInput, AnalysisLine, CommonOpp, MetricKey, SeasonGame } from "./analysis/core";

export const ANALYSIS_RULES = RULES.map(({ id, cat }) => ({ id, cat }));

// 표시 순서 — 전체 구도와 맞대결을 먼저, 나머지는 분야 순서대로.
const DISPLAY: Cat[] = [
  "overall", "h2h", "h2hHistory", "h2hDetail", "h2hScore", "common", "form", "window", "key", "cross",
  "identity", "style", "balance", "bat", "contact", "power", "pit", "pitchContact", "pitstyle", "speed",
  "record", "stage", "games", "runs", "robust", "strength", "level", "sample",
];

// 같은 쪽의 '압도' 주장은 그 쪽의 타격·마운드·성적·득실·강도지수 우위 주장을 포함한다.
const IMPLIES: Record<string, string[]> = {
  dominance: ["batEdge", "pitEdge", "recordEdge", "runsEdge", "strengthEdge", "power", "speedEdge", "bothEdge"],
  bothEdge: ["batEdge", "pitEdge"],
};
// 분야 안에서는 최고 중요도에서 WINDOW 이내의 규칙을 중요도 비례 가중치로 대진마다 돌아가며 고른다.
const WINDOW = 25;
// 전체 구도는 순서대로 하나, 맞대결 전적은 '지표와 엇갈림(H8)'이 있으면 그것을 먼저 보인다.
const WINDOWS: Partial<Record<Family, number>> = { overall: 0, h2h: 4 };
const JITTER = 8;

interface Cand {
  r: Rule;
  order: number;
  text: string;
  side: Side | null;
  claims: string[];
}

// '압도' 줄이 있으면 양쪽이 비슷하다는 줄(쪽 없음)도 함께 내지 않는다 — 우세를 말한 뒤 '비슷하다'고 하면 모순으로 읽힌다.
const IMPLIES_EVEN: Record<string, string[]> = {
  dominance: ["batEven", "pitEven", "recordEven", "balanceEven", "strengthEven"],
};
const claimKeys = (r: Rule, side: Side | null) => r.claims.map((t) => `${t}:${side ?? "-"}`);
const blockedBy = (x: Cand) => {
  const keys = new Set(x.claims);
  for (const t of x.r.claims) {
    for (const imp of IMPLIES[t] ?? []) keys.add(`${imp}:${x.side ?? "-"}`);
    for (const imp of IMPLIES_EVEN[t] ?? []) keys.add(`${imp}:-`);
  }
  return keys;
};

function evaluate(input: AnalysisInput, onPick?: Ctx["onPick"]) {
  const c = new Ctx(input);
  c.onPick = onPick;
  const all: (Cand & { fired: boolean })[] = [];
  RULES.forEach((r, order) => {
    c.side = null;
    const text = r.run(c);
    all.push({ r, order, text: text ?? "", side: text ? c.side : null, claims: text ? claimKeys(r, c.side) : [], fired: !!text });
  });
  return { c, all };
}

// 조건이 맞는 규칙 중에서 분야당 한 줄을 우선 고르고(부족하면 2차로 채움), 같은 분류·같은 지표·같은 주장은 반복하지 않는다.
export function analyzeVersus(input: AnalysisInput, max = 6): AnalysisLine[] {
  const { all } = evaluate(input);
  const pairKey = [input.aName, input.bName].sort().join("|");
  const fired = all.filter((x) => x.fired && x.r.cat !== "sample");

  // 분야별 후보 목록: 상위 구간은 대진 해시로 순환, 나머지는 중요도 순
  const byFam = new Map<Family, Cand[]>();
  for (const x of fired) {
    const f = FAMILY[x.r.cat];
    byFam.set(f, [...(byFam.get(f) ?? []), x]);
  }
  const famLists: { fam: Family; list: Cand[]; score: number }[] = [];
  for (const [fam, xs] of byFam) {
    const sorted = [...xs].sort((p, q) => q.r.w - p.r.w || p.order - q.order);
    const top = sorted[0].r.w;
    const window = WINDOWS[fam] ?? WINDOW;
    // 상위 구간 안에서 중요도에 비례한 가중치로 대진마다 하나를 고른다(같은 대진은 항상 같은 선택).
    const pool = sorted.filter((x) => x.r.w >= top - window);
    const weights = pool.map((x) => (window ? x.r.w - (top - window) : 1));
    let k = 0;
    if (pool.length > 1 && window > 0) {
      let t = hashOf(`${pairKey}|${fam}`) % weights.reduce((a, b) => a + b, 0);
      while (t >= weights[k]) t -= weights[k++];
    }
    const first = pool[k];
    // 분야 순서도 대진마다 조금씩 달라지게(±JITTER) 해 같은 분야만 늘 앞서지 않게 한다. 전체 구도는 항상 맨 앞.
    const jitter = fam === "overall" ? 100 : (hashOf(`${pairKey}|order|${fam}`) % (JITTER * 2 + 1)) - JITTER;
    famLists.push({ fam, list: [first, ...sorted.filter((x) => x !== first)], score: first.r.w + jitter });
  }
  famLists.sort((p, q) => q.score - p.score || p.fam.localeCompare(q.fam));

  const picked: Cand[] = [];
  const ok = (x: Cand, against: Cand[]) => {
    if (against.some((p) => p.r.cat === x.r.cat)) return false;
    const usedKeys = new Set(against.flatMap((p) => p.r.uses));
    if (x.r.uses.some((u) => usedKeys.has(u))) return false;
    const blocked = new Set(against.flatMap((p) => [...blockedBy(p)]));
    if (x.claims.some((k) => blocked.has(k))) return false;
    // 반대 방향 포함 관계: 새 줄의 '압도'가 이미 고른 같은 쪽 우위 줄을 포함하면 겹친다
    const mine = blockedBy(x);
    return !against.some((p) => p.claims.some((k) => mine.has(k)));
  };
  // 1차: 분야당 한 줄
  for (const { list } of famLists) {
    if (picked.length >= max) break;
    const x = list.find((y) => ok(y, picked));
    if (x) picked.push(x);
  }
  // 2차: 남은 자리는 중요도 순으로 (분야 중복 허용, 분류·지표·주장 중복은 금지)
  if (picked.length < max) {
    for (const x of [...fired].sort((p, q) => q.r.w - p.r.w || p.order - q.order)) {
      if (picked.length >= max) break;
      if (!picked.includes(x) && ok(x, picked)) picked.push(x);
    }
  }
  // 균형: 한쪽 학교 이야기만 4줄 이상이고 다른 쪽 줄이 없으면, 다른 쪽 줄 하나로 바꿔 넣는다
  const sideCount = (s: Side) => picked.filter((p) => p.side === s && p.r.cat !== "overall").length;
  for (const s of ["a", "b"] as Side[]) {
    const o: Side = s === "a" ? "b" : "a";
    if (sideCount(s) < 4 || sideCount(o) > 0) continue;
    const victims = picked.filter((p) => p.side === s && FAMILY[p.r.cat] !== "overall" && FAMILY[p.r.cat] !== "h2h")
      .sort((p, q) => p.r.w - q.r.w);
    const alt = [...fired].filter((x) => x.side === o && !picked.includes(x)).sort((p, q) => q.r.w - p.r.w);
    let done = false;
    for (const v of victims) {
      const rest = picked.filter((p) => p !== v);
      const x = alt.find((y) => ok(y, rest));
      if (x) {
        picked.splice(picked.indexOf(v), 1, x);
        done = true;
        break;
      }
    }
    if (done) break;
  }
  const lines: AnalysisLine[] = picked.map((x) => ({ id: x.r.id, cat: x.r.cat, text: x.text, side: x.side, claims: x.claims }));
  // 표본 경고는 맨 뒤에 하나
  const sample = all.find((x) => x.fired && x.r.cat === "sample");
  if (sample) lines.push({ id: sample.r.id, cat: "sample", text: sample.text, side: sample.side, claims: [] });
  return lines.sort((p, q) => DISPLAY.indexOf(p.cat) - DISPLAY.indexOf(q.cat));
}

// 테스트·측정용: 모든 규칙의 조건 충족 여부와 그 규칙이 가진 표현 변형 전체를 돌려준다.
export function probeRules(input: AnalysisInput) {
  const variants = new Map<string, string[]>();
  const { all } = evaluate(input, (id, vs) => variants.set(id, vs));
  return all.map((x) => ({ id: x.r.id, cat: x.r.cat, fired: x.fired, text: x.fired ? x.text : null, variants: variants.get(x.r.id) ?? null }));
}
