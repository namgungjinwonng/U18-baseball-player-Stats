// 경기 분석 규칙 — 팀 지표(핵심 매치업·투타 균형·장타·타격·주루·마운드·투구 스타일·타격/피안타 성향·리그 대비·팀 색깔·강도지수). 모두 시즌 기록 기준.
import {
  BAT, PIT, eun, f1, f2, f3, ga, gwa, ida, pct0, pct1, rule,
  type Ctx, type MetricKey,
} from "./core";

const nm = (c: Ctx, k: MetricKey, s: "a" | "b") => c.v(k, s)!;

// ── 핵심 매치업: 한 팀의 강점 vs 상대 약점 (9) ───────────────────
rule("M1", "key", 80, ["ops", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const ops = c.v("ops", s), era = c.v("era", o), lo = c.lg("ops"), le = c.lg("era");
  if (!(ops != null && era != null && lo && le && ops >= lo * 1.15 && era <= le * 0.8)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M1", [
    `${S} 타선(OPS ${f3(ops)})과 ${O} 마운드(ERA ${f2(era)}), 리그 상위권 창과 방패가 맞선다.`,
    `리그 평균을 크게 웃도는 ${S} 타선(OPS ${f3(ops)})이 실점이 적은 ${O} 마운드(ERA ${f2(era)})를 얼마나 공략하느냐가 관전 포인트다.`,
    `${O} 투수진(ERA ${f2(era)})이 ${S}의 강타선(OPS ${f3(ops)})을 묶을 수 있을지가 승부처다.`,
    `공격이 강한 ${S}(OPS ${f3(ops)}), 실점 억제가 강한 ${O}(ERA ${f2(era)}). 두 팀의 강점끼리 부딪친다.`,
    `두 팀의 강점이 맞선다. ${S} 타선 OPS ${f3(ops)}, ${O} 마운드 ERA ${f2(era)}.`,
  ]);
}));
rule("M2", "key", 85, ["ops", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const ops = c.v("ops", s), era = c.v("era", o), lo = c.lg("ops"), le = c.lg("era");
  if (!(ops != null && era != null && lo && le && ops <= lo * 0.9 && era >= le * 1.15)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M2", [
    `${S} 타선은 약한 편(OPS ${f3(ops)})이지만 ${O} 마운드도 실점이 많아(ERA ${f2(era)}) 득점 기회는 열려 있다.`,
    `OPS ${f3(ops)}로 공격력이 떨어지는 ${S}에게도 ERA ${f2(era)}의 ${O} 마운드는 공략할 여지가 있다.`,
    `${S} 타선의 약점(OPS ${f3(ops)})과 ${O} 마운드의 약점(ERA ${f2(era)})이 만난다.`,
    `공격이 약한 ${gwa(S)} 실점이 많은 ${O} 마운드의 대결이라 ${S}의 득점 여지가 평소보다 크다.`,
    `${O} 마운드의 실점(ERA ${f2(era)})이 많아 공격력이 약한 ${S}(OPS ${f3(ops)})에게도 기회가 있다.`,
  ]);
}));
rule("M3", "key", 85, ["obp", "bb9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const obp = c.v("obp", s), bb9 = c.v("bb9", o), lob = c.lg("obp"), lbb = c.lg("bb9");
  if (!(obp != null && bb9 != null && lob && lbb && obp >= lob * 1.08 && bb9 >= lbb * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M3", [
    `볼넷이 많은 ${O} 투수진(BB/9 ${f1(bb9)})이 출루율 ${f3(obp)}의 ${S} 타선을 만난다.`,
    `${S}의 출루 능력(출루율 ${f3(obp)})과 ${O} 마운드의 볼넷 허용(BB/9 ${f1(bb9)})이 맞물리는 대진이다.`,
    `${O} 마운드는 9이닝당 볼넷 ${f1(bb9)}개, ${S} 타선은 출루율 ${f3(obp)}다. 볼넷이 득점으로 이어질 조건이 갖춰져 있다.`,
    `출루율 ${f3(obp)}의 ${S} 타선에게 BB/9 ${f1(bb9)}의 ${O} 마운드는 볼넷으로 나갈 기회를 주는 상대다.`,
    `${S} 타선은 출루율 ${f3(obp)}, ${O} 마운드는 BB/9 ${f1(bb9)}. 볼넷이 변수가 될 조합이다.`,
  ]);
}));
rule("M4", "key", 85, ["sb", "whip"], (c) => c.either((s) => {
  const o = c.oth(s);
  const sbg = c.perGame(s, "sb"), whip = c.v("whip", o), lw = c.lg("whip");
  if (!(sbg != null && whip != null && lw && sbg >= 1.5 && whip >= lw * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M4", [
    `주자를 자주 내보내는 ${O}(WHIP ${f2(whip)})는 경기당 도루 ${f1(sbg)}개의 ${S} 기동력을 막아야 한다.`,
    `${O} 마운드의 출루 허용(WHIP ${f2(whip)})이 많을수록 ${S}의 발(경기당 도루 ${f1(sbg)}개)이 살아난다.`,
    `경기당 도루 ${f1(sbg)}개의 ${gwa(S)} 이닝당 ${f2(whip)}명을 내보내는 ${O} 마운드, 주자 싸움이 관건이다.`,
    `출루 허용이 많은 ${O} 마운드(WHIP ${f2(whip)})를 상대로 ${S}의 주루(경기당 도루 ${f1(sbg)}개)는 기회가 많다.`,
    `${S}의 기동력(경기당 도루 ${f1(sbg)}개)이 출루 허용이 많은 ${O} 마운드(WHIP ${f2(whip)})를 상대한다.`,
  ]);
}));
rule("M5", "key", 85, ["hr", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  const hrg = c.perGame(s, "hr"), hr = c.v("hr", s), era = c.v("era", o), le = c.lg("era");
  if (!(hrg != null && hr != null && era != null && le && hrg >= 0.4 && era >= le * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M5", [
    `${S}의 장타(홈런 ${hr}개)가 실점이 많은 ${O} 마운드(ERA ${f2(era)})를 상대한다.`,
    `홈런 ${hr}개의 ${S} 타선과 ERA ${f2(era)}의 ${O} 마운드, 장타가 나올 조건이 갖춰진 대진이다.`,
    `${O} 마운드(ERA ${f2(era)})는 장타력 있는 ${S}(홈런 ${hr}개)를 상대로 큰 것을 조심해야 한다.`,
    `${eun(S)} 경기당 홈런 ${f1(hrg)}개를 치고, ${O} 마운드는 리그 평균보다 실점이 많다(ERA ${f2(era)}).`,
    `${O} 마운드(ERA ${f2(era)})는 홈런 ${hr}개의 ${S} 타선을 상대로 장타 허용을 조심해야 한다.`,
  ]);
}));
rule("M6", "key", 85, ["avg", "h9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const avg = c.v("avg", s), h9 = c.ex("h9", o), la = c.lg("avg"), lh = c.lg("h9");
  if (!(avg != null && h9 != null && la && lh && avg >= la * 1.08 && h9 <= lh * 0.85)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M6", [
    `정교한 ${S} 타선(타율 ${f3(avg)})과 안타를 잘 맞지 않는 ${O} 마운드(H/9 ${f1(h9)})의 대결이다.`,
    `${S} 타선의 컨택(타율 ${f3(avg)})이 피안타가 적은 ${O} 투수진(H/9 ${f1(h9)})에게도 통할지가 관건이다.`,
    `안타를 잘 치는 팀(${S}, 타율 ${f3(avg)})과 안타를 잘 안 주는 팀(${O}, H/9 ${f1(h9)})이 만났다.`,
    `${O} 마운드는 9이닝당 피안타 ${f1(h9)}개로 리그 평균보다 적고, ${S} 타선은 타율 ${f3(avg)}로 리그 평균보다 높다.`,
    `${S}의 타율(${f3(avg)})과 ${O}의 피안타 억제(H/9 ${f1(h9)}), 강점끼리의 대결이다.`,
  ]);
}));
rule("M7", "key", 85, ["kpct", "k9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const kp = c.ex("kPct", s), k9 = c.v("k9", o), lk = c.lg("kPct"), l9 = c.lg("k9");
  if (!(kp != null && k9 != null && lk && l9 && kp <= lk * 0.85 && k9 >= l9 * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M7", [
    `삼진이 적은 ${S} 타선(삼진율 ${pct1(kp)})이 ${O}의 탈삼진 능력(K/9 ${f1(k9)})을 상대한다.`,
    `${O} 투수진의 삼진 능력(K/9 ${f1(k9)})과 ${S} 타자들의 컨택(삼진율 ${pct1(kp)})이 맞부딪친다.`,
    `${eun(S)} 쉽게 삼진을 당하지 않는 타선(삼진율 ${pct1(kp)})이라 ${O} 마운드의 탈삼진(K/9 ${f1(k9)})이 얼마나 통할지 지켜볼 만하다.`,
    `탈삼진형 마운드(${O}, K/9 ${f1(k9)})와 삼진이 적은 타선(${S}, 삼진율 ${pct1(kp)})의 대결이다.`,
    `${S} 타선은 삼진을 적게 당하고(${pct1(kp)}) ${O} 마운드는 삼진을 많이 잡는다(K/9 ${f1(k9)}).`,
  ]);
}));
rule("M8", "key", 85, ["kpct", "k9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const kp = c.ex("kPct", s), k9 = c.v("k9", o), lk = c.lg("kPct"), l9 = c.lg("k9");
  if (!(kp != null && k9 != null && lk && l9 && kp >= lk * 1.15 && k9 >= l9 * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M8", [
    `삼진이 많은 ${S} 타선(삼진율 ${pct1(kp)})이 탈삼진에 강한 ${O} 마운드(K/9 ${f1(k9)})를 만난다. 기록상 ${S}에게 불리한 상성이다.`,
    `${S} 타선의 삼진율(${pct1(kp)})과 ${O} 마운드의 K/9(${f1(k9)})이 모두 리그 평균보다 높다. 삼진이 많이 나올 조건이다.`,
    `${O} 투수진(K/9 ${f1(k9)})은 삼진이 잦은 ${S} 타선(삼진율 ${pct1(kp)})과 상성이 좋다.`,
    `${eun(S)} 삼진이 많은 타선(삼진율 ${pct1(kp)})이고 ${eun(O)} 삼진을 많이 잡는 마운드(K/9 ${f1(k9)})다.`,
    `${O} 마운드의 탈삼진(K/9 ${f1(k9)})이 삼진이 많은 ${S} 타선(${pct1(kp)})을 상대로 힘을 낼 조건이다.`,
  ]);
}));
rule("M9", "key", 85, ["sb", "bb9"], (c) => c.either((s) => {
  const o = c.oth(s);
  const sbg = c.perGame(s, "sb"), bb9 = c.v("bb9", o), lb = c.lg("bb9");
  if (!(sbg != null && bb9 != null && lb && sbg >= 2 && bb9 >= lb * 1.1)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("M9", [
    `볼넷이 많은 ${O} 마운드(BB/9 ${f1(bb9)})는 경기당 도루 ${f1(sbg)}개의 ${S} 주루를 상대한다. 볼넷이 곧 도루 기회가 될 수 있다.`,
    `${S}의 기동력(경기당 도루 ${f1(sbg)}개)과 ${O}의 볼넷 허용(BB/9 ${f1(bb9)})이 맞물린다.`,
    `${O} 마운드가 볼넷을 줄이지 못하면(BB/9 ${f1(bb9)}) ${S}의 도루(경기당 ${f1(sbg)}개)가 더 많아질 수 있다.`,
    `경기당 도루 ${f1(sbg)}개의 ${S}에게 9이닝당 볼넷 ${f1(bb9)}개의 ${O} 마운드는 뛸 기회를 주는 상대다.`,
    `${S}의 도루(경기당 ${f1(sbg)}개)는 볼넷 허용이 많은 ${O} 마운드(BB/9 ${f1(bb9)})를 상대로 기회가 늘 수 있다.`,
  ]);
}));

// ── 투타 균형 (6) ────────────────────────────────────────────
rule("B3", "balance", 80, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(b.side && p.side && b.side !== p.side)) return null;
  const Bt = c.name(b.side), Pt = c.name(p.side);
  return c.pick("B3", [
    `창과 방패의 대결이다. 방망이는 ${Bt}, 마운드는 ${ga(Pt)} 앞선다.`,
    `타격 지표는 ${Bt}, 마운드 지표는 ${Pt} 쪽이 우세하다. 강점이 서로 다른 두 팀이다.`,
    `${eun(Bt)} 타격(${b[b.side]}:${b[p.side]}), ${eun(Pt)} 마운드(${p[p.side]}:${p[b.side]})에서 앞선다.`,
    `공격은 ${Bt}, 수비(마운드)는 ${Pt}. 기록상 우세 분야가 갈린 대진이다.`,
    `${Bt} 타선과 ${Pt} 마운드가 각자 우위를 가진 대진이다.`,
  ]);
}, ["splitEdge"]);
rule("B1", "balance", 75, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(b.side && b.side === p.side && b[b.side] >= 4 && p[p.side] >= 3)) return null;
  c.about(b.side);
  const S = c.name(b.side);
  return c.pick("B1", [
    `${ga(S)} 타격(${b[b.side]}개)과 마운드(${p[p.side]}개) 지표 양쪽에서 모두 앞선다.`,
    `방망이도 마운드도 ${S} 쪽이 낫다(타격 ${b[b.side]}개·마운드 ${p[p.side]}개 우위).`,
    `${eun(S)} 투타 어느 쪽 지표에서도 밀리지 않는다.`,
    `타격 지표 ${b[b.side]}개, 마운드 지표 ${p[p.side]}개에서 ${ga(S)} 앞선다. 투타 모두 우위다.`,
    `${eun(S)} 타격과 마운드 지표 모두에서 상대보다 앞선다.`,
  ]);
}, ["bothEdge"]);
rule("B4", "balance", 65, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(!b.side && p.side)) return null;
  c.about(p.side);
  const S = c.name(p.side);
  return c.pick("B4", [
    `타선은 엇비슷하고 마운드에서 ${ga(S)} 앞선다. 기록상 차이는 마운드에 있다.`,
    `타격 지표는 비슷한데 마운드 지표는 ${S} 쪽이 낫다.`,
    `두 팀의 차이는 방망이보다 마운드에서 난다(마운드 우위 ${S}).`,
    `공격력은 대등하고 투수진은 ${S} 우세다.`,
    `${S} 마운드가 앞서고 타선은 비슷하다.`,
  ]);
}, ["pitEdge"]);
rule("B5", "balance", 65, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(b.side && !p.side)) return null;
  c.about(b.side);
  const S = c.name(b.side);
  return c.pick("B5", [
    `마운드는 비슷하고 타격에서 ${ga(S)} 앞선다. 기록상 차이는 타선에 있다.`,
    `마운드 지표는 엇비슷한데 타격 지표는 ${S} 쪽이 낫다.`,
    `두 팀의 차이는 마운드보다 방망이에서 난다(타격 우위 ${S}).`,
    `투수진은 대등하고 공격력은 ${S} 우세다.`,
    `${S} 타선이 앞서고 마운드는 비슷하다.`,
  ]);
}, ["batEdge"]);
rule("B2", "balance", 60, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(b.side && b.side === p.side)) return null;
  c.about(b.side);
  const S = c.name(b.side), O = c.name(c.oth(b.side));
  return c.pick("B2", [
    `타격과 마운드 모두 ${S} 쪽으로 기운다. ${eun(O)} 개별 강점 항목에 기대야 한다.`,
    `투타 지표가 모두 ${S} 우세다.`,
    `${ga(S)} 타격 지표와 마운드 지표에서 모두 더 많이 앞선다.`,
    `방망이와 마운드 어느 쪽에서도 ${O}의 우세 분야가 보이지 않는다.`,
    `투타 지표 모두에서 ${S} 쪽이 더 많이 앞선다.`,
  ]);
}, ["bothEdge"]);
rule("B6", "balance", 35, [], (c) => {
  const b = c.groupWins(BAT), p = c.groupWins(PIT);
  if (!(!b.side && !p.side && c.compared > 0)) return null;
  return c.pick("B6", [
    "타격·마운드 어느 쪽에서도 뚜렷한 차이가 없다.",
    "타격 지표도 마운드 지표도 두 팀이 엇비슷하다.",
    "투타 모두 우세 분야를 가리기 어렵다.",
    "공격과 마운드 어느 쪽에서도 한 팀이 확실히 앞서지 않는다.",
  ]);
}, ["balanceEven"]);

