// 경기 분석 규칙 — 전체 구도와 맞대결(전적·세부·시즌 흐름·맞대결 득점). 맞대결 문장에는 기준(통산/시즌)을 넣는다.
import {
  eun, eul, f1, ga, gwa, ida, ieotda, md, rule, signed, wl, ymd,
  type AnalysisGame, type Ctx, type Side,
} from "./core";

// ── 1. 전체 구도 (8) — 분야 안에서 순서대로 하나만 ───────────────
const overall = (c: Ctx) => {
  const w = c.wins;
  const lead = c.leader;
  return { w, lead, decided: w.a + w.b, wl: lead ? w[lead] : 0, ll: lead ? w[c.oth(lead)] : 0 };
};
rule("O1", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.lead && o.ll === 0 && o.wl >= 6)) return null;
  c.about(o.lead);
  const L = c.name(o.lead), O = c.name(c.oth(o.lead));
  return c.pick("O1", [
    `${ga(L)} 비교한 ${c.compared}개 지표 가운데 ${o.wl}개에서 앞서고 뒤진 항목은 없다. 기록상 전력 차가 분명한 대진이다.`,
    `${c.compared}개 지표 중 ${L}의 열세 항목은 0개다. 수치만 보면 빈틈이 보이지 않는다.`,
    `앞선 지표 ${o.wl}개, 뒤진 지표 0개로 ${ga(L)} 비교 항목 전반에서 우위다.`,
    `${eun(L)} 차이가 난 지표 ${o.wl}개 모두에서 ${eul(O)} 앞선다. 기록상 열세 항목이 없다.`,
    `${L}의 지표 우위는 ${o.wl}개, 열세는 0개다. 비교 항목 전반에서 앞선다.`,
  ]);
}, ["dominance"]);
rule("O2", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.lead && o.ll === 1 && o.wl >= 6)) return null;
  c.about(o.lead);
  const L = c.name(o.lead), O = c.name(c.oth(o.lead));
  return c.pick("O2", [
    `${ga(L)} ${o.wl}개 지표에서 앞서고 1개만 내줬다. 기록상 우세가 뚜렷하다.`,
    `앞선 지표 ${o.wl}:1, ${L} 쪽으로 크게 기운 대진이다.`,
    `${O}의 우위 항목은 1개뿐이다(${o.wl}:1). 수치상 ${L} 우세가 분명하다.`,
    `${eun(L)} 한 개 항목을 빼고 차이가 난 지표에서 모두 앞선다(${o.wl}:1).`,
    `차이가 난 지표 ${o.wl + 1}개 중 ${o.wl}개를 ${ga(L)} 가져갔다.`,
  ]);
}, ["dominance"]);
rule("O7", "overall", 100, [], (c) => {
  if (!(c.compared > 0 && overall(c).decided === 0)) return null;
  return c.pick("O7", [
    "모든 지표가 3% 이내 차이다. 기록만으로는 우열을 가리기 어렵다.",
    `비교한 ${c.compared}개 지표 모두 차이가 3% 안쪽이다. 수치상 거의 같은 전력이다.`,
    "지표마다 차이가 미미하다. 기록상 두 팀은 비슷한 수준이다.",
    `${c.compared}개 지표에서 뚜렷하게 앞선 쪽이 없다. 기록으로는 대등한 대진이다.`,
    `${c.compared}개 지표 모두 우열을 가를 만한 차이가 없다.`,
  ]);
}, ["overall"]);
rule("O8", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.decided > 0 && o.decided <= 3 && c.compared - o.decided >= 6)) return null;
  return c.pick("O8", [
    `대부분 지표가 비슷하고 ${o.decided}개 항목에서만 차이가 난다. 작은 차이가 승부를 가를 수 있다.`,
    `${c.compared}개 지표 중 차이가 나는 항목은 ${o.decided}개뿐이다. 나머지는 3% 이내로 비슷하다.`,
    `기록상 대부분 대등하다. 뚜렷한 차이는 ${o.decided}개 항목에 몰려 있다.`,
    `비슷한 지표가 ${c.compared - o.decided}개, 차이 나는 지표가 ${o.decided}개다. 근소한 차이의 대진이다.`,
    `지표 대부분은 대등하고, 차이는 ${o.decided}개 항목에서만 보인다.`,
  ]);
}, ["overall"]);
rule("O3", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.lead && o.wl / o.decided >= 0.75)) return null;
  c.about(o.lead);
  const L = c.name(o.lead), O = c.name(c.oth(o.lead));
  return c.pick("O3", [
    `${ga(L)} ${o.wl}:${o.ll}로 대부분 지표에서 앞선다. 기록상 전력은 ${L} 쪽이다.`,
    `지표 비교는 ${o.wl}:${o.ll}, ${L} 쪽으로 크게 기운다. ${O}의 강점은 앞선 ${o.ll}개 항목에 있다.`,
    `${L} 우세가 뚜렷한 대진이다(앞선 지표 ${o.wl}개, 뒤진 지표 ${o.ll}개).`,
    `앞선 지표 수 ${o.wl}:${o.ll}. ${O}보다 ${L}의 기록이 전반적으로 낫다.`,
    `${eun(L)} 지표 ${o.wl}개에서 앞서고 ${o.ll}개에서 뒤진다. 기록상 우세가 분명하다.`,
  ]);
}, ["dominance"]);
rule("O4", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.lead && o.wl / o.decided >= 0.6)) return null;
  c.about(o.lead);
  const L = c.name(o.lead), O = c.name(c.oth(o.lead));
  return c.pick("O4", [
    `${ga(L)} ${o.wl}:${o.ll}로 우세하지만 압도적이진 않다. ${O}도 ${o.ll}개 항목에서 앞선다.`,
    `앞선 지표 ${o.wl}:${o.ll}로 ${L} 쪽이 낫지만 격차가 크다고 보기는 어렵다.`,
    `${eun(L)} 더 많은 지표(${o.wl}개)에서 앞서지만 ${O}도 ${o.ll}개 항목에서 우위를 지켰다.`,
    `지표 비교 ${o.wl}:${o.ll}. 우세는 ${L} 쪽이되 ${O}의 강점 항목도 분명히 있다.`,
    `${L} 쪽이 지표 ${o.wl}:${o.ll}로 앞선다. 우세하지만 일방적이지는 않다.`,
  ]);
}, ["overall"]);
rule("O5", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!o.lead) return null;
  c.about(o.lead);
  const L = c.name(o.lead), O = c.name(c.oth(o.lead));
  return c.pick("O5", [
    `앞선 항목 ${o.wl}:${o.ll}, 근소하게 ${L} 쪽으로 기운 박빙 구도다.`,
    `지표는 ${o.wl}:${o.ll}로 거의 반반이다. 기록상 우열이 크지 않다.`,
    `${ga(L)} 한 끗 앞서는 정도(${o.wl}:${o.ll})다. 어느 쪽 우세라고 단정하기 어렵다.`,
    `앞선 지표 수는 ${L} ${o.wl}개, ${O} ${o.ll}개로 차이가 작다.`,
    `지표 ${o.wl}:${o.ll}, ${ga(L)} 근소하게 앞선다.`,
  ]);
}, ["overall"]);
rule("O6", "overall", 100, [], (c) => {
  const o = overall(c);
  if (!(o.decided > 0 && !o.lead)) return null;
  const A = c.name("a"), B = c.name("b");
  return c.pick("O6", [
    `앞선 항목 수가 ${o.w.a}:${o.w.b}로 똑같다. 두 팀의 강점이 서로 다른 곳에 있다.`,
    `지표 우위 개수 ${o.w.a}:${o.w.b}, 기록상 균형이 맞는 대진이다.`,
    `${gwa(A)} ${B}의 앞선 지표 수는 ${o.w.a}개로 같다. 항목별 강약이 엇갈린다.`,
    `어느 쪽도 지표 수에서 앞서지 못했다(${o.w.a}:${o.w.b}). 강점의 종류가 다른 두 팀이다.`,
    `두 팀이 앞선 지표 수가 ${o.w.a}개씩 같다.`,
  ]);
}, ["overall"]);

