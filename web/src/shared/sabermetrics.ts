// 세이버메트릭스 지표 (MLB 주요 지표) — 보유 데이터로 산출 가능한 항목.
// wRC+/WAR 는 리그 평균(LeagueRates — 데이터 갱신 시점마다 재계산)이 있어야 계산된다.
import type { BattingStats, LeagueRates, PitchingStats } from "./types";

// 이닝 표기(6.2 = 6과 2/3) → 실수 이닝
export function ipToInnings(ip: number): number {
  const whole = Math.floor(ip);
  const outs = Math.round((ip - whole) * 10);
  return whole + outs / 3;
}

// wOBA 가중치 (FanGraphs 관례값 고정 — 아마추어 리그 선형가중 미공개라 근사)
// scraper/src/leagueAverages.ts 의 WOBA_WEIGHTS 와 동일하게 유지할 것.
const W = { bb: 0.69, hbp: 0.72, b1: 0.89, b2: 1.27, b3: 1.62, hr: 2.1 };
const WOBA_SCALE = 1.15; // wOBA → 득점 환산 계수(관례값)
const RUNS_PER_WIN = 10; // 10런 = 1승 (관례값)
const BAT_REPL_PER_600PA = 20; // 타자 대체수준: 600타석당 -20런
const PIT_REPL_PER_9IP = 0.6; // 투수 대체수준: 9이닝당 +0.6런

export function woba(b: BattingStats): number {
  const b1 = b.h - b.b2 - b.b3 - b.hr;
  const den = b.ab + b.bb + b.hbp + (b.sf ?? 0);
  if (!den) return 0;
  return (W.bb * b.bb + W.hbp * b.hbp + W.b1 * b1 + W.b2 * b.b2 + W.b3 * b.b3 + W.hr * b.hr) / den;
}

export interface BattingAdvanced {
  ops: number; iso: number; babip: number; bbPct: number; kPct: number; bbK: number;
  woba: number;
  wrcPlus?: number; // 리그 평균 대비 득점 생산력 (100 = 평균) — 리그 평균 필요
  war?: number;     // 대체선수 대비 승수(간이 계산) — 리그 평균 필요
}
export function battingAdvanced(b: BattingStats, lg?: LeagueRates | null): BattingAdvanced {
  const pa = b.pa || b.ab + b.bb + b.hbp;
  const babipDen = b.ab - b.so - b.hr; // 희생플라이 미보유 → 근사
  const wobaV = woba(b);
  let wrcPlus: number | undefined;
  let war: number | undefined;
  if (lg && lg.rPerPa > 0 && pa > 0) {
    // wRAA = (wOBA − 리그wOBA) ÷ wOBA스케일 × 타석
    const wraa = ((wobaV - lg.woba) / WOBA_SCALE) * pa;
    // wRC+ = ( wRAA/타석 + 리그득점/타석 ) ÷ (리그득점/타석) × 100
    wrcPlus = Math.round(((wraa / pa + lg.rPerPa) / lg.rPerPa) * 100);
    // WAR(타자) = ( wRAA + 대체수준 20런×타석/600 ) ÷ 10런
    war = Number(((wraa + (BAT_REPL_PER_600PA * pa) / 600) / RUNS_PER_WIN).toFixed(1));
  }
  return {
    ops: b.obp + b.slg,
    iso: b.slg - b.avg, // 순수장타율
    babip: babipDen > 0 ? (b.h - b.hr) / babipDen : 0,
    bbPct: pa ? b.bb / pa : 0,
    kPct: pa ? b.so / pa : 0,
    bbK: b.so ? b.bb / b.so : b.bb,
    woba: wobaV,
    wrcPlus,
    war,
  };
}

// FIP 상수(리그 평균 보정) — 아마추어 리그 상수 미공개라 MLB 관례값 근사.
const FIP_CONST = 3.1;
export interface PitchingAdvanced {
  k9: number; bb9: number; h9: number; kbb: number; whip: number; fip?: number;
  war?: number; // 대체선수 대비 승수(ERA 기반 간이 계산) — 리그 평균 필요
}
export function pitchingAdvanced(p: PitchingStats, lg?: LeagueRates | null): PitchingAdvanced {
  const ip = ipToInnings(p.ip);
  // FIP = (13·피홈런 + 3·볼넷 − 2·탈삼진)/이닝 + 상수 (피홈런 데이터 있을 때만)
  const fip =
    p.hr != null && ip ? (13 * p.hr + 3 * p.bb - 2 * p.so) / ip + FIP_CONST : undefined;
  let war: number | undefined;
  if (lg && ip > 0) {
    // WAR(투수) = ( (리그ERA − ERA) + 대체수준 0.6 ) × 이닝/9 ÷ 10런
    war = Number((((lg.era - p.era + PIT_REPL_PER_9IP) * (ip / 9)) / RUNS_PER_WIN).toFixed(1));
  }
  return {
    k9: ip ? (p.so * 9) / ip : 0,
    bb9: ip ? (p.bb * 9) / ip : 0,
    h9: ip ? (p.h * 9) / ip : 0,
    kbb: p.bb ? p.so / p.bb : p.so,
    whip: p.whip,
    fip: fip != null ? Number(fip.toFixed(2)) : undefined,
    war,
  };
}

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const dec1 = (v: number) => v.toFixed(1);
