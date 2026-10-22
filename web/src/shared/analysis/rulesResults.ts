// 경기 분석 규칙 — 시즌 결과(승률·득실·경기 내용), 최근 흐름(3·5·10경기), 한 경기 제외 검증, 대회 단계별 성적, 표본 경고. 기준은 선택 시즌.
import {
  avgBy, eun, f1, f3, ga, ida, isNational, lossesIn, md, median, pct0, pctOf, rule, shortTitle, signed, winsIn, wl,
  type Ctx, type SeasonGame, type Side,
  eul, gwa,
} from "./core";

const sy = (c: Ctx) => (c.input.year ? `${c.input.year} 시즌` : "올 시즌");

// ── 승률 (11) ────────────────────────────────────────────────
rule("R5", "record", 84, ["pct"], (c) => {
  const m = c.leader, p = c.win("pct");
  if (!(m && p && m !== p)) return null;
  c.about(p);
  const M = c.name(m), P = c.name(p);
  return c.pick("R5", [
    `${eun(M)} 지표상 앞서지만 승률은 ${ga(P)} 높다(${f3(c.v("pct", p)!)}).`,
    `기록은 ${M}, 결과는 ${P} 쪽이었다. 승률(${f3(c.v("pct", p)!)})이 지표 열세를 뒤집고 있다.`,
    `${eun(P)} 지표에 비해 승리를 잘 챙겼다. 기록만으로 ${M} 우세를 단정하기 어렵다.`,
    `지표 수로는 ${M} 우위, 승률로는 ${P} 우위다. 두 기준이 다른 팀을 가리킨다.`,
    `승률 우위(${P})와 지표 우위(${M})가 엇갈린다.`,
  ]);
}, ["recordVsMetric"]);
rule("R10", "record", 78, ["pct"], (c) => c.either((s) => {
  const r = c.rec(s);
  if (!(r && r.l === 0 && r.w >= 3)) return null;
  const S = c.name(s), rec = `${r.w}승${r.d ? ` ${r.d}무` : ""}`;
  return c.pick("R10", [
    `${eun(S)} ${sy(c)} ${rec} 무패다.`,
    `${S}의 ${sy(c)} 성적은 ${rec}, 아직 지지 않았다.`,
    `${sy(c)} ${S}에게는 패배가 없다(${rec}).`,
    `${eun(S)} ${sy(c)} 치른 ${r.w + r.d}경기에서 한 번도 지지 않았다.`,
  ]);
}), ["recordEdge"]);
rule("R11", "record", 76, ["pct"], (c) => c.either((s) => {
  const r = c.rec(s);
  if (!(r && r.w === 0 && r.l + r.d >= 3)) return null;
  const S = c.name(s);
  return c.pick("R11", [
    `${eun(S)} ${sy(c)} 아직 승리가 없다(${r.l}패${r.d ? ` ${r.d}무` : ""}).`,
    `${S}의 ${sy(c)} 첫 승은 아직이다(${r.l}패).`,
    `${sy(c)} ${eun(S)} ${r.l + r.d}경기에서 승리를 거두지 못했다.`,
    `${eun(S)} ${sy(c)} 무승 상태다(${r.l}패${r.d ? ` ${r.d}무` : ""}).`,
  ]);
}), ["recordEdge"]);
rule("R1", "record", 62, ["pct"], (c) => c.either((s) => {
  if (!(c.win("pct") === s && c.lv("pct") === 3)) return null;
  const S = c.name(s), a = f3(c.v("pct", s)!), b = f3(c.v("pct", c.oth(s))!);
  return c.pick("R1", [
    `승률 ${a}:${b}, ${sy(c)} 성적은 ${ga(S)} 크게 앞선다.`,
    `${S}의 승률(${a})이 상대(${b})보다 뚜렷하게 높다.`,
    `${sy(c)} 결과에서 격차가 크다(승률 ${a}:${b}).`,
    `이긴 경기 비율은 ${S} ${a}, 상대 ${ida(b)}.`,
    `${S}의 ${sy(c)} 승률은 ${a}, 상대는 ${ida(b)}.`,
  ]);
}), ["recordEdge"]);
rule("R7", "record", 60, ["pct"], (c) => {
  if (!(c.has("pct") && c.v("pct", "a")! >= 0.7 && c.v("pct", "b")! >= 0.7)) return null;
  const a = f3(c.v("pct", "a")!), b = f3(c.v("pct", "b")!);
  return c.pick("R7", [
    `두 팀 모두 승률 7할 이상의 상위권 팀이다(${a}·${b}).`,
    `${sy(c)} 승률 ${a}와 ${b}, 잘 이기는 팀끼리 만났다.`,
    `양 팀 모두 열 경기 중 일곱 경기 이상을 이겼다.`,
    `승률 7할을 넘는 팀끼리의 대결이다(${a}·${b}).`,
  ]);
}, ["recordBoth"]);
rule("R8", "record", 60, ["pct"], (c) => {
  if (!(c.has("pct") && c.v("pct", "a")! <= 0.3 && c.v("pct", "b")! <= 0.3)) return null;
  const a = f3(c.v("pct", "a")!), b = f3(c.v("pct", "b")!);
  return c.pick("R8", [
    `두 팀 모두 승률 3할 아래다(${a}·${b}).`,
    `${sy(c)} 승리가 적은 팀끼리 만났다(승률 ${a}·${b}).`,
    `양 팀 모두 열 경기 중 세 경기 이하를 이겼다.`,
    `승률 3할 미만 팀끼리의 대결이다(${a}·${b}).`,
  ]);
}, ["recordBoth"]);
rule("R2", "record", 48, ["pct"], (c) => c.either((s) => {
  if (!(c.win("pct") === s && c.lv("pct") === 2)) return null;
  const S = c.name(s), a = f3(c.v("pct", s)!), b = f3(c.v("pct", c.oth(s))!);
  return c.pick("R2", [
    `승률은 ${S} 쪽이 한 단계 높다(${a}:${b}).`,
    `${sy(c)} 승률 ${a}:${b}, ${ga(S)} 앞선다.`,
    `${S}의 승률(${a})이 상대(${b})보다 높다.`,
    `결과는 ${S} 쪽이 낫다(승률 ${a}:${b}).`,
  ]);
}), ["recordEdge"]);
rule("R4", "record", 35, ["pct"], (c) => {
  if (!(c.has("pct") && c.lv("pct") === 0)) return null;
  const a = f3(c.v("pct", "a")!), b = f3(c.v("pct", "b")!);
  return c.pick("R4", [
    `두 팀의 승률이 ${a}·${b}로 비슷하다.`,
    `${sy(c)} 승률은 거의 같다(${a}:${b}).`,
    `승률로는 우열이 없다(${a}·${b}).`,
    `두 팀 모두 ${sy(c)} 비슷한 비율로 이겼다(승률 ${a}·${b}).`,
  ]);
}, ["recordEven"]);
rule("R3", "record", 30, ["pct"], (c) => {
  if (!(c.has("pct") && c.lv("pct") === 1)) return null;
  const a = f3(c.v("pct", "a")!), b = f3(c.v("pct", "b")!);
  return c.pick("R3", [
    `승률 차이는 크지 않다(${a}:${b}).`,
    `${sy(c)} 승률은 ${a}와 ${b}, 근소한 차이다.`,
    `두 팀의 승률 차는 작다(${a}·${b}).`,
    `승률로 본 격차는 미미하다(${a}:${b}).`,
  ]);
}, ["recordEven"]);
rule("R12", "record", 46, ["pct"], (c) => {
  const a = c.v("pct", "a"), b = c.v("pct", "b");
  if (!(a != null && b != null && a >= 0.45 && a <= 0.55 && b >= 0.45 && b <= 0.55 && c.games("a") >= 8 && c.games("b") >= 8)) return null;
  return c.pick("R12", [
    `두 팀 모두 승률 5할 언저리다(${f3(a)}·${f3(b)}).`,
    `${sy(c)} 이긴 만큼 진 팀끼리의 대결이다(승률 ${f3(a)}·${f3(b)}).`,
    `양 팀 모두 승패가 반반에 가깝다.`,
    `승률 ${f3(a)}와 ${f3(b)}, 중위권 팀끼리 만났다.`,
  ]);
}, ["recordBoth"]);