// ── 2. 맞대결 전적 (8) ───────────────────────────────────────
const h2hLead = (c: Ctx): Side | null => {
  const h = c.input.h2h;
  if (!h) return null;
  return h.w > h.l ? "a" : h.l > h.w ? "b" : null;
};
const h2hRec = (c: Ctx, s: Side) => {
  const h = c.input.h2h!;
  return s === "a" ? wl(h.w, h.l, h.d) : wl(h.l, h.w, h.d);
};
rule("H1", "h2h", 40, [], (c) => {
  if (!(!c.input.allYears && c.done.length === 0)) return null;
  const y = c.input.year ? `${c.input.year} 시즌` : "올 시즌";
  return c.pick("H1", [
    `${y} 두 팀의 맞대결 기록은 아직 없다.`,
    `${y}에는 아직 두 팀이 맞붙지 않았다.`,
    `${y} 맞대결은 아직 한 번도 없었다.`,
    `${y} 상대 전적이 없어 맞대결로는 비교할 수 없다.`,
  ]);
}, ["h2hNone"]);
rule("H2", "h2h", 40, [], (c) => {
  if (!(c.input.allYears && c.done.length === 0)) return null;
  return c.pick("H2", [
    "수집된 시즌을 통틀어도 두 팀이 맞붙은 기록이 없다.",
    "통산 맞대결 기록이 없어 상대 전적으로는 비교할 수 없다.",
    "두 팀의 통산 맞대결 기록은 아직 없다. 비교는 각자의 시즌 기록으로 한다.",
    "수집된 기록 안에서는 두 팀이 만난 적이 없다.",
  ]);
}, ["h2hNone"]);
rule("H8", "h2h", 95, [], (c) => {
  const h = h2hLead(c);
  const m = c.leader;
  if (!(h && m && h !== m && c.done.length >= 1)) return null;
  c.about(h);
  const H = c.name(h), M = c.name(m), r = h2hRec(c, h), sc = c.h2hScope;
  return c.pick("H8", [
    `${sc} 맞대결은 ${ga(H)} ${r}로 앞섰지만 지표는 ${M} 우위다. 상대 전적과 기록이 엇갈린다.`,
    `기록은 ${M} 쪽인데 ${sc} 맞대결은 ${H} ${ida(r)}. 상성이 지표와 다르게 나타났다.`,
    `${eun(H)} 지표에서 밀리지만 ${sc} 맞대결에서는 ${r}로 앞섰다.`,
    `지표 우세(${M})와 ${sc} 맞대결 우세(${H})가 서로 다른 대진이다(맞대결 ${r}).`,
    `${sc} 맞대결 결과(${H} ${r})는 지표 우세(${M})와 반대다.`,
  ]);
}, ["h2hVsMetric"]);
rule("H3", "h2h", 90, [], (c) => {
  const h = h2hLead(c);
  const x = c.input.h2h;
  if (!(h && x && c.done.length >= 2 && Math.min(x.w, x.l) === 0 && x.d === 0)) return null;
  c.about(h);
  const H = c.name(h), O = c.name(c.oth(h)), n = c.done.length, sc = c.h2hScope;
  return c.pick("H3", [
    `${sc} 맞대결 ${n}전 전승, ${ga(H)} 상대 전적에서 확실히 앞선다.`,
    `${eun(H)} ${sc} 맞대결 ${n}경기에서 한 번도 지지 않았다.`,
    `${sc} 상대 전적은 ${H}의 ${n}전 전승이다. ${O}에게는 아직 맞대결 승리가 없다.`,
    `${sc} 맞대결은 ${n}경기 모두 ${H} 승리로 끝났다.`,
    `${sc} 맞대결 ${n}경기에서 ${ga(H)} 모두 이겼다.`,
  ]);
}, ["h2hEdge"]);
rule("H4", "h2h", 90, [], (c) => {
  if (c.done.length !== 1) return null;
  const g = c.done[0];
  if (g.outcome === "무" || g.me == null || g.opp == null) return null;
  const s: Side = g.outcome === "승" ? "a" : "b";
  c.about(s);
  const [x, y] = s === "a" ? [g.me, g.opp] : [g.opp, g.me];
  const S = c.name(s), sc = c.h2hScope, d = ymd(g.date);
  return c.pick("H4", [
    `${sc} 맞대결은 1경기(${d})뿐이고 ${S}의 ${x}:${y} 승리였다.`,
    `두 팀은 ${sc} 한 번 맞붙었고(${d}) ${ga(S)} ${x}:${y}로 이겼다.`,
    `${sc} 유일한 맞대결(${d})에서 ${ga(S)} ${x}:${y} 승리를 거뒀다.`,
    `${sc} 맞대결 1경기는 ${S}의 ${x}:${y} 승리다. 한 경기라 상성을 단정하긴 어렵다.`,
    `${sc} 맞대결 기록은 ${d} 한 경기, ${S}의 ${x}:${y} 승리뿐이다.`,
  ]);
}, ["h2hOne"]);
rule("H5", "h2h", 90, [], (c) => {
  const g = c.done[0];
  if (!(c.done.length === 1 && g.outcome === "무")) return null;
  const sc = c.h2hScope, d = ymd(g.date);
  return c.pick("H5", [
    `${sc} 유일한 맞대결(${d})은 ${g.me}:${g.opp} 무승부였다.`,
    `두 팀은 ${sc} 한 번 맞붙어(${d}) ${g.me}:${g.opp}로 비겼다.`,
    `${sc} 맞대결 1경기(${d})는 승부를 가리지 못했다(${g.me}:${g.opp}).`,
    `${sc} 상대 전적은 무승부 1경기(${d}, ${g.me}:${g.opp})뿐이다.`,
  ]);
}, ["h2hOne"]);
rule("H6", "h2h", 90, [], (c) => {
  const h = h2hLead(c);
  if (!(h && c.done.length >= 2)) return null;
  c.about(h);
  const H = c.name(h), O = c.name(c.oth(h)), sc = c.h2hScope;
  return c.pick("H6", [
    `${sc} 맞대결 ${h2hRec(c, h)}로 ${ga(H)} 우세하다.`,
    `${sc} 상대 전적은 ${H} 기준 ${ida(h2hRec(c, h))}. 맞대결에서는 ${H} 쪽이 앞섰다.`,
    `${eun(H)} 이 상대에게 ${sc} ${h2hRec(c, h)}로 강했다.`,
    `${sc} 맞대결 성적은 ${H} ${h2hRec(c, h)}, ${O} ${ida(h2hRec(c, c.oth(h)))}.`,
    `${sc} 맞대결에서는 ${H} 쪽이 더 많이 이겼다(${h2hRec(c, h)}).`,
  ]);
}, ["h2hEdge"]);
rule("H7", "h2h", 90, [], (c) => {
  const x = c.input.h2h;
  if (!(x && c.done.length >= 2 && x.w === x.l)) return null;
  const r = wl(x.w, x.l, x.d), sc = c.h2hScope;
  return c.pick("H7", [
    `${sc} 맞대결 전적은 ${r}로 팽팽하다.`,
    `${sc} 상대 전적이 ${r}로 같다. 맞대결에서 우열이 갈리지 않았다.`,
    `두 팀은 ${sc} 맞대결에서 ${x.w}승씩 나눠 가졌다${x.d ? `(무승부 ${x.d})` : ""}.`,
    `${sc} ${c.done.length}경기 맞대결 결과는 ${r}, 어느 쪽도 앞서지 못했다.`,
    `${sc} 맞대결 ${c.done.length}경기, 두 팀의 승수가 같다(${r}).`,
  ]);
}, ["h2hEven"]);

