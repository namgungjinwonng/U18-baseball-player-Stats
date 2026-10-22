// 경기 분석 규칙 — 공통 상대 성적, 강점×약점 교차 조합, 팀 공격·마운드 스타일, 양 팀 공통 특징 보강. 기준은 선택 시즌.
import {
  eun, eul, f1, f2, f3, ga, gwa, ida, pct0, pct1, rule, wl,
  type Ctx, type Side,
} from "./core";

const sy = (c: Ctx) => (c.input.year ? `${c.input.year} 시즌` : "올 시즌");

// ── 공통 상대 (10) — 두 팀이 모두 상대한 학교와의 경기만 모아 비교 ─────────
const common = (c: Ctx) => {
  const list = c.input.common ?? [];
  const sum = (s: Side) => list.reduce(
    (t, x) => ({ w: t.w + x[s].w, l: t.l + x[s].l, d: t.d + x[s].d, rf: t.rf + x[s].rf, ra: t.ra + x[s].ra }),
    { w: 0, l: 0, d: 0, rf: 0, ra: 0 }
  );
  const a = sum("a"), b = sum("b");
  const pct = (r: { w: number; l: number }) => (r.w + r.l ? r.w / (r.w + r.l) : undefined);
  const g = (r: { w: number; l: number; d: number }) => r.w + r.l + r.d;
  return { n: list.length, list, a, b, pa: pct(a), pb: pct(b), ga: g(a), gb: g(b) };
};
const cRec = (r: { w: number; l: number; d: number }) => wl(r.w, r.l, r.d);
rule("CO1", "common", 74, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 3 && x.ga >= 4 && x.gb >= 4 && x.pa != null && x.pb != null && Math.abs(x.pa - x.pb) >= 0.3)) return null;
  const s: Side = x.pa > x.pb ? "a" : "b";
  c.about(s);
  const S = c.name(s), O = c.name(c.oth(s)), [rs, ro_] = s === "a" ? [x.a, x.b] : [x.b, x.a];
  return c.pick("CO1", [
    `공통 상대 ${x.n}개 학교와의 경기에서 ${S} ${cRec(rs)}, ${O} ${ida(cRec(ro_))}. 같은 상대를 놓고도 성적 차가 크다.`,
    `두 팀이 모두 만난 ${x.n}개 학교 상대로 ${eun(S)} ${cRec(rs)}, ${eun(O)} ${cRec(ro_)}를 기록했다.`,
    `같은 상대(${x.n}곳)와의 성적을 비교하면 ${ga(S)} 확실히 앞선다(${cRec(rs)} · ${cRec(ro_)}).`,
    `공통 상대 기준으로도 ${S} 우위다. ${x.n}곳 상대 승률이 ${S} ${f3(Math.max(x.pa, x.pb))}, ${O} ${ida(f3(Math.min(x.pa, x.pb)))}.`,
    `공통 상대 ${x.n}곳 기준 성적은 ${S} ${cRec(rs)}, ${O} ${ida(cRec(ro_))}.`,
  ]);
}, ["commonEdge"]);
rule("CO2", "common", 66, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 3 && x.a.w + x.a.l >= 4 && x.b.w + x.b.l >= 4 && x.pa != null && x.pb != null && Math.abs(x.pa - x.pb) <= 0.1)) return null;
  return c.pick("CO2", [
    `공통 상대 ${x.n}개 학교와의 성적이 비슷하다(${c.name("a")} ${cRec(x.a)} · ${c.name("b")} ${cRec(x.b)}).`,
    `같은 상대를 만났을 때 두 팀의 결과는 거의 같았다(공통 상대 ${x.n}곳).`,
    `공통 상대 기준으로는 우열이 없다(승률 ${f3(x.pa)}·${f3(x.pb)}).`,
    `두 팀이 모두 상대한 ${x.n}개 학교와의 경기에서 비슷한 승률을 냈다.`,
  ]);
}, ["commonEven"]);
rule("CO3", "common", 68, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 3 && x.ga >= 4 && x.gb >= 4)) return null;
  const ma = (x.a.rf - x.a.ra) / x.ga, mb = (x.b.rf - x.b.ra) / x.gb;
  if (!(Math.abs(ma - mb) >= 3)) return null;
  const s: Side = ma > mb ? "a" : "b";
  c.about(s);
  const S = c.name(s), O = c.name(c.oth(s)), [p, q] = s === "a" ? [ma, mb] : [mb, ma];
  return c.pick("CO3", [
    `공통 상대와의 경기당 득실 차는 ${S} ${p >= 0 ? "+" : ""}${f1(p)}점, ${O} ${p >= 0 && q >= 0 ? "+" : ""}${f1(q)}점이다.`,
    `같은 상대(${x.n}곳)를 만났을 때 ${eun(S)} 경기당 ${f1(p - q)}점 더 앞섰다.`,
    `공통 상대와의 경기 내용은 ${S} 쪽이 낫다(경기당 득실 차 ${f1(p)} · ${f1(q)}).`,
    `공통 상대 ${x.n}곳과의 득실을 경기당으로 바꾸면 ${gwa(S)} ${O}의 차이가 ${f1(p - q)}점이다.`,
    `같은 상대를 만났을 때의 경기 내용도 ${S} 쪽이 낫다(공통 상대 ${x.n}곳, 경기당 득실 차 ${f1(p)}:${f1(q)}).`,
  ]);
}, ["commonEdge"]);
rule("CO4", "common", 70, ["common"], (c) => {
  const x = common(c);
  const cross = (s: Side) => x.list.filter((o) => o[s].w > o[s].l && o[s === "a" ? "b" : "a"].l > o[s === "a" ? "b" : "a"].w);
  const ca = cross("a"), cb = cross("b");
  const s: Side | null = ca.length >= 2 && ca.length > cb.length ? "a" : cb.length >= 2 && cb.length > ca.length ? "b" : null;
  if (!s) return null;
  c.about(s);
  const list = (s === "a" ? ca : cb).map((o) => o.opponent), S = c.name(s), O = c.name(c.oth(s));
  const shown = list.slice(0, 3).join("·") + (list.length > 3 ? ` 등 ${list.length}곳` : "");
  return c.pick("CO4", [
    `${ga(O)} 진 학교(${shown})를 ${eun(S)} 이겼다.`,
    `${ga(S)} 이기고 ${ga(O)} 진 공통 상대가 ${list.length}곳이다(${shown}).`,
    `같은 상대에 대한 결과가 갈린 경우가 있다. ${shown} 상대로 ${eun(S)} 이겼고 ${eun(O)} 졌다.`,
    `${gwa(shown)}의 경기에서 두 팀의 결과가 엇갈렸다(${S} 승 · ${O} 패).`,
  ]);
}, ["commonCross"]);
rule("CO5", "common", 72, ["common"], (c) => {
  const x = common(c), h = c.input.h2h;
  if (!(x.n >= 3 && x.pa != null && x.pb != null && Math.abs(x.pa - x.pb) >= 0.2 && h && c.done.length >= 2 && h.w !== h.l)) return null;
  const cs: Side = x.pa > x.pb ? "a" : "b", hs: Side = h.w > h.l ? "a" : "b";
  if (cs === hs) return null;
  const C = c.name(cs), H = c.name(hs);
  return c.pick("CO5", [
    `공통 상대 성적은 ${C} 쪽이 좋지만 ${c.h2hScope} 맞대결은 ${H} 우세다. 두 근거가 엇갈린다.`,
    `같은 상대를 놓고는 ${ga(C)} 앞서는데, 직접 맞붙었을 때(${c.h2hScope})는 ${ga(H)} 더 많이 이겼다.`,
    `공통 상대 기준 우세(${C})와 ${c.h2hScope} 맞대결 우세(${H})가 다르다.`,
    `${eun(H)} ${c.h2hScope} 맞대결에서 앞섰지만 공통 상대와의 성적은 ${C} 쪽이 낫다.`,
  ]);
}, ["commonVsH2h"]);
rule("CO6", "common", 64, ["common"], (c) => {
  const x = common(c), m = c.leader;
  if (!(m && x.n >= 3 && x.pa != null && x.pb != null && Math.abs(x.pa - x.pb) >= 0.15)) return null;
  const cs: Side = x.pa > x.pb ? "a" : "b";
  if (cs !== m) return null;
  c.about(m);
  const M = c.name(m);
  return c.pick("CO6", [
    `지표 우세와 공통 상대 성적이 같은 쪽(${M})을 가리킨다.`,
    `공통 상대 ${x.n}곳과의 결과도 지표와 마찬가지로 ${M} 쪽이 낫다.`,
    `지표상 앞선 ${eun(M)} 공통 상대 성적에서도 앞선다.`,
    `기록과 공통 상대 결과가 일치한다. 두 근거 모두 ${M} 우세다.`,
  ]);
}, ["commonEdge"]);
rule("CO7", "common", 45, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 1 && x.n <= 2)) return null;
  const names = x.list.map((o) => o.opponent).join("·");
  return c.pick("CO7", [
    `두 팀이 모두 상대한 학교는 ${names} ${x.n}곳뿐이라 공통 상대 비교는 제한적이다.`,
    `공통 상대가 ${x.n}곳(${names})뿐이다.`,
    `같은 상대를 만난 경우가 적다(공통 상대 ${names}).`,
    `${sy(c)} 두 팀의 공통 상대는 ${names}뿐이다.`,
  ]);
}, ["commonFew"]);
rule("CO8", "common", 62, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 8)) return null;
  return c.pick("CO8", [
    `두 팀이 모두 상대한 학교가 ${x.n}곳이다. 공통 상대 성적은 ${c.name("a")} ${cRec(x.a)}, ${c.name("b")} ${ida(cRec(x.b))}.`,
    `공통 상대가 ${x.n}곳으로 많다. 같은 상대 기준 비교가 가능한 대진이다.`,
    `공통 상대 ${x.n}곳 상대 성적 — ${c.name("a")} ${cRec(x.a)} · ${c.name("b")} ${cRec(x.b)}.`,
    `${sy(c)} 두 팀은 ${x.n}개 학교를 함께 상대했다(${cRec(x.a)} · ${cRec(x.b)}).`,
  ]);
}, ["commonMany"]);
rule("CO9", "common", 60, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 3 && x.a.l === 0 && x.b.l === 0 && x.a.w >= 3 && x.b.w >= 3)) return null;
  return c.pick("CO9", [
    `두 팀 모두 공통 상대 ${x.n}곳에게 지지 않았다(${x.a.w}승 · ${x.b.w}승).`,
    `공통 상대와의 경기에서 양 팀 모두 무패다.`,
    `같은 상대를 만나 두 팀 모두 패배가 없었다(공통 상대 ${x.n}곳).`,
    `공통 상대 기준으로는 두 팀 모두 흠잡을 데 없는 성적이다(무패).`,
  ]);
}, ["commonEven"]);
rule("CO10", "common", 58, ["common"], (c) => {
  const x = common(c);
  if (!(x.n >= 3 && x.ga >= 4 && x.gb >= 4)) return null;
  const rfA = x.a.rf / x.ga, rfB = x.b.rf / x.gb, raA = x.a.ra / x.ga, raB = x.b.ra / x.gb;
  const bat: Side | null = rfA - rfB >= 1.5 ? "a" : rfB - rfA >= 1.5 ? "b" : null;
  const pit: Side | null = raB - raA >= 1.5 ? "a" : raA - raB >= 1.5 ? "b" : null;
  if (!(bat && pit && bat !== pit)) return null;
  const Bt = c.name(bat), Pt = c.name(pit);
  return c.pick("CO10", [
    `공통 상대와의 경기에서 ${eun(Bt)} 더 많이 냈고 ${eun(Pt)} 더 적게 내줬다.`,
    `같은 상대 기준 득점은 ${Bt}, 실점 억제는 ${Pt} 쪽이 낫다.`,
    `공통 상대 ${x.n}곳 상대로 득점력은 ${Bt}, 실점 억제는 ${Pt} 우위다.`,
    `공통 상대 성적에서도 두 팀의 강점이 갈린다(득점 ${Bt} · 실점 억제 ${Pt}).`,
  ]);
}, ["commonSplit"]);

