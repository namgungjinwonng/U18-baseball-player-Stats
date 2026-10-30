// AI 경기분석 프롬프트 — 분석 입력(+등급·주요 선수·기록 분석 문장)을 사람이 읽는 표기의 JSON으로 바꾸고,
// 방향별 6항목 구성을 지시하며, 응답 줄을 자르고 입력에 없는 숫자가 든 줄을 걸러낸다.
import type { AnalysisInput, MetricKey, SeasonGame } from "../analysis/core";
import type { TeamDetailMetric, TeamDetailStats } from "../teamDetailGrades";
import type { Player } from "../types";
import type { Record3, TopPlayers } from "../versus";
import { checkEdgeLines, edgeLabel, parseEdgeLabel } from "./edge";

export const MAX_LINES = 6;
const MIN_LINES = 3;
const RECENT = 10; // 팀별 최근 경기 수 (토큰 절약)

const r3 = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, "") : v.toFixed(3)); // .312 / 1.012
const f2 = (v: number) => v.toFixed(2);
const f1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmt = (v: number | null | undefined, f: (n: number) => string) => (v == null || !Number.isFinite(v) ? null : f(v));
const signed = (v: number, f: (n: number) => string) => (v < 0 ? "-" : "+") + f(Math.abs(v));

// [입력 지표, 표시 이름, 표기, 학교 상세 등급 지표]
const METRICS: [MetricKey, string, (n: number) => string, TeamDetailMetric][] = [
  ["pct", "승률", r3, "winPct"], ["avg", "팀 타율", r3, "avg"], ["obp", "출루율", r3, "obp"], ["ops", "OPS", r3, "ops"],
  ["hr", "홈런", String, "hr"], ["sb", "도루", String, "sb"], ["era", "팀 ERA", f2, "era"], ["whip", "WHIP", f2, "whip"],
  ["k9", "K/9", f2, "k9"], ["bb9", "BB/9", f2, "bb9"],
  ["sbat", "강도지수(타격, 1.00=리그 평균)", f2, "batStrength"], ["spit", "강도지수(마운드, 1.00=리그 평균)", f2, "pitStrength"],
];

// 데이터 보강 — 화면이 요청할 때만 만든다(학교 상세 등급, 팀별 주요 선수, 기록 기반 분석 문장).
export interface AiExtra {
  grades?: { a: TeamDetailStats | null; b: TeamDetailStats | null };
  players?: { a: TopPlayers; b: TopPlayers }; // 타자·투수 각 5명까지 — 방향별로 잘라 쓴다
  notes?: { cat: string; text: string }[]; // 기록 기반 분석 문장(분류 포함 — 맞대결·흐름은 흐름 분류만 쓴다)
  scope?: Record<string, unknown>; // 「분석 옵션」 선수 범위(제외한 선수·적용 자료·표본) — 프롬프트 '선수범위'
  conditions?: Record<string, unknown>; // 「분석 옵션」 경기 조건(대상 경기·조건별 성적) — 프롬프트 '경기조건'
  edge?: Record<string, unknown> | null; // 강도지수로 계산한 기록 기반 예상 우위(5:5~8:2, ai/edge.ts) — 프롬프트 '예상우위'
}

const recText = (r: Pick<Record3, "w" | "l" | "d">) => `${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ""}`;
function seasonRecord(r: Record3 | null | undefined) {
  if (!r) return null;
  const g = r.w + r.l + r.d;
  return {
    전적: recText(r), 경기수: g, 득점: r.rf, 실점: r.ra, 득실차: r.rf - r.ra,
    경기당득점: g ? f1(r.rf / g) : null, 경기당실점: g ? f1(r.ra / g) : null,
  };
}
const recentGames = (gs: SeasonGame[] | undefined) =>
  [...(gs ?? [])].sort((x, y) => y.date.localeCompare(x.date)).slice(0, RECENT)
    .map((g) => ({ 날짜: g.date, 상대: g.opp, 대회: g.title, 점수: `${g.rf}:${g.ra}`, 결과: g.outcome }));

// 최근 흐름 — 최근 5경기 전적·득실과 이 기간에 이어지는 연승·연패를 미리 계산해 준다.
function recentForm(gs: SeasonGame[] | undefined) {
  const last = [...(gs ?? [])].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);
  if (!last.length) return null;
  const w = last.filter((g) => g.outcome === "승").length, l = last.filter((g) => g.outcome === "패").length;
  let streak = 0;
  while (streak < last.length && last[streak].outcome === last[0].outcome) streak++;
  return {
    [`최근 ${last.length}경기`]: recText({ w, l, d: last.length - w - l }),
    득점: last.reduce((s, g) => s + g.rf, 0), 실점: last.reduce((s, g) => s + g.ra, 0),
    연속: streak >= 2 && last[0].outcome !== "무" ? `${streak}연${last[0].outcome}` : `가장 최근 경기 ${last[0].outcome}`,
  };
}