// ── 장타 (6) ─────────────────────────────────────────────────
rule("T7", "power", 78, ["obp", "hr"], (c) => c.either((s) => {
  const o = c.oth(s);
  if (!(c.win("obp") === s && c.win("hr") === o)) return null;
  const S = c.name(s), O = c.name(o), obp = nm(c, "obp", s), hr = nm(c, "hr", o);
  return c.pick("T7", [
    `${eun(S)} 출루(출루율 ${f3(obp)}), ${eun(O)} 장타(홈런 ${hr}개)로 맞서는 색깔이 다른 타선이다.`,
    `출루는 ${S}(출루율 ${f3(obp)}), 한 방은 ${O}(홈런 ${hr}개) 쪽이 앞선다.`,
    `${S} 타선은 자주 나가고, ${O} 타선은 멀리 친다(출루율 ${f3(obp)} 대 홈런 ${hr}개).`,
    `득점 방식이 다른 두 타선이다. ${eun(S)} 출루율, ${eun(O)} 홈런에서 앞선다.`,
    `${eun(S)} 출루율(${f3(obp)})로, ${eun(O)} 홈런(${hr}개)으로 앞선다.`,
  ]);
}), ["batStyle"]);
rule("T8", "power", 70, ["hr", "ops"], (c) => c.either((s) => {
  const ops = c.v("ops", s), lo = c.lg("ops");
  if (!(c.win("hr") === s && c.win("ops") === s && ops != null && (!lo || ops >= lo))) return null;
  const S = c.name(s), hr = nm(c, "hr", s);
  return c.pick("T8", [
    `${eun(S)} 홈런(${hr}개)과 OPS(${f3(ops)}) 모두 앞선 '한 방 있는 타선'이다.`,
    `장타력은 ${S} 쪽이다. 홈런 ${hr}개, OPS ${f3(ops)}로 장타 생산이 많다.`,
    `${S} 타선은 담장을 넘길 힘이 있다(홈런 ${hr}개·OPS ${f3(ops)}).`,
    `홈런과 OPS 두 지표 모두 ${S} 우위다(${hr}개·${f3(ops)}).`,
    `${S} 타선의 홈런(${hr}개)과 OPS(${f3(ops)})가 모두 상대보다 높다.`,
  ]);
}), ["power", "batEdge"]);
rule("T4", "power", 68, ["hr"], (c) => c.either((s) => {
  if (!(c.win("hr") === s && c.lv("hr") === 3 && nm(c, "hr", s) >= 3)) return null;
  const S = c.name(s), a = nm(c, "hr", s), b = nm(c, "hr", c.oth(s));
  return c.pick("T4", [
    `홈런 ${a}:${b}, 장타력에서 ${ga(S)} 확실히 앞선다.`,
    `${S}의 홈런 수(${a}개)가 상대(${b}개)보다 크게 많다.`,
    `담장을 넘긴 횟수는 ${S} ${a}번, 상대 ${b}번이다.`,
    `홈런 격차가 크다(${a}:${b}). 한 방은 ${S} 쪽이 앞선다.`,
    `${S} 홈런 ${a}개, 상대 ${b}개. 장타력 차이가 크다.`,
  ]);
}), ["power"]);
rule("T6", "power", 55, ["hr"], (c) => {
  if (!(c.has("hr") && c.v("hr", "a") === 0 && c.v("hr", "b") === 0)) return null;
  return c.pick("T6", [
    "두 팀 모두 홈런이 없다. 장타보다 연결로 점수를 내는 팀끼리다.",
    "두 타선 모두 아직 홈런을 치지 못했다.",
    "홈런 0개끼리의 대결이다. 득점은 연속 안타와 주루에서 나올 가능성이 크다.",
    "양 팀 모두 시즌 홈런이 없다. 한 방보다는 출루와 연결이 중요한 타선이다.",
  ]);
}, ["power"]);
rule("T5", "power", 50, ["hr"], (c) => c.either((s) => {
  if (!(c.v("hr", s) === 0 && (c.v("hr", c.oth(s)) ?? 0) > 0)) return null;
  const S = c.name(s);
  return c.pick("T5", [
    `${eun(S)} 아직 홈런이 없다. 한 방보다 연결로 점수를 내야 하는 팀이다.`,
    `${S}의 시즌 홈런은 0개다. 득점은 단타와 주루에 기대 왔다.`,
    `${S} 타선은 아직 담장을 넘기지 못했다.`,
    `홈런이 없는 ${eun(S)} 안타를 이어서 점수를 만드는 팀이다.`,
  ]);
}), ["power"]);
rule("T13", "power", 60, ["hr"], (c) => c.either((s) => {
  const g = c.perGame(s, "hr");
  if (!(g != null && g >= 1)) return null;
  const S = c.name(s);
  return c.pick("T13", [
    `${eun(S)} 경기당 홈런 ${f1(g)}개, 한 방이 자주 나오는 팀이다.`,
    `${S} 타선은 경기마다 평균 ${f1(g)}개의 홈런을 쳤다.`,
    `경기당 홈런 ${f1(g)}개는 고교 팀으로는 많은 편이다(${S}).`,
    `${S}의 홈런은 경기당 ${f1(g)}개꼴로 나왔다.`,
  ]);
}), ["power"]);

