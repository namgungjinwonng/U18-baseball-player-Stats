// 포지션/학년 배지 색상 — u81-baseball(generate_html.py) 원본 팔레트 이식.
// 선수현황 팀 모달의 테이블 배지와 필터 버튼에서 공용.

// 포지션 색상 (배지 배경 / 필터 버튼 아웃라인)
export const POS_COLORS: Record<string, string> = {
  투수: "#C8102E", 포수: "#0C2340", 내야수: "#1A7A4C", 외야수: "#2E6E9E", 미지정: "#9AA0A6",
};
// 학년 색상
export const GRADE_COLORS: Record<string, string> = {
  "1": "#2D9CDB", "2": "#E0902B", "3": "#C03221", 미지정: "#9AA0A6",
};