// ── 득실 (11) ────────────────────────────────────────────────
const margin = (c: Ctx, s: Side) => {
  const r = c.rec(s);
  return r ? r.rf - r.ra : undefined;
};
rule("U5", "runs", 70, ["runs"], (c) => c.either((s) => {
  const ms = margin(c, s), mo = margin(c, c.oth(s));
  if (!(ms != null && mo != null && ms > 0 && mo < 0)) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("U5", [
    `득실 마진 ${S} ${signed(ms)}, ${O} ${signed(mo)}. ${sy(c)} 득실 흐름이 정반대다.`,
    `${eun(S)} 낸 점수가 더 많고(${signed(ms)}) ${eun(O)} 내준 점수가 더 많다(${signed(mo)}).`,
    `${sy(c)} 득실 차는 ${S} ${signed(ms)}, ${O} ${ida(signed(mo))}.`,
    `득점이 실점보다 많은 ${gwa(S)} 그 반대인 ${O}의 대결이다(${signed(ms)}·${signed(mo)}).`,
    `${S}의 득실은 ${signed(ms)}점, ${O}의 득실은 ${signed(mo)}점이다.`,
  ]);
}), ["runsEdge"]);
rule("U3", "runs", 64, ["runs"], (c) => {
  const a = c.perGame("a", "rf"), b = c.perGame("b", "rf");
  if (!(a != null && b != null && a >= 7 && b >= 7)) return null;
  return c.pick("U3", [
    `두 팀 모두 경기당 7점 이상 뽑는다(${f1(a)}·${f1(b)}점).`,
    `양 팀의 경기당 득점이 ${f1(a)}점과 ${f1(b)}점으로 모두 많다.`,
    `득점력이 높은 팀끼리 만났다(경기당 ${f1(a)}·${f1(b)}점).`,
    `${sy(c)} 두 팀 모두 경기마다 7점 넘게 냈다.`,
  ]);
}, ["runsBoth"]);
rule("U4", "runs", 64, ["runs"], (c) => {
  const a = c.perGame("a", "rf"), b = c.perGame("b", "rf");
  if (!(a != null && b != null && a <= 3 && b <= 3)) return null;
  return c.pick("U4", [
    `두 팀 모두 경기당 3점 남짓만 낸다(${f1(a)}·${f1(b)}점). 한 점의 무게가 큰 대진이다.`,
    `양 팀의 경기당 득점이 ${f1(a)}점과 ${f1(b)}점으로 적다.`,
    `득점력이 낮은 팀끼리 만났다(경기당 ${f1(a)}·${f1(b)}점).`,
    `${sy(c)} 두 팀 모두 경기당 3점 이하를 냈다.`,
  ]);
}, ["runsBoth"]);
rule("U1", "runs", 62, ["runs"], (c) => c.either((s) => {
  const x = c.perGame(s, "rf"), y = c.perGame(c.oth(s), "rf");
  if (!(x != null && y != null && y > 0 && x / y >= 1.5)) return null;
  const S = c.name(s);
  return c.pick("U1", [
    `경기당 득점 ${f1(x)}:${f1(y)}, 점수를 뽑는 힘은 ${ga(S)} 확실히 앞선다.`,
    `${S}의 경기당 득점(${f1(x)}점)이 상대(${f1(y)}점)의 1.5배를 넘는다.`,
    `득점력 격차가 크다(경기당 ${f1(x)}:${f1(y)}점).`,
    `${eun(S)} 경기마다 상대보다 ${f1(x - y)}점 더 냈다.`,
  ]);
}), ["runsEdge"]);
rule("U2", "runs", 60, ["runs"], (c) => c.either((s) => {
  const x = c.perGame(s, "ra"), y = c.perGame(c.oth(s), "ra");
  if (!(x != null && y != null && y > 0 && x / y <= 0.6)) return null;
  const S = c.name(s);
  return c.pick("U2", [
    `경기당 실점 ${f1(x)}:${f1(y)}, ${eun(S)} 상대에게 점수를 잘 주지 않는다.`,
    `${S}의 경기당 실점(${f1(x)}점)이 상대(${f1(y)}점)의 60%에도 못 미친다.`,
    `실점 억제 격차가 크다(경기당 ${f1(x)}:${f1(y)}점).`,
    `${eun(S)} 경기마다 상대보다 ${f1(y - x)}점 덜 내줬다.`,
  ]);
}), ["runsEdge"]);
rule("U6", "runs", 58, ["runs"], (c) => {
  const a = margin(c, "a"), b = margin(c, "b");
  if (!(a != null && b != null && a >= 20 && b >= 20)) return null;
  return c.pick("U6", [
    `두 팀 모두 득실 마진이 크게 플러스다(${signed(a)}·${signed(b)}).`,
    `양 팀 모두 낸 점수가 내준 점수보다 20점 이상 많다.`,
    `득실 차 ${signed(a)}와 ${signed(b)}, 득실이 좋은 팀끼리 만났다.`,
    `${sy(c)} 두 팀 모두 득실 마진 +20 이상이다.`,
  ]);
}, ["runsBoth"]);
rule("U7", "runs", 56, ["runs"], (c) => {
  const a = margin(c, "a"), b = margin(c, "b");
  if (!(a != null && b != null && a < 0 && b < 0)) return null;
  return c.pick("U7", [
    "두 팀 모두 실점이 득점보다 많다. 마운드 안정이 공통 과제다.",
    `양 팀 득실 마진이 모두 마이너스다(${signed(a)}·${signed(b)}).`,
    `${sy(c)} 두 팀 모두 낸 점수보다 내준 점수가 많다.`,
    `득실 차 ${signed(a)}와 ${signed(b)}, 득실이 좋지 않은 팀끼리 만났다.`,
  ]);
}, ["runsBoth"]);
// 득실로 본 기대 승률(피타고리안, 지수 1.83)과 실제 승률의 차이 — 원인(운·접전 능력)은 단정하지 않는다
const pythag = (r: { rf: number; ra: number }) => (r.rf + r.ra > 0 ? r.rf ** 1.83 / (r.rf ** 1.83 + r.ra ** 1.83) : undefined);
rule("U8", "runs", 71, ["runs", "pct"], (c) => c.either((s) => {
  const r = c.rec(s), act = c.v("pct", s);
  const exp = r && pythag(r);
  if (!(r && exp != null && act != null && c.games(s) >= 8 && act - exp >= 0.12)) return null;
  const S = c.name(s);
  return c.pick("U8", [
    `${eun(S)} 득실로 본 기대 승률(${f3(exp)})보다 실제 승률(${f3(act)})이 높다. 득실 차에 비해 승리를 많이 챙겼다.`,
    `${S}의 실제 승률(${f3(act)})이 득실 기준 기대치(${f3(exp)})를 웃돈다.`,
    `득실만 보면 ${S}의 승률은 ${f3(exp)} 안팎이 자연스럽지만 실제로는 ${f3(act)}였다.`,
    `${eun(S)} 이긴 경기 수가 득실 차가 시사하는 것보다 많다(기대 ${f3(exp)} · 실제 ${f3(act)}).`,
    `${S}의 승률(${f3(act)})은 득실로 계산한 기대치(${f3(exp)})보다 높다.`,
  ]);
}), ["pythag"]);
rule("U9", "runs", 71, ["runs", "pct"], (c) => c.either((s) => {
  const r = c.rec(s), act = c.v("pct", s);
  const exp = r && pythag(r);
  if (!(r && exp != null && act != null && c.games(s) >= 8 && exp - act >= 0.12)) return null;
  const S = c.name(s);
  return c.pick("U9", [
    `${eun(S)} 득실로 본 기대 승률(${f3(exp)})보다 실제 승률(${f3(act)})이 낮다. 득실 차만큼 승리를 챙기지 못했다.`,
    `${S}의 실제 승률(${f3(act)})이 득실 기준 기대치(${f3(exp)})에 못 미친다.`,
    `득실만 보면 ${S}의 승률은 ${f3(exp)} 안팎이 자연스럽지만 실제로는 ${f3(act)}였다.`,
    `${eun(S)} 이긴 경기 수가 득실 차가 시사하는 것보다 적다(기대 ${f3(exp)} · 실제 ${f3(act)}).`,
    `${S}의 승률(${f3(act)})은 득실로 계산한 기대치(${f3(exp)})보다 낮다.`,
  ]);
}), ["pythag"]);
rule("U10", "runs", 55, ["runs"], (c) => {
  const a = c.perGame("a", "ra"), b = c.perGame("b", "ra");
  if (!(a != null && b != null && a <= 3 && b <= 3 && c.games("a") >= 8 && c.games("b") >= 8)) return null;
  return c.pick("U10", [
    `두 팀 모두 경기당 3점 이하를 내준다(${f1(a)}·${f1(b)}점).`,
    `양 팀의 경기당 실점이 ${f1(a)}점과 ${f1(b)}점으로 적다.`,
    `실점이 적은 팀끼리 만났다(경기당 ${f1(a)}·${f1(b)}점).`,
    `${sy(c)} 두 팀 모두 경기당 실점 3점 이하다.`,
  ]);
}, ["runsBoth"]);
rule("U11", "runs", 52, ["runs"], (c) => {
  const a = margin(c, "a"), b = margin(c, "b"), ga_ = c.games("a"), gb = c.games("b");
  if (!(a != null && b != null && ga_ >= 8 && gb >= 8 && Math.abs(a / ga_) <= 1 && Math.abs(b / gb) <= 1)) return null;
  return c.pick("U11", [
    `두 팀 모두 경기당 득실 차가 1점 이내다(${signed(a)}·${signed(b)}).`,
    `양 팀 모두 낸 점수와 내준 점수가 비슷하다.`,
    `${sy(c)} 두 팀 모두 득실이 거의 균형을 이뤘다(${signed(a)}·${signed(b)}).`,
    `득실 마진 ${signed(a)}와 ${signed(b)}, 경기당으로는 1점 안쪽이다.`,
  ]);
}, ["runsBoth"]);

