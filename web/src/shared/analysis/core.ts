// 매치업 경기 분석 엔진의 공통 부분 — 입력 타입, 한국어 조사·숫자 도우미, 규칙 실행 컨텍스트, 규칙 등록부.
import { compareEdge, type EdgeLevel } from "../heat";
import type { LeagueRates } from "../types";
import type { Record3, TeamExtra } from "../versus";

export type MetricKey = "pct" | "avg" | "obp" | "ops" | "hr" | "sb" | "era" | "whip" | "k9" | "bb9" | "sbat" | "spit";
export type Side = "a" | "b";
export type Cat =
  | "overall" | "h2h" | "key" | "balance" | "power" | "bat" | "speed" | "pit" | "pitstyle"
  | "record" | "runs" | "strength" | "h2hDetail" | "level" | "sample"
  | "form" | "contact" | "pitchContact" | "games" | "h2hHistory" | "identity"
  | "common" | "robust" | "window" | "stage" | "cross" | "style" | "h2hScore";

// 분야 — 한 화면(기본 6줄)에 분야당 한 줄을 우선 배정해 같은 이야기가 몰리지 않게 한다.
export type Family =
  | "overall" | "h2h" | "h2hMore" | "common" | "form" | "matchup" | "profile" | "offense" | "pitching" | "results" | "strength" | "sample";
export const FAMILY: Record<Cat, Family> = {
  overall: "overall",
  h2h: "h2h", h2hHistory: "h2hMore", h2hDetail: "h2hMore", h2hScore: "h2hMore",
  common: "common",
  form: "form", window: "form",
  key: "matchup", cross: "matchup",
  balance: "profile", identity: "profile", level: "profile", style: "profile",
  bat: "offense", power: "offense", contact: "offense", speed: "offense",
  pit: "pitching", pitstyle: "pitching", pitchContact: "pitching",
  record: "results", runs: "results", games: "results", robust: "results", stage: "results",
  strength: "strength",
  sample: "sample",
};

export interface AnalysisGame {
  date: string;
  status: string; // 완료 / 예정 / 취소
  me: number | null; // A팀 점수
  opp: number | null; // B팀 점수
  outcome: "승" | "패" | "무" | null; // A팀 기준
  title?: string; // 대회명
}

// 한 팀의 시즌 완료 경기 (최근 흐름·접전·대회 단계·한 경기 제외 분석용)
export interface SeasonGame {
  date: string;
  rf: number; // 득점
  ra: number; // 실점
  outcome: "승" | "패" | "무";
  opp?: string; // 상대 학교
  title?: string; // 대회명
}

// 두 팀이 모두 상대한 학교별 성적 (선택 시즌)
export interface CommonOpp {
  opponent: string;
  a: Record3;
  b: Record3;
}

export interface AnalysisInput {
  aName: string;
  bName: string;
  metrics: Partial<Record<MetricKey, { a?: number | null; b?: number | null }>>;
  recA?: Record3 | null; // 시즌 전적·득실
  recB?: Record3 | null;
  h2h?: { w: number; l: number; d: number; rf: number; ra: number; games: AnalysisGame[] } | null;
  allYears?: boolean; // 맞대결을 통산(여러 시즌)으로 본다
  lg?: Partial<LeagueRates> | null; // 리그 평균
  extra?: { a?: TeamExtra | null; b?: TeamExtra | null }; // 팀 세부 지표
  year?: number; // 선택 시즌
  seasonA?: SeasonGame[]; // 시즌 완료 경기
  seasonB?: SeasonGame[];
  common?: CommonOpp[] | null; // 공통 상대 성적
  reference?: {
    year: number;
    signature: string;
    teams: { team: string; rosterCount: number; matchedCount: number; transfers: { name: string; from: string }[] }[];
  }; // 시즌 초 현재 엔트리의 전년도 개인 기록만 참고한다. 올해 팀 성적과 섞지 않는다.
}