// 선수 세부 기록 — 타격·마운드 방향은 선수 위주로 쓰므로 유형(출루·장타·기동, 탈삼진·제구)을 읽을 수 있게 넉넉히 준다.
const batter = (p: Player) => {
  const b = p.batting!;
  return {
    이름: p.name, 학년: p.grade, 타석: b.pa, 타율: r3(b.avg), 출루율: r3(b.obp), 장타율: r3(b.slg), OPS: r3(b.obp + b.slg),
    홈런: b.hr, "2루타": b.b2, 도루: b.sb, 타점: b.rbi, 볼넷: b.bb, 삼진: b.so,
  };
};
const outsOf = (ip: number) => Math.floor(ip) * 3 + Math.round((ip % 1) * 10); // 6.2이닝 = 20아웃
const pitcher = (p: Player) => {
  const s = p.pitching!, outs = outsOf(s.ip);
  return {
    이름: p.name, 학년: p.grade, 경기: s.g, 이닝: String(s.ip), ERA: f2(s.era), WHIP: f2(s.whip),
    탈삼진: s.so, 볼넷: s.bb, 피안타: s.h, "K/9": outs ? f2((s.so * 27) / outs) : null, "BB/9": outs ? f2((s.bb * 27) / outs) : null,
    승: s.w, 패: s.l,
  };
};
// 공통 상대 — 모델이 여러 상대를 직접 비교하다 틀리지 않도록(예: "모두 이겼다") 상대별 우열과 묶음 요약을 미리 계산해 준다.
function commonOpponents(input: AnalysisInput, A: string, B: string) {
  const rows = (input.common ?? []).map((c) => {
    const da = c.a.w - c.a.l, db = c.b.w - c.b.l;
    return { 상대: c.opponent, [A]: recText(c.a), [B]: recText(c.b), 비교: da > db ? `${A} 우세` : db > da ? `${B} 우세` : "같음" };
  });
  const names = (pred: (c: NonNullable<AnalysisInput["common"]>[number]) => boolean) => (input.common ?? []).filter(pred).map((c) => c.opponent);
  return {
    공통상대: rows,
    공통상대요약: rows.length ? {
      [`${A} 우세 상대`]: rows.filter((r) => r.비교 === `${A} 우세`).map((r) => r.상대),
      [`${B} 우세 상대`]: rows.filter((r) => r.비교 === `${B} 우세`).map((r) => r.상대),
      [`두 학교 모두 이기지 못한 상대`]: names((c) => c.a.w === 0 && c.b.w === 0),
      [`두 학교 모두 지지 않은 상대`]: names((c) => c.a.l === 0 && c.b.l === 0),
    } : null,
  };
}

const playerList = (t: TopPlayers, nb: number, np: number) => ({ 타자: t.batters.slice(0, nb).map(batter), 투수: t.pitchers.slice(0, np).map(pitcher) });

// 방향별로 보낼 자료 — 자료에 없으면 쓸 수 없으므로 방향끼리(특히 종합과 맞대결·흐름) 같은 이야기가 겹치지 않는다.
type Section = "팀지표" | "리그평균" | "시즌전적" | "세부지표" | "맞대결" | "공통상대" | "공통상대요약" | "최근경기" | "최근흐름" | "주요선수" | "참고분석" | "선수범위" | "경기조건" | "예상우위";
const SECTIONS: Record<FocusId, Section[]> = {
  overall: ["팀지표", "리그평균", "시즌전적", "세부지표", "맞대결", "공통상대", "공통상대요약", "최근경기", "최근흐름", "주요선수", "참고분석", "선수범위", "경기조건", "예상우위"],
  // 경기조건·예상우위는 모든 방향에 보낸다 — 사용자가 고른 경기(선공/후공·시간대·구장·날씨)가 분석 전체의 전제다.
  batting: ["팀지표", "리그평균", "세부지표", "주요선수", "선수범위", "경기조건", "예상우위"],
  pitching: ["팀지표", "리그평균", "세부지표", "주요선수", "선수범위", "경기조건", "예상우위"],
  h2h: ["시즌전적", "맞대결", "공통상대", "공통상대요약", "최근경기", "최근흐름", "참고분석", "선수범위", "경기조건", "예상우위"],
  // AWAY·HOME 기준에만 있는 방향 — 공략·경계는 선수와 지표, 경기 운영은 득실 흐름까지
  attack: ["팀지표", "리그평균", "세부지표", "주요선수", "선수범위", "경기조건", "예상우위"],
  gameplan: ["팀지표", "리그평균", "시즌전적", "세부지표", "최근경기", "최근흐름", "주요선수", "선수범위", "경기조건", "예상우위"],
  threats: ["팀지표", "리그평균", "세부지표", "주요선수", "선수범위", "경기조건", "예상우위"],
};
// 주요 선수 수 [타자, 투수] — 타격은 타자, 마운드는 투수를 더 많이
const PLAYER_COUNT: Record<FocusId, [number, number]> = { overall: [3, 2], batting: [5, 2], pitching: [3, 4], h2h: [0, 0], attack: [4, 3], gameplan: [3, 4], threats: [5, 3] };
// 맞대결·흐름에 보낼 기록 분석 문장 분류 — 맞대결·공통 상대·흐름만(팀 지표 문장은 종합에서 다룬다)
const FLOW_CATS = new Set(["h2h", "h2hHistory", "h2hDetail", "h2hScore", "common", "form", "window", "stage", "games"]);

// 모델에 넘길 기록 — 키는 한국어, 숫자는 화면과 같은 표기 문자열로 둬서 그대로 옮겨 쓰게 한다.
export function buildPayload(input: AnalysisInput, extra: AiExtra = {}, focus: FocusId = "overall", perspective: Perspective = "both"): AiPayload {
  const full = fullPayload(input, extra, focus, perspective);
  const sections = input.reference ? ["참고기준", "주요선수", "선수범위", "경기조건"] : SECTIONS[focus];
  const keep = new Set<string>(["시즌", "학교", "관점", ...sections]);
  return Object.fromEntries(Object.entries(full).filter(([k]) => keep.has(k))) as AiPayload;
}

// 예상우위에 우리팀 쪽에서 읽은 비율을 붙인다 — 「원주고 우위 7:3」을 HOME 원주고 기준으로 보면 「우리팀 우위 7:3」
function withOurEdge(edge: Record<string, unknown>, A: string, ourIsA: boolean) {
  const s = parseEdgeLabel(String(edge.결과), A);
  return s === null ? edge : { ...edge, 우리팀기준: edgeLabel(ourIsA ? s : -s, "우리팀", "상대팀") };
}

