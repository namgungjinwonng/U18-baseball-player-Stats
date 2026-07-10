// 홈 이동을 나타내는 집 아이콘 — 브랜드 로고와 드로어 '홈' 항목에서 공용.
// 앱의 다른 아이콘(⌕ ☰ ✕)은 텍스트 글리프지만 집 글리프(⌂)는 모바일 폰트 지원이 불안정해 SVG 로 그린다.
export function HomeIcon() {
  return (
    <svg
      className="home-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 9.5 12 2.5l9 7V21H3z" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}