// ── 시즌 경기 내용 (9) ──────────────────────────────────────
const oneRun = (gs: SeasonGame[]) => gs.filter((g) => Math.abs(g.rf - g.ra) === 1);
rule("G4", "games", 69, ["close"], (c) => c.either((s) => {
  const g = oneRun(c.season(s));
  const w = winsIn(g), l = g.length - w;
  if (!(g.length >= 3 && w / g.length >= 0.7)) return null;
  const S = c.name(s);
  return c.pick("G4", [
    `${eun(S)} 1점 차 승부에서 ${w}승 ${l}패로 강했다.`,
    `${S}의 1점 차 경기 성적은 ${w}승 ${l}패다.`,
    `한 점 차로 끝난 ${g.length}경기에서 ${ga(S)} ${w}번 이겼다.`,
    `접전(1점 차)에서 ${S}의 승률이 높았다(${w}승 ${l}패).`,
  ]);
}), ["close"]);
rule("G5", "games", 67, ["close"], (c) => c.either((s) => {
  const g = oneRun(c.season(s));
  const w = winsIn(g), l = g.length - w;
  if (!(g.length >= 3 && w / g.length <= 0.3)) return null;
  const S = c.name(s);
  return c.pick("G5", [
    `${eun(S)} 1점 차 승부에서 ${w}승 ${l}패로 약했다.`,
    `${S}의 1점 차 경기 성적은 ${w}승 ${l}패다.`,
    `한 점 차로 끝난 ${g.length}경기에서 ${ga(S)} ${l}번 졌다.`,
    `접전(1점 차)에서 ${S}의 승률이 낮았다(${w}승 ${l}패).`,
  ]);
}), ["close"]);
rule("G3", "games", 61, ["shutout"], (c) => c.either((s) => {
  const n = c.season(s).filter((g) => g.outcome === "승" && g.ra === 0).length;
  if (!(n >= 3)) return null;
  const S = c.name(s);
  return c.pick("G3", [
    `${eun(S)} ${sy(c)} 상대를 무득점으로 막고 이긴 경기가 ${n}번이다.`,
    `${S}의 ${sy(c)} 무실점 승리는 ${n}경기다.`,
    `${eun(S)} ${n}경기에서 상대에게 한 점도 내주지 않고 이겼다.`,
    `영봉승 ${n}번, ${S} 마운드가 상대를 0점으로 묶은 경기가 많다.`,
  ]);
}), ["shutout"]);
rule("G7", "games", 61, ["bigloss"], (c) => c.either((s) => {
  const n = c.season(s).filter((g) => g.ra >= 10).length;
  if (!(n >= 3)) return null;
  const S = c.name(s);
  return c.pick("G7", [
    `${eun(S)} 10점 이상 내준 경기가 ${n}번 있다. 대량 실점이 약점이다.`,
    `${S}의 ${sy(c)} 두 자릿수 실점 경기는 ${n}번이다.`,
    `${eun(S)} ${n}경기에서 10점 넘게 내줬다.`,
    `한 경기 10실점 이상이 ${n}번, ${S} 마운드의 기복을 보여준다.`,
  ]);
}), ["bigloss"]);
rule("G6", "games", 59, ["bigwin"], (c) => c.either((s) => {
  const n = c.season(s).filter((g) => g.rf >= 10).length;
  if (!(n >= 5)) return null;
  const S = c.name(s);
  return c.pick("G6", [
    `${eun(S)} 10점 이상 낸 경기가 ${n}번이다. 한번 터지면 몰아치는 타선이다.`,
    `${S}의 ${sy(c)} 두 자릿수 득점 경기는 ${n}번이다.`,
    `${eun(S)} ${n}경기에서 10점 넘게 냈다.`,
    `한 경기 10득점 이상이 ${n}번, ${S} 타선은 대량 득점 경기가 많다.`,
  ]);
}), ["bigwin"]);
rule("G2", "games", 55, ["gp"], (c) => c.either((s) => {
  const x = c.games(s), y = c.games(c.oth(s));
  if (!(x >= 10 && x - y >= 6)) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("G2", [
    `${ga(S)} ${x}경기로 ${y}경기의 ${O}보다 훨씬 많은 경기를 치렀다. 기록의 무게가 다르다.`,
    `경기 수 차이가 크다(${S} ${x}경기 · ${O} ${y}경기). 적은 쪽 기록은 표본이 작다.`,
    `${S}의 기록은 ${x}경기, ${O}의 기록은 ${y}경기에서 나왔다.`,
    `${eun(O)} ${S}보다 ${x - y}경기 적게 치렀다. 비교할 때 표본 차이를 감안해야 한다.`,
  ]);
}), ["gp"]);
rule("G1", "games", 50, ["draw"], (c) => c.either((s) => {
  const d = c.rec(s)?.d ?? 0;
  if (!(d >= 2)) return null;
  const S = c.name(s);
  return c.pick("G1", [
    `${eun(S)} 무승부가 ${d}번으로 승부를 내지 못한 경기가 잦다.`,
    `${S}의 ${sy(c)} 무승부는 ${d}경기다.`,
    `${eun(S)} ${d}경기를 비겼다.`,
    `무승부 ${d}번, ${eun(S)} 승패가 갈리지 않은 경기가 여러 번 있었다.`,
  ]);
}), ["draw"]);
rule("G8", "games", 57, ["close"], (c) => c.either((s) => {
  const g = c.season(s).filter((x) => Math.abs(x.rf - x.ra) <= 2 && x.outcome !== "무");
  const w = winsIn(g), l = g.length - w;
  if (!(g.length >= 6 && Math.abs(w - l) >= 4)) return null;
  const S = c.name(s);
  const good = w > l;
  return c.pick("G8", [
    `${S}의 2점 차 이내 경기 성적은 ${w}승 ${l}패다.`,
    `점수 차 2점 이내로 끝난 ${g.length}경기에서 ${eun(S)} ${w}번 이기고 ${l}번 졌다.`,
    `${eun(S)} 2점 차 이내 접전에서 ${good ? "많이 이겼다" : "많이 졌다"}(${w}승 ${l}패).`,
    `${good ? "접전 승률이 높다" : "접전 승률이 낮다"}. ${S}의 2점 차 이내 경기는 ${w}승 ${l}패다.`,
  ]);
}), ["close"]);
rule("G9", "games", 54, ["shutoutLoss"], (c) => c.either((s) => {
  const n = c.season(s).filter((g) => g.rf === 0).length;
  if (!(n >= 3)) return null;
  const S = c.name(s);
  return c.pick("G9", [
    `${eun(S)} ${sy(c)} 한 점도 못 낸 경기가 ${n}번이다.`,
    `${S} 타선의 무득점 경기는 ${n}번이다.`,
    `${eun(S)} ${n}경기에서 득점 없이 끝났다.`,
    `영패 ${n}번, ${S} 타선은 막힐 때 완전히 막혔다.`,
  ]);
}), ["formBat"]);

