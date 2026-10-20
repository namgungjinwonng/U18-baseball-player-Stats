// 학교 대전 "경기 분석" 문구를 기록 조건에 따라 고르는 규칙 엔진 (101개 규칙, 15개 분류).
// 분류마다 한 줄, 같은 지표를 두 번 말하지 않도록 골라 최대 6줄을 만든다. 외부 호출 없는 순수 함수.
import { compareEdge, type EdgeLevel } from "./heat";
import type { LeagueRates } from "./types";
import type { Record3 } from "./versus";

export type MetricKey = "pct" | "avg" | "obp" | "ops" | "hr" | "sb" | "era" | "whip" | "k9" | "bb9" | "sbat" | "spit";
type Side = "a" | "b";
type Cat =
  | "overall" | "h2h" | "key" | "balance" | "power" | "bat" | "speed" | "pit" | "pitstyle"
  | "record" | "runs" | "strength" | "h2hDetail" | "level" | "sample";

export interface AnalysisGame {
  date: string;
  status: string; // 완료 / 예정 / 취소
  me: number | null; // A팀 점수
  opp: number | null; // B팀 점수
  outcome: "승" | "패" | "무" | null; // A팀 기준
}

export interface AnalysisInput {
  aName: string;
  bName: string;
  metrics: Partial<Record<MetricKey, { a?: number | null; b?: number | null }>>;
  recA?: Record3 | null; // 시즌 전적·득실
  recB?: Record3 | null;
  h2h?: { w: number; l: number; d: number; rf: number; ra: number; games: AnalysisGame[] } | null;
  allYears?: boolean; // 통산 맞대결 보기
  lg?: Partial<LeagueRates> | null; // 리그 평균
}

export interface AnalysisLine {
  id: string;
  cat: Cat;
  text: string;
}

// ── 문구 도우미 ──────────────────────────────────────────────
// 마지막 글자의 받침: 0 = 없음, 8 = ㄹ, 그 밖 = 있음. 영문·숫자는 읽는 소리 기준.
function finalOf(word: string): number {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  const digit = "0123456789".indexOf(ch);
  if (digit >= 0) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][digit];
  const up = ch.toUpperCase();
  if (up === "L" || up === "R") return 8;
  if (up === "M" || up === "N") return 16;
  return 0;
}
const ga = (w: string) => `${w}${finalOf(w) ? "이" : "가"}`;
const eun = (w: string) => `${w}${finalOf(w) ? "은" : "는"}`;

const f3 = (v: number) => {
  const s = v.toFixed(3);
  return v < 1 && v >= 0 ? s.replace(/^0/, "") : s;
};
const f2 = (v: number) => v.toFixed(2);
const f1 = (v: number) => v.toFixed(1);
const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

const LOWER: MetricKey[] = ["era", "whip", "bb9"];
const BAT: MetricKey[] = ["avg", "obp", "ops", "hr", "sb"];
const PIT: MetricKey[] = ["era", "whip", "k9", "bb9"];

// ── 규칙 실행 컨텍스트 ────────────────────────────────────────
class Ctx {
  constructor(readonly input: AnalysisInput) {}
  name = (s: Side) => (s === "a" ? this.input.aName : this.input.bName);
  oth = (s: Side): Side => (s === "a" ? "b" : "a");
  v = (k: MetricKey, s: Side): number | undefined => {
    const x = this.input.metrics[k]?.[s];
    return x == null || !Number.isFinite(x) ? undefined : x;
  };
  has = (k: MetricKey) => this.v(k, "a") != null && this.v(k, "b") != null;
  cmp = (k: MetricKey) => compareEdge(this.v(k, "a"), this.v(k, "b"), LOWER.includes(k));
  win = (k: MetricKey): Side | null => this.cmp(k).win;
  lv = (k: MetricKey): EdgeLevel => this.cmp(k).level;
  get wins() {
    let a = 0, b = 0;
    for (const k of Object.keys(this.input.metrics) as MetricKey[]) {
      const w = this.win(k);
      if (w === "a") a += 1;
      else if (w === "b") b += 1;
    }
    return { a, b };
  }
  get compared() {
    return (Object.keys(this.input.metrics) as MetricKey[]).filter((k) => this.has(k)).length;
  }
  groupWins = (keys: MetricKey[]) => {
    let a = 0, b = 0;
    for (const k of keys) {
      const w = this.win(k);
      if (w === "a") a += 1;
      else if (w === "b") b += 1;
    }
    return { a, b, side: (a > b ? "a" : b > a ? "b" : null) as Side | null };
  };
  rec = (s: Side) => (s === "a" ? this.input.recA : this.input.recB) ?? null;
  games = (s: Side) => {
    const r = this.rec(s);
    return r ? r.w + r.l + r.d : 0;
  };
  perGame = (s: Side, what: "rf" | "ra" | "sb" | "hr") => {
    const g = this.games(s);
    if (!g) return undefined;
    if (what === "rf" || what === "ra") return this.rec(s)![what] / g;
    const total = this.v(what, s);
    return total == null ? undefined : total / g;
  };
  lg = (k: keyof LeagueRates): number | undefined => {
    const x = this.input.lg?.[k];
    return typeof x === "number" && x > 0 ? x : undefined;
  };
  // 두 쪽 중 조건을 만족하는 쪽(앞선 쪽 우선)으로 문구를 만든다.
  either = (fn: (s: Side) => string | null): string | null => fn("a") ?? fn("b");
  get done() {
    return (this.input.h2h?.games ?? []).filter((g) => g.outcome != null);
  }
  // 지표 수로 본 우세 팀
  get leader(): Side | null {
    const w = this.wins;
    return w.a > w.b ? "a" : w.b > w.a ? "b" : null;
  }
}