// ── 타격 (7) ─────────────────────────────────────────────────
rule("T10", "bat", 76, ["avg", "ops"], (c) => c.either((s) => {
  if (!(c.win("avg") === s && c.win("ops") === c.oth(s))) return null;
  const S = c.name(s), O = c.name(c.oth(s));
  return c.pick("T10", [
    `${eun(S)} 타율(${f3(nm(c, "avg", s))})은 높지만 OPS는 뒤진다. 단타 위주로 출루하는 타선이다.`,
    `타율은 ${S}, OPS는 ${O} 쪽이 높다. ${S}의 안타는 단타 비중이 크다.`,
    `${S}의 타율 우위(${f3(nm(c, "avg", s))})가 OPS 우위로 이어지지 않았다. 장타가 상대적으로 적다.`,
    `${eun(S)} 자주 치지만 멀리 치는 쪽은 ${ida(O)}(OPS ${f3(nm(c, "ops", c.oth(s)))}).`,
    `${S}의 안타는 많지만 장타는 상대 쪽이 많다(타율 우위·OPS 열세).`,
  ]);
}), ["batStyle"]);
rule("T12", "bat", 74, ["obp", "avg"], (c) => c.either((s) => {
  const avg = c.v("avg", s), obp = c.v("obp", s), la = c.lg("avg"), lo = c.lg("obp");
  const lgGap = la && lo ? lo - la : 0.11;
  if (!(avg != null && obp != null && obp - avg >= lgGap * 1.25)) return null;
  const S = c.name(s);
  return c.pick("T12", [
    `${eun(S)} 타율(${f3(avg)})보다 출루율(${f3(obp)})이 크게 높다. 볼넷과 사구로 나가는 비중이 큰 타선이다.`,
    `${S} 타자들은 안타 없이도 자주 나간다(출루율 ${f3(obp)}, 타율 ${f3(avg)}).`,
    `${S} 타선의 출루율과 타율 차이(${f3(obp - avg)})가 리그 평균보다 크다.`,
    `${S}의 출루율 ${f3(obp)}에는 볼넷 몫이 크다. 타율은 ${ida(f3(avg))}.`,
    `${S} 타선은 안타보다 볼넷으로 나간 비중이 크다(출루율 ${f3(obp)} · 타율 ${f3(avg)}).`,
  ]);
}), ["batStyle"]);
rule("T1", "bat", 66, ["ops"], (c) => c.either((s) => {
  if (!(c.win("ops") === s && c.lv("ops") === 3)) return null;
  const S = c.name(s), a = f3(nm(c, "ops", s)), b = f3(nm(c, "ops", c.oth(s)));
  return c.pick("T1", [
    `OPS ${a}:${b}, 공격 생산력에서 ${ga(S)} 크게 앞선다.`,
    `${S}의 OPS(${a})가 상대(${b})보다 뚜렷하게 높다.`,
    `타선의 총합 지표인 OPS에서 ${ga(S)} 큰 차이로 앞선다(${a}:${b}).`,
    `OPS 격차가 크다(${a}:${b}). 공격력은 ${S} 쪽이다.`,
    `${S} 타선의 OPS가 ${a}로 상대(${b})보다 크게 높다.`,
  ]);
}), ["batEdge"]);
rule("T2", "bat", 56, ["ops"], (c) => c.either((s) => {
  if (!(c.win("ops") === s && c.lv("ops") === 2)) return null;
  const S = c.name(s), a = f3(nm(c, "ops", s)), b = f3(nm(c, "ops", c.oth(s)));
  return c.pick("T2", [
    `${S}의 OPS(${a})가 한 단계 위다(상대 ${b}).`,
    `OPS ${a}:${b}, 공격 지표는 ${S} 쪽이 낫다.`,
    `${ga(S)} OPS에서 앞선다(${a}:${b}). 격차는 중간 정도다.`,
    `타선의 생산력은 ${S} 우위다(OPS ${a}:${b}).`,
  ]);
}), ["batEdge"]);
rule("T9", "bat", 52, ["avg"], (c) => c.either((s) => {
  if (!(c.win("avg") === s && c.lv("avg") >= 2)) return null;
  const S = c.name(s), a = f3(nm(c, "avg", s)), b = f3(nm(c, "avg", c.oth(s)));
  return c.pick("T9", [
    `팀 타율 ${a}의 ${S}, 정교함에서 앞선다(상대 ${b}).`,
    `안타 생산은 ${S} 쪽이 낫다(팀 타율 ${a}:${b}).`,
    `${S} 타선의 팀 타율(${a})이 상대(${b})보다 높다.`,
    `팀 타율 ${a}:${b}, ${ga(S)} 더 자주 안타를 쳤다.`,
  ]);
}), ["batEdge"]);
rule("T11", "bat", 50, ["obp"], (c) => c.either((s) => {
  if (!(c.win("obp") === s && c.lv("obp") >= 2)) return null;
  const S = c.name(s), a = f3(nm(c, "obp", s)), b = f3(nm(c, "obp", c.oth(s)));
  return c.pick("T11", [
    `출루율 ${a}:${b}, ${S} 타자들이 더 자주 1루를 밟는다.`,
    `${S}의 출루율(${a})이 상대(${b})보다 높다.`,
    `누상에 주자를 더 많이 내보내는 쪽은 ${ida(S)}(출루율 ${a}).`,
    `출루 능력은 ${S} 우위다(${a}:${b}).`,
  ]);
}), ["batEdge"]);
rule("T3", "bat", 30, ["ops"], (c) => {
  if (!(c.has("ops") && c.lv("ops") === 1)) return null;
  const a = f3(nm(c, "ops", "a")), b = f3(nm(c, "ops", "b"));
  return c.pick("T3", [
    `OPS 차이는 ${a}:${b}로 근소하다.`,
    `두 타선의 OPS가 ${a}·${b}로 큰 차이가 없다.`,
    `공격 생산력은 엇비슷하다(OPS ${a}:${b}).`,
    `OPS 차이는 크지 않다(${a}:${b}).`,
  ]);
}, ["batEven"]);