// ── 최근 흐름: 5경기 (10) ───────────────────────────────────
rule("F1", "form", 76, ["form"], (c) => c.either((s) => {
  const r = c.recent(s);
  if (!(r.length === 5 && winsIn(r) === 5)) return null;
  const S = c.name(s);
  return c.pick("F1", [
    `${eun(S)} 최근 5경기를 모두 이겼다.`,
    `${S}의 최근 5경기는 전승이다.`,
    `최근 5연속 승리, ${ga(S)} 좋은 흐름을 이어가고 있다.`,
    `${eun(S)} 최근 5경기에서 진 적이 없다(5승).`,
    `최근 5경기 5승 0패, ${S}의 최근 성적이 좋다.`,
  ]);
}), ["formWin"]);
rule("F3", "form", 74, ["form"], (c) => c.either((s) => {
  const st = c.streak(s);
  if (!(st.kind === "패" && st.n >= 3)) return null;
  const S = c.name(s);
  return c.pick("F3", [
    `${eun(S)} 최근 ${st.n}연패 중이다.`,
    `${S}의 최근 ${st.n}경기는 모두 패배였다.`,
    `${ga(S)} ${st.n}경기 연속으로 졌다.`,
    `최근 ${st.n}연패, ${eun(S)} 흐름이 좋지 않다.`,
    `${eun(S)} 최근 ${st.n}경기에서 이기지 못했다(${st.n}연패).`,
  ]);
}), ["formLoss"]);
rule("F2", "form", 72, ["form"], (c) => c.either((s) => {
  const x = c.recent(s), y = c.recent(c.oth(s));
  if (!(x.length === 5 && y.length === 5 && winsIn(x) >= 4 && winsIn(y) <= 2)) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("F2", [
    `최근 5경기 ${winsIn(x)}승 대 ${winsIn(y)}승, 흐름은 ${S} 쪽이다.`,
    `최근 5경기 성적은 ${S} ${winsIn(x)}승, ${O} ${winsIn(y)}승이다.`,
    `요즘 성적은 ${ga(S)} 낫다(최근 5경기 ${winsIn(x)}승 ${lossesIn(x)}패).`,
    `최근 5경기로 보면 ${S} 우세, ${O} 열세다.`,
    `최근 5경기 승수는 ${S} ${winsIn(x)}, ${O} ${ida(String(winsIn(y)))}.`,
  ]);
}), ["formWin"]);
rule("F6", "form", 66, ["form"], (c) => c.either((s) => {
  const st = c.streak(s);
  if (!(st.kind === "승" && st.n >= 3 && st.n < 5)) return null;
  const S = c.name(s);
  return c.pick("F6", [
    `${eun(S)} ${st.n}연승을 달리고 있다.`,
    `${S}의 최근 ${st.n}경기는 모두 승리였다.`,
    `${ga(S)} ${st.n}경기 연속으로 이겼다.`,
    `최근 ${st.n}연승, ${eun(S)} 흐름이 좋다.`,
    `${S}의 최근 흐름은 ${st.n}연승이다.`,
  ]);
}), ["formWin"]);
rule("F7", "form", 64, ["form"], (c) => c.either((s) => {
  const r = c.avgOf(c.recent(s), "rf"), all = c.avgOf(c.season(s), "rf");
  if (!(c.season(s).length >= 8 && r != null && all != null && r >= all + 2)) return null;
  const S = c.name(s);
  return c.pick("F7", [
    `${S} 타선은 최근 5경기 경기당 ${f1(r)}점으로 ${sy(c)} 평균(${f1(all)}점)보다 많이 냈다.`,
    `최근 5경기 ${S}의 득점(경기당 ${f1(r)}점)이 시즌 평균을 ${f1(r - all)}점 웃돈다.`,
    `${S}의 최근 득점력이 올라왔다(최근 5경기 ${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 5경기에서 시즌 평균보다 경기당 ${f1(r - all)}점 더 냈다.`,
  ]);
}), ["formBat"]);
rule("F8", "form", 64, ["form"], (c) => c.either((s) => {
  const r = c.avgOf(c.recent(s), "ra"), all = c.avgOf(c.season(s), "ra");
  if (!(c.season(s).length >= 8 && r != null && all != null && r <= all - 2)) return null;
  const S = c.name(s);
  return c.pick("F8", [
    `${S} 마운드는 최근 5경기 경기당 ${f1(r)}실점으로 ${sy(c)} 평균(${f1(all)}실점)보다 적게 내줬다.`,
    `최근 5경기 ${S}의 실점(경기당 ${f1(r)}점)이 시즌 평균보다 ${f1(all - r)}점 적다.`,
    `${S}의 최근 실점이 줄었다(최근 5경기 ${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 5경기에서 시즌 평균보다 경기당 ${f1(all - r)}점 덜 내줬다.`,
  ]);
}), ["formPit"]);
rule("F9", "form", 62, ["form"], (c) => c.either((s) => {
  const r = c.avgOf(c.recent(s), "rf"), all = c.avgOf(c.season(s), "rf");
  if (!(c.season(s).length >= 8 && r != null && all != null && r <= all - 2)) return null;
  const S = c.name(s);
  return c.pick("F9", [
    `${S} 타선은 최근 5경기 경기당 ${f1(r)}점으로 ${sy(c)} 평균(${f1(all)}점)보다 적게 냈다.`,
    `최근 5경기 ${S}의 득점(경기당 ${f1(r)}점)이 시즌 평균에 ${f1(all - r)}점 못 미친다.`,
    `${S}의 최근 득점력이 떨어졌다(최근 5경기 ${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 5경기에서 시즌 평균보다 경기당 ${f1(all - r)}점 덜 냈다.`,
  ]);
}), ["formBat"]);
rule("F4", "form", 60, ["form"], (c) => {
  const a = c.recent("a"), b = c.recent("b");
  if (!(a.length === 5 && b.length === 5 && winsIn(a) >= 4 && winsIn(b) >= 4)) return null;
  return c.pick("F4", [
    "두 팀 모두 최근 5경기 4승 이상, 좋은 흐름끼리 만난다.",
    `최근 5경기 ${winsIn(a)}승과 ${winsIn(b)}승, 두 팀 모두 잘 나가고 있다.`,
    "양 팀 모두 최근 성적이 좋다(최근 5경기 4승 이상).",
    "최근 흐름이 좋은 팀끼리의 대결이다.",
  ]);
}, ["formBoth"]);
rule("F5", "form", 60, ["form"], (c) => {
  const a = c.recent("a"), b = c.recent("b");
  if (!(a.length === 5 && b.length === 5 && winsIn(a) <= 1 && winsIn(b) <= 1)) return null;
  return c.pick("F5", [
    "두 팀 모두 최근 5경기 1승 이하로 흐름이 좋지 않다.",
    `최근 5경기 ${winsIn(a)}승과 ${winsIn(b)}승, 두 팀 모두 부진하다.`,
    "양 팀 모두 최근 성적이 좋지 않다(최근 5경기 1승 이하).",
    "최근 흐름이 나쁜 팀끼리의 대결이다.",
  ]);
}, ["formBoth"]);
rule("F10", "form", 58, ["form"], (c) => c.either((s) => {
  const g = c.season(s).slice(-1)[0];
  if (!(g && g.outcome === "승" && g.rf - g.ra >= 7)) return null;
  const S = c.name(s), vs = g.opp ? ` ${g.opp}전` : "";
  return c.pick("F10", [
    `${eun(S)} 직전 경기(${md(g.date)}${vs})에서 ${g.rf}:${g.ra}로 크게 이겼다.`,
    `${S}의 가장 최근 경기는 ${g.rf}:${g.ra} 대승이었다(${md(g.date)}).`,
    `직전 경기(${md(g.date)})에서 ${ga(S)} ${g.rf - g.ra}점 차 승리를 거뒀다.`,
    `${eun(S)} 마지막 경기를 ${g.rf}:${g.ra}로 이겼다(${md(g.date)}${vs}).`,
  ]);
}), ["formWin"]);