interface Rule {
  id: string;
  cat: Cat;
  w: number; // 고를 때의 중요도 (높을수록 먼저)
  uses: string[]; // 언급하는 지표 — 같은 지표를 두 줄에서 반복하지 않는다
  run: (c: Ctx) => string | null;
}

const R: Rule[] = [];
const rule = (id: string, cat: Cat, w: number, uses: string[], run: (c: Ctx) => string | null) =>
  R.push({ id, cat, w, uses, run });

// ── 1. 전체 구도 (8) ─────────────────────────────────────────
const overall = (c: Ctx) => {
  const w = c.wins;
  const lead = c.leader;
  return { w, lead, decided: w.a + w.b, wl: lead ? w[lead] : 0, ll: lead ? w[c.oth(lead)] : 0 };
};
rule("O1", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.lead && o.ll === 0 && o.wl >= 6
    ? `${ga(c.name(o.lead))} 비교한 ${c.compared}개 지표 가운데 ${o.wl}개에서 앞서고 뒤진 항목이 하나도 없다. 전력 차가 분명한 매치업이다.`
    : null;
});
rule("O2", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.lead && o.ll === 1 && o.wl >= 6
    ? `${c.name(o.lead)}의 일방적인 우세다. ${o.wl}개 항목에서 앞서고 단 1개 항목만 내줬다.`
    : null;
});
rule("O7", "overall", 100, [], (c) =>
  c.compared > 0 && overall(c).decided === 0 ? "모든 지표가 3% 이내 차이다. 기록만으로는 우열을 가리기 어렵다." : null
);
rule("O8", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.decided > 0 && o.decided <= 3 && c.compared - o.decided >= 6
    ? `대부분 지표가 비슷하고 ${o.decided}개 항목에서만 차이가 난다. 작은 차이가 승부를 가를 수 있다.`
    : null;
});
rule("O3", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.lead && o.wl / o.decided >= 0.75
    ? `${ga(c.name(o.lead))} ${o.wl}:${o.ll}로 대부분 지표에서 앞선다. 객관적 전력은 ${c.name(o.lead)} 쪽이다.`
    : null;
});
rule("O4", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.lead && o.wl / o.decided >= 0.6
    ? `${ga(c.name(o.lead))} ${o.wl}:${o.ll}로 우세하지만 압도적이진 않다. 열세 항목에서 반격의 여지가 있다.`
    : null;
});
rule("O5", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.lead ? `앞선 항목 ${o.wl}:${o.ll}, 근소하게 ${c.name(o.lead)} 쪽으로 기운 박빙 구도다.` : null;
});
rule("O6", "overall", 100, [], (c) => {
  const o = overall(c);
  return o.decided > 0 && !o.lead
    ? `앞선 항목 수가 ${o.w.a}:${o.w.b}로 똑같다. 어느 쪽이 자기 강점을 살리느냐의 싸움이다.`
    : null;
});

// ── 2. 맞대결 (8) ────────────────────────────────────────────
const h2hLead = (c: Ctx): Side | null => {
  const h = c.input.h2h;
  if (!h) return null;
  return h.w > h.l ? "a" : h.l > h.w ? "b" : null;
};
const h2hRec = (c: Ctx, s: Side) => {
  const h = c.input.h2h!;
  const [w, l] = s === "a" ? [h.w, h.l] : [h.l, h.w];
  return `${w}승 ${l}패${h.d ? ` ${h.d}무` : ""}`;
};
rule("H1", "h2h", 40, [], (c) =>
  !c.input.allYears && c.done.length === 0 ? "올 시즌 두 팀의 맞대결 기록은 아직 없다." : null
);
rule("H2", "h2h", 40, [], (c) =>
  c.input.allYears && c.done.length === 0 ? "최근 시즌들을 통틀어도 두 팀이 맞붙은 기록이 없다." : null
);
rule("H8", "h2h", 95, [], (c) => {
  const h = h2hLead(c);
  const m = c.leader;
  return h && m && h !== m && c.done.length >= 1
    ? `맞대결은 ${ga(c.name(h))} ${h2hRec(c, h)}로 앞섰지만 지표는 ${c.name(m)} 우위다. 상성이 기록과 다를 수 있다.`
    : null;
});
rule("H3", "h2h", 90, [], (c) => {
  const h = h2hLead(c);
  const x = c.input.h2h;
  return h && x && c.done.length >= 2 && Math.min(x.w, x.l) === 0 && x.d === 0
    ? `맞대결 ${c.done.length}전 전승, ${ga(c.name(h))} 상대 전적에서 확실히 앞선다.`
    : null;
});
rule("H4", "h2h", 90, [], (c) => {
  if (c.done.length !== 1) return null;
  const g = c.done[0];
  if (g.outcome === "무" || g.me == null || g.opp == null) return null;
  const s: Side = g.outcome === "승" ? "a" : "b";
  const [x, y] = s === "a" ? [g.me, g.opp] : [g.opp, g.me];
  return `유일한 맞대결(${md(g.date)})은 ${c.name(s)}의 ${x}:${y} 승리였다.`;
});
rule("H5", "h2h", 90, [], (c) => {
  const g = c.done[0];
  return c.done.length === 1 && g.outcome === "무" ? `유일한 맞대결(${md(g.date)})은 ${g.me}:${g.opp} 무승부로 끝났다.` : null;
});
rule("H6", "h2h", 90, [], (c) => {
  const h = h2hLead(c);
  return h && c.done.length >= 2 ? `맞대결 ${h2hRec(c, h)}로 ${ga(c.name(h))} 우세하다.` : null;
});
rule("H7", "h2h", 90, [], (c) => {
  const x = c.input.h2h;
  return x && c.done.length >= 2 && x.w === x.l ? `맞대결 전적은 ${x.w}승 ${x.l}패${x.d ? ` ${x.d}무` : ""}로 팽팽하다.` : null;
});