// ── 주루 (6) ─────────────────────────────────────────────────
rule("V5", "speed", 72, ["sb", "obp"], (c) => c.either((s) => {
  if (!(c.win("sb") === s && c.win("obp") === c.oth(s))) return null;
  const S = c.name(s), sb = nm(c, "sb", s);
  return c.pick("V5", [
    `${eun(S)} 출루는 적어도 나가면 뛴다. 도루 ${sb}개로 부족한 출루를 발로 만회한다.`,
    `${S}의 출루율은 상대보다 낮지만 도루(${sb}개)는 더 많다.`,
    `출루는 상대가 앞서고 주루는 ${ga(S)} 앞선다(도루 ${sb}개).`,
    `${eun(S)} 적은 출루를 도루(${sb}개)로 메우는 팀이다.`,
  ]);
}), ["speedEdge"]);
rule("V3", "speed", 64, ["sb", "obp"], (c) => c.either((s) => {
  if (!(c.win("sb") === s && c.win("obp") === s)) return null;
  const S = c.name(s), sb = nm(c, "sb", s), obp = f3(nm(c, "obp", s));
  return c.pick("V3", [
    `${eun(S)} 많이 나가고(출루율 ${obp}) 많이 뛴다(도루 ${sb}개).`,
    `출루율(${obp})과 도루(${sb}개) 모두 ${S} 쪽이 앞선다.`,
    `${eun(S)} 출루와 주루를 모두 갖춘 타선이다(출루율 ${obp}·도루 ${sb}개).`,
    `누상에 많이 나가고 나가서도 뛰는 쪽은 ${ida(S)}.`,
  ]);
}), ["speedEdge"]);
rule("V1", "speed", 62, ["sb"], (c) => c.either((s) => {
  if (!(c.win("sb") === s && c.lv("sb") === 3)) return null;
  const S = c.name(s), a = nm(c, "sb", s), b = nm(c, "sb", c.oth(s));
  return c.pick("V1", [
    `도루 ${a}:${b}, 기동력에서 ${ga(S)} 크게 앞선다.`,
    `${S}의 도루 수(${a}개)가 상대(${b}개)보다 크게 많다.`,
    `주루 차이가 크다(도루 ${a}:${b}).`,
    `베이스를 훔친 횟수는 ${S} ${a}번, 상대 ${b}번이다.`,
  ]);
}), ["speedEdge"]);
rule("V4", "speed", 58, ["sb"], (c) => {
  const a = c.perGame("a", "sb"), b = c.perGame("b", "sb");
  if (!(a != null && b != null && a >= 2 && b >= 2)) return null;
  return c.pick("V4", [
    `두 팀 모두 경기당 도루 2개 이상(${f1(a)}·${f1(b)}), 적극적으로 뛰는 팀끼리다.`,
    `양 팀 모두 주루가 활발하다(경기당 도루 ${f1(a)}·${f1(b)}개).`,
    `경기당 도루 ${f1(a)}개와 ${f1(b)}개, 두 팀 모두 많이 뛴다.`,
    `도루가 많은 팀끼리의 대결이다(경기당 ${f1(a)}·${f1(b)}개).`,
  ]);
}, ["speedBoth"]);
rule("V2", "speed", 45, ["sb"], (c) => c.either((s) => {
  if (!(c.win("sb") === s && c.lv("sb") === 2)) return null;
  const S = c.name(s), a = nm(c, "sb", s), b = nm(c, "sb", c.oth(s));
  return c.pick("V2", [
    `베이스 위 움직임은 ${S} 쪽이 더 활발하다(도루 ${a}개).`,
    `도루는 ${S} ${a}개, 상대 ${b}개다.`,
    `주루는 ${S} 쪽이 조금 더 적극적이다(도루 ${a}:${b}).`,
    `${ga(S)} 도루에서 앞선다(${a}:${b}).`,
  ]);
}), ["speedEdge"]);
rule("V6", "speed", 50, ["sb"], (c) => {
  const a = c.perGame("a", "sb"), b = c.perGame("b", "sb");
  if (!(a != null && b != null && a <= 0.5 && b <= 0.5)) return null;
  return c.pick("V6", [
    "두 팀 모두 도루가 거의 없다. 주루보다 타격 위주의 팀끼리다.",
    `양 팀의 경기당 도루가 ${f1(a)}·${f1(b)}개로 적다.`,
    "두 팀 모두 뛰는 야구와는 거리가 있다.",
    `도루가 적은 팀끼리의 대결이다(경기당 ${f1(a)}·${f1(b)}개).`,
  ]);
}, ["speedBoth"]);

// ── 마운드 실점 억제 (6) ─────────────────────────────────────
rule("P4", "pit", 82, ["era", "whip"], (c) => c.either((s) => {
  const o = c.oth(s);
  if (!(c.win("era") === s && c.win("whip") === o)) return null;
  const S = c.name(s), O = c.name(o);
  return c.pick("P4", [
    `${eun(S)} 주자를 더 내보내고도(WHIP ${f2(nm(c, "whip", s))}) 실점이 적고(ERA ${f2(nm(c, "era", s))}), ${eun(O)} 출루 허용이 적은데도 실점이 많다. 위기 상황 결과에서 갈린 구도다.`,
    `출루 허용은 ${ga(O)} 적지만(WHIP ${f2(nm(c, "whip", o))}) 실점은 ${ga(S)} 적다(ERA ${f2(nm(c, "era", s))}).`,
    `${S} 마운드는 주자를 내보내고도 점수를 덜 줬다(WHIP ${f2(nm(c, "whip", s))}, ERA ${f2(nm(c, "era", s))}).`,
    `WHIP은 ${O}, ERA는 ${S} 우위다. 출루 허용과 실점의 관계가 두 팀에서 다르게 나타났다.`,
    `${eun(S)} 출루를 더 허용하고도 실점이 적었고, ${eun(O)} 그 반대였다.`,
  ]);
}), ["pitStyle"]);
rule("P5", "pit", 62, ["whip"], (c) => {
  const a = c.v("whip", "a"), b = c.v("whip", "b"), l = c.lg("whip");
  if (!(a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1)) return null;
  return c.pick("P5", [
    `두 팀 마운드 모두 이닝당 출루 허용이 많다(WHIP ${f2(a)}·${f2(b)}). 주자가 자주 나갈 수 있는 대진이다.`,
    `양 팀 WHIP이 모두 리그 평균(${f2(l)})보다 높다(${f2(a)}·${f2(b)}).`,
    `두 마운드 모두 이닝당 1.5명 안팎 이상을 내보낸다(WHIP ${f2(a)}·${f2(b)}).`,
    `출루 허용이 많은 마운드끼리다(WHIP ${f2(a)}·${f2(b)}, 리그 평균 ${f2(l)}).`,
  ]);
}, ["pitBoth"]);
rule("P1", "pit", 66, ["era"], (c) => c.either((s) => {
  if (!(c.win("era") === s && c.lv("era") === 3)) return null;
  const S = c.name(s), a = f2(nm(c, "era", s)), b = f2(nm(c, "era", c.oth(s)));
  return c.pick("P1", [
    `팀 ERA ${a}:${b}, 실점 억제력에서 ${ga(S)} 크게 앞선다.`,
    `${S} 마운드의 ERA(${a})가 상대(${b})보다 뚜렷하게 낮다.`,
    `마운드 격차가 크다(ERA ${a}:${b}). 실점 억제는 ${S} 쪽이다.`,
    `점수를 덜 주는 쪽은 확실히 ${ida(S)}(팀 ERA ${a}, 상대 ${b}).`,
    `${S} 마운드의 팀 ERA ${a}, 상대는 ${ida(b)}. 실점 억제 격차가 크다.`,
  ]);
}), ["pitEdge"]);
rule("P2", "pit", 56, ["era"], (c) => c.either((s) => {
  if (!(c.win("era") === s && c.lv("era") === 2)) return null;
  const S = c.name(s), a = f2(nm(c, "era", s)), b = f2(nm(c, "era", c.oth(s)));
  return c.pick("P2", [
    `${S} 마운드가 실점을 더 잘 막는다(ERA ${a}:${b}).`,
    `팀 ERA는 ${S} 쪽이 낮다(${a}:${b}).`,
    `실점 억제력은 ${S} 우위다. 격차는 중간 정도다(ERA ${a}:${b}).`,
    `${ga(S)} 팀 ERA에서 앞선다(${a}:${b}).`,
  ]);
}), ["pitEdge"]);
rule("P6", "pit", 50, ["whip"], (c) => c.either((s) => {
  if (!(c.win("whip") === s && c.lv("whip") >= 2)) return null;
  const S = c.name(s), a = f2(nm(c, "whip", s)), b = f2(nm(c, "whip", c.oth(s)));
  return c.pick("P6", [
    `이닝당 출루 허용 ${a}:${b}, ${eun(S)} 주자를 잘 묶는다.`,
    `${S} 마운드의 WHIP(${a})이 상대(${b})보다 낮다.`,
    `주자를 덜 내보내는 쪽은 ${ida(S)}(WHIP ${a}:${b}).`,
    `${ga(S)} 이닝당 출루 허용에서 앞선다(WHIP ${a}:${b}).`,
  ]);
}), ["pitEdge"]);
rule("P3", "pit", 30, ["era"], (c) => {
  if (!(c.has("era") && c.lv("era") === 1)) return null;
  const a = f2(nm(c, "era", "a")), b = f2(nm(c, "era", "b"));
  return c.pick("P3", [
    `팀 ERA는 ${a}:${b}로 근소한 차이다.`,
    `두 마운드의 ERA가 ${a}·${b}로 비슷하다.`,
    `실점 억제력은 엇비슷하다(ERA ${a}:${b}).`,
    `팀 ERA 차이는 크지 않다(${a}:${b}).`,
  ]);
}, ["pitEven"]);