function fullPayload(input: AnalysisInput, extra: AiExtra, focus: FocusId, perspective: Perspective) {
  const A = input.aName, B = input.bName; // A = AWAY(선공), B = HOME(후공)
  const ours = perspective === "away" ? A : perspective === "home" ? B : null;
  const scope = input.allYears ? "통산" : `${input.year} 시즌`;
  const lg = input.lg ?? {};
  const ex = (e: NonNullable<AnalysisInput["extra"]>["a"]) =>
    e && {
      타선삼진율: fmt(e.kPct, pct), 타선볼넷율: fmt(e.bbPct, pct), 순수장타율ISO: fmt(e.iso, r3), BABIP: fmt(e.babip, r3),
      타선볼넷삼진비: fmt(e.bbK, f2), 마운드9이닝당피안타: fmt(e.h9, f2), 실점중비자책비율: fmt(e.unearned, pct), 마운드삼진볼넷비: fmt(e.kbbP, f2),
    };
  const h2h = input.h2h && input.h2h.games.length ? input.h2h : null; // 맞대결이 없으면 빼서 '0승 0패' 문장을 막는다
  const notes = (extra.notes ?? []).filter((n) => focus !== "h2h" || FLOW_CATS.has(n.cat)).map((n) => n.text);
  return {
    시즌: input.year,
    학교: [A, B],
    ...(ours ? { 관점: { 우리팀: ours, 상대팀: ours === A ? B : A } } : {}), // 양팀 비교는 관점 없이 중립으로
    ...(input.reference ? { 참고기준: {
      분석대상연도: input.year, 개인기록연도: input.reference.year,
      대상: "현재 엔트리와 고유번호가 일치하고 전년도 3학년이 아닌 선수만 포함. 학년은 현재 엔트리 기준.",
      학교별확인: input.reference.teams.map((t) => ({ 학교: t.team, 현재엔트리: t.rosterCount, 전년도기록확인: t.matchedCount, 미포함: t.rosterCount - t.matchedCount, 이전소속변경: t.transfers })),
      한계: "올해 팀 성적·등급·최근 흐름이 아니다. 신입생·무기록·미확인 선수는 추정하지 않는다. 표본이 작은 전년도 기록은 제한을 밝힌다.",
    } } : {}),
    팀지표: METRICS.flatMap(([k, label, f, gk]) => {
      const m = input.metrics[k];
      const a = fmt(m?.a, f), b = fmt(m?.b, f);
      if (a == null && b == null) return [];
      const ga = extra.grades?.a?.grades[gk]?.grade, gb = extra.grades?.b?.grades[gk]?.grade;
      return [{
        지표: label, [A]: a, [B]: b,
        ...(ga || gb ? { [`${A} 등급`]: ga ?? null, [`${B} 등급`]: gb ?? null } : {}),
        ...(m?.a != null && m?.b != null ? { [`차이(${A}-${B})`]: signed(m.a - m.b, f) } : {}),
      }];
    }),
    리그평균: {
      타율: fmt(lg.avg, r3), 출루율: fmt(lg.obp, r3), OPS: fmt(lg.ops, r3), ERA: fmt(lg.era, f2), WHIP: fmt(lg.whip, f2),
      "K/9": fmt(lg.k9, f2), "BB/9": fmt(lg.bb9, f2),
    },
    시즌전적: { [A]: seasonRecord(input.recA), [B]: seasonRecord(input.recB) },
    세부지표: { [A]: ex(input.extra?.a), [B]: ex(input.extra?.b) },
    맞대결: h2h && {
      기준: scope,
      [`${A} 기준 전적`]: recText(h2h),
      [`${A} 득점`]: h2h.rf,
      [`${B} 득점`]: h2h.ra,
      경기: h2h.games.map((g) => ({
        날짜: g.date, 대회: g.title, 상태: g.status,
        점수: g.me != null && g.opp != null ? `${A} ${g.me} : ${g.opp} ${B}` : null,
        결과: g.outcome ? `${A} ${g.outcome}` : null,
      })),
    },
    ...commonOpponents(input, A, B),
    최근경기: { [A]: recentGames(input.seasonA), [B]: recentGames(input.seasonB) },
    최근흐름: { [A]: recentForm(input.seasonA), [B]: recentForm(input.seasonB) },
    ...(extra.players ? { 주요선수: { [A]: playerList(extra.players.a, ...PLAYER_COUNT[focus]), [B]: playerList(extra.players.b, ...PLAYER_COUNT[focus]) } } : {}),
    ...(notes.length ? { 참고분석: notes } : {}),
    ...(extra.scope ? { 선수범위: extra.scope } : {}),
    ...(extra.conditions ? { 경기조건: extra.conditions } : {}),
    ...(extra.edge ? { 예상우위: ours ? withOurEdge(extra.edge, A, ours === A) : extra.edge } : {}),
  };
}
type FullPayload = ReturnType<typeof fullPayload>;
export type AiPayload = Partial<FullPayload> & Pick<FullPayload, "시즌" | "학교">;

// 관점 — 양팀 비교는 중립 해설, AWAY·HOME 기준은 그 학교를 우리팀으로 놓고 경기 준비를 돕는다.
export type Perspective = "both" | "away" | "home";
export const PERSPECTIVES: { id: Perspective; label: string }[] = [
  { id: "both", label: "양팀 비교" }, { id: "away", label: "AWAY 기준" }, { id: "home", label: "HOME 기준" },
];
export const perspectiveName = (p: Perspective = "both") => PERSPECTIVES.find((x) => x.id === p)?.label ?? "양팀 비교";