// ── 3. 핵심 매치업: 한 팀의 강점 vs 상대 약점 (5) ───────────────
rule("M1", "key", 85, ["ops", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const ops = c.v("ops", s), era = c.v("era", o), lo = c.lg("ops"), le = c.lg("era");
  return ops != null && era != null && lo && le && ops >= lo * 1.1 && era <= le * 0.85
    ? `${c.name(s)} 타선(OPS ${f3(ops)})과 ${c.name(o)} 마운드(ERA ${f2(era)}), 창과 방패가 정면으로 부딪친다.`
    : null;
}));
rule("M2", "key", 85, ["ops", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const ops = c.v("ops", s), era = c.v("era", o), lo = c.lg("ops"), le = c.lg("era");
  return ops != null && era != null && lo && le && ops <= lo * 0.9 && era >= le * 1.15
    ? `${c.name(s)} 타선은 약한 편이지만 ${c.name(o)} 마운드도 실점이 많아(ERA ${f2(era)}) 득점 기회는 열려 있다.`
    : null;
}));
rule("M3", "key", 85, ["obp", "bb9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const obp = c.v("obp", s), bb9 = c.v("bb9", o), lob = c.lg("obp"), lbb = c.lg("bb9");
  return obp != null && bb9 != null && lob && lbb && obp >= lob * 1.08 && bb9 >= lbb * 1.1
    ? `볼넷이 많은 ${c.name(o)} 투수진(BB/9 ${f1(bb9)})이 출루율 ${f3(obp)}의 ${c.name(s)} 선구안을 만난다.`
    : null;
}));
rule("M4", "key", 85, ["sb", "whip"], (c) => c.either((s) => {
  const o = c.oth(s);
  const sbg = c.perGame(s, "sb"), whip = c.v("whip", o), lw = c.lg("whip");
  return sbg != null && whip != null && lw && sbg >= 1.5 && whip >= lw * 1.1
    ? `주자를 자주 내보내는 ${c.name(o)}(WHIP ${f2(whip)})는 경기당 도루 ${f1(sbg)}개의 ${c.name(s)} 기동력을 막아야 한다.`
    : null;
}));
rule("M5", "key", 85, ["hr", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const hrg = c.perGame(s, "hr"), hr = c.v("hr", s), era = c.v("era", o), le = c.lg("era");
  return hrg != null && hr != null && era != null && le && hrg >= 0.4 && era >= le * 1.1
    ? `${c.name(s)}의 장타(홈런 ${hr}개)가 실점이 많은 ${c.name(o)} 마운드(ERA ${f2(era)})를 상대로 터질 수 있다.`
    : null;
}));

// ── 4. 타격·마운드 균형 (6) ──────────────────────────────────
rule("B3", "balance", 80, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return b.side && p.side && b.side !== p.side
    ? `창과 방패의 대결이다. 방망이는 ${c.name(b.side)}, 마운드는 ${ga(c.name(p.side))} 앞선다.`
    : null;
});
rule("B1", "balance", 75, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return b.side && b.side === p.side && b[b.side] >= 3 && p[p.side] >= 3
    ? `${ga(c.name(b.side))} 타격(${b[b.side]}개)과 마운드(${p[p.side]}개) 양쪽에서 모두 앞선 완성형 전력이다.`
    : null;
});
rule("B4", "balance", 65, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return !b.side && p.side ? `타선은 엇비슷하고 마운드에서 ${ga(c.name(p.side))} 앞선다. 투수 운용이 승부처다.` : null;
});
rule("B5", "balance", 65, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return b.side && !p.side ? `마운드는 비슷하고 타격에서 ${ga(c.name(b.side))} 앞선다. 누가 먼저 점수를 내느냐가 관건이다.` : null;
});
rule("B2", "balance", 60, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return b.side && b.side === p.side ? `타격과 마운드 모두 ${c.name(b.side)} 쪽으로 기운다. 상대는 특정 강점에 기대야 한다.` : null;
});
rule("B6", "balance", 35, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  return !b.side && !p.side && c.compared > 0 ? "타격·마운드 어느 쪽에서도 뚜렷한 차이가 없다." : null;
});

// ── 5. 장타 (5) ──────────────────────────────────────────────
rule("T7", "power", 78, ["obp", "hr"], (c) => c.either((s) => {
  const o = c.oth(s);
  return c.win("obp") === s && c.win("hr") === o
    ? `${eun(c.name(s))} 출루(출루율 ${f3(c.v("obp", s)!)}), ${eun(c.name(o))} 장타(홈런 ${c.v("hr", o)}개)로 맞서는 색깔이 다른 타선이다.`
    : null;
}));
rule("T8", "power", 70, ["hr", "ops"], (c) => c.either((s) =>
  c.win("hr") === s && c.win("ops") === s
    ? `${eun(c.name(s))} 홈런(${c.v("hr", s)}개)과 OPS(${f3(c.v("ops", s)!)}) 모두 앞선 '한 방 있는 타선'이다.`
    : null
));
rule("T4", "power", 68, ["hr"], (c) => c.either((s) =>
  c.win("hr") === s && c.lv("hr") === 3 && c.v("hr", s)! >= 3
    ? `홈런 ${c.v("hr", s)}:${c.v("hr", c.oth(s))}, 장타력에서 ${ga(c.name(s))} 확실히 앞선다.`
    : null
));
rule("T6", "power", 55, ["hr"], (c) =>
  c.has("hr") && c.v("hr", "a") === 0 && c.v("hr", "b") === 0
    ? "두 팀 모두 홈런이 없다. 장타보다 작전과 주루로 점수를 짜내는 경기가 예상된다."
    : null
);
rule("T5", "power", 50, ["hr"], (c) => c.either((s) =>
  c.v("hr", s) === 0 && (c.v("hr", c.oth(s)) ?? 0) > 0
    ? `${eun(c.name(s))} 아직 홈런이 없다. 한 방보다 연결로 점수를 내야 하는 팀이다.`
    : null
));