// ── 투구 스타일 (7) ─────────────────────────────────────────
rule("K2", "pitstyle", 74, ["k9", "bb9"], (c) => c.either((s) => {
  const o = c.oth(s);
  if (!(c.win("k9") === s && c.win("bb9") === o)) return null;
  const S = c.name(s), O = c.name(o), k = f1(nm(c, "k9", s)), bb = f1(nm(c, "bb9", o));
  return c.pick("K2", [
    `투구 스타일이 정반대다. ${eun(S)} 삼진(K/9 ${k})으로, ${eun(O)} 적은 볼넷(BB/9 ${bb})으로 막는다.`,
    `탈삼진은 ${S}(K/9 ${k}), 제구는 ${O}(BB/9 ${bb}) 쪽이 앞선다.`,
    `${S} 마운드는 삼진형, ${O} 마운드는 제구형이다(K/9 ${k} · BB/9 ${bb}).`,
    `두 마운드의 강점이 다르다. ${eun(S)} 삼진, ${eun(O)} 볼넷 억제가 장점이다.`,
    `${eun(S)} 탈삼진(K/9 ${k}), ${eun(O)} 볼넷 억제(BB/9 ${bb})가 강점이다.`,
  ]);
}), ["pitStyle"]);
rule("K3", "pitstyle", 62, ["bb9"], (c) => {
  const a = c.v("bb9", "a"), b = c.v("bb9", "b"), l = c.lg("bb9");
  if (!(a != null && b != null && l && a <= l * 0.85 && b <= l * 0.85)) return null;
  return c.pick("K3", [
    `두 팀 모두 볼넷이 적은 마운드다(BB/9 ${f1(a)}·${f1(b)}). 볼넷으로 출루하기 어려운 대진이다.`,
    `양 팀 BB/9이 모두 리그 평균(${f1(l)})보다 낮다(${f1(a)}·${f1(b)}).`,
    `제구가 안정된 마운드끼리 만난다(BB/9 ${f1(a)}·${f1(b)}).`,
    `두 투수진 모두 볼넷을 적게 준다(9이닝당 ${f1(a)}·${f1(b)}개).`,
  ]);
}, ["pitBoth"]);
rule("K1", "pitstyle", 70, ["k9", "bb9"], (c) => c.either((s) => {
  if (!(c.win("k9") === s && c.win("bb9") === s)) return null;
  const S = c.name(s), k = f1(nm(c, "k9", s)), bb = f1(nm(c, "bb9", s));
  return c.pick("K1", [
    `${S} 투수진은 삼진은 많고(K/9 ${k}) 볼넷은 적다(BB/9 ${bb}).`,
    `탈삼진(K/9 ${k})과 볼넷 억제(BB/9 ${bb}) 모두 ${S} 마운드가 앞선다.`,
    `${S} 마운드는 구위와 제구 지표가 모두 상대보다 낫다(K/9 ${k}·BB/9 ${bb}).`,
    `삼진은 더 잡고 볼넷은 덜 주는 쪽이 ${ida(S)}(K/9 ${k}·BB/9 ${bb}).`,
    `${S} 마운드가 K/9(${k})과 BB/9(${bb}) 모두 앞선다.`,
  ]);
}), ["pitEdge"]);
rule("K7", "pitstyle", 60, ["k9", "era"], (c) => c.either((s) => {
  if (!(c.win("k9") === s && c.win("era") === s)) return null;
  const S = c.name(s), k = f1(nm(c, "k9", s));
  return c.pick("K7", [
    `${eun(S)} 탈삼진(K/9 ${k})과 ERA 모두 앞선 마운드다.`,
    `${S} 마운드는 삼진을 더 잡고(K/9 ${k}) 실점도 더 적다.`,
    `삼진 능력(K/9 ${k})과 실점 억제 모두 ${S} 쪽이 낫다.`,
    `${S} 투수진은 K/9 ${k}로 삼진을 많이 잡고 ERA도 상대보다 낮다.`,
  ]);
}), ["pitEdge"]);
rule("K6", "pitstyle", 58, ["k9"], (c) => {
  const a = c.v("k9", "a"), b = c.v("k9", "b"), l = c.lg("k9");
  if (!(a != null && b != null && l && a >= l * 1.15 && b >= l * 1.15)) return null;
  return c.pick("K6", [
    `두 팀 모두 리그 평균보다 삼진을 많이 잡는다(K/9 ${f1(a)}·${f1(b)}). 타자들의 컨택이 시험대에 오른다.`,
    `양 팀 K/9이 모두 리그 평균(${f1(l)})을 크게 웃돈다(${f1(a)}·${f1(b)}).`,
    `탈삼진형 마운드끼리의 대결이다(K/9 ${f1(a)}·${f1(b)}).`,
    `두 투수진 모두 9이닝당 삼진이 많다(${f1(a)}·${f1(b)}개).`,
  ]);
}, ["pitBoth"]);
rule("K4", "pitstyle", 52, ["k9"], (c) => c.either((s) => {
  if (!(c.win("k9") === s && c.lv("k9") >= 2)) return null;
  const S = c.name(s), a = f1(nm(c, "k9", s)), b = f1(nm(c, "k9", c.oth(s)));
  return c.pick("K4", [
    `탈삼진 능력은 ${ga(S)} 뚜렷하게 앞선다(K/9 ${a}:${b}).`,
    `${S} 마운드의 K/9(${a})이 상대(${b})보다 높다.`,
    `삼진을 더 많이 잡는 쪽은 ${ida(S)}(9이닝당 ${a}개).`,
    `K/9 ${a}:${b}, 구위 지표는 ${S} 우위다.`,
  ]);
}), ["pitEdge"]);
rule("K5", "pitstyle", 50, ["bb9"], (c) => c.either((s) => {
  if (!(c.win("bb9") === s && c.lv("bb9") >= 2)) return null;
  const S = c.name(s), a = f1(nm(c, "bb9", s)), b = f1(nm(c, "bb9", c.oth(s)));
  return c.pick("K5", [
    `${S} 투수진의 제구가 더 안정적이다(BB/9 ${a}:${b}).`,
    `볼넷을 덜 주는 쪽은 ${ida(S)}(9이닝당 ${a}개, 상대 ${b}개).`,
    `${S} 마운드의 BB/9(${a})이 상대(${b})보다 낮다.`,
    `제구 지표(BB/9)는 ${S} 우위다(${a}:${b}).`,
  ]);
}), ["pitEdge"]);