export interface AnalysisLine {
  id: string;
  cat: Cat;
  text: string;
  side?: Side | null; // 주로 다룬 학교 (양쪽·전체면 null)
  claims?: string[]; // 주장 태그 (쪽 포함) — 중복 판정용
}

// ── 문구 도우미 ──────────────────────────────────────────────
// 마지막 글자의 받침: 0 = 없음, 8 = ㄹ, 그 밖 = 있음. 영문·숫자는 읽는 소리 기준.
export function finalOf(word: string): number {
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
export const hashOf = (text: string) => {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
export const ga = (w: string) => `${w}${finalOf(w) ? "이" : "가"}`;
export const eun = (w: string) => `${w}${finalOf(w) ? "은" : "는"}`;
export const eul = (w: string) => `${w}${finalOf(w) ? "을" : "를"}`;
export const gwa = (w: string) => `${w}${finalOf(w) ? "과" : "와"}`;
export const ro = (w: string) => `${w}${finalOf(w) && finalOf(w) !== 8 ? "으로" : "로"}`;
export const ida = (w: string) => `${w}${finalOf(w) ? "이다" : "다"}`;
export const ieotda = (w: string) => `${w}${finalOf(w) ? "이었다" : "였다"}`;

export const f3 = (v: number) => {
  const s = v.toFixed(3);
  return v < 1 && v >= 0 ? s.replace(/^0/, "") : s;
};
export const f2 = (v: number) => v.toFixed(2);
export const f1 = (v: number) => v.toFixed(1);
export const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
export const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
export const pct0 = (v: number) => `${Math.round(v * 100)}%`;
export const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
export const ymd = (d: string) => `${d.slice(2, 4)}.${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;
export const wl = (w: number, l: number, d = 0) => `${w}승 ${l}패${d ? ` ${d}무` : ""}`;
export const shortTitle = (t: string) => t.replace(/^\s*\d{4}\s*/, "").trim();

export const LOWER: MetricKey[] = ["era", "whip", "bb9"];
export const BAT: MetricKey[] = ["avg", "obp", "ops", "hr", "sb"];
export const PIT: MetricKey[] = ["era", "whip", "k9", "bb9"];

export const winsIn = (gs: SeasonGame[]) => gs.filter((g) => g.outcome === "승").length;
export const lossesIn = (gs: SeasonGame[]) => gs.filter((g) => g.outcome === "패").length;
export const pctOf = (gs: SeasonGame[]) => {
  const w = winsIn(gs), l = lossesIn(gs);
  return w + l ? w / (w + l) : undefined;
};
export const avgBy = (gs: SeasonGame[], k: "rf" | "ra") =>
  gs.length ? gs.reduce((x, g) => x + g[k], 0) / gs.length : undefined;
export const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// 대회명으로 전국대회 여부 (주말리그·왕중왕전 겸 대회는 전국대회로 본다)
export const isNational = (title?: string) => !!title && !/주말리그/.test(title.replace(/겸\s*주말리그\s*왕중왕전/, ""));

// ── 규칙 실행 컨텍스트 ────────────────────────────────────────
export class Ctx {
  // 이번 규칙이 주로 다룬 학교 — either()·about()이 기록한다 (중복 주장 판정·A/B 균형용)
  side: Side | null = null;
  // 표현 변형 기록용(테스트·측정) — 규칙이 고려한 모든 변형을 받는다
  onPick?: (id: string, variants: string[]) => void;
  private seasonCache = new Map<Side, SeasonGame[]>();
  private winsCache: { a: number; b: number } | null = null;
  private pairKey: string;
  constructor(readonly input: AnalysisInput) {
    this.pairKey = [input.aName, input.bName].sort().join("|");
  }
  name = (s: Side) => (s === "a" ? this.input.aName : this.input.bName);
  oth = (s: Side): Side => (s === "a" ? "b" : "a");
  about = (s: Side | null) => {
    this.side = s;
    return this;
  };
  v = (k: MetricKey, s: Side): number | undefined => {
    const x = this.input.metrics[k]?.[s];
    return x == null || !Number.isFinite(x) ? undefined : x;
  };
  has = (k: MetricKey) => this.v(k, "a") != null && this.v(k, "b") != null;
  cmp = (k: MetricKey) => compareEdge(this.v(k, "a"), this.v(k, "b"), LOWER.includes(k));
  win = (k: MetricKey): Side | null => this.cmp(k).win;
  lv = (k: MetricKey): EdgeLevel => this.cmp(k).level;
  get wins() {
    if (this.winsCache) return this.winsCache;
    let a = 0, b = 0;
    for (const k of Object.keys(this.input.metrics) as MetricKey[]) {
      const w = this.win(k);
      if (w === "a") a += 1;
      else if (w === "b") b += 1;
    }
    return (this.winsCache = { a, b });
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
  // 지표 수로 본 우세 팀
  get leader(): Side | null {
    const w = this.wins;
    return w.a > w.b ? "a" : w.b > w.a ? "b" : null;
  }
  // 두 쪽 중 조건을 만족하는 쪽으로 문구를 만든다. A/B 순서와 무관하게 같은 결과가 나오도록
  // 지표 우세 팀(없으면 학교 이름순)을 먼저 본다.
  either = (fn: (s: Side) => string | null): string | null => {
    const first: Side = this.leader ?? (this.input.aName <= this.input.bName ? "a" : "b");
    for (const s of [first, this.oth(first)]) {
      const t = fn(s);
      if (t) {
        this.side = s;
        return t;
      }
    }
    return null;
  };
  // 표현 변형 — 학교 순서와 무관하게 대진·규칙마다 고정된 하나를 고른다.
  pick = (id: string, variants: string[]) => {
    this.onPick?.(id, variants);
    return variants[hashOf(`${this.pairKey}|${id}`) % variants.length];
  };
  // 맞대결 기준 표기 — 통산이면 "통산", 아니면 선택 시즌
  get h2hScope() {
    return this.input.allYears ? "통산" : `${this.input.year ?? "올"} 시즌`;
  }
  get done() {
    return (this.input.h2h?.games ?? []).filter((g) => g.outcome != null);
  }
  ex = (k: keyof TeamExtra, s: Side): number | undefined => {
    const x = this.input.extra?.[s]?.[k];
    return x == null || !Number.isFinite(x) ? undefined : x;
  };
  season = (s: Side): SeasonGame[] => {
    let g = this.seasonCache.get(s);
    if (!g) {
      g = [...((s === "a" ? this.input.seasonA : this.input.seasonB) ?? [])].sort((x, y) => x.date.localeCompare(y.date));
      this.seasonCache.set(s, g);
    }
    return g;
  };
  recent = (s: Side, n = 5) => this.season(s).slice(-n);
  // 현재 연승·연패 (무승부에서 끊긴다)
  streak = (s: Side): { kind: "승" | "패" | null; n: number } => {
    const g = this.season(s);
    const last = g[g.length - 1]?.outcome;
    if (last !== "승" && last !== "패") return { kind: null, n: 0 };
    let n = 0;
    for (let i = g.length - 1; i >= 0 && g[i].outcome === last; i--) n += 1;
    return { kind: last, n };
  };
  avgOf = (games: SeasonGame[], k: "rf" | "ra") => avgBy(games, k);
}

// ── 규칙 등록부 ──────────────────────────────────────────────
export interface Rule {
  id: string;
  cat: Cat;
  w: number; // 고를 때의 중요도 (높을수록 먼저)
  uses: string[]; // 언급하는 지표 — 같은 지표를 두 줄에서 반복하지 않는다
  claims: string[]; // 주장 태그 — 같은 쪽의 같은 주장은 한 줄만
  run: (c: Ctx) => string | null;
}
export const RULES: Rule[] = [];
export const rule = (id: string, cat: Cat, w: number, uses: string[], run: (c: Ctx) => string | null, claims: string[] = []) =>
  RULES.push({ id, cat, w, uses, claims, run });