// ── 6. 타격 (7) ──────────────────────────────────────────────
rule("T10", "bat", 76, ["avg", "ops"], (c) => c.either((s) =>
  c.win("avg") === s && c.win("ops") === c.oth(s)
    ? `${eun(c.name(s))} 타율(${f3(c.v("avg", s)!)})은 높지만 OPS는 뒤진다. 단타 위주로 꾸준히 출루하는 타선이다.`
    : null
));
rule("T12", "bat", 74, ["obp", "avg"], (c) => c.either((s) => {
  const avg = c.v("avg", s), obp = c.v("obp", s);
  return avg != null && obp != null && obp - avg >= 0.12
    ? `${eun(c.name(s))} 타율(${f3(avg)})보다 출루율(${f3(obp)})이 크게 높다. 볼넷을 잘 골라내는 타선이다.`
    : null;
}));
rule("T1", "bat", 66, ["ops"], (c) => c.either((s) =>
  c.win("ops") === s && c.lv("ops") === 3
    ? `OPS ${f3(c.v("ops", s)!)}:${f3(c.v("ops", c.oth(s))!)}, 공격 생산력에서 ${ga(c.name(s))} 크게 앞선다.`
    : null
));
rule("T2", "bat", 56, ["ops"], (c) => c.either((s) =>
  c.win("ops") === s && c.lv("ops") === 2
    ? `${c.name(s)}의 OPS(${f3(c.v("ops", s)!)})가 한 단계 위다. 득점 기대치에서 앞선다.`
    : null
));
rule("T9", "bat", 52, ["avg"], (c) => c.either((s) =>
  c.win("avg") === s && c.lv("avg") >= 2 ? `팀 타율 ${f3(c.v("avg", s)!)}의 ${c.name(s)}, 정교함에서 앞선다.` : null
));
rule("T11", "bat", 50, ["obp"], (c) => c.either((s) =>
  c.win("obp") === s && c.lv("obp") >= 2
    ? `출루율 ${f3(c.v("obp", s)!)}:${f3(c.v("obp", c.oth(s))!)}, ${c.name(s)} 타자들이 더 자주 1루를 밟는다.`
    : null
));
rule("T3", "bat", 30, ["ops"], (c) =>
  c.has("ops") && c.lv("ops") === 1
    ? `OPS 차이는 ${f3(c.v("ops", "a")!)}:${f3(c.v("ops", "b")!)}로 근소하다. 타선의 힘은 비슷한 수준이다.`
    : null
);

// ── 7. 주루 (5) ──────────────────────────────────────────────
rule("V5", "speed", 72, ["sb", "obp"], (c) => c.either((s) =>
  c.win("sb") === s && c.win("obp") === c.oth(s)
    ? `${eun(c.name(s))} 출루는 적어도 나가면 뛴다. 도루 ${c.v("sb", s)}개로 부족한 출루를 발로 만회한다.`
    : null
));
rule("V3", "speed", 64, ["sb", "obp"], (c) => c.either((s) =>
  c.win("sb") === s && c.win("obp") === s
    ? `${eun(c.name(s))} 많이 나가고(출루율 ${f3(c.v("obp", s)!)}) 많이 뛴다(도루 ${c.v("sb", s)}개). 주자가 쌓이면 흔들기가 시작된다.`
    : null
));
rule("V1", "speed", 62, ["sb"], (c) => c.either((s) =>
  c.win("sb") === s && c.lv("sb") === 3
    ? `도루 ${c.v("sb", s)}:${c.v("sb", c.oth(s))}, 기동력에서 ${ga(c.name(s))} 크게 앞선다.`
    : null
));
rule("V4", "speed", 58, ["sb"], (c) => {
  const a = c.perGame("a", "sb"), b = c.perGame("b", "sb");
  return a != null && b != null && a >= 2 && b >= 2 ? "두 팀 모두 경기당 도루 2개 이상, 적극적인 주루를 펼친다." : null;
});
rule("V2", "speed", 45, ["sb"], (c) => c.either((s) =>
  c.win("sb") === s && c.lv("sb") === 2 ? `베이스 위 움직임은 ${c.name(s)} 쪽이 더 활발하다(도루 ${c.v("sb", s)}개).` : null
));

