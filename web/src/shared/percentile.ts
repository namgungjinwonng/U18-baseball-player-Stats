// 선수 상세 요약 카드용 백분위·누적 추세 계산 순수 함수 (MLB Savant 방식 백분위).
import { battingAdvanced, pitchingAdvanced } from "./sabermetrics";
import type { BattingStats, GameLogEntry, LeagueRates, Player } from "./types";
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

export type GradeLetter = "A" | "B" | "C" | "D" | "E";
const LETTERS: GradeLetter[] = ["E", "D", "C", "B", "A"];

// 백분위(0~100, 높을수록 좋음) → A+ ~ E- 등급.
// 20점 구간마다 E·D·C·B·A, 구간 안을 셋으로 나눠 아래 1/3은 -, 위 1/3은 + 를 붙인다.
// 예: 98 → A+, 91 → A, 80 → A-, 79 → B+, 50 → C, 40 → C-, 0 → E-.
export function pctGrade(p: number): { grade: string; letter: GradeLetter } {
  const v = Math.max(0, Math.min(100, p));
  const band = Math.min(4, Math.floor(v / 20));
  const offset = v - band * 20; // 0 ~ 20 (100점은 A 구간의 20)
  const sign = offset >= 40 / 3 ? "+" : offset < 20 / 3 ? "-" : "";
  return { grade: `${LETTERS[band]}${sign}`, letter: LETTERS[band] };
}

// 백분위 → "상위 N%" 문구용 숫자 (최소 1).
export const topPercent = (p: number) => Math.max(1, Math.round(100 - p));

export interface TrendPoint {
  date: string;
  avg: number;
  ops: number;
  entry: GameLogEntry; // 그 경기 로그 (상대·한 줄 기록) — 지점 선택 시 표시
  games: number; // 그 경기까지 누적 경기 수
  ab: number; // 누적 타수
  h: number; // 누적 안타
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
  return window.map((g, i) => {
    const s = g.bStat!;
    ab += s.ab; h += s.h; b2 += s.b2; b3 += s.b3; hr += s.hr; bb += s.bb; hbp += s.hbp;
    const tb = h + b2 + 2 * b3 + 3 * hr;
    const obpDen = ab + bb + hbp;
    const avg = ab ? h / ab : 0;
    const obp = obpDen ? (h + bb + hbp) / obpDen : 0;
    const slg = ab ? tb / ab : 0;
    return { date: g.date, avg, ops: obp + slg, entry: g, games: i + 1, ab, h };
  });
}

// 공식 시즌 합계와 경기 로그(bStat) 합계의 차이. 추세는 경기 로그만 쌓기 때문에, 박스스코어 집계가
// 공식 기록과 다르면(2루타·홈런 누락 등) 마지막 누적값이 시즌 값과 달라진다. 희생플라이는 경기 로그에 없다.
export interface TrendGap {
  diffs: { label: string; log: number; official: number }[];
  sf: number; // 공식 희생플라이 — 경기 로그 출루율에는 반영되지 않는다
}
const GAP_KEYS: [keyof NonNullable<GameLogEntry["bStat"]> & keyof BattingStats, string][] = [
  ["ab", "타수"], ["h", "안타"], ["b2", "2루타"], ["b3", "3루타"], ["hr", "홈런"], ["bb", "볼넷"], ["hbp", "사구"],
];
export function trendGap(log: GameLogEntry[], season: BattingStats | undefined): TrendGap | null {
  if (!season) return null;
  const games = log.filter((g) => g.bStat);
  if (games.length === 0) return null;
  const diffs = GAP_KEYS.flatMap(([k, label]) => {
    const sum = games.reduce((acc, g) => acc + (g.bStat![k] ?? 0), 0);
    const official = season[k] ?? 0;
    return sum !== official ? [{ label, log: sum, official }] : [];
  });
  return { diffs, sf: season.sf ?? 0 };
}
