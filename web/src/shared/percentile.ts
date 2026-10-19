// 선수 상세 요약 카드용 백분위·누적 추세 계산 순수 함수 (MLB Savant 방식 백분위).
import { battingAdvanced, pitchingAdvanced } from "./sabermetrics";
import type { GameLogEntry, LeagueRates, Player } from "./types";
import { dec2, rate } from "./format";

export interface PctMetric {
  key: keyof LeagueRates;
  label: string;
  of: (p: Player) => number | undefined;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

export const BAT_METRICS: PctMetric[] = [
  { key: "avg", label: "타율", of: (p) => p.batting?.avg, format: rate },
  { key: "obp", label: "출루율", of: (p) => p.batting?.obp, format: rate },
  { key: "ops", label: "OPS", of: (p) => (p.batting ? p.batting.obp + p.batting.slg : undefined), format: rate },
  { key: "bbPct", label: "볼넷%", of: (p) => (p.batting ? battingAdvanced(p.batting).bbPct : undefined), format: pct1 },
  { key: "kPct", label: "삼진%", of: (p) => (p.batting ? battingAdvanced(p.batting).kPct : undefined), format: pct1, lowerIsBetter: true },
];

export const PIT_METRICS: PctMetric[] = [
  { key: "era", label: "ERA", of: (p) => p.pitching?.era, format: dec2, lowerIsBetter: true },
  { key: "whip", label: "WHIP", of: (p) => p.pitching?.whip, format: dec2, lowerIsBetter: true },
  { key: "k9", label: "K/9", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).k9 : undefined), format: (v) => v.toFixed(1) },
  { key: "bb9", label: "BB/9", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).bb9 : undefined), format: (v) => v.toFixed(1), lowerIsBetter: true },
  { key: "fip", label: "FIP", of: (p) => (p.pitching ? pitchingAdvanced(p.pitching).fip : undefined), format: dec2, lowerIsBetter: true },
];

// 비교 집단 안에서 v보다 나쁜 선수 비율(동률은 절반) → 0~100. 높을수록 좋다.
export function percentileRank(population: number[], v: number, lowerIsBetter = false): number | null {
  const values = population.filter((x) => Number.isFinite(x));
  if (values.length === 0 || !Number.isFinite(v)) return null;
  let worse = 0;
  let ties = 0;
  for (const x of values) {
    if (x === v) ties += 1;
    else if (lowerIsBetter ? x > v : x < v) worse += 1;
  }
  return Math.round(((worse + ties / 2) / values.length) * 100);
}

export interface TrendPoint {
  date: string;
  avg: number;
  ops: number;
}

// 경기 로그(bStat 보유 경기)를 날짜순으로 쌓아 경기별 누적 타율·OPS를 만든다. last 지정 시 최근 N경기만 누적.
export function cumulativeBatting(log: GameLogEntry[], last?: number): TrendPoint[] {
  const games = log
    .filter((g) => g.bStat)
    .map((g, i) => ({ g, i }))
    .sort((x, y) => x.g.date.localeCompare(y.g.date) || x.i - y.i)
    .map(({ g }) => g);
  const window = last ? games.slice(-last) : games;
  let ab = 0, h = 0, b2 = 0, b3 = 0, hr = 0, bb = 0, hbp = 0;
  return window.map((g) => {
    const s = g.bStat!;
    ab += s.ab; h += s.h; b2 += s.b2; b3 += s.b3; hr += s.hr; bb += s.bb; hbp += s.hbp;
    const tb = h + b2 + 2 * b3 + 3 * hr;
    const obpDen = ab + bb + hbp;
    const avg = ab ? h / ab : 0;
    const obp = obpDen ? (h + bb + hbp) / obpDen : 0;
    const slg = ab ? tb / ab : 0;
    return { date: g.date, avg, ops: obp + slg };
  });
}
