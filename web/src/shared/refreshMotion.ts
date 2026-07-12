// 수동 새로고침 때 다음 문서에서 한 번 재생할 모바일 모션을 임시 선택·소비한다.
const REFRESH_MOTION_KEY = "u18-refresh-motion";
const LAST_REFRESH_MOTION_KEY = "u18-last-refresh-motion";
const REFRESH_MOTIONS = [
  "launch-home-run.webm",
  "refresh-fast-pitch.webm",
  "refresh-scoreboard-flip.webm",
] as const;

type RefreshMotion = (typeof REFRESH_MOTIONS)[number];

export function selectRandomRefreshMotion() {
  try {
    const last = sessionStorage.getItem(LAST_REFRESH_MOTION_KEY);
    const candidates = REFRESH_MOTIONS.filter((motion) => motion !== last);
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    sessionStorage.setItem(REFRESH_MOTION_KEY, selected);
    sessionStorage.setItem(LAST_REFRESH_MOTION_KEY, selected);
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
