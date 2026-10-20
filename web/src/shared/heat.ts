// 기록 값을 리그 평균과 비교해 셀 배경색(파랑=좋음, 빨강=나쁨)으로 바꾸는 순수 함수.

// 리그 평균 대비 상대 차이가 이 비율에 이르면 색이 가장 진해진다 (예: 타율 .265 → .345).
const FULL_SCALE = 0.3;
const MAX_ALPHA = 0.34;

// 좋음(+1) ~ 나쁨(-1) 점수. 평균이 없거나 0이면 null(색 없음).
export function heatScore(value: number | undefined, average: number | undefined, lowerIsBetter = false): number | null {
  if (value == null || average == null || !Number.isFinite(value) || !(average > 0)) return null;
  const relative = (value / average - 1) / FULL_SCALE;
  const signed = lowerIsBetter ? -relative : relative;
  return Math.max(-1, Math.min(1, signed));
}

// 점수 → 반투명 배경색. 파랑 = 리그 평균보다 좋음, 빨강 = 나쁨 (사용자 지정).
export function heatColor(score: number | null | undefined): string | undefined {
  if (score == null || Math.abs(score) < 0.08) return undefined;
  const alpha = (Math.abs(score) * MAX_ALPHA).toFixed(3);
  return score > 0 ? `rgba(17, 81, 255, ${alpha})` : `rgba(211, 0, 5, ${alpha})`;
}

// 두 값의 우위 단계 — 차이 비율(|a−b| ÷ 큰 쪽 절댓값) 기준.
// 0 대등(3% 미만) · 1 근소 우위(10% 미만) · 2 우위(25% 미만) · 3 큰 우위.
export type EdgeLevel = 0 | 1 | 2 | 3;
export const EDGE_LABELS = ["대등", "근소 우위", "우위", "큰 우위"] as const;
export function edgeLevel(a: number, b: number): EdgeLevel {
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return 0;
  const diff = Math.abs(a - b) / base;
  return diff < 0.03 ? 0 : diff < 0.1 ? 1 : diff < 0.25 ? 2 : 3;
}

// 두 값 중 어느 쪽이 앞서는지와 우위 단계 — 비교 막대·우위 항목 수·경기 분석이 같은 기준을 쓴다.
export function compareEdge(
  a: number | null | undefined,
  b: number | null | undefined,
  lowerIsBetter = false
): { win: "a" | "b" | null; level: EdgeLevel } {
  if (a == null || b == null) return { win: null, level: 0 };
  const level = edgeLevel(a, b);
  if (level === 0) return { win: null, level };
  const aWins = lowerIsBetter ? a < b : a > b;
  return { win: aWins ? "a" : "b", level };
}