// ── 최근 흐름: 3·10경기 (14) ─────────────────────────────────
const firstN = (c: Ctx, s: Side, n: number) => c.season(s).slice(0, n);
rule("W1", "window", 66, ["form"], (c) => c.either((s) => {
  const all = c.season(s), r = c.recent(s, 10);
  const pa = pctOf(all), pr = pctOf(r);
  if (!(all.length >= 15 && pa != null && pr != null && pr - pa >= 0.2)) return null;
  const S = c.name(s);
  return c.pick("W1", [
    `${S}의 최근 10경기 승률(${f3(pr)})이 ${sy(c)} 승률(${f3(pa)})보다 높다. 시즌 후반으로 올수록 성적이 좋아졌다.`,
    `${eun(S)} 최근 10경기 ${winsIn(r)}승 ${lossesIn(r)}패로 시즌 전체 성적보다 낫다.`,
    `최근 10경기만 보면 ${S}의 승률은 ${f3(pr)}, 시즌 전체(${f3(pa)})를 웃돈다.`,
    `${S}의 성적은 최근 들어 올라왔다(최근 10경기 ${winsIn(r)}승 · 시즌 승률 ${f3(pa)}).`,
  ]);
}), ["formWin"]);
rule("W2", "window", 66, ["form"], (c) => c.either((s) => {
  const all = c.season(s), r = c.recent(s, 10);
  const pa = pctOf(all), pr = pctOf(r);
  if (!(all.length >= 15 && pa != null && pr != null && pa - pr >= 0.2)) return null;
  const S = c.name(s);
  return c.pick("W2", [
    `${S}의 최근 10경기 승률(${f3(pr)})이 ${sy(c)} 승률(${f3(pa)})보다 낮다. 최근 성적이 시즌 평균에 못 미친다.`,
    `${eun(S)} 최근 10경기 ${winsIn(r)}승 ${lossesIn(r)}패로 시즌 전체 성적보다 처진다.`,
    `최근 10경기만 보면 ${S}의 승률은 ${f3(pr)}, 시즌 전체(${f3(pa)})를 밑돈다.`,
    `${S}의 성적은 최근 들어 내려왔다(최근 10경기 ${winsIn(r)}승 · 시즌 승률 ${f3(pa)}).`,
  ]);
}), ["formLoss"]);
rule("W3", "window", 60, ["form"], (c) => c.either((s) => {
  const r = avgBy(c.recent(s, 10), "rf"), all = avgBy(c.season(s), "rf");
  if (!(c.season(s).length >= 15 && r != null && all != null && r >= all + 1.5)) return null;
  const S = c.name(s);
  return c.pick("W3", [
    `${S} 타선은 최근 10경기 경기당 ${f1(r)}점으로 ${sy(c)} 평균(${f1(all)}점)보다 많이 냈다.`,
    `최근 10경기 ${S}의 득점이 시즌 평균보다 경기당 ${f1(r - all)}점 많다.`,
    `${S}의 득점력은 최근 10경기에서 올라왔다(${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 10경기 동안 시즌 평균을 웃도는 득점을 했다(경기당 ${f1(r)}점).`,
  ]);
}), ["formBat"]);
rule("W4", "window", 60, ["form"], (c) => c.either((s) => {
  const r = avgBy(c.recent(s, 10), "ra"), all = avgBy(c.season(s), "ra");
  if (!(c.season(s).length >= 15 && r != null && all != null && r <= all - 1.5)) return null;
  const S = c.name(s);
  return c.pick("W4", [
    `${S} 마운드는 최근 10경기 경기당 ${f1(r)}실점으로 ${sy(c)} 평균(${f1(all)}점)보다 적게 내줬다.`,
    `최근 10경기 ${S}의 실점이 시즌 평균보다 경기당 ${f1(all - r)}점 적다.`,
    `${S}의 실점은 최근 10경기에서 줄었다(${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 10경기 동안 시즌 평균보다 적게 실점했다(경기당 ${f1(r)}점).`,
  ]);
}), ["formPit"]);
rule("W5", "window", 60, ["form"], (c) => c.either((s) => {
  const r = avgBy(c.recent(s, 10), "ra"), all = avgBy(c.season(s), "ra");
  if (!(c.season(s).length >= 15 && r != null && all != null && r >= all + 1.5)) return null;
  const S = c.name(s);
  return c.pick("W5", [
    `${S} 마운드는 최근 10경기 경기당 ${f1(r)}실점으로 ${sy(c)} 평균(${f1(all)}점)보다 많이 내줬다.`,
    `최근 10경기 ${S}의 실점이 시즌 평균보다 경기당 ${f1(r - all)}점 많다.`,
    `${S}의 실점은 최근 10경기에서 늘었다(${f1(r)}점 · 시즌 ${f1(all)}점).`,
    `${eun(S)} 최근 10경기 동안 시즌 평균보다 많이 실점했다(경기당 ${f1(r)}점).`,
  ]);
}), ["formPit"]);
rule("W6", "window", 63, ["form"], (c) => c.either((s) => {
  const r = c.recent(s, 3);
  if (!(r.length === 3 && r.every((g) => g.outcome === "승" && g.rf - g.ra >= 5))) return null;
  const S = c.name(s), m = Math.min(...r.map((g) => g.rf - g.ra));
  return c.pick("W6", [
    `${eun(S)} 최근 3경기를 모두 5점 차 이상으로 이겼다.`,
    `${S}의 최근 3경기는 모두 ${m}점 차 이상 승리였다.`,
    `최근 3경기 연속 큰 점수 차 승리, ${S}의 최근 경기 내용이 좋다.`,
    `${ga(S)} 최근 3경기에서 매번 5점 이상 앞서며 이겼다.`,
  ]);
}), ["formWin"]);
rule("W7", "window", 61, ["form"], (c) => c.either((s) => {
  const r = c.recent(s, 3);
  if (!(r.length === 3 && r.every((g) => g.outcome === "패") && c.streak(s).n === 3)) return null;
  const S = c.name(s), ra = r.reduce((t, g) => t + g.ra, 0), rf = r.reduce((t, g) => t + g.rf, 0);
  return c.pick("W7", [
    `${eun(S)} 최근 3경기를 모두 졌다(합계 ${rf}:${ra}).`,
    `${S}의 최근 3경기는 전패, 그 3경기 득실은 ${rf}:${ida(String(ra))}.`,
    `최근 3연패, ${eun(S)} 3경기에서 ${rf}점을 내고 ${ra}점을 내줬다.`,
    `${ga(S)} 최근 3경기에서 승리를 거두지 못했다(3패).`,
  ]);
}), ["formLoss"]);
rule("W8", "window", 64, ["form"], (c) => c.either((s) => {
  const all = c.season(s);
  if (all.length < 20) return null;
  const f = firstN(c, s, 10), r = c.recent(s, 10);
  const pf = pctOf(f), pr = pctOf(r);
  if (!(pf != null && pr != null && pf <= 0.4 && pr >= 0.7)) return null;
  const S = c.name(s);
  return c.pick("W8", [
    `${eun(S)} 시즌 첫 10경기 ${winsIn(f)}승 ${lossesIn(f)}패에서 최근 10경기 ${winsIn(r)}승 ${lossesIn(r)}패로 반등했다.`,
    `${S}의 시즌 초반과 최근 성적이 크게 다르다(첫 10경기 승률 ${f3(pf)} → 최근 10경기 ${f3(pr)}).`,
    `시즌 초반 부진했던 ${eun(S)} 최근 10경기에서 ${winsIn(r)}승을 거뒀다.`,
    `${S}의 성적은 시즌을 치르며 좋아졌다(첫 10경기 ${winsIn(f)}승 · 최근 10경기 ${winsIn(r)}승).`,
  ]);
}), ["formTrend"]);
rule("W9", "window", 64, ["form"], (c) => c.either((s) => {
  const all = c.season(s);
  if (all.length < 20) return null;
  const f = firstN(c, s, 10), r = c.recent(s, 10);
  const pf = pctOf(f), pr = pctOf(r);
  if (!(pf != null && pr != null && pf >= 0.7 && pr <= 0.4)) return null;
  const S = c.name(s);
  return c.pick("W9", [
    `${eun(S)} 시즌 첫 10경기 ${winsIn(f)}승 ${lossesIn(f)}패였지만 최근 10경기는 ${winsIn(r)}승 ${lossesIn(r)}패다.`,
    `${S}의 시즌 초반과 최근 성적이 크게 다르다(첫 10경기 승률 ${f3(pf)} → 최근 10경기 ${f3(pr)}).`,
    `시즌 초반 잘 나가던 ${S}의 최근 10경기 승리는 ${winsIn(r)}번이다.`,
    `${S}의 성적은 시즌을 치르며 내려왔다(첫 10경기 ${winsIn(f)}승 · 최근 10경기 ${winsIn(r)}승).`,
  ]);
}), ["formTrend"]);
rule("W10", "window", 59, ["form"], (c) => c.either((s) => {
  const all = c.season(s), r = c.recent(s, 10);
  if (all.length < 15) return null;
  const ma = all.reduce((t, g) => t + g.rf - g.ra, 0), mr = r.reduce((t, g) => t + g.rf - g.ra, 0);
  if (!(ma > 0 && mr < 0)) return null;
  const S = c.name(s);
  return c.pick("W10", [
    `${S}의 ${sy(c)} 득실은 ${signed(ma)}점이지만 최근 10경기만 보면 ${signed(mr)}점으로 마이너스다.`,
    `시즌 전체로는 득점이 많았던 ${ga(S)} 최근 10경기에서는 실점이 더 많았다(${signed(mr)}).`,
    `${S}의 최근 10경기 득실(${signed(mr)})이 시즌 득실(${signed(ma)})과 반대 방향이다.`,
    `최근 10경기 ${eun(S)} 낸 점수보다 내준 점수가 많다(${signed(mr)}). 시즌 전체는 ${ida(signed(ma))}.`,
  ]);
}), ["formTrend"]);
rule("W11", "window", 58, ["form"], (c) => c.either((s) => {
  const r = c.recent(s, 5);
  if (!(r.length === 5 && r.every((g) => g.rf >= 5))) return null;
  const S = c.name(s), lo = Math.min(...r.map((g) => g.rf));
  return c.pick("W11", [
    `${S} 타선은 최근 5경기 모두 5점 이상을 냈다.`,
    `최근 5경기 ${S}의 최소 득점이 ${lo}점이다. 매 경기 점수를 냈다.`,
    `${eun(S)} 최근 5경기 연속 5득점 이상을 기록했다.`,
    `최근 5경기에서 ${S} 타선이 5점 미만으로 막힌 경기가 없다.`,
  ]);
}), ["formBat"]);
rule("W12", "window", 58, ["form"], (c) => c.either((s) => {
  const r = c.recent(s, 5);
  if (!(r.length === 5 && r.every((g) => g.ra <= 3))) return null;
  const S = c.name(s), hi = Math.max(...r.map((g) => g.ra));
  return c.pick("W12", [
    `${S} 마운드는 최근 5경기 모두 3점 이하로 막았다.`,
    `최근 5경기 ${S}의 최다 실점이 ${hi}점이다.`,
    `${eun(S)} 최근 5경기 연속 3실점 이하를 기록했다.`,
    `최근 5경기에서 ${S} 마운드가 4점 이상 내준 경기가 없다.`,
  ]);
}), ["formPit"]);
rule("W13", "window", 57, ["form"], (c) => c.either((s) => {
  const r = c.recent(s, 3);
  const z = r.filter((g) => g.rf === 0).length;
  if (!(r.length === 3 && z >= 2)) return null;
  const S = c.name(s);
  return c.pick("W13", [
    `${S} 타선은 최근 3경기 중 ${z}경기에서 득점하지 못했다.`,
    `최근 3경기 ${S}의 무득점 경기가 ${z}번이다.`,
    `${eun(S)} 최근 3경기에서 ${z}번 0점에 그쳤다.`,
    `최근 ${S} 타선이 막혔다(최근 3경기 중 무득점 ${z}경기).`,
  ]);
}), ["formBat"]);
rule("W14", "window", 59, ["form"], (c) => {
  const a = c.recent("a", 10), b = c.recent("b", 10);
  const pa = pctOf(a), pb = pctOf(b);
  if (!(a.length === 10 && b.length === 10 && pa != null && pb != null && pa >= 0.8 && pb >= 0.8)) return null;
  return c.pick("W14", [
    `두 팀 모두 최근 10경기 승률 8할 이상이다(${winsIn(a)}승·${winsIn(b)}승).`,
    `최근 10경기 ${winsIn(a)}승과 ${winsIn(b)}승, 두 팀 모두 최근 성적이 좋다.`,
    "양 팀 모두 최근 10경기에서 열에 여덟 이상을 이겼다.",
    "최근 10경기 흐름이 좋은 팀끼리의 대결이다.",
  ]);
}, ["formBoth"]);

