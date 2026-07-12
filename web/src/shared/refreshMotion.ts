// 수동 새로고침 때 다음 문서에서 한 번 재생할 모바일 모션을 임시 선택·소비한다.
const REFRESH_MOTION_KEY = "u18-refresh-motion";
const REFRESH_MOTIONS = [
  "launch-home-run.webm",
  "refresh-fast-pitch.webm",
  "refresh-scoreboard-flip.webm",
] as const;

type RefreshMotion = (typeof REFRESH_MOTIONS)[number];

export function selectRandomRefreshMotion() {
  const selected = REFRESH_MOTIONS[Math.floor(Math.random() * REFRESH_MOTIONS.length)];
  try {
    sessionStorage.setItem(REFRESH_MOTION_KEY, selected);
  } catch {
    /* 저장할 수 없으면 다음 실행에서 기본 홈런 아크를 사용한다. */
  }
}

export function consumeRefreshMotion(): RefreshMotion | null {
  try {
    const selected = sessionStorage.getItem(REFRESH_MOTION_KEY);
    sessionStorage.removeItem(REFRESH_MOTION_KEY);
    return REFRESH_MOTIONS.find((motion) => motion === selected) ?? null;
  } catch {
    return null;
  }
}