export function systemPrompt(perspective: Perspective = "both") {
  const team = perspective !== "both";
  return [
    ...(team ? [
      "너는 한국 고교야구 전력분석원이다. 사용자가 준 JSON 기록만 근거로, '관점'의 우리팀이 상대팀과의 경기를 준비하도록 돕는 분석을 한국어로 쓴다.",
      "독자는 우리팀 지도자·선수·팬이다. 표의 숫자를 되읽지 말고 그 숫자가 우리팀에 무엇을 뜻하는지(살릴 강점, 경계할 점, 공략할 약점) 풀어 준다.",
    ] : [
      "너는 한국 고교야구 전문 해설위원이다. 사용자가 준 JSON 기록만 근거로 두 학교 매치업 프리뷰를 한국어로 쓴다.",
      "독자는 기록 표를 이미 본 팬이므로, 표의 숫자를 되읽지 말고 그 숫자가 경기에서 무엇을 뜻하는지 풀어 준다.",
    ]),
    "사용자 메시지의 '구성'에 따라 6개 항목을 순서대로 쓴다. 항목 앞에 번호나 제목을 붙이지 않는다.",
    "규칙:",
    "- 숫자는 JSON 값을 표기 그대로만, 항목당 2개 이내로 쓴다. 차이는 JSON의 '차이' 값만 쓰고 새로 계산하지 않는다.",
    "- 'A는 X, B는 Y다'처럼 두 숫자를 나란히 놓기만 하는 문장은 쓰지 않는다. 숫자 뒤에는 반드시 의미를 붙인다.",
    "- 등급(A+~E-)은 그 시즌 전체 학교 가운데 위치다. 리그평균과 비교해 수준을 말할 수 있다.",
    "- 항목마다 1~2문장, 100자 이내로 쓴다. 같은 지표를 두 항목에서 반복하지 않는다.",
    "- 근거 없는 추측(컨디션, 부상, 작전, 선발 예고), 승패 단정, 승리 확률(%)은 쓰지 않는다. '~라면 ~할 수 있다' 같은 조건부 관전 포인트는 쓸 수 있다. 우위 비율은 '예상우위' 규칙으로만 쓴다.",
    "- '예상우위'가 있으면 첫 항목을 '기록 기반 예상 우위는 {결과}'로 시작한다. 경기조건·최근흐름·맞대결·주요선수 같은 다른 기록이 한쪽으로 뚜렷하면 '조정범위' 안에서만 조정할 수 있고, 그때는 'AI 판단은 {학교} {비율}'과 그 근거 기록을 같은 항목에 쓴다. 근거가 약하면 조정하지 않고 기준을 따른다. 비율은 5:5·6:4·7:3·8:2 표기만 쓰고 %나 다른 비율로 바꾸지 않는다. '검증'의 승률은 기준 비율에만 해당한다. '표본주의'가 있으면 밝힌다.",
    "- '선수범위'가 있으면 일부 선수를 뺀 분석이다. 첫 항목에서 무엇을 뺐는지 밝힌다. '선수범위.전체선수기준' 자료(승률·전적·맞대결·최근 흐름 등)는 뺀 선수도 뛴 팀 결과라는 점을 구분해서 쓴다.",
    "- '경기조건'이 있으면 사용자가 고른 대상 경기(선공/후공·시간대·구장·예보 기온·비)를 분석 전체의 전제로 삼는다. 각 학교의 '대상조건'(이번 경기와 같은 조건의 승패·평균 득점·실점)을 '전체' 성적과 견주어, 그 조건에서 강해지거나 약해지는 학교를 해석한다. '통산'은 여러 시즌 표본이라 경향 확인용으로만 쓰고 기간을 밝힌다. 경기 수가 5경기 미만인 구간은 참고 수준이라고 밝힌다. 날씨 예보가 없으면 기온·비 이야기는 하지 않는다. 조건 성적은 경향이며 승패를 단정하는 근거로 쓰지 않는다.",
    "- 맞대결이 null이면 두 학교의 맞대결 이야기를 하지 않는다. 있으면 '맞대결.기준'(통산 또는 시즌)을 밝힌다.",
    "- 경기 수가 5경기 미만인 학교는 표본이 적다는 점을 밝히고 단정하지 않는다.",
    "- '모두', '항상', '전부', '한 번도' 같은 말은 JSON에 그 사실이 직접 있을 때만 쓴다. 공통 상대 비교는 '공통상대'의 '비교'와 '공통상대요약'을 그대로 따른다.",
    "- '~다'로 끝나는 평서문을 쓴다. 학교·선수 이름은 JSON 표기 그대로 쓴다.",
    ...(team ? [
      "- 학교는 처음에 '우리팀 ○○', '상대팀 ○○'으로 부르고 이후 '우리팀'·'상대팀'으로 줄여 쓸 수 있다. 우리팀에 불리한 기록도 숨기거나 좋게 바꾸지 않는다.",
    ] : []),
    "- '참고기준'이 있으면 현재 엔트리 선수의 전년도 개인 기록 참고 분석이다. 처음 항목에서 기록 연도를 밝히고, 전년도 기록을 올해 성적·팀 전체 전력·등급·최근 흐름으로 바꾸어 말하지 않는다. 입력에 없는 졸업 선수·신입생을 추가하지 않는다.",
    '응답은 {"lines": ["항목", ...]} 형식의 JSON만 보낸다.',
  ].join("\n");
}