// ── 8. 마운드 실점 억제 (6) ──────────────────────────────────
rule("P4", "pit", 82, ["era", "whip"], (c) => c.either((s) => {
  const o = c.oth(s);
  return c.win("era") === s && c.win("whip") === o
    ? `${eun(c.name(s))} 주자를 더 내보내고도(WHIP ${f2(c.v("whip", s)!)}) 실점이 적고(ERA ${f2(c.v("era", s)!)}), ${eun(c.name(o))} 출루 허용이 적은데도 실점이 많다. 위기관리에서 갈린 구도다.`
    : null;
}));
rule("P5", "pit", 62, ["whip"], (c) => {
  const a = c.v("whip", "a"), b = c.v("whip", "b"), l = c.lg("whip");
  return a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1
    ? `두 팀 마운드 모두 이닝당 출루 허용이 많다(WHIP ${f2(a)}·${f2(b)}). 주자가 자주 깔리는 경기가 예상된다.`
    : null;
});
rule("P1", "pit", 66, ["era"], (c) => c.either((s) =>
  c.win("era") === s && c.lv("era") === 3
    ? `팀 ERA ${f2(c.v("era", s)!)}:${f2(c.v("era", c.oth(s))!)}, 실점 억제력에서 ${ga(c.name(s))} 크게 앞선다.`
    : null
));
rule("P2", "pit", 56, ["era"], (c) => c.either((s) =>
  c.win("era") === s && c.lv("era") === 2 ? `${c.name(s)} 마운드가 실점을 더 잘 막는다(ERA ${f2(c.v("era", s)!)}).` : null
));
rule("P6", "pit", 50, ["whip"], (c) => c.either((s) =>
  c.win("whip") === s && c.lv("whip") >= 2
    ? `이닝당 출루 허용 ${f2(c.v("whip", s)!)}:${f2(c.v("whip", c.oth(s))!)}, ${eun(c.name(s))} 주자를 잘 묶는다.`
    : null
));
rule("P3", "pit", 30, ["era"], (c) =>
  c.has("era") && c.lv("era") === 1 ? `팀 ERA는 ${f2(c.v("era", "a")!)}:${f2(c.v("era", "b")!)}로 근소한 차이다.` : null
);

// ── 9. 투구 스타일 (7) ───────────────────────────────────────
rule("K2", "pitstyle", 74, ["k9", "bb9"], (c) => c.either((s) => {
  const o = c.oth(s);
  return c.win("k9") === s && c.win("bb9") === o
    ? `투구 스타일이 정반대다. ${eun(c.name(s))} 삼진(K/9 ${f1(c.v("k9", s)!)})으로, ${eun(c.name(o))} 적은 볼넷(BB/9 ${f1(c.v("bb9", o)!)})으로 막는다.`
    : null;
}));
rule("K3", "pitstyle", 62, ["bb9"], (c) => {
  const a = c.v("bb9", "a"), b = c.v("bb9", "b"), l = c.lg("bb9");
  return a != null && b != null && l && a <= l * 0.85 && b <= l * 0.85
    ? `두 팀 모두 볼넷이 적은 마운드다(BB/9 ${f1(a)}·${f1(b)}). 타자들이 적극적으로 쳐야 길이 열린다.`
    : null;
});
rule("K1", "pitstyle", 70, ["k9", "bb9"], (c) => c.either((s) =>
  c.win("k9") === s && c.win("bb9") === s
    ? `${c.name(s)} 투수진은 삼진은 많고(K/9 ${f1(c.v("k9", s)!)}) 볼넷은 적다(BB/9 ${f1(c.v("bb9", s)!)}). 구위와 제구를 겸비했다.`
    : null
));
rule("K7", "pitstyle", 60, ["k9"], (c) => c.either((s) =>
  c.win("k9") === s && c.win("era") === s ? `${eun(c.name(s))} 탈삼진(K/9 ${f1(c.v("k9", s)!)})으로 실점을 막는 마운드다.` : null
));
rule("K6", "pitstyle", 58, ["k9"], (c) => {
  const a = c.v("k9", "a"), b = c.v("k9", "b"), l = c.lg("k9");
  return a != null && b != null && l && a >= l * 1.15 && b >= l * 1.15
    ? `두 팀 모두 리그 평균보다 삼진을 많이 잡는다(K/9 ${f1(a)}·${f1(b)}). 타자들의 컨택이 시험대에 오른다.`
    : null;
});
rule("K4", "pitstyle", 52, ["k9"], (c) => c.either((s) =>
  c.win("k9") === s && c.lv("k9") >= 2
    ? `탈삼진 능력은 ${ga(c.name(s))} 뚜렷하게 앞선다(K/9 ${f1(c.v("k9", s)!)}:${f1(c.v("k9", c.oth(s))!)}).`
    : null
));
rule("K5", "pitstyle", 50, ["bb9"], (c) => c.either((s) =>
  c.win("bb9") === s && c.lv("bb9") >= 2
    ? `${c.name(s)} 투수진의 제구가 더 안정적이다(BB/9 ${f1(c.v("bb9", s)!)}:${f1(c.v("bb9", c.oth(s))!)}).`
    : null
));