// ── 한 경기 제외 검증 (10) — 특정 경기 하나에 기록이 쏠렸는지 본다 ─────────
const best = (gs: SeasonGame[]) => gs.reduce<SeasonGame | null>((m, g) => (!m || g.rf - g.ra > m.rf - m.ra ? g : m), null);
const worst = (gs: SeasonGame[]) => gs.reduce<SeasonGame | null>((m, g) => (!m || g.rf - g.ra < m.rf - m.ra ? g : m), null);
const sumM = (gs: SeasonGame[]) => gs.reduce((t, g) => t + g.rf - g.ra, 0);
const gName = (g: SeasonGame) => `${md(g.date)}${g.opp ? ` ${g.opp}전` : ""}`;
rule("RB1", "robust", 63, ["runs"], (c) => c.either((s) => {
  const gs = c.season(s), m = sumM(gs), b = best(gs);
  if (!(gs.length >= 10 && b && m >= 20 && (b.rf - b.ra) / m >= 0.3)) return null;
  const S = c.name(s), d = b.rf - b.ra;
  return c.pick("RB1", [
    `${S}의 득실 마진 ${signed(m)} 중 ${d}점이 한 경기(${gName(b)} ${b.rf}:${b.ra})에서 나왔다. 그 경기를 빼면 ${signed(m - d)}점이다.`,
    `${S}의 득실 우위는 한 경기의 영향이 크다. ${gName(b)} ${b.rf}:${b.ra} 경기를 빼면 마진이 ${signed(m)}점에서 ${signed(m - d)}점으로 줄어든다.`,
    `${gName(b)}의 ${b.rf}:${b.ra} 경기가 ${S} 득실 마진(${signed(m)})의 ${pct0(d / m)}를 차지한다.`,
    `득실 마진만으로 ${eul(S)} 평가하면 한 경기(${gName(b)}) 대승의 몫이 크다. 그 경기를 빼면 ${signed(m - d)}점이다.`,
  ]);
}), ["runsDepend"]);
rule("RB2", "robust", 61, ["runs"], (c) => c.either((s) => {
  const gs = c.season(s), m = sumM(gs), b = best(gs);
  if (!(gs.length >= 10 && b && m >= 30 && (m - (b.rf - b.ra)) / m >= 0.75)) return null;
  const S = c.name(s), m2 = m - (b.rf - b.ra);
  return c.pick("RB2", [
    `${S}의 득실 마진 ${signed(m)}점은 가장 큰 점수 차 경기(${gName(b)})를 빼도 ${signed(m2)}점으로 유지된다.`,
    `${S}의 득실 우위는 특정 경기 하나에 기대지 않는다. 최대 점수 차 경기를 빼도 ${ida(signed(m2))}.`,
    `가장 크게 이긴 경기를 제외해도 ${S}의 득실 마진은 ${ida(signed(m2))}. 고르게 쌓인 우위다.`,
    `${eun(S)} 한 경기 대승 없이도 득실 우위(${signed(m2)})를 지킨다.`,
  ]);
}), ["runsRobust"]);
rule("RB3", "robust", 60, ["runs"], (c) => c.either((s) => {
  const gs = c.season(s), m = sumM(gs), w = worst(gs);
  if (!(gs.length >= 10 && w && m < 0 && m - (w.rf - w.ra) >= 0)) return null;
  const S = c.name(s), m2 = m - (w.rf - w.ra);
  return c.pick("RB3", [
    `${S}의 득실 마진은 ${signed(m)}점이지만 가장 크게 진 경기(${gName(w)} ${w.rf}:${w.ra})를 빼면 ${ida(signed(m2))}.`,
    `${S}의 마이너스 득실은 한 경기 대패(${gName(w)})의 영향이 크다. 그 경기를 빼면 ${ida(signed(m2))}.`,
    `${gName(w)}의 ${w.rf}:${w.ra} 패배를 제외하면 ${S}의 득실은 플러스(${signed(m2)})로 바뀐다.`,
    `득실 마진(${signed(m)})만 보면 ${ga(S)} 약해 보이지만, 대패 한 경기를 빼면 득실이 ${ida(signed(m2))}.`,
  ]);
}), ["runsDepend"]);
rule("RB4", "robust", 58, ["runsDist"], (c) => c.either((s) => {
  const gs = c.season(s), mean = avgBy(gs, "rf"), med = median(gs.map((g) => g.rf));
  if (!(gs.length >= 10 && mean != null && med != null && mean - med >= 2)) return null;
  const S = c.name(s);
  return c.pick("RB4", [
    `${S}의 경기당 평균 득점은 ${f1(mean)}점이지만 중앙값은 ${f1(med)}점이다. 대량 득점 경기가 평균을 끌어올렸다.`,
    `${S} 타선의 득점은 경기별 편차가 크다(평균 ${f1(mean)}점 · 중앙값 ${f1(med)}점).`,
    `평균(${f1(mean)}점)만 보면 ${S}의 득점력이 과대평가될 수 있다. 보통 경기의 득점은 ${f1(med)}점 안팎이다.`,
    `${S}의 득점 평균과 중앙값 차이가 ${f1(mean - med)}점이다. 몇몇 대량 득점 경기의 몫이 크다.`,
  ]);
}), ["runsDist"]);
rule("RB5", "robust", 58, ["raDist"], (c) => c.either((s) => {
  const gs = c.season(s), mean = avgBy(gs, "ra"), med = median(gs.map((g) => g.ra));
  if (!(gs.length >= 10 && mean != null && med != null && mean - med >= 2)) return null;
  const S = c.name(s);
  return c.pick("RB5", [
    `${S}의 경기당 평균 실점은 ${f1(mean)}점이지만 중앙값은 ${f1(med)}점이다. 대량 실점 경기가 평균을 끌어올렸다.`,
    `${S} 마운드의 실점은 경기별 편차가 크다(평균 ${f1(mean)}점 · 중앙값 ${f1(med)}점).`,
    `평균 실점(${f1(mean)}점)만 보면 ${S} 마운드가 과소평가될 수 있다. 보통 경기의 실점은 ${f1(med)}점 안팎이다.`,
    `${S}의 실점 평균과 중앙값 차이가 ${f1(mean - med)}점이다. 몇몇 대량 실점 경기의 몫이 크다.`,
  ]);
}), ["raDist"]);
rule("RB6", "robust", 56, ["runsDist"], (c) => c.either((s) => {
  const gs = c.season(s), n = gs.filter((g) => g.rf >= 5).length;
  if (!(gs.length >= 10 && n / gs.length >= 0.7)) return null;
  const S = c.name(s);
  return c.pick("RB6", [
    `${eun(S)} ${gs.length}경기 중 ${n}경기에서 5점 이상을 냈다. 득점이 꾸준하다.`,
    `${S} 타선이 5점 이상 낸 경기 비율은 ${pct0(n / gs.length)}다.`,
    `${S}의 득점은 기복이 적다(5득점 이상 ${n}/${gs.length}경기).`,
    `경기 열 번 중 일곱 번 이상, ${eun(S)} 5점 넘게 냈다.`,
  ]);
}), ["runsDist"]);
rule("RB7", "robust", 56, ["raDist"], (c) => c.either((s) => {
  const gs = c.season(s), n = gs.filter((g) => g.ra <= 3).length;
  if (!(gs.length >= 10 && n / gs.length >= 0.6)) return null;
  const S = c.name(s);
  return c.pick("RB7", [
    `${S} 마운드는 ${gs.length}경기 중 ${n}경기를 3점 이하로 막았다. 실점이 꾸준히 적다.`,
    `${ga(S)} 3점 이하로 막은 경기 비율은 ${pct0(n / gs.length)}다.`,
    `${S}의 실점은 기복이 적다(3실점 이하 ${n}/${gs.length}경기).`,
    `경기 열 번 중 여섯 번 이상, ${eun(S)} 3점 이하만 내줬다.`,
  ]);
}), ["raDist"]);
rule("RB8", "robust", 55, ["winMargin"], (c) => c.either((s) => {
  const ws = c.season(s).filter((g) => g.outcome === "승");
  const avg = ws.length ? ws.reduce((t, g) => t + g.rf - g.ra, 0) / ws.length : 0;
  if (!(ws.length >= 5 && avg >= 7)) return null;
  const S = c.name(s);
  return c.pick("RB8", [
    `${S}의 승리는 평균 ${f1(avg)}점 차였다. 이길 때는 크게 이겼다.`,
    `${ga(S)} 이긴 ${ws.length}경기의 평균 점수 차는 ${f1(avg)}점이다.`,
    `${S}의 승리 경기 평균 득실 차가 ${f1(avg)}점으로 크다.`,
    `이긴 경기만 보면 ${eun(S)} 평균 ${f1(avg)}점 차로 앞섰다.`,
  ]);
}), ["winMargin"]);
rule("RB9", "robust", 55, ["lossMargin"], (c) => c.either((s) => {
  const ls = c.season(s).filter((g) => g.outcome === "패");
  const avg = ls.length ? ls.reduce((t, g) => t + g.ra - g.rf, 0) / ls.length : 99;
  if (!(ls.length >= 4 && avg <= 2)) return null;
  const S = c.name(s);
  return c.pick("RB9", [
    `${S}의 패배는 평균 ${f1(avg)}점 차였다. 진 경기도 대부분 접전이었다.`,
    `${ga(S)} 진 ${ls.length}경기의 평균 점수 차는 ${f1(avg)}점이다.`,
    `${eun(S)} 질 때도 크게 지지 않았다(패배 평균 ${f1(avg)}점 차).`,
    `진 경기만 보면 ${eun(S)} 평균 ${f1(avg)}점 차로 뒤졌다.`,
  ]);
}), ["lossMargin"]);
rule("RB10", "robust", 54, ["runs"], (c) => {
  const ok = (s: Side) => {
    const gs = c.season(s), m = sumM(gs), b = best(gs);
    return gs.length >= 10 && b && m >= 30 && (m - (b.rf - b.ra)) / m >= 0.75 ? m - (b.rf - b.ra) : null;
  };
  const a = ok("a"), b = ok("b");
  if (a == null || b == null) return null;
  return c.pick("RB10", [
    `두 팀 모두 가장 크게 이긴 경기를 빼도 득실 마진이 크게 플러스다(${signed(a)}·${signed(b)}).`,
    `양 팀의 득실 우위는 한 경기에 기대지 않는다(최대 점수 차 경기 제외 ${signed(a)}·${signed(b)}).`,
    "두 팀 모두 대승 한 경기 없이도 득실 우위가 유지된다.",
    `득실 마진이 고르게 쌓인 팀끼리다(대승 한 경기 제외 ${signed(a)}·${signed(b)}).`,
  ]);
}, ["runsRobustBoth"]);