// ── 타격 성향 (6) ───────────────────────────────────────────
rule("C5", "contact", 62, ["iso"], (c) => c.either((s) => {
  const v = c.ex("iso", s), l = c.lg("iso");
  if (!(v != null && l && v >= l * 1.3)) return null;
  const S = c.name(s);
  return c.pick("C5", [
    `${S}의 순수장타율(ISO ${f3(v)})이 리그 평균(${f3(l)})보다 높다. 장타 비중이 큰 타선이다.`,
    `${S} 타선은 안타 중 장타가 많다(ISO ${f3(v)}, 리그 평균 ${f3(l)}).`,
    `장타율에서 타율을 뺀 ISO가 ${S} 타선은 ${f3(v)}로 리그 평균을 크게 웃돈다.`,
    `${S} 타선의 ISO ${f3(v)}는 리그 평균(${f3(l)})의 ${f1(v / l)}배 수준이다.`,
  ]);
}), ["power"]);
rule("C2", "contact", 60, ["kpct"], (c) => c.either((s) => {
  const v = c.ex("kPct", s), l = c.lg("kPct");
  if (!(v != null && l && v >= l * 1.2)) return null;
  const S = c.name(s);
  return c.pick("C2", [
    `${S} 타선은 삼진이 많은 편(삼진율 ${pct1(v)})이라 탈삼진형 투수에게 고전할 수 있다.`,
    `${S}의 타석당 삼진율은 ${pct1(v)}로 리그 평균(${pct1(l)})보다 높다.`,
    `${S} 타자들은 삼진이 잦다(삼진율 ${pct1(v)}). 공을 맞히는 면에서 약점이 있다.`,
    `${S} 타선의 삼진율 ${pct1(v)}는 리그 평균을 웃돈다.`,
    `${S} 타선은 삼진 비율이 높은 편이다(${pct1(v)}).`,
  ]);
}), ["contact"]);
rule("C7", "contact", 59, ["bbk"], (c) => c.either((s) => {
  const v = c.ex("bbK", s);
  if (!(v != null && v >= 1)) return null;
  const S = c.name(s);
  return c.pick("C7", [
    `${S} 타선은 삼진보다 볼넷이 많다(볼넷/삼진 ${f2(v)}). 선구안이 좋은 타선이다.`,
    `${S} 타자들은 삼진 1개당 볼넷 ${f2(v)}개를 얻었다.`,
    `볼넷이 삼진보다 많은 타선은 드물다. ${S}의 볼넷/삼진은 ${ida(f2(v))}.`,
    `${S} 타선의 볼넷/삼진 비율 ${f2(v)}는 공을 잘 보는 타선이라는 뜻이다.`,
  ]);
}), ["contact"]);
rule("C1", "contact", 58, ["kpct"], (c) => c.either((s) => {
  const v = c.ex("kPct", s), l = c.lg("kPct");
  if (!(v != null && l && v <= l * 0.8)) return null;
  const S = c.name(s);
  return c.pick("C1", [
    `${S} 타선은 삼진이 적다(삼진율 ${pct1(v)}). 공을 맞히는 능력이 좋다.`,
    `${S}의 삼진율 ${pct1(v)}는 리그 평균(${pct1(l)})보다 낮다.`,
    `${S} 타자들은 쉽게 삼진을 당하지 않는다(삼진율 ${pct1(v)}).`,
    `삼진이 적은 타선이다(${S}, 타석당 삼진 ${pct1(v)}).`,
  ]);
}), ["contact"]);
rule("C6", "contact", 57, ["iso"], (c) => {
  const a = c.ex("iso", "a"), b = c.ex("iso", "b"), l = c.lg("iso");
  if (!(a != null && b != null && l && a <= l * 0.7 && b <= l * 0.7)) return null;
  return c.pick("C6", [
    `두 팀 모두 장타가 적은 타선(ISO ${f3(a)}·${f3(b)})이라 단타와 작전 싸움 성향의 대진이다.`,
    `양 팀 ISO가 모두 리그 평균(${f3(l)})을 크게 밑돈다(${f3(a)}·${f3(b)}).`,
    `장타보다 단타가 많은 타선끼리다(ISO ${f3(a)}·${f3(b)}).`,
    `두 타선 모두 순수장타율이 낮다(${f3(a)}·${f3(b)}). 장타로 점수를 내는 팀들은 아니다.`,
  ]);
}, ["powerBoth"]);
rule("C3", "contact", 56, ["bbpct"], (c) => c.either((s) => {
  const v = c.ex("bbPct", s), l = c.lg("bbPct");
  if (!(v != null && l && v >= l * 1.2)) return null;
  const S = c.name(s);
  return c.pick("C3", [
    `${S} 타선은 볼넷을 많이 얻어낸다(볼넷율 ${pct1(v)}).`,
    `${S}의 타석당 볼넷 비율은 ${pct1(v)}로 리그 평균(${pct1(l)})보다 높다.`,
    `${S} 타자들은 타석의 ${pct1(v)}를 볼넷으로 나갔다.`,
    `볼넷을 잘 골라내는 타선이다(${S}, 볼넷율 ${pct1(v)}).`,
  ]);
}), ["contact"]);

// ── 피안타·실점의 질 (5) ────────────────────────────────────
rule("Q4", "pitchContact", 65, ["unearned"], (c) => c.either((s) => {
  const v = c.ex("unearned", s);
  if (!(v != null && v >= 0.35)) return null;
  const S = c.name(s);
  return c.pick("Q4", [
    `${S}의 실점 중 ${pct0(v)}가 비자책이다. 실책이 실점으로 이어진 경우가 많았다.`,
    `${S} 마운드가 내준 점수의 ${pct0(v)}는 자책점이 아니다.`,
    `비자책 실점 비율이 ${pct0(v)}로 높다(${S}). 수비 실책이 실점에 영향을 줬다.`,
    `${S}의 실점은 ERA만으로 다 설명되지 않는다. 실점의 ${pct0(v)}가 비자책이다.`,
  ]);
}), ["defense"]);
rule("Q3", "pitchContact", 63, ["h9", "bb9"], (c) => c.either((s) => {
  const h9 = c.ex("h9", s), bb9 = c.v("bb9", s), lw = c.lg("whip"), w = c.v("whip", s);
  if (!(h9 != null && bb9 != null && w != null && lw && w >= lw && bb9 >= h9)) return null;
  const S = c.name(s);
  return c.pick("Q3", [
    `${S} 마운드의 출루 허용은 안타보다 볼넷 비중이 크다(H/9 ${f1(h9)}·BB/9 ${f1(bb9)}).`,
    `${S} 투수진은 9이닝당 볼넷(${f1(bb9)}개)이 피안타(${f1(h9)}개)보다 많다.`,
    `${S} 마운드의 출루 허용(WHIP ${f2(w)})은 주로 볼넷에서 나왔다.`,
    `피안타보다 볼넷이 많은 마운드다(${S}, H/9 ${f1(h9)}·BB/9 ${f1(bb9)}).`,
  ]);
}), ["pitStyle"]);
rule("Q1", "pitchContact", 60, ["h9"], (c) => c.either((s) => {
  const v = c.ex("h9", s), l = c.lg("h9");
  if (!(v != null && l && v <= l * 0.8)) return null;
  const S = c.name(s);
  return c.pick("Q1", [
    `${S} 마운드는 9이닝당 피안타 ${f1(v)}개로 안타 자체를 잘 맞지 않는다.`,
    `${S}의 H/9 ${f1(v)}는 리그 평균(${f1(l)})보다 낮다.`,
    `${S} 투수진은 안타 허용이 적다(9이닝당 ${f1(v)}개).`,
    `피안타가 적은 마운드다(${S}, H/9 ${f1(v)}).`,
  ]);
}), ["hitAllowed"]);
rule("Q2", "pitchContact", 58, ["h9"], (c) => c.either((s) => {
  const v = c.ex("h9", s), l = c.lg("h9");
  if (!(v != null && l && v >= l * 1.2)) return null;
  const S = c.name(s);
  return c.pick("Q2", [
    `${S} 마운드는 9이닝당 피안타가 ${f1(v)}개로 많다.`,
    `${S}의 H/9 ${f1(v)}는 리그 평균(${f1(l)})보다 높다.`,
    `${S} 투수진은 안타 허용이 많은 편이다(9이닝당 ${f1(v)}개).`,
    `피안타가 많은 마운드다(${S}, H/9 ${f1(v)}).`,
  ]);
}), ["hitAllowed"]);
rule("Q5", "pitchContact", 57, ["kbbp"], (c) => c.either((s) => {
  const v = c.ex("kbbP", s);
  if (!(v != null && v >= 3)) return null;
  const S = c.name(s);
  return c.pick("Q5", [
    `${S} 투수진은 볼넷 1개당 삼진 ${f1(v)}개를 잡았다. 구위와 제구의 균형이 좋다.`,
    `${S} 마운드의 삼진/볼넷 비율은 ${ida(f1(v))}.`,
    `${S} 투수들은 볼넷보다 삼진이 ${f1(v)}배 많다.`,
    `삼진/볼넷 ${f1(v)}, ${S} 마운드는 제구가 받쳐 주는 탈삼진형이다.`,
  ]);
}), ["pitStyle"]);