// ── 3. 맞대결 세부 (8) ───────────────────────────────────────
const winnerOf = (g: AnalysisGame): Side | null => (g.outcome === "승" ? "a" : g.outcome === "패" ? "b" : null);
const latest = (c: Ctx) => [...c.done].sort((x, y) => y.date.localeCompare(x.date))[0];
rule("D3", "h2hDetail", 72, ["flip"], (c) => {
  const h = h2hLead(c);
  const g = latest(c);
  const r = g && winnerOf(g);
  if (!(h && r && c.done.length >= 2 && r !== h)) return null;
  c.about(r);
  const H = c.name(h), R = c.name(r), sc = c.h2hScope, d = ymd(g.date);
  return c.pick("D3", [
    `${sc} 맞대결은 ${H} 우세지만 가장 최근 경기(${d})는 ${ga(R)} 가져갔다.`,
    `${sc} 상대 전적은 ${H} 쪽이지만 가장 최근 맞대결(${d})의 승자는 ${ieotda(R)}.`,
    `${eun(R)} ${sc} 맞대결에서 밀렸지만 가장 최근 경기(${d})는 이겼다.`,
    `가장 최근 맞대결(${d}) 승자는 ${R}로, ${sc} 우세 팀(${H})과 다르다.`,
  ]);
}, ["h2hFlip"]);
rule("D4", "h2hDetail", 70, [], (c) => {
  const g = latest(c);
  const r = g && winnerOf(g);
  if (!g || !r || g.me == null || g.opp == null || Math.abs(g.me - g.opp) < 7) return null;
  c.about(r);
  const [x, y] = r === "a" ? [g.me, g.opp] : [g.opp, g.me];
  const R = c.name(r), d = ymd(g.date);
  return c.pick("D4", [
    `가장 최근 맞대결(${d})은 ${R}의 ${x}:${y} 대승이었다.`,
    `가장 최근 맞대결(${d})에서 ${ga(R)} ${x}:${y}, ${x - y}점 차로 이겼다.`,
    `${eun(R)} 가장 최근 맞대결(${d})을 ${x}:${y}로 크게 이겼다.`,
    `마지막 맞대결(${d}) 점수는 ${R} 기준 ${x}:${y}, ${x - y}점 차였다.`,
  ]);
}, ["h2hLatest"]);
rule("D1", "h2hDetail", 68, [], (c) => {
  if (!(c.done.length >= 2 && c.done.every((g) => g.me != null && g.opp != null && Math.abs(g.me - g.opp) <= 2))) return null;
  const n = c.done.length, sc = c.h2hScope;
  return c.pick("D1", [
    `${sc} 맞대결 ${n}경기가 모두 2점 차 이내 접전이었다.`,
    `두 팀의 ${sc} 맞대결은 ${n}경기 모두 2점 차 안에서 갈렸다.`,
    `${sc} 맞대결에서 3점 차 이상 벌어진 경기가 없다(${n}경기).`,
    `${sc} 맞대결 ${n}경기 모두 점수 차가 2점 이하였다.`,
  ]);
}, ["h2hClose"]);
rule("D5", "h2hDetail", 66, [], (c) => {
  const seq = [...c.done].sort((x, y) => x.date.localeCompare(y.date)).map(winnerOf);
  if (!(seq.length >= 3 && seq.every((s, i) => s && (i === 0 || s !== seq[i - 1])))) return null;
  const n = seq.length, sc = c.h2hScope;
  return c.pick("D5", [
    `${sc} 맞대결에서 승패를 번갈아 주고받았다. 한쪽으로 흐름이 이어진 적이 없다.`,
    `${sc} 맞대결 ${n}경기는 승자가 매번 바뀌었다.`,
    `두 팀은 ${sc} 맞대결에서 번갈아 이겼다(${n}경기).`,
    `${sc} 맞대결에서 연승이 한 번도 없었다. 승패가 매 경기 엇갈렸다.`,
  ]);
}, ["h2hSwing"]);
const avgTotal = (c: Ctx) => {
  const xs = c.done.filter((g) => g.me != null && g.opp != null);
  return xs.length ? xs.reduce((sum, g) => sum + g.me! + g.opp!, 0) / xs.length : undefined;
};
rule("D7", "h2hDetail", 60, [], (c) => {
  const t = avgTotal(c);
  if (!(t != null && t >= 14)) return null;
  const sc = c.h2hScope, n = c.done.length;
  return c.pick("D7", [
    `${sc} 맞대결에서 경기당 평균 ${f1(t)}점이 나왔다. 점수가 많이 난 상성이다.`,
    `${sc} 맞대결 ${n}경기의 경기당 양 팀 합계 득점은 ${f1(t)}점으로 높다.`,
    `두 팀이 만나면 점수가 많이 났다(${sc} 맞대결 경기당 ${f1(t)}점).`,
    `${sc} 맞대결은 경기당 ${f1(t)}점이 오간 다득점 경기였다.`,
  ]);
}, ["h2hTotal"]);
rule("D8", "h2hDetail", 60, [], (c) => {
  const t = avgTotal(c);
  if (!(t != null && c.done.length >= 1 && t <= 5)) return null;
  const sc = c.h2hScope, n = c.done.length;
  return c.pick("D8", [
    `${sc} 맞대결 경기당 평균 ${f1(t)}점, 점수가 잘 나지 않은 상성이다.`,
    `${sc} 맞대결 ${n}경기의 경기당 양 팀 합계 득점은 ${f1(t)}점에 그쳤다.`,
    `두 팀이 만나면 점수가 적게 났다(${sc} 맞대결 경기당 ${f1(t)}점).`,
    `${sc} 맞대결은 경기당 ${f1(t)}점의 저득점 경기였다.`,
  ]);
}, ["h2hTotal"]);
rule("D2", "h2hDetail", 55, [], (c) => {
  const x = c.input.h2h;
  if (!(x && c.done.length >= 2 && Math.abs(x.rf - x.ra) >= 10)) return null;
  const s: Side = x.rf > x.ra ? "a" : "b";
  c.about(s);
  const [p, q] = s === "a" ? [x.rf, x.ra] : [x.ra, x.rf];
  const S = c.name(s), sc = c.h2hScope;
  return c.pick("D2", [
    `${sc} 맞대결 득실 ${p}:${q}, ${S} 쪽으로 점수 차도 크게 벌어졌다.`,
    `${sc} 맞대결에서 ${eun(S)} ${p}점을 내고 ${q}점만 내줬다.`,
    `${sc} 맞대결 ${c.done.length}경기 합계 점수는 ${S} 기준 ${p}:${ida(String(q))}.`,
    `${sc} 맞대결 득실 차는 ${S} 기준 ${signed(p - q)}점이다.`,
  ]);
}, ["h2hEdge"]);
rule("D6", "h2hDetail", 45, [], (c) => {
  const next = (c.input.h2h?.games ?? []).filter((g) => g.status === "예정").sort((x, y) => x.date.localeCompare(y.date))[0];
  if (!next) return null;
  const d = md(next.date);
  return c.pick("D6", [
    `다음 맞대결은 ${d}에 예정돼 있다.`,
    `두 팀은 ${d}에 다시 만날 예정이다.`,
    `일정상 다음 맞대결 날짜는 ${ida(d)}.`,
    `${d}에 두 팀의 맞대결이 잡혀 있다.`,
  ]);
}, ["h2hNext"]);

