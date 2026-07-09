// KBSA(korea-baseball.com) 외부 링크 URL 헬퍼 — 선수 상세/경기 기록 새 탭 이동용.
export const KBSA_BASE = "https://www.korea-baseball.com";

// 선수(P)/지도자(T) 상세 페이지
export const kbsaPlayerUrl = (personNo: string, gubun: "P" | "T" = "P") =>
  `${KBSA_BASE}/info/player/player_view?person_no=${personNo}&gubun=${gubun}`;

// 경기 박스스코어(기록) 페이지
export const kbsaBoxScoreUrl = (gameIdx: string) =>
  `${KBSA_BASE}/game/box_score?game_idx=${gameIdx}`;
