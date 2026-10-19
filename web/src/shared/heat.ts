// 기록 값을 리그 평균과 비교해 셀 배경색(빨강=좋음, 파랑=나쁨)으로 바꾸는 순수 함수.

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

// 점수 → 반투명 배경색. Baseball Savant 관례(빨강 = 리그 평균보다 좋음)를 따른다.
export function heatColor(score: number | null | undefined): string | undefined {
  if (score == null || Math.abs(score) < 0.08) return undefined;
  const alpha = (Math.abs(score) * MAX_ALPHA).toFixed(3);
  return score > 0 ? `rgba(211, 0, 5, ${alpha})` : `rgba(17, 81, 255, ${alpha})`;
}