// ── 10. 승률 (9) ─────────────────────────────────────────────
rule("R5", "record", 84, ["pct"], (c) => {
  const m = c.leader, p = c.win("pct");
  return m && p && m !== p
    ? `${eun(c.name(m))} 지표상 앞서지만 승률은 ${ga(c.name(p))} 높다. 접전에서 이기는 힘은 ${c.name(p)} 쪽이다.`
    : null;
});
rule("R10", "record", 78, ["pct"], (c) => c.either((s) => {
  const r = c.rec(s);
  return r && r.l === 0 && r.w >= 3 ? `${eun(c.name(s))} 올 시즌 ${r.w}승${r.d ? ` ${r.d}무` : ""} 무패 행진 중이다.` : null;
}));
rule("R11", "record", 76, ["pct"], (c) => c.either((s) => {
  const r = c.rec(s);
  return r && r.w === 0 && r.l + r.d >= 3 ? `${eun(c.name(s))} 아직 승리가 없다(${r.l}패). 첫 승이 절실한 상황이다.` : null;
}));
rule("R1", "record", 62, ["pct"], (c) => c.either((s) =>
  c.win("pct") === s && c.lv("pct") === 3
    ? `승률 ${f3(c.v("pct", s)!)}:${f3(c.v("pct", c.oth(s))!)}, 시즌 성적은 ${ga(c.name(s))} 크게 앞선다.`
    : null
));
rule("R7", "record", 60, ["pct"], (c) =>
  c.has("pct") && c.v("pct", "a")! >= 0.7 && c.v("pct", "b")! >= 0.7 ? "두 팀 모두 승률 7할 이상의 상위권 팀이다." : null
);
rule("R8", "record", 60, ["pct"], (c) =>
  c.has("pct") && c.v("pct", "a")! <= 0.3 && c.v("pct", "b")! <= 0.3 ? "두 팀 모두 승률 3할 아래로 반등이 필요한 처지다." : null
);
rule("R2", "record", 48, ["pct"], (c) => c.either((s) =>
  c.win("pct") === s && c.lv("pct") === 2 ? `승률은 ${c.name(s)} 쪽이 한 단계 높다(${f3(c.v("pct", s)!)}).` : null
));
rule("R4", "record", 35, ["pct"], (c) =>
  c.has("pct") && c.lv("pct") === 0 ? `두 팀의 승률이 ${f3(c.v("pct", "a")!)}·${f3(c.v("pct", "b")!)}로 비슷하다.` : null
);
rule("R3", "record", 30, ["pct"], (c) =>
  c.has("pct") && c.lv("pct") === 1 ? `승률 차이는 크지 않다(${f3(c.v("pct", "a")!)}:${f3(c.v("pct", "b")!)}).` : null
);

// ── 11. 득실 (7) ─────────────────────────────────────────────
const margin = (c: Ctx, s: Side) => {
  const r = c.rec(s);
  return r ? r.rf - r.ra : undefined;
};
rule("U5", "runs", 70, ["runs"], (c) => c.either((s) => {
  const ms = margin(c, s), mo = margin(c, c.oth(s));
  return ms != null && mo != null && ms > 0 && mo < 0
    ? `득실 마진 ${c.name(s)} ${signed(ms)}, ${c.name(c.oth(s))} ${signed(mo)}. 시즌 흐름이 정반대다.`
    : null;
}));
rule("U3", "runs", 64, ["runs"], (c) => {
  const a = c.perGame("a", "rf"), b = c.perGame("b", "rf");
  return a != null && b != null && a >= 7 && b >= 7 ? "두 팀 모두 경기당 7점 이상 뽑는다. 다득점 경기가 예상된다." : null;
});
rule("U4", "runs", 64, ["runs"], (c) => {
  const a = c.perGame("a", "rf"), b = c.perGame("b", "rf");
  return a != null && b != null && a <= 3 && b <= 3 ? "두 팀 모두 경기당 3점 남짓만 낸다. 한 점 싸움이 될 가능성이 크다." : null;
});
rule("U1", "runs", 62, ["runs"], (c) => c.either((s) => {
  const x = c.perGame(s, "rf"), y = c.perGame(c.oth(s), "rf");
  return x != null && y != null && y > 0 && x / y >= 1.5
    ? `경기당 득점 ${f1(x)}:${f1(y)}, 점수를 뽑는 힘은 ${ga(c.name(s))} 확실히 앞선다.`
    : null;
}));
rule("U2", "runs", 60, ["runs"], (c) => c.either((s) => {
  const x = c.perGame(s, "ra"), y = c.perGame(c.oth(s), "ra");
  return x != null && y != null && y > 0 && x / y <= 0.6
    ? `경기당 실점 ${f1(x)}:${f1(y)}, ${eun(c.name(s))} 상대에게 점수를 잘 주지 않는다.`
    : null;
}));
rule("U6", "runs", 58, ["runs"], (c) => {
  const a = margin(c, "a"), b = margin(c, "b");
  return a != null && b != null && a >= 20 && b >= 20 ? `두 팀 모두 득실 마진이 크게 플러스(${signed(a)}·${signed(b)})인 강팀이다.` : null;
});
rule("U7", "runs", 56, ["runs"], (c) => {
  const a = margin(c, "a"), b = margin(c, "b");
  return a != null && b != null && a < 0 && b < 0 ? "두 팀 모두 실점이 득점보다 많다. 마운드 안정이 공통 과제다." : null;
});