// 분석 방향 — 키를 넣은 사용자가 고른다. 방향마다 6항목 구성이 다르다({A}·{B}는 학교 이름으로 바뀐다).
// 양팀 비교는 {A}=AWAY·{B}=HOME 중립 해설, AWAY·HOME 기준은 {A}=우리팀·{B}=상대팀이고 방향 3개(공략 포인트·경기 운영·경계 선수)가 더 있다.
export type FocusId = "overall" | "batting" | "pitching" | "h2h" | "attack" | "gameplan" | "threats";
interface Focus { id: FocusId; label: string; plan: string[]; rule?: string }
const BOTH_FOCUS: Focus[] = [
  {
    id: "overall", label: "종합", plan: [
      "총평: 두 팀의 성격 차이와 이 대진의 핵심 구도",
      "{A} 공격 대 {B} 수비: {A} 타선의 색깔(출루·장타·기동력·삼진)이 {B} 마운드의 성향(제구·탈삼진·피안타)과 어떻게 부딪히는지",
      "{B} 공격 대 {A} 수비: 바로 앞 항목의 반대 방향",
      "핵심 선수: '주요선수'에서 양쪽 각 1명 이상을 이름과 대표 기록 1~2개로 짚고 왜 중요한지",
      "흐름·맥락: '최근경기', '공통상대', '참고분석' 가운데 가장 의미 있는 사실 하나의 해석",
      "변수: 조건부 관전 포인트나 표본의 한계",
    ],
    rule: "맞대결·공통 상대·최근 흐름은 5번 항목에서 한 번만 짧게 쓴다(자세한 내용은 맞대결·흐름 분석에서 다룬다). 다른 항목에서는 다시 꺼내지 않는다.",
  },
  {
    id: "batting", label: "타격", plan: [
      "총평: 두 학교 타선을 이끄는 타자들의 유형 차이(출루형·장타형·기동형)",
      "{A} 핵심 타자: '주요선수' {A} 타자 가운데 가장 중요한 1명의 유형과 대표 기록, {B} 마운드 성향과 어떻게 맞물리는지",
      "{A} 다른 주요 타자: {A}의 다른 주요 타자 1~2명이 타선에서 맡는 역할",
      "{B} 핵심 타자: '주요선수' {B} 타자 가운데 가장 중요한 1명의 유형과 대표 기록, {A} 마운드 성향과 어떻게 맞물리는지",
      "{B} 다른 주요 타자: {B}의 다른 주요 타자 1~2명이 타선에서 맡는 역할",
      "변수: 어느 타자가 살아나거나 막히면 흐름이 바뀌는지(조건부)",
    ],
    rule: "선수 위주로 쓴다. 6항목 가운데 5항목 이상에 타자 이름을 넣고, 팀 지표는 선수 이야기를 돕는 데만 짧게 쓴다.",
  },
  {
    id: "pitching", label: "마운드", plan: [
      "총평: 두 학교 마운드를 이끄는 투수들의 유형 차이(탈삼진형·맞혀 잡는 형·제구)",
      "{A} 핵심 투수: '주요선수' {A} 투수 가운데 가장 중요한 1명의 유형과 대표 기록, {B} 타선 성향과 어떻게 맞물리는지",
      "{A} 다른 주요 투수: {A}의 다른 주요 투수 1~2명의 역할(이닝 소화·제구 등)",
      "{B} 핵심 투수: '주요선수' {B} 투수 가운데 가장 중요한 1명의 유형과 대표 기록, {A} 타선 성향과 어떻게 맞물리는지",
      "{B} 다른 주요 투수: {B}의 다른 주요 투수 1~2명의 역할(이닝 소화·제구 등)",
      "변수: 어느 투수의 제구나 이닝 소화가 흔들리면 흐름이 바뀌는지(조건부)",
    ],
    rule: "선수 위주로 쓴다. 6항목 가운데 5항목 이상에 투수 이름을 넣고, 팀 지표는 선수 이야기를 돕는 데만 짧게 쓴다. 선발 예고처럼 누가 던질지는 단정하지 않는다.",
  },
  {
    id: "h2h", label: "맞대결·흐름", plan: [
      "총평: 맞대결·공통 상대·최근 흐름만으로 본 두 학교의 관계",
      "맞대결: 맞대결 경기들의 내용(어느 학교가 이겼는지 학교 이름으로, 점수 차, 대회, 가장 최근 만남). 맞대결이 null이면 기록이 없다는 말 없이 공통 상대 이야기로 대신",
      "공통 상대: '공통상대요약'이 보여 주는 의미",
      "{A} 최근 흐름: '최근흐름'의 최근 5경기 전적·득실·연속 기록이 뜻하는 것",
      "{B} 최근 흐름: '최근흐름'의 최근 5경기 전적·득실·연속 기록이 뜻하는 것",
      "변수: 흐름이 이어지거나 바뀔 조건",
    ],
    rule: "팀 지표·등급·선수 이야기는 쓰지 않는다(종합 분석에서 다룬다). 경기 결과와 흐름만 쓴다.",
  },
];
const TEAM_FOCUS: Focus[] = [
  {
    id: "overall", label: "종합", plan: [
      "총평: 우리팀 {A} 입장에서 본 상대팀 {B} 전력과의 차이와 이 경기의 핵심 구도",
      "우리팀 공격: {A} 타선의 색깔(출루·장타·기동력·삼진)이 {B} 마운드의 성향(제구·탈삼진·피안타)과 어떻게 부딪히고 어디를 공략할 수 있는지",
      "우리팀 수비: {B} 타선을 막기 위해 {A} 마운드가 경계할 점",
      "핵심 선수: '주요선수'에서 우리팀이 기대할 선수와 경계할 상대팀 선수를 각 1명 이상 이름과 대표 기록 1~2개로",
      "흐름·맥락: '최근경기', '공통상대', '참고분석' 가운데 우리팀에 가장 의미 있는 사실 하나의 해석",
      "변수: 우리팀이 유리해지거나 불리해지는 조건(조건부)과 표본의 한계",
    ],
    rule: "맞대결·공통 상대·최근 흐름은 5번 항목에서 한 번만 짧게 쓴다(자세한 내용은 맞대결·흐름 분석에서 다룬다). 다른 항목에서는 다시 꺼내지 않는다.",
  },
  {
    id: "batting", label: "타격", plan: [
      "총평: 우리팀 {A} 타선과 상대팀 {B} 타선의 유형 차이(출루형·장타형·기동형)",
      "우리팀 핵심 타자: '주요선수' {A} 타자 가운데 가장 중요한 1명의 유형과 대표 기록, {B} 마운드를 상대로 살릴 점",
      "우리팀 다른 주요 타자: {A}의 다른 주요 타자 1~2명이 타선에서 맡는 역할",
      "경계할 상대 타자: '주요선수' {B} 타자 가운데 가장 위협적인 1명의 유형과 대표 기록, {A} 마운드가 조심할 점",
      "상대팀 다른 주요 타자: {B}의 다른 주요 타자 1~2명이 타선에서 맡는 역할",
      "변수: 우리팀 타자가 살아나거나 상대 타자를 막으면 흐름이 바뀌는 조건(조건부)",
    ],
    rule: "선수 위주로 쓴다. 6항목 가운데 5항목 이상에 타자 이름을 넣고, 팀 지표는 선수 이야기를 돕는 데만 짧게 쓴다.",
  },
  {
    id: "pitching", label: "마운드", plan: [
      "총평: 우리팀 {A} 마운드와 상대팀 {B} 마운드의 유형 차이(탈삼진형·맞혀 잡는 형·제구)",
      "우리팀 핵심 투수: '주요선수' {A} 투수 가운데 가장 중요한 1명의 유형과 대표 기록, {B} 타선을 상대로 살릴 점",
      "우리팀 다른 주요 투수: {A}의 다른 주요 투수 1~2명의 역할(이닝 소화·제구 등)",
      "공략할 상대 투수: '주요선수' {B} 투수 가운데 가장 중요한 1명의 유형과 대표 기록, {A} 타선이 노릴 점",
      "상대팀 다른 주요 투수: {B}의 다른 주요 투수 1~2명의 역할(이닝 소화·제구 등)",
      "변수: 어느 투수의 제구나 이닝 소화가 흔들리면 우리팀에 유리하거나 불리해지는지(조건부)",
    ],
    rule: "선수 위주로 쓴다. 6항목 가운데 5항목 이상에 투수 이름을 넣고, 팀 지표는 선수 이야기를 돕는 데만 짧게 쓴다. 선발 예고처럼 누가 던질지는 단정하지 않는다.",
  },
  {
    id: "h2h", label: "맞대결·흐름", plan: [
      "총평: 맞대결·공통 상대·최근 흐름만으로 본 우리팀 {A}·상대팀 {B}의 관계",
      "맞대결: 맞대결 경기들의 내용(어느 학교가 이겼는지 학교 이름으로, 점수 차, 대회, 가장 최근 만남). 맞대결이 null이면 기록이 없다는 말 없이 공통 상대 이야기로 대신",
      "공통 상대: '공통상대요약'이 보여 주는 의미",
      "우리팀 최근 흐름: {A}의 '최근흐름' 최근 5경기 전적·득실·연속 기록이 뜻하는 것",
      "상대팀 최근 흐름: {B}의 '최근흐름' 최근 5경기 전적·득실·연속 기록이 뜻하는 것",
      "변수: 우리팀이 흐름을 가져오거나 내줄 조건",
    ],
    rule: "팀 지표·등급·선수 이야기는 쓰지 않는다(종합 분석에서 다룬다). 경기 결과와 흐름만 쓴다.",
  },
  {
    id: "attack", label: "공략 포인트", plan: [
      "총평: 우리팀 {A}가 상대팀 {B}를 상대로 가장 크게 노릴 수 있는 약점과 그 근거 기록",
      "상대 마운드 약점: {B} 마운드의 제구(BB/9)·피안타(WHIP)·탈삼진(K/9) 가운데 리그평균이나 등급으로 보아 약한 곳",
      "공략할 우리 타자: '주요선수' {A} 타자 가운데 그 약점을 파고들 유형의 타자 1~2명과 대표 기록",
      "상대 타선 약점: {B} 타선의 삼진율·볼넷율·장타력 가운데 약한 곳",
      "우리 마운드 대응: '주요선수' {A} 투수 가운데 그 약점을 찌를 유형의 투수 1~2명과 대표 기록",
      "변수: 공략이 통하지 않을 조건(조건부)과 표본의 한계",
    ],
    rule: "상대의 약점과 그 약점을 파고들 우리 선수를 짝지어 쓴다. 상대의 강점은 공략을 막는 조건으로만 짧게 쓴다. 작전·타순·선발은 단정하지 않는다.",
  },
  {
    id: "gameplan", label: "경기 운영", plan: [
      "총평: 우리팀 {A}가 이 경기를 끌고 가야 할 흐름(선취점·접전·다득점 등)과 그 근거 기록",
      "초반 운영: '경기조건'의 선공/후공과 '대상조건', 두 팀의 득점·실점 흐름으로 본 초반 대비. 경기조건이 없으면 '시즌전적'·'최근흐름'의 득점·실점으로",
      "마운드 운용: '주요선수' {A} 투수들의 이닝 소화·제구로 본 운용 포인트",
      "득점 방식: {A} 타선의 출루·도루·장타 성향 가운데 {B} 마운드를 상대로 점수를 내기 좋은 방식",
      "조건 대응: '경기조건'의 시간대·구장·날씨 예보에서 우리팀이 대비할 점. 경기조건이 없으면 '최근경기'에서 드러난 접전·대량 실점 경향",
      "변수: 경기 후반 흐름을 바꿀 조건(조건부)",
    ],
    rule: "기록에 근거한 운영 제안을 '~라면 ~하는 편이 낫다'처럼 조건부로 쓴다. 작전·타순·선발 예고·누가 던질지는 단정하지 않는다. 경기조건이 없으면 선공/후공·시간대·날씨는 말하지 않는다.",
  },
  {
    id: "threats", label: "경계 선수", plan: [
      "총평: 상대팀 {B}의 위협이 타선과 마운드 가운데 어디에 몰려 있는지",
      "경계 타자 1: '주요선수' {B} 타자 가운데 가장 위협적인 1명의 유형·대표 기록과 우리팀 {A} 마운드의 대응",
      "경계 타자 2: {B}의 두 번째로 경계할 타자 1명의 유형·대표 기록과 대응",
      "경계 타자 3: {B}의 세 번째로 경계할 타자 1명(출루·기동력 위주 선수 포함)의 유형·대표 기록과 대응",
      "경계 투수: '주요선수' {B} 투수 1~2명의 유형·대표 기록과 {A} 타선의 대응",
      "변수: 이 선수들을 막거나 놓쳤을 때 달라지는 흐름(조건부)",
    ],
    rule: "상대 선수 위주로 쓴다. 6항목 가운데 5항목 이상에 상대 선수 이름을 넣고, 같은 선수를 두 항목에서 다루지 않는다. 대응은 기록에 근거한 조건부 제안으로 쓴다.",
  },
];
export const FOCUS_IDS = TEAM_FOCUS.map((f) => f.id);
export const focusList = (p: Perspective = "both") => (p === "both" ? BOTH_FOCUS : TEAM_FOCUS);
// 시즌 초 전년도 개인 기록 참고 분석에서는 팀 경기 결과가 없어 쓸 수 없는 방향
export const REFERENCE_UNAVAILABLE = new Set<FocusId>(["h2h", "gameplan"]);
export const focusLabel = (id?: FocusId) => TEAM_FOCUS.find((f) => f.id === id)?.label ?? "종합";