// ── 강점×약점 교차 조합 (14) ────────────────────────────────
rule("CR1", "cross", 76, ["iso", "h9"], (c) => c.either((s) => {
  const o = c.oth(s), iso = c.ex("iso", s), h9 = c.ex("h9", o), li = c.lg("iso"), lh = c.lg("h9");
  if (!(iso != null && h9 != null && li && lh && iso >= li * 1.2 && h9 >= lh * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR1", [
    `장타가 많은 ${S} 타선(ISO ${f3(iso)})이 안타를 많이 맞는 ${O} 마운드(H/9 ${f1(h9)})를 만난다.`,
    `${S}의 장타력(ISO ${f3(iso)})과 ${O} 마운드의 피안타(H/9 ${f1(h9)})가 맞물리는 대진이다.`,
    `${O} 투수진은 9이닝당 ${f1(h9)}개의 안타를 맞았고, ${S} 타선은 장타 비중이 크다(ISO ${f3(iso)}).`,
    `피안타가 많은 ${O} 마운드에게 장타형 ${S} 타선(ISO ${f3(iso)})은 부담스러운 상대다.`,
  ]);
}));
rule("CR2", "cross", 72, ["kpct", "k9"], (c) => c.either((s) => {
  const o = c.oth(s), kp = c.ex("kPct", s), k9 = c.v("k9", o), lk = c.lg("kPct"), l9 = c.lg("k9");
  if (!(kp != null && k9 != null && lk && l9 && kp >= lk * 1.15 && k9 <= l9 * 0.9)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR2", [
    `삼진이 많은 ${S} 타선(삼진율 ${pct1(kp)})이지만 ${O} 마운드는 삼진을 많이 잡지 않는다(K/9 ${f1(k9)}).`,
    `${S} 타선의 약점(삼진율 ${pct1(kp)})이 탈삼진이 적은 ${O} 마운드(K/9 ${f1(k9)})를 만나 덜 드러날 수 있다.`,
    `${O} 투수진의 K/9(${f1(k9)})은 리그 평균보다 낮다. 삼진이 잦은 ${S} 타선에게는 부담이 덜한 상대다.`,
    `${S}의 높은 삼진율(${pct1(kp)})과 ${O}의 낮은 탈삼진(K/9 ${f1(k9)})이 만난다.`,
  ]);
}));
rule("CR3", "cross", 72, ["avg", "whip"], (c) => c.either((s) => {
  const o = c.oth(s), avg = c.v("avg", s), whip = c.v("whip", o), la = c.lg("avg"), lw = c.lg("whip");
  if (!(avg != null && whip != null && la && lw && avg <= la * 0.92 && whip <= lw * 0.9)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR3", [
    `타율이 낮은 ${S} 타선(${f3(avg)})이 출루 허용이 적은 ${O} 마운드(WHIP ${f2(whip)})를 상대한다.`,
    `${S}의 약한 컨택(타율 ${f3(avg)})과 ${O}의 짠물 마운드(WHIP ${f2(whip)})가 만나 ${S}의 득점 조건이 좋지 않다.`,
    `${O} 마운드는 이닝당 ${f2(whip)}명만 내보냈고 ${S} 타선의 타율은 ${ida(f3(avg))}.`,
    `${S} 타선에게 WHIP ${f2(whip)}의 ${O} 마운드는 공략하기 까다로운 상대다(타율 ${f3(avg)}).`,
  ]);
}));
rule("CR4", "cross", 70, ["sb", "unearned"], (c) => c.either((s) => {
  const o = c.oth(s), sbg = c.perGame(s, "sb"), un = c.ex("unearned", o);
  if (!(sbg != null && un != null && sbg >= 1.5 && un >= 0.3)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR4", [
    `${S}의 주루(경기당 도루 ${f1(sbg)}개)와 비자책 실점 비중이 큰 ${O} 수비(${pct0(un)})가 만난다.`,
    `${O}의 실점 중 ${pct0(un)}가 비자책이다. 많이 뛰는 ${S} 타선(경기당 도루 ${f1(sbg)}개)을 상대로 수비 부담이 클 수 있다.`,
    `기동력 있는 ${gwa(S)} 비자책 실점이 많은 ${O}의 대결이다(도루 ${f1(sbg)}개/경기 · 비자책 ${pct0(un)}).`,
    `${O} 수비가 흔들리면 ${S}의 주루(경기당 도루 ${f1(sbg)}개)가 더 많은 기회를 얻는다.`,
  ]);
}));
rule("CR5", "cross", 68, ["bbpct", "kbbp"], (c) => c.either((s) => {
  const o = c.oth(s), bp = c.ex("bbPct", s), kb = c.ex("kbbP", o), lb = c.lg("bbPct");
  if (!(bp != null && kb != null && lb && bp >= lb * 1.15 && kb <= 1.2)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR5", [
    `볼넷을 잘 얻는 ${S} 타선(볼넷율 ${pct1(bp)})과 삼진/볼넷 ${f1(kb)}의 ${O} 마운드가 만난다.`,
    `${O} 투수진은 삼진 대비 볼넷이 많다(삼진/볼넷 ${f1(kb)}). ${S} 타선은 볼넷을 많이 얻는다(${pct1(bp)}).`,
    `${S}의 선구안(볼넷율 ${pct1(bp)})이 제구 지표가 약한 ${O} 마운드(삼진/볼넷 ${f1(kb)})를 상대한다.`,
    `볼넷이 승부에 영향을 줄 조건이다. ${eun(S)} 잘 고르고(${pct1(bp)}) ${eun(O)} 볼넷이 많다(삼진/볼넷 ${f1(kb)}).`,
  ]);
}));
rule("CR6", "cross", 70, ["obp", "whip"], (c) => c.either((s) => {
  const o = c.oth(s), obp = c.v("obp", s), whip = c.v("whip", o), lob = c.lg("obp"), lw = c.lg("whip");
  if (!(obp != null && whip != null && lob && lw && obp >= lob * 1.08 && whip >= lw * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR6", [
    `출루율 ${f3(obp)}의 ${S} 타선이 이닝당 ${f2(whip)}명을 내보내는 ${O} 마운드를 만난다.`,
    `${S}의 출루 능력과 ${O} 마운드의 출루 허용(WHIP ${f2(whip)})이 맞물린다. 주자가 자주 나갈 조건이다.`,
    `${O} 마운드의 WHIP(${f2(whip)})은 리그 평균보다 높고 ${S} 타선의 출루율(${f3(obp)})은 리그 평균보다 높다.`,
    `잘 나가는 ${gwa(S)} 잘 내보내는 ${O} 마운드의 조합이다(출루율 ${f3(obp)} · WHIP ${f2(whip)}).`,
  ]);
}));
rule("CR7", "cross", 74, ["runs"], (c) => c.either((s) => {
  const o = c.oth(s), rf = c.perGame(s, "rf"), ra = c.perGame(o, "ra");
  if (!(rf != null && ra != null && rf >= 7 && ra <= 3 && c.games(s) >= 8 && c.games(o) >= 8)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR7", [
    `경기당 ${f1(rf)}점을 내는 ${S} 타선과 경기당 ${f1(ra)}점만 내주는 ${O} 마운드가 맞선다.`,
    `${S}의 득점력(경기당 ${f1(rf)}점)과 ${O}의 실점 억제(경기당 ${f1(ra)}점), 결과 기록상 강점끼리 부딪친다.`,
    `많이 내는 팀(${S}, ${f1(rf)}점)과 적게 주는 팀(${O}, ${f1(ra)}점)의 대결이다.`,
    `${S} 타선이 평소처럼 점수를 낼 수 있을지, ${O} 마운드가 평소처럼 막을 수 있을지가 관전 포인트다.`,
  ]);
}));
rule("CR8", "cross", 66, ["hr", "era"], (c) => c.either((s) => {
  const o = c.oth(s), hrg = c.perGame(s, "hr"), era = c.v("era", o), le = c.lg("era");
  if (!(hrg != null && era != null && le && hrg <= 0.1 && era <= le * 0.8 && c.games(s) >= 8)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR8", [
    `홈런이 거의 없는 ${S} 타선이 실점이 적은 ${O} 마운드(ERA ${f2(era)})를 상대한다. 한 방으로 풀기 어려운 조건이다.`,
    `${S}의 경기당 홈런은 ${f1(hrg)}개, ${O}의 ERA는 ${ida(f2(era))}. ${S}의 득점은 연결에 기대야 한다.`,
    `장타가 적은 ${gwa(S)} 실점이 적은 ${O} 마운드의 조합이다(ERA ${f2(era)}).`,
    `${O} 마운드(ERA ${f2(era)})를 상대로 ${eun(S)} 장타보다 연속 안타로 점수를 만들어야 한다.`,
  ]);
}));
rule("CR9", "cross", 70, ["sbat", "spit"], (c) => c.either((s) => {
  const o = c.oth(s), b = c.v("sbat", s), p = c.v("spit", o);
  if (!(b != null && p != null && b >= 1.1 && p >= 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR9", [
    `상대 수준을 보정해도 강한 ${S} 타선(강도지수 ${f2(b)})과 ${O} 마운드(${f2(p)})가 정면으로 맞선다.`,
    `보정 지수 기준으로도 ${S} 타선(${f2(b)})과 ${O} 마운드(${f2(p)})가 모두 리그 평균보다 10% 이상 강하다.`,
    `강도지수로 본 ${S}의 공격(${f2(b)})과 ${O}의 마운드(${f2(p)}), 강점끼리의 대결이다.`,
    `${S} 타선과 ${O} 마운드 모두 상대 수준 보정 후에도 상위권이다(${f2(b)} · ${f2(p)}).`,
  ]);
}));
rule("CR10", "cross", 66, ["bbk", "k9"], (c) => c.either((s) => {
  const o = c.oth(s), bk = c.ex("bbK", s), k9 = c.v("k9", o), l9 = c.lg("k9");
  if (!(bk != null && k9 != null && l9 && bk >= 0.8 && k9 >= l9 * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR10", [
    `선구안이 좋은 ${S} 타선(볼넷/삼진 ${f2(bk)})이 탈삼진형 ${O} 마운드(K/9 ${f1(k9)})를 만난다.`,
    `${S} 타자들의 볼넷/삼진(${f2(bk)})과 ${O} 투수들의 K/9(${f1(k9)}), 카운트 싸움이 관건인 조합이다.`,
    `${O} 마운드의 삼진 능력(K/9 ${f1(k9)})이 공을 잘 보는 ${S} 타선(볼넷/삼진 ${f2(bk)})에게도 통할지 지켜볼 만하다.`,
    `공을 잘 고르는 ${gwa(S)} 삼진을 잘 잡는 ${O}의 대결이다(${f2(bk)} · K/9 ${f1(k9)}).`,
  ]);
}));
rule("CR11", "cross", 64, ["iso", "k9"], (c) => c.either((s) => {
  const o = c.oth(s), iso = c.ex("iso", s), k9 = c.v("k9", o), li = c.lg("iso"), l9 = c.lg("k9");
  if (!(iso != null && k9 != null && li && l9 && iso <= li * 0.75 && k9 >= l9 * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR11", [
    `장타가 적은 ${S} 타선(ISO ${f3(iso)})이 삼진을 많이 잡는 ${O} 마운드(K/9 ${f1(k9)})를 만난다. 득점 조건이 까다롭다.`,
    `${S}의 낮은 ISO(${f3(iso)})와 ${O}의 높은 K/9(${f1(k9)}), ${S}에게 불리한 조합이다.`,
    `${O} 마운드의 탈삼진(K/9 ${f1(k9)})을 상대로 ${eun(S)} 장타보다 출루와 연결이 필요하다.`,
    `한 방이 적은 ${gwa(S)} 삼진이 많은 ${O} 마운드의 대결이다(ISO ${f3(iso)} · K/9 ${f1(k9)}).`,
  ]);
}));
rule("CR12", "cross", 73, ["ops", "era"], (c) => {
  const lo = c.lg("ops"), le = c.lg("era");
  const ok = (s: Side) => {
    const ops = c.v("ops", s), era = c.v("era", c.oth(s));
    return ops != null && era != null && lo && le && ops >= lo * 1.05 && era >= le * 1.05;
  };
  if (!(ok("a") && ok("b"))) return null;
  return c.pick("CR12", [
    "두 팀 모두 상대 마운드보다 타선 쪽이 강하다. 양쪽 모두 득점 조건이 좋은 대진이다.",
    `${c.name("a")} 타선(OPS ${f3(c.v("ops", "a")!)})과 ${c.name("b")} 타선(OPS ${f3(c.v("ops", "b")!)}) 모두 상대 마운드의 약점(ERA ${f2(c.v("era", "b")!)}·${f2(c.v("era", "a")!)})을 공략할 조건이다.`,
    "양 팀 모두 리그 평균 이상의 타선이 리그 평균 이하의 마운드를 만난다.",
    "공격은 강하고 마운드는 약한 팀끼리라 점수가 많이 날 조건이다.",
  ]);
}, ["matchupBoth"]);
rule("CR13", "cross", 71, ["era", "ops"], (c) => {
  const lo = c.lg("ops"), le = c.lg("era");
  const ok = (s: Side) => {
    const era = c.v("era", s), ops = c.v("ops", c.oth(s));
    return era != null && ops != null && lo && le && era <= le * 0.85 && ops <= lo;
  };
  if (!(ok("a") && ok("b"))) return null;
  return c.pick("CR13", [
    "두 팀 모두 마운드가 상대 타선보다 강하다. 양쪽 모두 득점이 쉽지 않은 대진이다.",
    `${c.name("a")} 마운드(ERA ${f2(c.v("era", "a")!)})와 ${c.name("b")} 마운드(ERA ${f2(c.v("era", "b")!)}) 모두 리그 평균 이하의 상대 타선을 만난다.`,
    "양 팀 모두 리그 평균보다 강한 마운드가 리그 평균 이하의 타선을 상대한다.",
    "마운드는 강하고 타선은 평범한 팀끼리라 점수가 적게 날 조건이다.",
  ]);
}, ["matchupBoth"]);
rule("CR14", "cross", 68, ["kpct", "h9"], (c) => c.either((s) => {
  const o = c.oth(s), kp = c.ex("kPct", s), h9 = c.ex("h9", o), lk = c.lg("kPct"), lh = c.lg("h9");
  if (!(kp != null && h9 != null && lk && lh && kp <= lk * 0.85 && h9 >= lh * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("CR14", [
    `공을 잘 맞히는 ${S} 타선(삼진율 ${pct1(kp)})이 피안타가 많은 ${O} 마운드(H/9 ${f1(h9)})를 만난다.`,
    `${S}의 컨택(삼진율 ${pct1(kp)})과 ${O} 마운드의 피안타(H/9 ${f1(h9)})가 맞물린다. 안타가 많이 나올 조건이다.`,
    `${O} 투수진은 안타를 많이 맞았고(H/9 ${f1(h9)}) ${S} 타선은 삼진이 적다(${pct1(kp)}).`,
    `삼진이 적은 ${gwa(S)} 안타를 많이 내주는 ${O}의 대결이다(${pct1(kp)} · H/9 ${f1(h9)}).`,
  ]);
}));

// ── 팀 스타일 (10) — 여러 지표를 묶은 공격·마운드 성향 ─────────────
const gapLg = (c: Ctx) => {
  const la = c.lg("avg"), lo = c.lg("obp");
  return la && lo ? lo - la : 0.11;
};
const onBaseStyle = (c: Ctx, s: Side) => {
  const avg = c.v("avg", s), obp = c.v("obp", s), iso = c.ex("iso", s), li = c.lg("iso");
  return avg != null && obp != null && iso != null && li && obp - avg >= gapLg(c) * 1.2 && iso <= li;
};
const powerStyle = (c: Ctx, s: Side) => {
  const iso = c.ex("iso", s), bp = c.ex("bbPct", s), li = c.lg("iso"), lb = c.lg("bbPct");
  return iso != null && bp != null && li && lb && iso >= li * 1.2 && bp <= lb;
};
rule("SY1", "style", 62, ["obp", "iso"], (c) => c.either((s) => {
  if (!onBaseStyle(c, s)) return null;
  const S = c.name(s);
  return c.pick("SY1", [
    `${eun(S)} 볼넷으로 나가고 단타로 잇는 출루형 타선이다(출루율 ${f3(c.v("obp", s)!)} · ISO ${f3(c.ex("iso", s)!)}).`,
    `${S} 타선은 장타보다 출루로 점수를 만든다.`,
    `${S}의 공격은 출루율이 높고 장타 비중은 리그 평균 이하인 출루형이다.`,
    `많이 나가고 짧게 치는 타선, ${S}의 공격 색깔이다.`,
  ]);
}), ["styleBat"]);
rule("SY2", "style", 62, ["iso", "bbpct"], (c) => c.either((s) => {
  if (!powerStyle(c, s)) return null;
  const S = c.name(s);
  return c.pick("SY2", [
    `${eun(S)} 볼넷은 적고 장타가 많은 장타형 타선이다(ISO ${f3(c.ex("iso", s)!)}).`,
    `${S} 타선은 기다리기보다 적극적으로 쳐서 장타를 만든다.`,
    `${S}의 공격은 볼넷율은 리그 평균 이하, 장타 비중은 높은 장타형이다.`,
    `적게 고르고 멀리 치는 타선, ${S}의 공격 색깔이다.`,
  ]);
}), ["styleBat"]);
rule("SY3", "style", 60, ["kpct", "avg"], (c) => c.either((s) => {
  const kp = c.ex("kPct", s), avg = c.v("avg", s), lk = c.lg("kPct"), la = c.lg("avg");
  if (!(kp != null && avg != null && lk && la && kp <= lk * 0.85 && avg >= la)) return null;
  const S = c.name(s);
  return c.pick("SY3", [
    `${eun(S)} 삼진이 적고 타율이 높은 컨택형 타선이다(삼진율 ${pct1(kp)} · 타율 ${f3(avg)}).`,
    `${S} 타선은 공을 맞혀 안타를 만드는 데 강하다.`,
    `${S}의 공격은 삼진율은 리그 평균보다 낮고 타율은 높은 컨택형이다.`,
    `잘 맞히고 자주 치는 타선, ${S}의 공격 색깔이다.`,
  ]);
}), ["styleBat"]);
rule("SY4", "style", 60, ["sb", "hr"], (c) => c.either((s) => {
  const sbg = c.perGame(s, "sb"), hrg = c.perGame(s, "hr");
  if (!(sbg != null && hrg != null && sbg >= 2 && hrg <= 0.2 && c.games(s) >= 8)) return null;
  const S = c.name(s);
  return c.pick("SY4", [
    `${eun(S)} 홈런은 적고 도루는 많은 기동력형 팀이다(경기당 도루 ${f1(sbg)}개).`,
    `${S}의 득점 방식은 장타보다 주루에 가깝다(경기당 도루 ${f1(sbg)}개 · 홈런 ${f1(hrg)}개).`,
    `${eun(S)} 발로 한 베이스를 더 가는 야구를 한다.`,
    `뛰는 야구, ${S}의 공격 색깔이다(경기당 도루 ${f1(sbg)}개).`,
  ]);
}), ["styleBat"]);
rule("SY5", "style", 60, ["k9", "bb9"], (c) => c.either((s) => {
  const k9 = c.v("k9", s), bb9 = c.v("bb9", s), l9 = c.lg("k9"), lb = c.lg("bb9");
  if (!(k9 != null && bb9 != null && l9 && lb && k9 >= l9 * 1.1 && bb9 >= lb * 1.1)) return null;
  const S = c.name(s);
  return c.pick("SY5", [
    `${S} 마운드는 삼진도 많고 볼넷도 많다(K/9 ${f1(k9)} · BB/9 ${f1(bb9)}). 구위형이지만 제구 기복이 있다.`,
    `${S} 투수진은 힘으로 누르는 스타일이지만 볼넷이 따라온다.`,
    `${S}의 마운드는 탈삼진과 볼넷이 모두 리그 평균보다 많다.`,
    `삼진형이면서 볼넷도 많은 마운드, ${S} 투수진의 색깔이다.`,
  ]);
}), ["stylePit"]);
rule("SY6", "style", 60, ["k9", "era"], (c) => c.either((s) => {
  const k9 = c.v("k9", s), era = c.v("era", s), l9 = c.lg("k9"), le = c.lg("era");
  if (!(k9 != null && era != null && l9 && le && k9 <= l9 * 0.9 && era <= le * 0.9)) return null;
  const S = c.name(s);
  return c.pick("SY6", [
    `${S} 마운드는 삼진은 적지만 실점도 적다(K/9 ${f1(k9)} · ERA ${f2(era)}). 맞혀 잡는 스타일이다.`,
    `${S} 투수진은 탈삼진보다 범타 유도로 막는다.`,
    `${S}의 마운드는 K/9이 리그 평균보다 낮은데도 ERA는 리그 평균보다 좋다.`,
    `삼진 없이 막는 마운드, ${S} 투수진의 색깔이다.`,
  ]);
}), ["stylePit"]);
rule("SY7", "style", 58, ["bb9", "h9"], (c) => c.either((s) => {
  const bb9 = c.v("bb9", s), h9 = c.ex("h9", s), lb = c.lg("bb9"), lh = c.lg("h9");
  if (!(bb9 != null && h9 != null && lb && lh && bb9 <= lb * 0.85 && h9 >= lh * 1.1)) return null;
  const S = c.name(s);
  return c.pick("SY7", [
    `${S} 마운드는 볼넷은 적지만 안타를 많이 맞는다(BB/9 ${f1(bb9)} · H/9 ${f1(h9)}).`,
    `${S} 투수진은 스트라이크를 많이 던지는 대신 맞는 타구가 많다.`,
    `${S}의 출루 허용은 볼넷보다 안타에서 나온다.`,
    `제구는 좋고 피안타는 많은 마운드, ${S} 투수진의 색깔이다.`,
  ]);
}), ["stylePit"]);
rule("SY8", "style", 58, ["unearned", "h9"], (c) => c.either((s) => {
  const un = c.ex("unearned", s), h9 = c.ex("h9", s), lh = c.lg("h9");
  if (!(un != null && h9 != null && lh && un >= 0.3 && h9 <= lh)) return null;
  const S = c.name(s);
  return c.pick("SY8", [
    `${S} 마운드는 피안타는 적은데(H/9 ${f1(h9)}) 실점의 ${pct0(un)}가 비자책이다. 실점에 수비 영향이 크다.`,
    `${S}의 실점은 마운드보다 수비 쪽 영향이 크게 나타난다(비자책 ${pct0(un)}).`,
    `안타를 많이 맞지 않는 ${S} 마운드에서 비자책 실점 비중이 높다.`,
    `${eun(S)} 투수 지표에 비해 실점이 많다. 비자책 실점이 ${pct0(un)}를 차지한다.`,
  ]);
}), ["defense"]);
rule("SY9", "style", 63, ["obp", "iso"], (c) => {
  const pair = (s: Side) => onBaseStyle(c, s) && powerStyle(c, c.oth(s));
  const s: Side | null = pair("a") ? "a" : pair("b") ? "b" : null;
  if (!s) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("SY9", [
    `출루형 ${S} 타선과 장타형 ${O} 타선, 점수를 내는 방식이 다른 두 팀이다.`,
    `${eun(S)} 나가서 잇고 ${eun(O)} 멀리 친다. 공격 색깔이 정반대다.`,
    `공격 스타일 대비 — ${S}(출루형) · ${O}(장타형).`,
    `${eun(S)} 출루로, ${eun(O)} 장타로 득점을 만드는 팀이다.`,
  ]);
}, ["styleBoth"]);
rule("SY10", "style", 63, ["k9", "bb9"], (c) => {
  const l9 = c.lg("k9"), lb = c.lg("bb9");
  const kType = (s: Side) => { const k = c.v("k9", s); return k != null && l9 && k >= l9 * 1.15; };
  const cType = (s: Side) => { const k = c.v("k9", s), b = c.v("bb9", s); return k != null && b != null && l9 && lb && k <= l9 * 0.9 && b <= lb * 0.9; };
  const s: Side | null = kType("a") && cType("b") ? "a" : kType("b") && cType("a") ? "b" : null;
  if (!s) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("SY10", [
    `삼진으로 막는 ${S} 마운드와 볼넷 없이 맞혀 잡는 ${O} 마운드, 투구 스타일이 다른 두 팀이다.`,
    `${S} 투수진은 탈삼진형, ${O} 투수진은 제구형이다.`,
    `마운드 스타일 대비 — ${S}(K/9 ${f1(c.v("k9", s)!)}) · ${O}(BB/9 ${f1(c.v("bb9", c.oth(s))!)}).`,
    `${eun(S)} 삼진으로, ${eun(O)} 적은 볼넷으로 실점을 막아 왔다.`,
  ]);
}, ["styleBoth"]);

// ── 양 팀 공통 특징 보강 (7) ────────────────────────────────
rule("Q6", "pitchContact", 55, ["h9"], (c) => {
  const a = c.ex("h9", "a"), b = c.ex("h9", "b"), l = c.lg("h9");
  if (!(a != null && b != null && l && a <= l * 0.85 && b <= l * 0.85)) return null;
  return c.pick("Q6", [
    `두 팀 마운드 모두 안타를 적게 맞는다(H/9 ${f1(a)}·${f1(b)}).`,
    `양 팀 H/9이 모두 리그 평균(${f1(l)})보다 낮다.`,
    `피안타가 적은 마운드끼리 만났다(9이닝당 ${f1(a)}·${f1(b)}개).`,
    "두 투수진 모두 안타 허용이 적어 연속 안타가 나오기 어려운 조건이다.",
  ]);
}, ["pitBoth"]);
rule("Q7", "pitchContact", 53, ["unearned"], (c) => {
  const a = c.ex("unearned", "a"), b = c.ex("unearned", "b");
  if (!(a != null && b != null && a >= 0.3 && b >= 0.3)) return null;
  return c.pick("Q7", [
    `두 팀 모두 실점 중 비자책 비중이 크다(${pct0(a)}·${pct0(b)}). 수비 실책이 승부에 영향을 줄 수 있다.`,
    `양 팀 모두 실점의 30% 이상이 비자책이다.`,
    `수비가 흔들린 경기가 많은 팀끼리다(비자책 실점 ${pct0(a)}·${pct0(b)}).`,
    "두 팀 모두 자책점보다 실점이 꽤 많다. 수비가 변수다.",
  ]);
}, ["defense"]);
rule("C8", "contact", 55, ["kpct"], (c) => {
  const a = c.ex("kPct", "a"), b = c.ex("kPct", "b"), l = c.lg("kPct");
  if (!(a != null && b != null && l && a >= l * 1.15 && b >= l * 1.15)) return null;
  return c.pick("C8", [
    `두 타선 모두 삼진이 많다(삼진율 ${pct1(a)}·${pct1(b)}).`,
    `양 팀 삼진율이 모두 리그 평균(${pct1(l)})을 크게 웃돈다.`,
    "삼진이 잦은 타선끼리 만났다.",
    `두 팀 타자들 모두 타석당 삼진 비율이 높다(${pct1(a)}·${pct1(b)}).`,
  ]);
}, ["contactBoth"]);
rule("C9", "contact", 55, ["bbpct"], (c) => {
  const a = c.ex("bbPct", "a"), b = c.ex("bbPct", "b"), l = c.lg("bbPct");
  if (!(a != null && b != null && l && a >= l * 1.15 && b >= l * 1.15)) return null;
  return c.pick("C9", [
    `두 타선 모두 볼넷을 많이 얻는다(볼넷율 ${pct1(a)}·${pct1(b)}).`,
    `양 팀 볼넷율이 모두 리그 평균(${pct1(l)})을 크게 웃돈다.`,
    "공을 잘 고르는 타선끼리 만났다.",
    `두 팀 타자들 모두 타석당 볼넷 비율이 높다(${pct1(a)}·${pct1(b)}).`,
  ]);
}, ["contactBoth"]);
rule("L13", "level", 55, ["avg"], (c) => {
  const a = c.v("avg", "a"), b = c.v("avg", "b");
  if (!(a != null && b != null && a >= 0.3 && b >= 0.3)) return null;
  return c.pick("L13", [
    `두 팀 모두 팀 타율 3할 이상이다(${f3(a)}·${f3(b)}).`,
    `양 팀 타선이 모두 3할을 친다(${f3(a)}·${f3(b)}).`,
    "팀 타율 3할 타선끼리의 대결이다.",
    `안타를 많이 치는 팀끼리 만났다(팀 타율 ${f3(a)}·${f3(b)}).`,
  ]);
}, ["batBoth"]);
rule("S9", "strength", 56, ["spit"], (c) => {
  if (!(c.has("spit") && c.v("spit", "a")! >= 1.1 && c.v("spit", "b")! >= 1.1)) return null;
  const a = f2(c.v("spit", "a")!), b = f2(c.v("spit", "b")!);
  return c.pick("S9", [
    `두 팀 모두 마운드 강도지수 1.10 이상(${a}·${b}), 상대 수준을 보정해도 강한 마운드끼리다.`,
    `양 팀 마운드 모두 보정 지수상 리그 평균보다 10% 이상 강하다(${a}·${b}).`,
    `마운드 강도지수 ${a}와 ${b}, 투수진이 강한 팀끼리 만났다.`,
    `양 팀 마운드 모두 보정 지수상 상위권이다(${a}·${b}).`,
  ]);
}, ["pitBoth"]);
rule("S10", "strength", 54, ["sbat"], (c) => {
  if (!(c.has("sbat") && c.v("sbat", "a")! <= 0.9 && c.v("sbat", "b")! <= 0.9)) return null;
  const a = f2(c.v("sbat", "a")!), b = f2(c.v("sbat", "b")!);
  return c.pick("S10", [
    `두 팀 모두 타선 강도지수 0.90 이하(${a}·${b}), 상대 수준을 보정해도 공격력이 약한 편이다.`,
    `양 팀 타선 모두 보정 지수상 리그 평균보다 10% 이상 약하다(${a}·${b}).`,
    `타선 강도지수 ${a}와 ${b}, 공격력이 약한 팀끼리 만났다.`,
    `양 팀 타선 모두 보정 지수상 하위권이다(${a}·${b}).`,
  ]);
}, ["batBoth"]);

void eul;
void ga;