// ── 4. 맞대결 시즌 흐름 (9) ──────────────────────────────────
const yearOf = (g: AnalysisGame) => g.date.slice(0, 4);
const byYear = (c: Ctx) => {
  const m = new Map<string, { a: number; b: number }>();
  for (const g of c.done) {
    const w = winnerOf(g);
    if (!w) continue;
    const y = m.get(yearOf(g)) ?? { a: 0, b: 0 };
    y[w] += 1;
    m.set(yearOf(g), y);
  }
  return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
};
const yearWinner = (r: { a: number; b: number }): Side | null => (r.a > r.b ? "a" : r.b > r.a ? "b" : null);
rule("Y4", "h2hHistory", 82, ["flip"], (c) => {
  const ys = byYear(c);
  if (ys.length < 2) return null;
  const [cy, cr] = ys[ys.length - 1];
  const past = ys.slice(0, -1).reduce((acc, [, r]) => ({ a: acc.a + r.a, b: acc.b + r.b }), { a: 0, b: 0 });
  const pw = yearWinner(past), cw = yearWinner(cr);
  if (!(pw && cw && pw !== cw)) return null;
  c.about(cw);
  const P = c.name(pw), C = c.name(cw);
  return c.pick("Y4", [
    `${Number(cy) - 1}년까지는 ${ga(P)} 맞대결에서 앞섰지만 ${cy}년 맞대결은 ${ga(C)} 가져갔다. 상성이 바뀌는 중이다.`,
    `지난 시즌까지의 맞대결 열세를 ${ga(C)} ${cy}년에 뒤집었다.`,
    `${cy}년 들어 맞대결 흐름이 ${C} 쪽으로 넘어왔다(이전 우위는 ${P}).`,
    `${cy}년 맞대결 우위는 ${C}, 그 이전 시즌들은 ${ieotda(P)}. 최근 시즌에 흐름이 바뀌었다.`,
  ]);
}, ["h2hFlip"]);
rule("Y1", "h2hHistory", 80, [], (c) => {
  const ys = byYear(c).filter(([, r]) => yearWinner(r));
  const winners = new Set(ys.map(([, r]) => yearWinner(r)));
  if (!(ys.length >= 2 && winners.size === 2)) return null;
  const list = ys.map(([y, r]) => `${y} ${c.name(yearWinner(r)!)}`).join(", ");
  return c.pick("Y1", [
    `시즌마다 맞대결 승자가 달랐다(${list}).`,
    `맞대결 우위가 시즌별로 바뀌었다(${list}).`,
    `한 팀이 맞대결을 계속 앞선 적이 없다. 시즌별 우위는 ${list} 순이다.`,
    `시즌마다 맞대결 우위가 엇갈렸다(${list}). 연도에 따라 결과가 달랐다.`,
  ]);
}, ["h2hSwing"]);
rule("Y2", "h2hHistory", 78, [], (c) => {
  const ys = byYear(c);
  const ws = ys.map(([, r]) => yearWinner(r));
  if (!(ys.length >= 2 && ws.every((w) => w && w === ws[0]))) return null;
  c.about(ws[0]!);
  const W = c.name(ws[0]!), n = ys.length;
  return c.pick("Y2", [
    `${eun(W)} 맞대결이 있었던 ${n}개 시즌 모두 우위였다.`,
    `시즌이 바뀌어도 맞대결 우위는 늘 ${W} 쪽이었다(${n}개 시즌).`,
    `${ys.map(([y]) => y).join("·")}년 모두 맞대결은 ${ga(W)} 앞섰다.`,
    `${n}개 시즌 연속으로 맞대결에서 ${ga(W)} 앞섰다.`,
  ]);
}, ["h2hEdge"]);
rule("Y3", "h2hHistory", 70, [], (c) => {
  const ys = [...new Set(c.done.map(yearOf))].sort();
  const now = c.input.year ? String(c.input.year) : null;
  if (!(now && ys.length > 0 && !ys.includes(now))) return null;
  const yl = ys.join("·");
  return c.pick("Y3", [
    `맞대결은 ${yl}년에만 있었고 ${now}년에는 아직 맞붙지 않았다.`,
    `${now}년에는 아직 맞대결이 없다. 맞대결 기록은 모두 ${yl}년 것이다.`,
    `두 팀의 맞대결 기록은 ${yl}년에 나왔다. ${now}년에는 아직 만나지 않았다.`,
    `${now}년 맞대결은 아직 없고, 이전 맞대결은 ${yl}년에 있었다.`,
  ]);
}, ["h2hYear"]);
rule("Y8", "h2hHistory", 66, [], (c) => {
  const g = c.done.find((x) => x.me != null && x.opp != null && (x.me === 0 || x.opp === 0) && x.me !== x.opp);
  if (!g) return null;
  const s: Side = g.opp === 0 ? "a" : "b";
  c.about(s);
  const S = c.name(s), d = ymd(g.date);
  return c.pick("Y8", [
    `맞대결에서 ${ga(S)} 상대를 무득점으로 막은 경기도 있었다(${d}).`,
    `${eun(S)} ${d} 맞대결에서 상대를 0점으로 묶었다.`,
    `${c.h2hScope} 맞대결 중 ${S}의 무실점 승리가 있다(${d}).`,
    `${d} 맞대결은 ${S}의 완봉 경기였다.`,
  ]);
}, ["h2hShutout"]);
rule("Y7", "h2hHistory", 64, [], (c) => {
  if (c.done.length < 5) return null;
  const n = c.done.length, sc = c.h2hScope;
  return c.pick("Y7", [
    `${sc} ${n}번 맞붙은 단골 상대다. 맞대결 표본이 비교적 많다.`,
    `두 팀은 ${sc} ${n}경기를 치렀다. 상대 전적을 볼 만한 경기 수다.`,
    `${sc} 맞대결이 ${n}경기나 된다. 자주 만난 사이다.`,
    `${sc} 맞대결 ${n}경기, 고교 팀끼리로는 많이 만난 편이다.`,
  ]);
}, ["h2hMany"]);
rule("Y5", "h2hHistory", 62, [], (c) => {
  const g = c.done.find((x) => x.title && !/주말리그/.test(x.title.replace(/겸\s*주말리그\s*왕중왕전/, "")));
  if (!g) return null;
  const d = ymd(g.date), t = g.title!.replace(/^\s*\d{4}\s*/, "");
  return c.pick("Y5", [
    `전국대회에서도 맞붙은 적이 있다(${d} ${t}).`,
    `두 팀은 주말리그 밖 전국대회에서도 만났다(${d} ${t}).`,
    `맞대결 중에는 전국대회 경기도 있다(${d} ${t}).`,
    `${d} ${t}에서도 두 팀이 맞대결을 펼쳤다.`,
  ]);
}, ["h2hStage"]);
rule("Y6", "h2hHistory", 52, [], (c) => {
  if (!(c.done.length >= 2 && c.done.every((x) => x.title && /주말리그/.test(x.title) && !/왕중왕전/.test(x.title)))) return null;
  const n = c.done.length;
  return c.pick("Y6", [
    `맞대결 ${n}경기는 모두 주말리그에서 나왔다. 같은 권역 리그에서 만난 사이다.`,
    `두 팀의 맞대결은 전부 주말리그 경기였다(${n}경기).`,
    `전국대회 맞대결은 없고, ${n}경기 모두 주말리그 맞대결이다.`,
    `맞대결 기록 ${n}경기가 모두 주말리그 권역 경기다.`,
  ]);
}, ["h2hStage"]);
rule("Y9", "h2hHistory", 45, [], (c) => {
  if (c.done.length !== 1) return null;
  return c.pick("Y9", [
    "맞대결이 1경기뿐이라 상성을 단정하기엔 이르다.",
    `${c.h2hScope} 맞대결은 한 경기뿐이다. 상대 전적의 무게는 크지 않다.`,
    "맞대결 표본이 1경기라 상성 판단은 조심스럽다.",
    "두 팀이 만난 경기는 한 번뿐이라 맞대결 결과만으로 우열을 말하긴 어렵다.",
  ]);
}, ["h2hOne"]);

