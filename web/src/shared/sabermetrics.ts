// 세이버메트릭스 지표 (MLB 주요 지표) — 보유 데이터로 산출 가능한 항목.
import type { BattingStats, PitchingStats } from "./types";

// 이닝 표기(6.2 = 6과 2/3) → 실수 이닝
export function ipToInnings(ip: number): number {
  const whole = Math.floor(ip);
  const outs = Math.round((ip - whole) * 10);
  return whole + outs / 3;
}

export interface BattingAdvanced {
  ops: number; iso: number; babip: number; bbPct: number; kPct: number; bbK: number;
}
export function battingAdvanced(b: BattingStats): BattingAdvanced {
  const pa = b.pa || b.ab + b.bb + b.hbp;
  const babipDen = b.ab - b.so - b.hr; // 희생플라이 미보유 → 근사
  return {
    ops: b.obp + b.slg,
    iso: b.slg - b.avg, // 순수장타율
    babip: babipDen > 0 ? (b.h - b.hr) / babipDen : 0,
    bbPct: pa ? b.bb / pa : 0,
    kPct: pa ? b.so / pa : 0,
    bbK: b.so ? b.bb / b.so : b.bb,
  };
}

// FIP 상수(리그 평균 보정) — 아마추어 리그 상수 미공개라 MLB 관례값 근사.
const FIP_CONST = 3.1;
export interface PitchingAdvanced {
  k9: number; bb9: number; h9: number; kbb: number; whip: number; fip?: number;
}
export function pitchingAdvanced(p: PitchingStats): PitchingAdvanced {
  const ip = ipToInnings(p.ip);
  // FIP = (13·피홈런 + 3·볼넷 − 2·탈삼진)/이닝 + 상수 (피홈런 데이터 있을 때만)
  const fip =
    p.hr != null && ip ? (13 * p.hr + 3 * p.bb - 2 * p.so) / ip + FIP_CONST : undefined;
  return {
    k9: ip ? (p.so * 9) / ip : 0,
    bb9: ip ? (p.bb * 9) / ip : 0,
    h9: ip ? (p.h * 9) / ip : 0,
    kbb: p.bb ? p.so / p.bb : p.so,
    whip: p.whip,
    fip: fip != null ? Number(fip.toFixed(2)) : undefined,
  };
}

export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const dec1 = (v: number) => v.toFixed(1);