// ── 리그 대비 수준 (12) ─────────────────────────────────────
rule("L1", "level", 67, ["ops"], (c) => {
  const a = c.v("ops", "a"), b = c.v("ops", "b"), l = c.lg("ops");
  if (!(a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1)) return null;
  return c.pick("L1", [
    `두 팀 모두 리그 평균 OPS(${f3(l)})를 크게 웃돈다(${f3(a)}·${f3(b)}). 타격이 강한 팀끼리다.`,
    `양 팀 OPS가 모두 리그 평균보다 10% 이상 높다(${f3(a)}·${f3(b)}).`,
    `공격력이 리그 상위권인 두 타선이 만난다(OPS ${f3(a)}·${f3(b)}).`,
    `두 타선 모두 리그 평균을 넘는 생산력을 보였다(OPS ${f3(a)}·${f3(b)}, 리그 ${f3(l)}).`,
  ]);
}, ["batBoth"]);
rule("L2", "level", 67, ["era"], (c) => {
  const a = c.v("era", "a"), b = c.v("era", "b"), l = c.lg("era");
  if (!(a != null && b != null && l && a <= l * 0.85 && b <= l * 0.85)) return null;
  return c.pick("L2", [
    `두 팀 모두 팀 ERA가 리그 평균(${f2(l)})보다 낮다(${f2(a)}·${f2(b)}). 마운드가 강한 팀끼리다.`,
    `양 팀 ERA가 모두 리그 평균보다 15% 이상 낮다(${f2(a)}·${f2(b)}).`,
    `실점 억제력이 좋은 두 마운드가 만난다(ERA ${f2(a)}·${f2(b)}).`,
    `두 투수진 모두 리그 평균보다 점수를 덜 줬다(ERA ${f2(a)}·${f2(b)}, 리그 ${f2(l)}).`,
  ]);
}, ["pitBoth"]);
rule("L3", "level", 63, ["ops"], (c) => {
  const a = c.v("ops", "a"), b = c.v("ops", "b"), l = c.lg("ops");
  if (!(a != null && b != null && l && a <= l * 0.9 && b <= l * 0.9)) return null;
  return c.pick("L3", [
    `두 팀 모두 공격력이 리그 평균에 못 미친다(OPS ${f3(a)}·${f3(b)}). 점수가 많이 나지 않을 수 있다.`,
    `양 팀 OPS가 모두 리그 평균(${f3(l)})보다 10% 이상 낮다.`,
    `타선이 약한 팀끼리의 대결이다(OPS ${f3(a)}·${f3(b)}).`,
    `두 타선 모두 리그 평균 이하의 생산력을 보였다(OPS ${f3(a)}·${f3(b)}).`,
  ]);
}, ["batBoth"]);
rule("L7", "level", 59, ["era"], (c) => c.either((s) => {
  const v = c.v("era", s), l = c.lg("era");
  if (!(v != null && l && v <= l * 0.6)) return null;
  const S = c.name(s);
  return c.pick("L7", [
    `${S}의 팀 ERA ${f2(v)}는 리그 최상위권 수준이다(리그 평균 ${f2(l)}).`,
    `${S} 마운드는 리그 평균보다 40% 이상 적게 실점했다(ERA ${f2(v)}).`,
    `리그 평균 ERA ${f2(l)}와 비교하면 ${S}(${f2(v)})의 마운드는 상위권이다.`,
    `${S}의 팀 ERA(${f2(v)})는 리그에서도 손꼽히게 낮다.`,
  ]);
}), ["pitLevel"]);
rule("L4", "level", 58, ["bb9"], (c) => {
  const a = c.v("bb9", "a"), b = c.v("bb9", "b"), l = c.lg("bb9");
  if (!(a != null && b != null && l && a >= l * 1.1 && b >= l * 1.1)) return null;
  return c.pick("L4", [
    "양 팀 모두 볼넷이 많은 편이라 볼넷 하나가 승부를 흔들 수 있다.",
    `두 마운드 모두 BB/9이 리그 평균(${f1(l)})보다 높다(${f1(a)}·${f1(b)}).`,
    `볼넷 허용이 많은 마운드끼리다(9이닝당 ${f1(a)}·${f1(b)}개).`,
    `두 투수진 모두 제구 지표가 리그 평균보다 나쁘다(BB/9 ${f1(a)}·${f1(b)}).`,
  ]);
}, ["pitBoth"]);
rule("L8", "level", 57, ["ops"], (c) => c.either((s) => {
  const v = c.v("ops", s), l = c.lg("ops");
  if (!(v != null && l && v >= l * 1.2)) return null;
  const S = c.name(s);
  return c.pick("L8", [
    `${S}의 OPS ${f3(v)}는 리그 평균(${f3(l)})보다 20% 이상 높은 상위권 타선이다.`,
    `${S} 타선은 리그 평균을 크게 웃도는 생산력을 보였다(OPS ${f3(v)}).`,
    `리그 평균 OPS ${f3(l)}와 비교하면 ${S}(${f3(v)})의 타선은 상위권이다.`,
    `${S}의 OPS(${f3(v)})는 리그 평균의 ${f1(v / l)}배 수준이다.`,
  ]);
}), ["batLevel"]);
rule("L6", "level", 56, ["era"], (c) => c.either((s) => {
  const v = c.v("era", s), l = c.lg("era");
  if (!(v != null && l && v >= l * 1.3)) return null;
  const S = c.name(s);
  return c.pick("L6", [
    `${eun(S)} 팀 ERA ${f2(v)}로 리그 평균(${f2(l)})보다 실점이 많다.`,
    `${S} 마운드의 ERA(${f2(v)})는 리그 평균보다 30% 이상 높다.`,
    `실점 억제가 ${S}의 약점이다(ERA ${f2(v)}, 리그 ${f2(l)}).`,
    `${S} 투수진은 리그 평균보다 점수를 많이 내줬다(ERA ${f2(v)}).`,
  ]);
}), ["pitLevel"]);
rule("L9", "level", 55, ["ops"], (c) => c.either((s) => {
  const v = c.v("ops", s), l = c.lg("ops");
  if (!(v != null && l && v <= l * 0.8)) return null;
  const S = c.name(s);
  return c.pick("L9", [
    `${S}의 OPS ${f3(v)}는 리그 평균(${f3(l)})에 크게 못 미친다.`,
    `${S} 타선의 생산력은 리그 평균보다 20% 이상 낮다(OPS ${f3(v)}).`,
    `공격력이 ${S}의 약점이다(OPS ${f3(v)}, 리그 ${f3(l)}).`,
    `${S} 타선은 리그 평균보다 득점 생산이 적었다(OPS ${f3(v)}).`,
  ]);
}), ["batLevel"]);
rule("L5", "level", 54, ["avg"], (c) => c.either((s) => {
  const v = c.v("avg", s), l = c.lg("avg");
  if (!(v != null && l && v >= 0.3 && v >= l + 0.03)) return null;
  const S = c.name(s);
  return c.pick("L5", [
    `${S}의 팀 타율 ${f3(v)}는 리그 평균(${f3(l)})을 크게 웃돈다.`,
    `${S} 타선은 팀 타율 3할을 넘긴다(${f3(v)}).`,
    `리그 평균 타율 ${f3(l)}보다 ${f3(v - l)} 높은 ${S} 타선이다.`,
    `팀 타율 ${f3(v)}, ${eun(S)} 안타를 많이 치는 팀이다.`,
  ]);
}), ["batLevel"]);
rule("L10", "level", 53, ["whip"], (c) => c.either((s) => {
  const v = c.v("whip", s), l = c.lg("whip");
  if (!(v != null && l && v <= l * 0.8)) return null;
  const S = c.name(s);
  return c.pick("L10", [
    `${S} 마운드는 이닝당 ${f2(v)}명만 출루시킨다. 리그 평균(${f2(l)})보다 훨씬 적다.`,
    `${S}의 WHIP ${f2(v)}는 리그 평균보다 20% 이상 낮다.`,
    `출루 허용이 적은 마운드다(${S}, WHIP ${f2(v)}).`,
    `리그 평균 WHIP ${f2(l)}와 비교하면 ${S}(${f2(v)})의 마운드는 상위권이다.`,
  ]);
}), ["pitLevel"]);
// BABIP는 인플레이 타구가 안타가 된 비율 — 운·타구 질을 단정하지 않고 사실과 일반적 경향만 말한다.
rule("L11", "level", 52, ["babip"], (c) => c.either((s) => {
  const v = c.ex("babip", s), l = c.lg("babip");
  if (!(v != null && l && v >= l * 1.12)) return null;
  const S = c.name(s);
  return c.pick("L11", [
    `${S} 타선의 BABIP은 ${f3(v)}로 리그 평균(${f3(l)})보다 높다. 인플레이 타구가 안타가 된 비율이 높았다.`,
    `${S}의 BABIP ${f3(v)}는 리그 평균을 웃돈다. 표본이 쌓이면 평균 쪽으로 움직이는 경우가 많은 지표다.`,
    `인플레이 타구 타율(BABIP)은 ${S} 타선 ${f3(v)}, 리그 평균 ${ida(f3(l))}.`,
    `${S} 타선은 그라운드 안으로 보낸 타구의 안타 비율이 높다(BABIP ${f3(v)}).`,
  ]);
}), ["babip"]);
rule("L12", "level", 54, ["babip"], (c) => c.either((s) => {
  const v = c.ex("babip", s), l = c.lg("babip");
  if (!(v != null && l && v <= l * 0.88)) return null;
  const S = c.name(s);
  return c.pick("L12", [
    `${S} 타선의 BABIP은 ${f3(v)}로 리그 평균(${f3(l)})보다 낮다. 인플레이 타구가 안타가 된 비율이 낮았다.`,
    `${S}의 BABIP ${f3(v)}는 리그 평균을 밑돈다. 표본이 쌓이면 평균 쪽으로 움직이는 경우가 많은 지표다.`,
    `인플레이 타구 타율(BABIP)은 ${S} 타선 ${f3(v)}, 리그 평균 ${ida(f3(l))}.`,
    `${S} 타선은 그라운드 안으로 보낸 타구의 안타 비율이 낮다(BABIP ${f3(v)}).`,
  ]);
}), ["babip"]);

