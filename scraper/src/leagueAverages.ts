// 리그 평균 산출 — 집계된 선수 stats 의 "리그 합산"으로부터 각 지표의 평균을 계산.
// 데이터 갱신(재집계) 때마다 다시 계산되어 data/{year}/averages.json 으로 기록된다.
// 프론트 세이버 용어 모달의 "전체/리그별/시합별 리그평균" 표시 + wRC+/WAR 기준값.
import type { LeagueRates, Player } from "./types.js";

const r3 = (n: number) => Number(n.toFixed(3));
const r2 = (n: number) => Number(n.toFixed(2));

const ipToOuts = (ip: number) => {
  const w = Math.floor(ip);
  return w * 3 + Math.round((ip - w) * 10);
};

// wOBA 가중치 (FanGraphs 관례값 고정 — 아마추어 리그 선형가중 미공개라 근사)
export const WOBA_WEIGHTS = { bb: 0.69, hbp: 0.72, b1: 0.89, b2: 1.27, b3: 1.62, hr: 2.1 };
export const FIP_CONST = 3.1;

export function computeLeagueRates(players: Player[]): LeagueRates {
  // 타격 합산
  let ab = 0, h = 0, b2 = 0, b3 = 0, hr = 0, bb = 0, hbp = 0, so = 0, r = 0, pa = 0, sf = 0;
  for (const p of players) {
    const b = p.batting;
    if (!b || !b.g) continue;
    ab += b.ab; h += b.h; b2 += b.b2; b3 += b.b3; hr += b.hr;
    bb += b.bb; hbp += b.hbp; so += b.so; r += b.r; sf += b.sf ?? 0;
    pa += b.pa || b.ab + b.bb + b.hbp;
  }
  const b1 = h - b2 - b3 - hr;
  const tb = b1 + 2 * b2 + 3 * b3 + 4 * hr;
  const obDen = ab + bb + hbp + sf;
  const wobaDen = ab + bb + hbp + sf;
  const W = WOBA_WEIGHTS;
  const avg = ab ? h / ab : 0;
  const obp = obDen ? (h + bb + hbp) / obDen : 0;
  const slg = ab ? tb / ab : 0;
  const babipDen = ab - so - hr + sf;

  // 투구 합산 (+ 피홈런은 공식기록 보유 선수 부분합으로 FIP 근사)
  let outs = 0, ph = 0, pr = 0, er = 0, pbb = 0, pso = 0;
  let fipOuts = 0, fipHr = 0, fipBb = 0, fipSo = 0;
  for (const p of players) {
    const t = p.pitching;
    if (!t || !t.g) continue;
    const o = ipToOuts(t.ip);
    outs += o; ph += t.h; pr += t.r; er += t.er; pbb += t.bb; pso += t.so;
    if (t.hr != null) { fipOuts += o; fipHr += t.hr; fipBb += t.bb; fipSo += t.so; }
  }
  const ip = outs / 3;
  const fipIp = fipOuts / 3;

  return {
    avg: r3(avg), obp: r3(obp), slg: r3(slg), ops: r3(obp + slg),
    iso: r3(slg - avg),
    babip: babipDen > 0 ? r3((h - hr) / babipDen) : 0,
    bbPct: pa ? r3(bb / pa) : 0,
    kPct: pa ? r3(so / pa) : 0,
    bbK: so ? r2(bb / so) : 0,
    woba: wobaDen
      ? r3((W.bb * bb + W.hbp * hbp + W.b1 * b1 + W.b2 * b2 + W.b3 * b3 + W.hr * hr) / wobaDen)
      : 0,
    rPerPa: pa ? Number((r / pa).toFixed(4)) : 0,
    era: outs ? r2((er * 27) / outs) : 0,
    whip: outs ? r2(((ph + pbb) * 3) / outs) : 0,
    fip: fipIp >= 50 ? r2((13 * fipHr + 3 * fipBb - 2 * fipSo) / fipIp + FIP_CONST) : undefined,
    k9: ip ? r2((pso * 9) / ip) : 0,
    bb9: ip ? r2((pbb * 9) / ip) : 0,
    h9: ip ? r2((ph * 9) / ip) : 0,
    kbb: pbb ? r2(pso / pbb) : 0,
    pa, outs,
  };
}
