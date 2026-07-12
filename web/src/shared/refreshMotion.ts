// 수동 새로고침 때 다음 문서에서 재생할 모바일 모션을 2→3→1 순으로 선택·소비한다.
const REFRESH_MOTION_KEY = "u18-refresh-motion";
const REFRESH_CYCLE_INDEX_KEY = "u18-refresh-motion-cycle-index";
const REFRESH_MOTIONS = [
  "refresh-scoreboard-flip.webm",
  "refresh-fast-pitch.webm",
  "launch-home-run.webm",
] as const;

type RefreshMotion = (typeof REFRESH_MOTIONS)[number];
const REFRESH_CYCLE = [REFRESH_MOTIONS[1], REFRESH_MOTIONS[2], REFRESH_MOTIONS[0]] as const;

export function selectNextRefreshMotion() {
  try {
    const savedIndex = Number(sessionStorage.getItem(REFRESH_CYCLE_INDEX_KEY));
    const index = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < REFRESH_CYCLE.length
      ? savedIndex
      : 0;
    const selected = REFRESH_CYCLE[index];
    sessionStorage.setItem(REFRESH_MOTION_KEY, selected);
    sessionStorage.setItem(REFRESH_CYCLE_INDEX_KEY, String((index + 1) % REFRESH_CYCLE.length));
  } catch {
    /* 저장할 수 없으면 다음 실행에서 기본 1번 모션을 사용한다. */
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