// ── 12. 강도지수 (8) ─────────────────────────────────────────
rule("S2", "strength", 79, ["sbat"], (c) => c.either((s) => {
  const o = c.oth(s);
  return c.win("ops") === s && c.win("sbat") === o
    ? `OPS는 ${ga(c.name(s))} 앞서지만 상대 수준을 반영한 타선 강도지수는 ${ga(c.name(o))} 높다(${f2(c.v("sbat", o)!)}). 상대한 마운드의 수준 차를 감안해야 한다.`
    : null;
}));
rule("S3", "strength", 66, ["sbat"], (c) => c.either((s) =>
  c.win("sbat") === s && c.lv("sbat") === 3
    ? `타선 강도지수 ${f2(c.v("sbat", s)!)}:${f2(c.v("sbat", c.oth(s))!)}, 상대 수준까지 감안하면 ${c.name(s)} 타선이 확실히 강하다.`
    : null
));
rule("S4", "strength", 77, ["spit"], (c) => c.either((s) => {
  const o = c.oth(s);
  return c.win("era") === s && c.win("spit") === o
    ? `팀 ERA는 ${ga(c.name(s))} 좋지만 마운드 강도지수는 ${ga(c.name(o))} 높다(${f2(c.v("spit", o)!)}). ${c.name(o)} 마운드는 기록보다 실제 전력이 강할 수 있다.`
    : null;
}));
rule("S5", "strength", 65, ["spit"], (c) => c.either((s) =>
  c.win("spit") === s && c.lv("spit") === 3
    ? `마운드 강도지수 ${f2(c.v("spit", s)!)}:${f2(c.v("spit", c.oth(s))!)}, 상대 타선 수준까지 감안해도 ${c.name(s)} 마운드가 한 수 위다.`
    : null
));
rule("S1", "strength", 63, ["sbat", "spit"], (c) => c.either((s) =>
  c.win("sbat") === s && c.win("spit") === s
    ? `상대 수준을 보정한 강도지수에서도 ${ga(c.name(s))} 타선·마운드 모두 앞선다.`
    : null
));
rule("S6", "strength", 61, ["sbat", "spit"], (c) => {
  const b = c.win("sbat"), p = c.win("spit");
  return b && p && b !== p ? `강도지수로 보면 타선은 ${c.name(b)}, 마운드는 ${c.name(p)} 쪽이 낫다.` : null;
});
rule("S7", "strength", 57, ["sbat"], (c) =>
  c.has("sbat") && c.v("sbat", "a")! >= 1.1 && c.v("sbat", "b")! >= 1.1
    ? "두 팀 모두 타선 강도지수 1.10 이상, 리그 상위권 타선끼리의 대결이다."
    : null
);
rule("S8", "strength", 40, ["sbat", "spit"], (c) => {
  const xs = (["sbat", "spit"] as MetricKey[]).flatMap((k) => [c.v(k, "a"), c.v(k, "b")]);
  return xs.every((x) => x != null && Math.abs(x - 1) <= 0.05) ? "두 팀 모두 강도지수가 리그 평균(1.00) 근처인 비슷한 체급이다." : null;
});

// ── 13. 맞대결 세부 (8) ──────────────────────────────────────
const winnerOf = (g: AnalysisGame): Side | null => (g.outcome === "승" ? "a" : g.outcome === "패" ? "b" : null);
const latest = (c: Ctx) => [...c.done].sort((x, y) => y.date.localeCompare(x.date))[0];
rule("D3", "h2hDetail", 72, [], (c) => {
  const h = h2hLead(c);
  const g = latest(c);
  const r = g && winnerOf(g);
  return h && r && c.done.length >= 2 && r !== h
    ? `시리즈는 ${c.name(h)} 우세지만 가장 최근 경기(${md(g.date)})는 ${ga(c.name(r))} 가져갔다.`
    : null;
});
rule("D4", "h2hDetail", 70, [], (c) => {
  const g = latest(c);
  const r = g && winnerOf(g);
  if (!g || !r || g.me == null || g.opp == null || Math.abs(g.me - g.opp) < 7) return null;
  const [x, y] = r === "a" ? [g.me, g.opp] : [g.opp, g.me];
  return `가장 최근 맞대결(${md(g.date)})은 ${c.name(r)}의 ${x}:${y} 대승이었다.`;
});
rule("D1", "h2hDetail", 68, [], (c) =>
  c.done.length >= 2 && c.done.every((g) => g.me != null && g.opp != null && Math.abs(g.me - g.opp) <= 2)
    ? `맞대결 ${c.done.length}경기가 모두 2점 차 이내 접전이었다.`
    : null
);
rule("D5", "h2hDetail", 66, [], (c) => {
  const seq = [...c.done].sort((x, y) => x.date.localeCompare(y.date)).map(winnerOf);
  return seq.length >= 3 && seq.every((s, i) => s && (i === 0 || s !== seq[i - 1]))
    ? "맞대결에서 승패를 번갈아 주고받았다. 어느 쪽도 흐름을 잡지 못했다."
    : null;
});
const avgTotal = (c: Ctx) => {
  const xs = c.done.filter((g) => g.me != null && g.opp != null);
  return xs.length ? xs.reduce((sum, g) => sum + g.me! + g.opp!, 0) / xs.length : undefined;
};
rule("D7", "h2hDetail", 60, [], (c) => {
  const t = avgTotal(c);
  return t != null && t >= 14 ? `맞대결에서 경기당 평균 ${f1(t)}점이 나왔다. 난타전이 잦은 상성이다.` : null;
});
rule("D8", "h2hDetail", 60, [], (c) => {
  const t = avgTotal(c);
  return t != null && c.done.length >= 1 && t <= 5 ? `맞대결 경기당 평균 ${f1(t)}점, 점수가 잘 나지 않는 상성이다.` : null;
});
rule("D2", "h2hDetail", 55, [], (c) => {
  const x = c.input.h2h;
  return x && c.done.length >= 2 && Math.abs(x.rf - x.ra) >= 10 ? `맞대결 득실 ${x.rf}:${x.ra}, 점수 차도 크게 벌어졌다.` : null;
});
rule("D6", "h2hDetail", 45, [], (c) => {
  const next = (c.input.h2h?.games ?? [])
    .filter((g) => g.status === "예정")
    .sort((x, y) => x.date.localeCompare(y.date))[0];
  return next ? `다음 맞대결은 ${md(next.date)}에 예정돼 있다.` : null;
});