export function buildUserPrompt(payload: AiPayload, previous?: string[], focus: FocusId = "overall", perspective: Perspective = "both") {
  // AWAY·HOME 기준은 {A}가 우리팀 — HOME 기준이면 학교 순서를 뒤집어 넣는다.
  const [A, B] = perspective === "home" ? [payload.학교[1], payload.학교[0]] : payload.학교;
  const team = perspective !== "both";
  const list = focusList(perspective);
  const f = list.find((x) => x.id === focus) ?? list[0];
  const referencePlan = focus === "overall" ? (team ? [
    "총평: 참고기준의 개인기록연도를 밝히고, 현재 엔트리에서 확인된 선수들만으로 본 우리팀 {A}·상대팀 {B}의 구도와 한계",
    "우리팀 공격: {A} 현재 엔트리 주요 타자의 전년도 기록이 보여 주는 유형과 표본",
    "상대팀 공격: {B} 현재 엔트리 주요 타자의 전년도 기록이 보여 주는 유형과 표본",
    "우리팀 마운드: {A} 현재 엔트리 주요 투수의 전년도 기록과 이닝 표본",
    "상대팀 마운드: {B} 현재 엔트리 주요 투수의 전년도 기록과 이닝 표본",
    "한계: 전년도 기록이 없는 선수·신입생·올해 성장·올해 최근 흐름은 판단할 수 없다는 점",
  ] : [
    "총평: 참고기준의 개인기록연도를 밝히고, 현재 엔트리에서 확인된 선수들만으로 본 두 학교의 구도와 한계",
    "{A} 공격: 현재 엔트리 주요 타자의 전년도 기록이 보여 주는 유형과 표본",
    "{B} 공격: 현재 엔트리 주요 타자의 전년도 기록이 보여 주는 유형과 표본",
    "{A} 마운드: 현재 엔트리 주요 투수의 전년도 기록과 이닝 표본",
    "{B} 마운드: 현재 엔트리 주요 투수의 전년도 기록과 이닝 표본",
    "한계: 전년도 기록이 없는 선수·신입생·올해 성장·올해 최근 흐름은 판단할 수 없다는 점",
  ]) : f.plan.map((s) => s.replace(/마운드 성향/g, "확인 가능한 투수의 전년도 기록").replace(/타선 성향/g, "확인 가능한 타자의 전년도 기록"));
  const plan = (payload.참고기준 ? referencePlan : f.plan).map((s, i) => `${i + 1}) ${s.split("{A}").join(A).split("{B}").join(B)}`);
  const referenceRule = "전년도 개인 기록만으로 참고 분석한다. 첫 항목에 개인기록연도를 명시한다. 팀 지표·학교 등급·리그 평균·올해 승률·올해 연승·선발 예고는 쓰지 않는다. 이전소속변경 선수도 현재 학교 이름으로 설명하되 과거 기록임을 밝힌다. 한쪽의 타자·투수 자료가 없으면 없다고 밝히고 다른 선수를 지어내지 않는다. 선수 이름과 기록 중심으로 쓰되 확인된 선수가 적으면 다른 선수를 요구하지 말고 표본 한계를 설명한다.";
  const conditionRule = payload.경기조건
    ? "\n경기조건 규칙: 첫 항목에서 대상 경기 조건을 '○○ 선공·○○ 후공'처럼 학교 이름으로 밝힌다(모르면 생략). 2~5번 항목 가운데 2개 이상은 그 항목 주제와 맞는 '대상조건' 수치(승패 또는 평균 득점·실점)를 그대로 인용해 '전체' 성적과 견준다(예: 오전 경기 평균 실점이 전체보다 많다). 마지막 항목은 두 학교의 '대상조건' 성적 차이로 이번 경기 조건에서 갈릴 변수를 쓴다. 조건 성적은 경향이며 승패 단정 근거가 아니다."
    : "";
  const edgeRule = payload.예상우위 ? `
예상우위 규칙: 첫 항목은 '기록 기반 예상 우위는 ${String(payload.예상우위.결과)}'로 시작하고, 조정할 때만 '조정범위' 안에서 'AI 판단은 …'과 근거를 붙인다.` : "";
  const parts = [`기록(JSON):\n${JSON.stringify(payload)}`, `구성:\n${plan.join("\n")}${payload.참고기준 ? `\n이 방향의 규칙: ${referenceRule}` : f.rule ? `\n이 방향의 규칙: ${f.rule}` : ""}${conditionRule}${edgeRule}`];
  if (previous?.length) {
    parts.push(
      `이전 분석:\n${previous.map((l) => `- ${l}`).join("\n")}\n` +
        "이전 분석과 다른 근거와 표현으로 새로 쓴다. 이전 문장을 되풀이하지 않는다."
    );
  }
  return parts.join("\n\n");
}