// ── 대회 단계별 성적 (9) — 전국대회와 주말리그(권역)를 나눠 본다 ─────────
const split = (c: Ctx, s: Side) => {
  const gs = c.season(s).filter((g) => g.title);
  const nat = gs.filter((g) => isNational(g.title)), lea = gs.filter((g) => !isNational(g.title));
  return { nat, lea };
};
rule("ST1", "stage", 62, ["stage"], (c) => c.either((s) => {
  const { nat, lea } = split(c, s);
  const pn = pctOf(nat), pl = pctOf(lea);
  if (!(nat.length >= 5 && lea.length >= 5 && pn != null && pl != null && pn - pl >= 0.25)) return null;
  const S = c.name(s);
  return c.pick("ST1", [
    `${eun(S)} 전국대회 ${winsIn(nat)}승 ${lossesIn(nat)}패로 주말리그(${winsIn(lea)}승 ${lossesIn(lea)}패)보다 성적이 좋다.`,
    `${S}의 전국대회 승률(${f3(pn)})이 주말리그 승률(${f3(pl)})보다 높다.`,
    `큰 대회에서 ${S}의 성적이 더 좋았다(전국대회 승률 ${f3(pn)} · 주말리그 ${f3(pl)}).`,
    `${eun(S)} 주말리그보다 전국대회에서 더 많이 이겼다(${winsIn(nat)}승 ${lossesIn(nat)}패).`,
  ]);
}), ["stage"]);
rule("ST2", "stage", 62, ["stage"], (c) => c.either((s) => {
  const { nat, lea } = split(c, s);
  const pn = pctOf(nat), pl = pctOf(lea);
  if (!(nat.length >= 5 && lea.length >= 5 && pn != null && pl != null && pl - pn >= 0.25)) return null;
  const S = c.name(s);
  return c.pick("ST2", [
    `${eun(S)} 주말리그 ${winsIn(lea)}승 ${lossesIn(lea)}패에 비해 전국대회 성적(${winsIn(nat)}승 ${lossesIn(nat)}패)이 처진다.`,
    `${S}의 전국대회 승률(${f3(pn)})이 주말리그 승률(${f3(pl)})보다 낮다.`,
    `권역 리그에 비해 전국대회에서 ${S}의 성적이 떨어졌다(승률 ${f3(pl)} → ${f3(pn)}).`,
    `${eun(S)} 주말리그에서 더 많이 이겼다(전국대회 ${winsIn(nat)}승 ${lossesIn(nat)}패).`,
  ]);
}), ["stage"]);
rule("ST3", "stage", 58, ["stageRuns"], (c) => c.either((s) => {
  const { nat, lea } = split(c, s);
  const rn = avgBy(nat, "rf"), rl = avgBy(lea, "rf");
  if (!(nat.length >= 5 && lea.length >= 5 && rn != null && rl != null && Math.abs(rn - rl) >= 2)) return null;
  const S = c.name(s), more = rn > rl;
  return c.pick("ST3", [
    `${S}의 경기당 득점은 전국대회 ${f1(rn)}점, 주말리그 ${f1(rl)}점이다.`,
    `${S} 타선은 ${more ? "전국대회" : "주말리그"}에서 경기당 ${f1(Math.abs(rn - rl))}점 더 냈다.`,
    `대회 종류에 따라 ${S}의 득점이 달랐다(전국대회 ${f1(rn)}점 · 주말리그 ${f1(rl)}점).`,
    `${S}의 득점력은 ${more ? "전국대회" : "주말리그"} 쪽에서 더 높았다.`,
  ]);
}), ["stageRuns"]);
rule("ST4", "stage", 58, ["stageRuns"], (c) => c.either((s) => {
  const { nat, lea } = split(c, s);
  const rn = avgBy(nat, "ra"), rl = avgBy(lea, "ra");
  if (!(nat.length >= 5 && lea.length >= 5 && rn != null && rl != null && Math.abs(rn - rl) >= 2)) return null;
  const S = c.name(s), more = rn > rl;
  return c.pick("ST4", [
    `${S}의 경기당 실점은 전국대회 ${f1(rn)}점, 주말리그 ${f1(rl)}점이다.`,
    `${S} 마운드는 ${more ? "전국대회" : "주말리그"}에서 경기당 ${f1(Math.abs(rn - rl))}점 더 내줬다.`,
    `대회 종류에 따라 ${S}의 실점이 달랐다(전국대회 ${f1(rn)}점 · 주말리그 ${f1(rl)}점).`,
    `${S} 마운드는 ${more ? "주말리그" : "전국대회"} 쪽에서 더 잘 막았다.`,
  ]);
}), ["stageRuns"]);
rule("ST5", "stage", 55, ["stageExp"], (c) => c.either((s) => {
  const { nat } = split(c, s);
  if (!(nat.length >= 10)) return null;
  const S = c.name(s);
  return c.pick("ST5", [
    `${eun(S)} ${sy(c)} 전국대회에서만 ${nat.length}경기를 치렀다(${winsIn(nat)}승 ${lossesIn(nat)}패).`,
    `${S}의 전국대회 경기 수는 ${nat.length}경기다. 큰 대회 경험이 많은 편이다.`,
    `${sy(c)} 전국대회 ${nat.length}경기, ${eun(S)} 여러 전국대회에서 경기를 이어갔다.`,
    `${S}의 기록 중 ${nat.length}경기가 전국대회에서 나왔다.`,
  ]);
}), ["stageExp"]);
rule("ST6", "stage", 57, ["stageExp"], (c) => c.either((s) => {
  const x = split(c, s).nat, y = split(c, c.oth(s)).nat;
  if (!(x.length >= 5 && y.length <= 1)) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("ST6", [
    `${eun(S)} 전국대회 ${x.length}경기를 치렀고 ${eun(O)} ${y.length}경기다. 기록의 무대가 다르다.`,
    `${O}의 기록은 대부분 주말리그에서, ${S}의 기록은 전국대회에서도 나왔다(${x.length}경기).`,
    `전국대회 경기 수 차이가 크다(${S} ${x.length} · ${O} ${y.length}).`,
    `상대 수준이 다른 경기가 섞여 있다. ${eun(S)} 전국대회 ${x.length}경기, ${eun(O)} ${y.length}경기다.`,
  ]);
}), ["stageExp"]);
rule("ST7", "stage", 56, ["stageCmp"], (c) => {
  const a = split(c, "a").nat, b = split(c, "b").nat;
  const pa = pctOf(a), pb = pctOf(b);
  if (!(a.length >= 5 && b.length >= 5 && pa != null && pb != null && Math.abs(pa - pb) >= 0.2)) return null;
  const s: Side = pa > pb ? "a" : "b";
  c.about(s);
  const S = c.name(s), O = c.name(c.oth(s)), [xs, ys] = s === "a" ? [a, b] : [b, a];
  return c.pick("ST7", [
    `전국대회 성적은 ${S} ${wl(winsIn(xs), lossesIn(xs))}, ${O} ${ida(wl(winsIn(ys), lossesIn(ys)))}.`,
    `전국대회만 놓고 보면 ${ga(S)} 앞선다(승률 ${f3(Math.max(pa, pb))}:${f3(Math.min(pa, pb))}).`,
    `${S}의 전국대회 승률이 ${O}보다 높다(${winsIn(xs)}승 ${lossesIn(xs)}패 · ${winsIn(ys)}승 ${lossesIn(ys)}패).`,
    `큰 대회 성적에서도 차이가 난다. 전국대회 승률은 ${S} 쪽이 높다.`,
  ]);
}, ["stageCmp"]);
rule("ST8", "stage", 52, ["stageCmp"], (c) => {
  const a = split(c, "a").lea, b = split(c, "b").lea;
  const pa = pctOf(a), pb = pctOf(b);
  if (!(a.length >= 5 && b.length >= 5 && pa != null && pb != null && Math.abs(pa - pb) >= 0.2)) return null;
  const s: Side = pa > pb ? "a" : "b";
  c.about(s);
  const S = c.name(s), O = c.name(c.oth(s)), [xs, ys] = s === "a" ? [a, b] : [b, a];
  return c.pick("ST8", [
    `주말리그 성적은 ${S} ${wl(winsIn(xs), lossesIn(xs))}, ${O} ${ida(wl(winsIn(ys), lossesIn(ys)))}.`,
    `권역 리그(주말리그)만 놓고 보면 ${ga(S)} 앞선다.`,
    `${S}의 주말리그 승률이 ${O}보다 높다(${winsIn(xs)}승 ${lossesIn(xs)}패 · ${winsIn(ys)}승 ${lossesIn(ys)}패).`,
    `주말리그 기록에서도 ${S} 쪽 성적이 낫다.`,
  ]);
}, ["stageCmp"]);
rule("ST9", "stage", 57, ["stage"], (c) => c.either((s) => {
  const { nat } = split(c, s);
  if (!(nat.length >= 4 && lossesIn(nat) === 0)) return null;
  const S = c.name(s);
  return c.pick("ST9", [
    `${eun(S)} ${sy(c)} 전국대회 ${nat.length}경기에서 지지 않았다.`,
    `${S}의 전국대회 성적은 ${winsIn(nat)}승 무패다.`,
    `전국대회 무패(${winsIn(nat)}승), ${eun(S)} 큰 대회에서 패배가 없다.`,
    `${sy(c)} 전국대회에서 ${S}에게 아직 패배가 없다.`,
  ]);
}), ["stage"]);

