// 홈 이동을 나타내는 야구 홈베이스(오각형) 아이콘 — 브랜드 로고(U18 BASEBALL) 옆에 부착.
// 앱의 다른 아이콘(⌕ ☰ ✕)처럼 currentColor 를 따르는 단색 아웃라인.
export function HomeIcon() {
  return (
    <svg
      className="home-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4h16v9l-8 8-8-8z" />
    </svg>
  );
}