// 응답 형식 — Claude·GPT는 JSON Schema, Gemini는 OpenAPI 부분집합(대문자 type)을 쓴다.
export const JSON_SCHEMA = {
  type: "object",
  properties: { lines: { type: "array", items: { type: "string" } } },
  required: ["lines"],
  additionalProperties: false,
};
export const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: { lines: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["lines"],
};

// 입력 JSON에 나온 숫자 — 문장의 숫자는 이 값(같은 자릿수로 반올림한 값 포함)이어야 한다.
function allowedNumbers(payload: unknown): number[] {
  const out: number[] = [];
  JSON.stringify(payload).replace(/\d*\.\d+|\d+/g, (t) => {
    out.push(parseFloat(t));
    return t;
  });
  return out;
}
const decimals = (t: string) => (t.includes(".") ? t.split(".")[1].length : 0);
const roundTo = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

// 경기 수·연속 기록·날짜 같은 작은 정수는 기록에서 셀 수 있어 허용하고, 그 밖의 숫자는 입력에 있어야 한다.
const SMALL_INT = 31;
export function unknownNumbers(line: string, allowed: number[]): string[] {
  const tokens = line.match(/\d*\.\d+|\d+/g) ?? [];
  return tokens.filter((t) => {
    const v = parseFloat(t), d = decimals(t);
    if (d === 0 && v <= SMALL_INT) return false;
    return !allowed.some((a) => Math.abs(roundTo(a, d) - v) < 1e-9);
  });
}