// ── 14. 리그 대비 수준 (10) ──────────────────────────────────
rule("L1", "level", 67, ["ops"], (c) => {
  const a = c.v("ops", "a"), b = c.v("ops", "b"), l = c.lg("ops");
  return a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1
    ? `두 팀 모두 리그 평균 OPS(${f3(l)})를 크게 웃돈다. 타격전 양상이 예상된다.`
    : null;
});
rule("L2", "level", 67, ["era"], (c) => {
  const a = c.v("era", "a"), b = c.v("era", "b"), l = c.lg("era");
  return a != null && b != null && l && a <= l * 0.85 && b <= l * 0.85
    ? `두 팀 모두 팀 ERA가 리그 평균(${f2(l)})보다 낮다. 투수전 양상이 예상된다.`
    : null;
});
rule("L3", "level", 63, ["ops"], (c) => {
  const a = c.v("ops", "a"), b = c.v("ops", "b"), l = c.lg("ops");
  return a != null && b != null && l && a <= l * 0.9 && b <= l * 0.9
    ? "두 팀 모두 공격력이 리그 평균에 못 미친다. 저득점 경기가 될 수 있다."
    : null;
});
rule("L7", "level", 59, ["era"], (c) => c.either((s) => {
  const v = c.v("era", s), l = c.lg("era");
  return v != null && l && v <= l * 0.6 ? `${c.name(s)}의 팀 ERA ${f2(v)}는 리그 최상위권 수준이다(리그 평균 ${f2(l)}).` : null;
}));
rule("L4", "level", 58, ["bb9"], (c) => {
  const a = c.v("bb9", "a"), b = c.v("bb9", "b"), l = c.lg("bb9");
  return a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1
    ? "양 팀 모두 볼넷이 많은 편이라 볼넷 하나가 승부를 흔들 수 있다."
    : null;
});
rule("L8", "level", 57, ["ops"], (c) => c.either((s) => {
  const v = c.v("ops", s), l = c.lg("ops");
  return v != null && l && v >= l * 1.2 ? `${c.name(s)}의 OPS ${f3(v)}는 리그 평균(${f3(l)})보다 20% 이상 높은 상위권 타선이다.` : null;
}));
rule("L6", "level", 56, ["era"], (c) => c.either((s) => {
  const v = c.v("era", s), l = c.lg("era");
  return v != null && l && v >= l * 1.3 ? `${eun(c.name(s))} 팀 ERA ${f2(v)}로 마운드 고민이 크다(리그 평균 ${f2(l)}).` : null;
}));
rule("L9", "level", 55, ["ops"], (c) => c.either((s) => {
  const v = c.v("ops", s), l = c.lg("ops");
  return v != null && l && v <= l * 0.8 ? `${c.name(s)}의 OPS ${f3(v)}는 리그 평균(${f3(l)})에 크게 못 미친다.` : null;
}));
rule("L5", "level", 54, ["avg"], (c) => c.either((s) => {
  const v = c.v("avg", s), l = c.lg("avg");
  return v != null && l && v >= 0.3 && v >= l + 0.03 ? `${c.name(s)}의 팀 타율 ${f3(v)}는 리그 평균(${f3(l)})을 크게 웃돈다.` : null;
}));
rule("L10", "level", 53, ["whip"], (c) => c.either((s) => {
  const v = c.v("whip", s), l = c.lg("whip");
  return v != null && l && v <= l * 0.8
    ? `${c.name(s)} 마운드는 이닝당 ${f2(v)}명만 출루시킨다. 리그 평균(${f2(l)})보다 훨씬 짠물이다.`
    : null;
}));

// ── 15. 표본 (2) — 고른 줄 뒤에 항상 덧붙인다 ─────────────────
rule("X2", "sample", 0, [], (c) =>
  c.games("a") > 0 && c.games("b") > 0 && c.games("a") < 5 && c.games("b") < 5
    ? "두 팀 모두 5경기 미만의 기록이라 표본이 적다. 참고용으로 보자."
    : null
);
rule("X1", "sample", 0, [], (c) => c.either((s) => {
  const g = c.games(s);
  return g > 0 && g < 5 && c.games(c.oth(s)) >= 5 ? `${eun(c.name(s))} ${g}경기 기록뿐이라 표본이 적다. 참고용으로 보자.` : null;
}));

export const ANALYSIS_RULES = R.map(({ id, cat }) => ({ id, cat }));

// 표시 순서 — 전체 구도와 맞대결을 먼저, 나머지는 분류 순서대로.
const DISPLAY: Cat[] = [
  "overall", "h2h", "key", "balance", "bat", "power", "pit", "pitstyle", "speed",
  "record", "runs", "strength", "h2hDetail", "level", "sample",
];

// 조건이 맞는 규칙 중 중요도 높은 순으로, 분류당 한 줄·같은 지표 중복 없이 max줄을 고른다.
export function analyzeVersus(input: AnalysisInput, max = 6): AnalysisLine[] {
  const c = new Ctx(input);
  const candidates = R.filter((r) => r.cat !== "sample")
    .map((r, order) => ({ r, order, text: r.run(c) }))
    .filter((x): x is { r: Rule; order: number; text: string } => !!x.text)
    .sort((x, y) => y.r.w - x.r.w || x.order - y.order);
  const usedCat = new Set<Cat>();
  const usedKey = new Set<string>();
  const picked: AnalysisLine[] = [];
  for (const { r, text } of candidates) {
    if (picked.length >= max) break;
    if (usedCat.has(r.cat) || r.uses.some((u) => usedKey.has(u))) continue;
    picked.push({ id: r.id, cat: r.cat, text });
    usedCat.add(r.cat);
    r.uses.forEach((u) => usedKey.add(u));
  }
  for (const r of R.filter((x) => x.cat === "sample")) {
    const text = r.run(c);
    if (text) {
      picked.push({ id: r.id, cat: r.cat, text });
      break;
    }
  }
  return picked.sort((x, y) => DISPLAY.indexOf(x.cat) - DISPLAY.indexOf(y.cat));
}