// ── 5. 맞대결 득점 (8) — 맞대결과 시즌 평균을 비교할 때는 두 기준을 함께 적는다 ─────
const h2hFor = (c: Ctx, s: Side) => {
  const xs = c.done.filter((g) => g.me != null && g.opp != null);
  if (!xs.length) return null;
  const rf = xs.reduce((t, g) => t + (s === "a" ? g.me! : g.opp!), 0) / xs.length;
  const ra = xs.reduce((t, g) => t + (s === "a" ? g.opp! : g.me!), 0) / xs.length;
  return { n: xs.length, rf, ra };
};
const seasonYear = (c: Ctx) => (c.input.year ? `${c.input.year} 시즌` : "올 시즌");
rule("HS1", "h2hScore", 64, [], (c) => c.either((s) => {
  const h = h2hFor(c, s), all = c.avgOf(c.season(s), "rf");
  if (!(h && h.n >= 2 && all != null && c.season(s).length >= 8 && h.rf <= all - 3)) return null;
  const S = c.name(s), O = c.name(c.oth(s)), sc = c.h2hScope, sy = seasonYear(c);
  return c.pick("HS1", [
    `${eun(S)} ${sc} 맞대결에서 경기당 ${f1(h.rf)}점으로 ${sy} 평균(${f1(all)}점)보다 적게 냈다. ${O} 상대로는 득점이 쉽지 않았다.`,
    `${S}의 ${sc} 맞대결 득점은 경기당 ${f1(h.rf)}점, ${sy} 평균 ${f1(all)}점에 못 미친다.`,
    `${sy} 경기당 ${f1(all)}점을 내는 ${S} 타선이 ${gwa(O)}의 ${sc} 맞대결에서는 ${f1(h.rf)}점에 그쳤다.`,
    `${O} 상대 ${sc} 맞대결(${h.n}경기)에서 ${S}의 득점은 ${sy} 평균보다 ${f1(all - h.rf)}점 적었다.`,
  ]);
}), ["h2hScore"]);
rule("HS2", "h2hScore", 62, [], (c) => c.either((s) => {
  const h = h2hFor(c, s), all = c.avgOf(c.season(s), "rf");
  if (!(h && h.n >= 2 && all != null && c.season(s).length >= 8 && h.rf >= all + 3)) return null;
  const S = c.name(s), O = c.name(c.oth(s)), sc = c.h2hScope, sy = seasonYear(c);
  return c.pick("HS2", [
    `${eun(S)} ${sc} 맞대결에서 경기당 ${f1(h.rf)}점으로 ${sy} 평균(${f1(all)}점)보다 많이 냈다.`,
    `${S}의 ${sc} 맞대결 득점은 경기당 ${f1(h.rf)}점, ${sy} 평균 ${f1(all)}점을 웃돈다.`,
    `${eul(O)} 만나면 ${S} 타선의 득점이 늘었다(${sc} 맞대결 ${f1(h.rf)}점, ${sy} 평균 ${f1(all)}점).`,
    `${O} 상대 ${sc} 맞대결(${h.n}경기)에서 ${S}의 득점은 ${sy} 평균보다 ${f1(h.rf - all)}점 많았다.`,
  ]);
}), ["h2hScore"]);
rule("HS3", "h2hScore", 60, [], (c) => c.either((s) => {
  const h = h2hFor(c, s), all = c.avgOf(c.season(s), "ra");
  if (!(h && h.n >= 2 && all != null && c.season(s).length >= 8 && h.ra <= all - 2.5)) return null;
  const S = c.name(s), O = c.name(c.oth(s)), sc = c.h2hScope, sy = seasonYear(c);
  return c.pick("HS3", [
    `${S} 마운드는 ${gwa(O)}의 ${sc} 맞대결에서 경기당 ${f1(h.ra)}실점으로 ${sy} 평균(${f1(all)}실점)보다 잘 막았다.`,
    `${sc} 맞대결에서 ${eun(S)} 경기당 ${f1(h.ra)}점만 내줬다. ${sy} 평균 실점은 ${f1(all)}점이다.`,
    `${O} 타선을 상대로 ${S}의 실점이 줄었다(${sc} 맞대결 ${f1(h.ra)}점, ${sy} 평균 ${f1(all)}점).`,
    `${sc} 맞대결(${h.n}경기)에서 ${S}의 실점은 ${sy} 평균보다 ${f1(all - h.ra)}점 적었다.`,
  ]);
}), ["h2hScore"]);
rule("HS4", "h2hScore", 58, [], (c) => c.either((s) => {
  const h = h2hFor(c, s);
  if (!(h && h.n >= 2 && h.rf - h.ra >= 5)) return null;
  const S = c.name(s), sc = c.h2hScope, m = h.rf - h.ra;
  return c.pick("HS4", [
    `${sc} 맞대결에서 ${eun(S)} 경기당 ${f1(m)}점 차로 앞섰다(${f1(h.rf)}:${f1(h.ra)}).`,
    `${S}의 ${sc} 맞대결 평균 점수는 ${f1(h.rf)}:${f1(h.ra)}, 경기당 ${f1(m)}점 차다.`,
    `${sc} 맞대결 ${h.n}경기 평균 득실 차는 ${S} 기준 +${f1(m)}점이다.`,
    `${ga(S)} ${sc} 맞대결에서 평균 ${f1(m)}점 차로 우위를 보였다.`,
  ]);
}), ["h2hEdge"]);
rule("HS5", "h2hScore", 57, [], (c) => {
  const seq = [...c.done].sort((x, y) => x.date.localeCompare(y.date));
  if (seq.length < 3) return null;
  const last2 = seq.slice(-2).map(winnerOf);
  const s = last2[0];
  if (!(s && s === last2[1] && seq.slice(0, -2).some((g) => winnerOf(g) && winnerOf(g) !== s))) return null;
  c.about(s);
  const S = c.name(s), sc = c.h2hScope;
  return c.pick("HS5", [
    `${eun(S)} ${sc} 맞대결에서 최근 2경기를 연달아 이겼다.`,
    `${sc} 맞대결 최근 2경기는 모두 ${S} 승리였다.`,
    `최근 맞대결 2연승은 ${S} 쪽이다(${sc} 기준).`,
    `${ga(S)} ${sc} 맞대결 최근 2경기를 가져갔다. 그 이전에는 상대에게 진 경기도 있었다.`,
  ]);
}, ["h2hLatest"]);
rule("HS6", "h2hScore", 56, [], (c) => {
  const now = c.input.year ? String(c.input.year) : null;
  const n = now ? c.done.filter((g) => yearOf(g) === now).length : 0;
  if (!(now && n >= 3)) return null;
  return c.pick("HS6", [
    `두 팀은 ${now}년에만 ${n}번 맞붙었다.`,
    `${now}년 맞대결이 벌써 ${n}경기다. 올해 자주 만난 상대다.`,
    `${now}년 한 해에 ${n}번 만났다. 올해 맞대결 표본이 많은 편이다.`,
    `${now}년 맞대결 ${n}경기, 이번 시즌 가장 자주 만난 상대 중 하나다.`,
  ]);
}, ["h2hMany"]);
rule("HS7", "h2hScore", 55, [], (c) => {
  const close = c.done.filter((g) => g.me != null && g.opp != null && Math.abs(g.me - g.opp) === 1);
  if (!(close.length >= 2 && close.length < c.done.length)) return null;
  const sc = c.h2hScope;
  return c.pick("HS7", [
    `${sc} 맞대결 ${c.done.length}경기 중 ${close.length}경기가 1점 차였다.`,
    `두 팀의 ${sc} 맞대결에서 1점 차 승부가 ${close.length}번 나왔다.`,
    `${sc} 맞대결 1점 차 경기 ${close.length}번, 한 점에 승부가 갈린 적이 많다.`,
    `${sc} 맞대결에는 1점 차로 끝난 경기가 ${close.length}경기 있다.`,
  ]);
}, ["h2hClose"]);
rule("HS8", "h2hScore", 54, [], (c) => {
  const sc = c.h2hScope;
  const ranked = c.done.filter((g) => g.me != null && g.opp != null).sort((x, y) => Math.abs(y.me! - y.opp!) - Math.abs(x.me! - x.opp!));
  const g = ranked[0];
  if (!(g && c.done.length >= 3 && Math.abs(g.me! - g.opp!) >= 8)) return null;
  const s: Side = g.me! > g.opp! ? "a" : "b";
  const others = ranked.slice(1).every((x) => Math.abs(x.me! - x.opp!) <= 4);
  if (!others) return null;
  c.about(s);
  const [x, y] = s === "a" ? [g.me!, g.opp!] : [g.opp!, g.me!];
  const S = c.name(s), d = ymd(g.date);
  return c.pick("HS8", [
    `${sc} 맞대결은 대부분 4점 차 이내였지만 ${d} 경기만 ${S}의 ${x}:${y} 대승이었다.`,
    `${d} ${S}의 ${x}:${y} 승리를 빼면 ${sc} 맞대결은 모두 4점 차 이내로 팽팽했다.`,
    `${sc} 맞대결 득실은 ${d} 한 경기(${S} ${x}:${y})의 영향이 크다. 나머지는 4점 차 이내다.`,
    `큰 점수 차가 난 ${sc} 맞대결은 ${d}(${S} ${x}:${y}) 한 경기뿐이다.`,
  ]);
}, ["h2hEdge"]);