export class InvalidAnswer extends Error {}

// 지시를 어기고 붙는 항목 제목("총평.", "관전 포인트 1:")·목록 기호를 뗀다. "2026 시즌" 같은 첫 숫자는 남긴다.
const LEAD = /^(?:[-•·]\s*|\d+[.)]\s+|(?:총평|관전\s?포인트\s?\d*|핵심\s?(?:선수|타자|투수)|흐름·?맥락|변수|공격 대 수비|상대\s?(?:마운드|타선)\s?약점|공략할\s?우리\s?타자|우리\s?마운드\s?대응|초반\s?운영|마운드\s?운용|득점\s?방식|조건\s?대응|경계\s?(?:타자\s?\d?|투수)|(?:우리팀|상대팀)\s?(?:공격|수비|마운드|최근\s?흐름|핵심\s?(?:타자|투수)|다른\s?주요\s?(?:타자|투수))|경계할\s?상대\s?타자|공략할\s?상대\s?투수)\s*[.:：)]\s*)/;

// 응답 문자열 → 화면 줄. 형식이 틀리거나 쓸 수 있는 줄이 3줄 미만이면 실패로 본다.
// 예상우위가 있으면 기준에서 한 구간을 넘는 비율 문장을 버리고, 화면에 보일 기준·AI 판단 비율을 함께 낸다.
export interface AnswerEdge { base: string; adjusted?: string }
export function parseAnswer(raw: string, payload: AiPayload): { lines: string[]; dropped: string[]; edge?: AnswerEdge } {
  let lines: unknown;
  try {
    lines = (JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")) as { lines?: unknown }).lines;
  } catch {
    throw new InvalidAnswer("응답 형식이 올바르지 않습니다.");
  }
  if (!Array.isArray(lines)) throw new InvalidAnswer("응답 형식이 올바르지 않습니다.");
  const allowed = allowedNumbers(payload);
  const kept: string[] = [], dropped: string[] = [];
  for (const l of lines) {
    if (typeof l !== "string" || !l.trim()) continue;
    const text = l.trim().replace(LEAD, "");
    if (unknownNumbers(text, allowed).length) dropped.push(text);
    else kept.push(text);
  }
  const result = payload.예상우위?.결과;
  const baseLabel = typeof result === "string" ? result : null;
  const [A, B] = payload.학교;
  const base = baseLabel ? parseEdgeLabel(baseLabel, A) : null;
  let edge: AnswerEdge | undefined;
  let out = kept;
  if (baseLabel && base !== null) {
    // AWAY·HOME 기준 분석은 「우리팀」·「상대팀」으로 부르기도 한다 — 관점의 우리팀이 A인지 B인지 넘긴다.
    const ours = payload.관점 ? (payload.관점.우리팀 === A ? "a" : "b") : undefined;
    const checked = checkEdgeLines(kept, A, B, base, ours);
    out = checked.kept;
    dropped.push(...checked.dropped);
    edge = { base: baseLabel, ...(checked.adjusted ? { adjusted: checked.adjusted } : {}) };
  }
  if (out.length < MIN_LINES) throw new InvalidAnswer("기록과 맞지 않는 숫자가 많아 분석을 쓰지 않았습니다.");
  return { lines: out.slice(0, MAX_LINES), dropped, ...(edge ? { edge } : {}) };
}