// ── 팀 색깔 (4) — 리그 평균 대비 투타 균형 ─────────────────
const identity = (c: Ctx, s: "a" | "b") => {
  const ops = c.v("ops", s), era = c.v("era", s), lo = c.lg("ops"), le = c.lg("era");
  return ops != null && era != null && lo && le ? { bat: ops / lo, pit: le / era, ops, era } : null;
};
rule("I1", "identity", 68, ["ops", "era"], (c) => c.either((s) => {
  const x = identity(c, s);
  if (!(x && x.bat >= 1.1 && x.pit <= 0.9)) return null;
  const S = c.name(s);
  return c.pick("I1", [
    `${eun(S)} 타선(OPS ${f3(x.ops)})은 리그 평균보다 강하고 마운드(ERA ${f2(x.era)})는 약한 '때리는 야구' 팀이다.`,
    `${S}의 강점은 방망이, 약점은 마운드다(OPS ${f3(x.ops)}·ERA ${f2(x.era)}).`,
    `${eun(S)} 실점이 많아도 그만큼 점수를 뽑는 팀이다(리그 대비 타격 우위·마운드 열세).`,
    `리그 평균과 비교하면 ${eun(S)} 공격형 팀이다. 타격 지표는 높고 마운드 지표는 낮다.`,
  ]);
}), ["identity"]);
rule("I2", "identity", 68, ["ops", "era"], (c) => c.either((s) => {
  const x = identity(c, s);
  if (!(x && x.pit >= 1.15 && x.bat <= 0.95)) return null;
  const S = c.name(s);
  return c.pick("I2", [
    `${eun(S)} 마운드(ERA ${f2(x.era)})는 강하고 타선(OPS ${f3(x.ops)})은 약한 '지키는 야구' 팀이다.`,
    `${S}의 강점은 마운드, 약점은 방망이다(ERA ${f2(x.era)}·OPS ${f3(x.ops)}).`,
    `${eun(S)} 많이 뽑기보다 적게 주는 팀이다(리그 대비 마운드 우위·타격 열세).`,
    `리그 평균과 비교하면 ${eun(S)} 수비형 팀이다. 마운드 지표는 좋고 타격 지표는 낮다.`,
  ]);
}), ["identity"]);
rule("I3", "identity", 60, ["ops", "era"], (c) => c.either((s) => {
  const x = identity(c, s);
  if (!(x && x.bat >= 1.05 && x.pit >= 1.05)) return null;
  const S = c.name(s);
  return c.pick("I3", [
    `${eun(S)} 투타 모두 리그 평균 이상인 균형 잡힌 팀이다.`,
    `${eun(S)} 타격(OPS ${f3(x.ops)})과 마운드(ERA ${f2(x.era)}) 모두 리그 평균보다 낫다.`,
    `리그 평균과 비교하면 ${eun(S)} 투타에 뚜렷한 약점이 없다.`,
    `${S}의 타선과 마운드는 모두 리그 평균을 웃돈다.`,
  ]);
}), ["identity"]);
rule("I4", "identity", 60, ["ops", "era"], (c) => c.either((s) => {
  const x = identity(c, s);
  if (!(x && x.bat <= 0.95 && x.pit <= 0.95)) return null;
  const S = c.name(s);
  return c.pick("I4", [
    `${eun(S)} 투타 모두 리그 평균에 못 미친다.`,
    `${eun(S)} 타격(OPS ${f3(x.ops)})과 마운드(ERA ${f2(x.era)}) 모두 리그 평균보다 낮다.`,
    `리그 평균과 비교하면 ${eun(S)} 투타 모두 보완이 필요한 팀이다.`,
    `${S}의 타선과 마운드는 모두 리그 평균을 밑돈다.`,
  ]);
}), ["identity"]);

// ── 강도지수 (8) — 상대 수준을 보정한 지수, 1.00 = 리그 평균 ─────
rule("S2", "strength", 79, ["sbat", "ops"], (c) => c.either((s) => {
  const o = c.oth(s);
  if (!(c.win("ops") === s && c.win("sbat") === o)) return null;
  const S = c.name(s), O = c.name(o), v = f2(nm(c, "sbat", o));
  return c.pick("S2", [
    `OPS는 ${ga(S)} 앞서지만 상대 수준을 반영한 타선 강도지수는 ${ga(O)} 높다(${v}). 상대한 마운드 수준 차를 감안해야 한다.`,
    `원 기록(OPS)과 상대 보정 지수(타선 강도 ${v})가 가리키는 우세 팀이 다르다.`,
    `${S}의 OPS 우위는 상대 마운드 수준을 보정하면 사라진다. 타선 강도지수는 ${O} 쪽(${v})이 높다.`,
    `타선 강도지수로 보면 ${O} 타선이 더 강하다(${v}). OPS 우위인 ${gwa(S)} 반대다.`,
  ]);
}), ["strengthGap"]);
rule("S3", "strength", 66, ["sbat"], (c) => c.either((s) => {
  if (!(c.win("sbat") === s && c.lv("sbat") === 3)) return null;
  const S = c.name(s), a = f2(nm(c, "sbat", s)), b = f2(nm(c, "sbat", c.oth(s)));
  return c.pick("S3", [
    `타선 강도지수 ${a}:${b}, 상대 수준까지 감안하면 ${S} 타선이 확실히 강하다.`,
    `상대 마운드 수준을 보정해도 ${S} 타선의 우위가 크다(강도지수 ${a}:${b}).`,
    `${S}의 타선 강도지수(${a})가 상대(${b})보다 뚜렷하게 높다.`,
    `보정 지수로 본 타선 격차가 크다(${a}:${b}). 공격은 ${S} 쪽이다.`,
  ]);
}), ["strengthEdge"]);
rule("S4", "strength", 77, ["spit", "era"], (c) => c.either((s) => {
  const o = c.oth(s);
  if (!(c.win("era") === s && c.win("spit") === o)) return null;
  const S = c.name(s), O = c.name(o), v = f2(nm(c, "spit", o));
  return c.pick("S4", [
    `팀 ERA는 ${ga(S)} 좋지만 마운드 강도지수는 ${ga(O)} 높다(${v}). 상대한 타선 수준을 감안하면 ${O} 마운드가 기록보다 강할 수 있다.`,
    `원 기록(ERA)과 상대 보정 지수(마운드 강도 ${v})가 가리키는 우세 팀이 다르다.`,
    `${S}의 ERA 우위는 상대 타선 수준을 보정하면 사라진다. 마운드 강도지수는 ${O} 쪽(${v})이 높다.`,
    `마운드 강도지수로 보면 ${O} 마운드가 더 강하다(${v}). ERA 우위인 ${gwa(S)} 반대다.`,
  ]);
}), ["strengthGap"]);
rule("S5", "strength", 65, ["spit"], (c) => c.either((s) => {
  if (!(c.win("spit") === s && c.lv("spit") === 3)) return null;
  const S = c.name(s), a = f2(nm(c, "spit", s)), b = f2(nm(c, "spit", c.oth(s)));
  return c.pick("S5", [
    `마운드 강도지수 ${a}:${b}, 상대 타선 수준까지 감안해도 ${S} 마운드가 한 수 위다.`,
    `상대 타선 수준을 보정해도 ${S} 마운드의 우위가 크다(강도지수 ${a}:${b}).`,
    `${S}의 마운드 강도지수(${a})가 상대(${b})보다 뚜렷하게 높다.`,
    `보정 지수로 본 마운드 격차가 크다(${a}:${b}). 마운드는 ${S} 쪽이다.`,
  ]);
}), ["strengthEdge"]);
rule("S1", "strength", 63, ["sbat", "spit"], (c) => c.either((s) => {
  if (!(c.win("sbat") === s && c.win("spit") === s)) return null;
  const S = c.name(s);
  return c.pick("S1", [
    `상대 수준을 보정한 강도지수에서도 ${ga(S)} 타선·마운드 모두 앞선다.`,
    `타선 강도지수(${f2(nm(c, "sbat", s))})와 마운드 강도지수(${f2(nm(c, "spit", s))}) 모두 ${S} 우위다.`,
    `상대 수준을 감안해도 ${S}의 투타 우위가 유지된다.`,
    `보정 지수로 봐도 ${eun(S)} 공격과 마운드 양쪽에서 앞선다.`,
  ]);
}), ["strengthEdge"]);
rule("S6", "strength", 61, ["sbat", "spit"], (c) => {
  const b = c.win("sbat"), p = c.win("spit");
  if (!(b && p && b !== p)) return null;
  const Bt = c.name(b), Pt = c.name(p);
  return c.pick("S6", [
    `강도지수로 보면 타선은 ${Bt}, 마운드는 ${Pt} 쪽이 낫다.`,
    `상대 수준 보정 지수에서 공격은 ${Bt}, 마운드는 ${Pt} 우위다.`,
    `${eun(Bt)} 타선 강도지수, ${eun(Pt)} 마운드 강도지수에서 앞선다.`,
    `보정 지수로도 두 팀의 강점이 갈린다(타선 ${Bt} · 마운드 ${Pt}).`,
  ]);
}, ["splitEdge"]);
rule("S7", "strength", 57, ["sbat"], (c) => {
  if (!(c.has("sbat") && c.v("sbat", "a")! >= 1.1 && c.v("sbat", "b")! >= 1.1)) return null;
  const a = f2(nm(c, "sbat", "a")), b = f2(nm(c, "sbat", "b"));
  return c.pick("S7", [
    `두 팀 모두 타선 강도지수 1.10 이상(${a}·${b}), 리그 상위권 타선끼리의 대결이다.`,
    `상대 수준을 보정해도 두 타선 모두 리그 평균보다 10% 이상 강하다(${a}·${b}).`,
    `타선 강도지수 ${a}와 ${b}, 공격력이 강한 팀끼리 만났다.`,
    `양 팀 타선 모두 보정 지수상 상위권이다(${a}·${b}).`,
  ]);
}, ["batBoth"]);
rule("S8", "strength", 40, ["sbat", "spit"], (c) => {
  const xs = (["sbat", "spit"] as MetricKey[]).flatMap((k) => [c.v(k, "a"), c.v(k, "b")]);
  if (!xs.every((x) => x != null && Math.abs(x - 1) <= 0.05)) return null;
  return c.pick("S8", [
    "두 팀 모두 강도지수가 리그 평균(1.00) 근처인 비슷한 체급이다.",
    "타선·마운드 강도지수가 양 팀 모두 0.95~1.05 사이다.",
    "상대 수준을 보정한 지수로는 두 팀 모두 리그 평균 수준이다.",
    "강도지수상 두 팀은 리그 평균형 전력이다.",
  ]);
}, ["strengthEven"]);