// ── 표본 (2) — 고른 줄 뒤에 항상 덧붙인다 ─────────────────────
rule("X2", "sample", 0, [], (c) => {
  if (!(c.games("a") > 0 && c.games("b") > 0 && c.games("a") < 5 && c.games("b") < 5)) return null;
  return c.pick("X2", [
    "두 팀 모두 5경기 미만의 기록이라 표본이 적다. 참고용으로 보자.",
    `두 팀의 기록이 각각 ${c.games("a")}·${c.games("b")}경기뿐이다. 위 분석은 참고 수준이다.`,
    "양 팀 모두 경기 수가 적어 기록이 바뀔 여지가 크다.",
    "표본이 작은 두 팀의 비교다. 수치는 참고로만 보자.",
  ]);
});
rule("X1", "sample", 0, [], (c) => c.either((s) => {
  const g = c.games(s);
  if (!(g > 0 && g < 5 && c.games(c.oth(s)) >= 5)) return null;
  const S = c.name(s);
  return c.pick("X1", [
    `${eun(S)} ${g}경기 기록뿐이라 표본이 적다. 참고용으로 보자.`,
    `${S}의 기록은 ${g}경기에서 나온 것이다. 비교는 참고 수준이다.`,
    `${eun(S)} 경기 수(${g}경기)가 적어 기록이 바뀔 여지가 크다.`,
    `${S}의 표본이 작다(${g}경기). 수치는 참고로만 보자.`,
  ]);
}));

void shortTitle;
